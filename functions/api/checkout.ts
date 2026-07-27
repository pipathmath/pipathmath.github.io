import {
  CHECKOUT_HOLD_SECONDS,
  getStripePriceId,
  missingCheckoutConfig,
} from "../../server/config";
import {
  assertCheckoutRateLimit,
  getCohort,
  markCheckoutAttempt,
  markCheckoutCreated,
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
import {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
} from "../../server/stripe";
import type { Env } from "../../server/types";
import { parseCheckoutRequest } from "../../server/validation";
import type Stripe from "stripe";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let attemptId: string | null = null;
  let stripeSession: Stripe.Checkout.Session | null = null;

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
    const priceId = getStripePriceId(env, input.cohortId);

    if (!cohort || cohort.status !== "enrolling" || !priceId) {
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

    stripeSession = await createStripeCheckoutSession(request, env, {
      attemptId,
      cohort,
      priceId,
      expiresAt,
      parentEmail: input.parentEmail,
    });

    if (!stripeSession.url) {
      throw new Error("stripe_checkout_url_missing");
    }

    await markCheckoutCreated(env, attemptId, stripeSession.id);

    return jsonResponse({ url: stripeSession.url });
  } catch (error) {
    if (stripeSession) {
      try {
        await expireStripeCheckoutSession(env, stripeSession.id);
      } catch (expirationError) {
        console.error(
          "Could not expire orphaned Stripe session",
          expirationError instanceof Error ? expirationError.message : "unknown",
        );
      }
    }

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
