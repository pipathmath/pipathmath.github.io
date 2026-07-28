import {
  getEnrollmentCohort,
  getStripePaymentLinkUrl,
  missingCheckoutConfig,
} from "../../server/config";
import { createGoogleSheetLead } from "../../server/google-sheets";
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonBody,
} from "../../server/http";
import { buildPaymentLinkUrl } from "../../server/payment-link";
import type { Env } from "../../server/types";
import { parseCheckoutRequest } from "../../server/validation";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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
    const cohort = getEnrollmentCohort(input.cohortId);
    const paymentLinkUrl = getStripePaymentLinkUrl(env, input.cohortId);

    if (!cohort || cohort.status !== "enrolling" || !paymentLinkUrl) {
      throw new ApiError(
        409,
        "cohort_unavailable",
        "This cohort is not currently available for online enrollment.",
      );
    }

    const leadId = crypto.randomUUID();
    await createGoogleSheetLead(env, leadId, cohort, input);

    const checkoutUrl = buildPaymentLinkUrl(paymentLinkUrl, {
      attemptId: leadId,
      parentEmail: input.parentEmail,
      attribution: input.attribution,
    });

    return jsonResponse({ url: checkoutUrl });
  } catch (error) {
    return errorResponse(error);
  }
};
