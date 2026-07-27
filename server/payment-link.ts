import type { Attribution } from "./types";

export function buildPaymentLinkUrl(
  paymentLinkUrl: string,
  input: {
    attemptId: string;
    parentEmail: string;
    attribution: Attribution;
  },
): string {
  const url = new URL(paymentLinkUrl);

  if (url.protocol !== "https:") {
    throw new Error("stripe_payment_link_must_use_https");
  }

  url.searchParams.set("client_reference_id", input.attemptId);
  url.searchParams.set("locked_prefilled_email", input.parentEmail);

  const trackingParameters: Array<[string, string | null]> = [
    ["utm_source", input.attribution.utmSource],
    ["utm_medium", input.attribution.utmMedium],
    ["utm_campaign", input.attribution.utmCampaign],
    ["utm_content", input.attribution.utmContent],
    ["utm_term", input.attribution.utmTerm],
  ];

  for (const [key, value] of trackingParameters) {
    if (value) url.searchParams.set(key, value);
  }

  return url.toString();
}
