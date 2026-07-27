import {
  CHECKOUT_HOLD_SECONDS,
  getStripePaymentLinkUrl,
  missingCheckoutConfig,
} from "../../server/config";
import {
  assertCheckoutRateLimit,
  getCohort,
  markCheckoutAttempt,
  reserveSeat,
} from "../../server/db";
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonBody,
} from "../../server/http";
import { createRequestFingerprint } from "../../server/security";
import { buildPaymentLinkUrl } from "../../server/payment-link";
import type { Env } from "../../server/types";
import { parseCheckoutRequest } from "../../server/validation";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let attemptId: string | null = null;

  try {
    assertSameOrigin(request);

    const missingConfig = missingCheckoutConfig(env);
    if (missingConfig.length > 0) {
      console.error("Checkout configuration missing", missingConfig.join(","));
      throw new ApiError(
        503,
        "enrollment_not_configured",
        "Online enrollment is being configured. Please try again later.",
      );
    }

    const input = parseCheckoutRequest(await readJsonBody(request));
    const cohort = await getCohort(env, input.cohortId);
    const paymentLinkUrl = getStripePaymentLinkUrl(env, input.cohortId);

    if (!cohort || cohort.status !== "enrolling" || !paymentLinkUrl) {
      throw new ApiError(
        409,
        "cohort_unavailable",
        "This cohort is not currently available for online enrollment.",
      );
    }

    const requestFingerprint = await createRequestFingerprint(request, env);
    await assertCheckoutRateLimit(env, requestFingerprint);

    attemptId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1_000) + CHECKOUT_HOLD_SECONDS;

    await reserveSeat(env, {
      attemptId,
      cohortId: cohort.id,
      reservationExpiresAt: expiresAt,
      requestFingerprint,
      parentName: input.parentName,
      parentEmail: input.parentEmail,
      parentPhone: input.parentPhone,
      studentName: input.studentName,
      studentMathScore: input.studentMathScore,
      additionalNotes: input.additionalNotes,
      attribution: input.attribution,
    });

    const checkoutUrl = buildPaymentLinkUrl(paymentLinkUrl, {
      attemptId,
      parentEmail: input.parentEmail,
      attribution: input.attribution,
    });

    await markCheckoutAttempt(env, attemptId, "checkout_created");

    return jsonResponse({ url: checkoutUrl });
  } catch (error) {
    if (attemptId) {
      try {
        await markCheckoutAttempt(env, attemptId, "failed");
      } catch (databaseError) {
        console.error(
          "Could not release failed checkout hold",
          databaseError instanceof Error ? databaseError.message : "unknown",
        );
      }
    }

    return errorResponse(error);
  }
};
