import { recordAudit } from "./enrollment";
import type { FulfilledEnrollment } from "./enrollment";
import type { Env } from "./types";

export async function sendGa4Purchase(
  env: Env,
  enrollment: FulfilledEnrollment,
): Promise<boolean> {
  const measurementId = env.GA4_MEASUREMENT_ID?.trim();
  const apiSecret = env.GA4_API_SECRET?.trim();
  const clientId = enrollment.gaClientId?.trim();

  if (!measurementId || !apiSecret || !clientId) {
    await recordAudit(
      env,
      "purchase_analytics_skipped",
      "enrollment",
      enrollment.enrollmentId,
      {
        hasMeasurementId: Boolean(measurementId),
        hasApiSecret: Boolean(apiSecret),
        hasClientId: Boolean(clientId),
      },
    );
    return false;
  }

  const endpoint = new URL("https://www.google-analytics.com/mp/collect");
  endpoint.searchParams.set("measurement_id", measurementId);
  endpoint.searchParams.set("api_secret", apiSecret);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: enrollment.transactionId,
            value: enrollment.amountCents / 100,
            currency: enrollment.currency.toUpperCase(),
            cohort_id: enrollment.cohort.id,
            items: [
              {
                item_id: enrollment.cohort.id,
                item_name: enrollment.cohort.name,
                price: enrollment.amountCents / 100,
                quantity: 1,
              },
            ],
            engagement_time_msec: 1,
          },
        },
      ],
    }),
  });

  await recordAudit(
    env,
    response.ok ? "purchase_analytics_sent" : "purchase_analytics_failed",
    "enrollment",
    enrollment.enrollmentId,
    { status: response.status },
  );

  return response.ok;
}
