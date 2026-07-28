import { ApiError } from "./http";
import type {
  Attribution,
  CheckoutRequest,
  EnrollmentCohortDefinition,
  Env,
} from "./types";

interface AppsScriptResponse {
  ok?: boolean;
  code?: string;
  result?: string;
}

interface PaymentUpdate {
  eventId: string;
  eventType: string;
  leadId?: string | null;
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
  paymentStatus: "processing" | "paid" | "failed" | "expired";
  amountCents?: number | null;
  currency?: string | null;
  paidAt?: string | null;
}

interface RefundUpdate {
  eventId: string;
  eventType: string;
  paymentIntentId: string;
  refundStatus: "partially_refunded" | "refunded";
  refundedAmountCents: number;
}

function appsScriptUrl(env: Env): string {
  let url: URL;

  try {
    url = new URL(env.GOOGLE_SHEETS_WEB_APP_URL);
  } catch {
    throw new ApiError(
      503,
      "lead_store_not_configured",
      "Online enrollment is temporarily unavailable. Please try again later.",
    );
  }

  if (url.protocol !== "https:" || url.hostname !== "script.google.com") {
    throw new ApiError(
      503,
      "lead_store_not_configured",
      "Online enrollment is temporarily unavailable. Please try again later.",
    );
  }

  return url.toString();
}

async function postToAppsScript(
  env: Env,
  payload: Record<string, unknown>,
): Promise<AppsScriptResponse> {
  const response = await fetch(appsScriptUrl(env), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...payload,
      secret: env.GOOGLE_SHEETS_SHARED_SECRET,
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new ApiError(
      502,
      "lead_store_unavailable",
      "We could not save the enrollment information. Please try again.",
    );
  }

  let result: AppsScriptResponse;
  try {
    result = (await response.json()) as AppsScriptResponse;
  } catch {
    throw new ApiError(
      502,
      "lead_store_invalid_response",
      "We could not save the enrollment information. Please try again.",
    );
  }

  if (result.ok !== true) {
    console.error("Google Sheets operation failed", result.code ?? "unknown");
    throw new ApiError(
      502,
      "lead_store_rejected",
      "We could not save the enrollment information. Please try again.",
    );
  }

  return result;
}

export async function createGoogleSheetLead(
  env: Env,
  leadId: string,
  cohort: EnrollmentCohortDefinition,
  input: CheckoutRequest,
): Promise<void> {
  const attribution: Attribution = input.attribution;

  await postToAppsScript(env, {
    action: "create_lead",
    lead: {
      createdAt: new Date().toISOString(),
      leadId,
      cohortId: cohort.id,
      cohortName: cohort.name,
      expectedAmountCents: cohort.priceCents,
      expectedCurrency: cohort.currency,
      parentName: input.parentName,
      studentName: input.studentName,
      parentEmail: input.parentEmail,
      parentPhone: input.parentPhone,
      studentMathScore: input.studentMathScore,
      additionalNotes: input.additionalNotes,
      gaClientId: attribution.gaClientId,
      utmSource: attribution.utmSource,
      utmMedium: attribution.utmMedium,
      utmCampaign: attribution.utmCampaign,
      utmContent: attribution.utmContent,
      utmTerm: attribution.utmTerm,
      gclid: attribution.gclid,
      landingPage: attribution.landingPage,
      referrer: attribution.referrer,
    },
  });
}

export async function updateGoogleSheetPayment(
  env: Env,
  update: PaymentUpdate,
): Promise<void> {
  await postToAppsScript(env, {
    action: "payment_update",
    payment: update,
  });
}

export async function updateGoogleSheetRefund(
  env: Env,
  update: RefundUpdate,
): Promise<void> {
  await postToAppsScript(env, {
    action: "refund_update",
    refund: update,
  });
}
