import type Stripe from "stripe";
import { sendGa4Purchase } from "../../server/analytics";
import { missingWebhookConfig } from "../../server/config";
import { sendEnrollmentEmails } from "../../server/email";
import {
  beginStripeEvent,
  completeStripeEvent,
  expireCheckoutAttemptFromSession,
  failCheckoutAttemptFromPaymentIntent,
  failStripeEvent,
  fulfillPaidCheckout,
  recordRefund,
} from "../../server/enrollment";
import { jsonResponse } from "../../server/http";
import { constructStripeEvent } from "../../server/stripe";
import type { Env } from "../../server/types";

function errorCode(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 120);
  }

  return "webhook_processing_failed";
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const missingConfig = missingWebhookConfig(env);
  if (missingConfig.length > 0) {
    console.error("Webhook configuration missing", missingConfig.join(","));
    return jsonResponse(
      { error: "webhook_not_configured" },
      503,
    );
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

  const shouldProcess = await beginStripeEvent(env, event.id, event.type);
  if (!shouldProcess) {
    return jsonResponse({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          const enrollment = await fulfillPaidCheckout(env, session);
          await sendEnrollmentEmails(env, enrollment);

          try {
            await sendGa4Purchase(env, enrollment);
          } catch (analyticsError) {
            console.error(
              "Purchase analytics failed",
              analyticsError instanceof Error ? analyticsError.message : "unknown",
            );
          }
        }
        break;
      }
      case "checkout.session.expired":
        await expireCheckoutAttemptFromSession(
          env,
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "payment_intent.payment_failed":
        await failCheckoutAttemptFromPaymentIntent(
          env,
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "charge.refunded":
        await recordRefund(env, event.data.object as Stripe.Charge);
        break;
      default:
        break;
    }

    await completeStripeEvent(env, event.id);
    return jsonResponse({ received: true });
  } catch (error) {
    const code = errorCode(error);
    await failStripeEvent(env, event.id, code);
    console.error("Stripe webhook processing failed", event.type, code);
    return jsonResponse({ error: "webhook_processing_failed" }, 500);
  }
};
