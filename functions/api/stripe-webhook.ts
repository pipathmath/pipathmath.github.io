import type Stripe from "stripe";
import { missingWebhookConfig } from "../../server/config";
import {
  updateGoogleSheetPayment,
  updateGoogleSheetRefund,
} from "../../server/google-sheets";
import { ApiError, jsonResponse } from "../../server/http";
import { constructStripeEvent } from "../../server/stripe";
import type { Env } from "../../server/types";

function stripeId(value: string | { id: string } | null): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function eventTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1_000).toISOString();
}

function isPiPathLeadId(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        value,
      ),
  );
}

async function recordCheckoutSession(
  env: Env,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  paymentStatus: "processing" | "paid" | "failed" | "expired",
): Promise<boolean> {
  if (!isPiPathLeadId(session.client_reference_id)) {
    return false;
  }

  await updateGoogleSheetPayment(env, {
    eventId: event.id,
    eventType: event.type,
    leadId: session.client_reference_id,
    paymentIntentId: stripeId(
      session.payment_intent as string | Stripe.PaymentIntent | null,
    ),
    checkoutSessionId: session.id,
    paymentStatus,
    amountCents: session.amount_total,
    currency: session.currency?.toLowerCase() ?? null,
    paidAt: paymentStatus === "paid" ? eventTime(event.created) : null,
  });

  return true;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const missingConfig = missingWebhookConfig(env);
  if (missingConfig.length > 0) {
    console.error("Webhook configuration missing", missingConfig.join(","));
    return jsonResponse({ error: "webhook_not_configured" }, 503);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse({ error: "missing_stripe_signature" }, 400);
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = await constructStripeEvent(env, rawBody, signature);
  } catch {
    return jsonResponse({ error: "invalid_stripe_signature" }, 400);
  }

  try {
    let handled = false;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        handled = await recordCheckoutSession(
          env,
          event,
          session,
          session.payment_status === "paid" ? "paid" : "processing",
        );
        break;
      }
      case "checkout.session.async_payment_succeeded":
        handled = await recordCheckoutSession(
          env,
          event,
          event.data.object as Stripe.Checkout.Session,
          "paid",
        );
        break;
      case "checkout.session.async_payment_failed":
        handled = await recordCheckoutSession(
          env,
          event,
          event.data.object as Stripe.Checkout.Session,
          "failed",
        );
        break;
      case "checkout.session.expired":
        handled = await recordCheckoutSession(
          env,
          event,
          event.data.object as Stripe.Checkout.Session,
          "expired",
        );
        break;
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = stripeId(
          charge.payment_intent as string | Stripe.PaymentIntent | null,
        );

        if (paymentIntentId) {
          await updateGoogleSheetRefund(env, {
            eventId: event.id,
            eventType: event.type,
            paymentIntentId,
            refundStatus:
              charge.amount_refunded >= charge.amount
                ? "refunded"
                : "partially_refunded",
            refundedAmountCents: charge.amount_refunded,
          });
          handled = true;
        }
        break;
      }
      default:
        break;
    }

    return jsonResponse({ received: true, handled });
  } catch (error) {
    const code =
      error instanceof ApiError
        ? error.code
        : error instanceof Error
          ? error.message.replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 120)
          : "webhook_processing_failed";
    console.error("Stripe webhook processing failed", event.type, code);
    return jsonResponse({ error: "webhook_processing_failed" }, 500);
  }
};
