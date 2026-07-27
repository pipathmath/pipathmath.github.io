import Stripe from "stripe";
import { getSiteOrigin } from "./config";
import type { CohortRow, Env } from "./types";

export function getStripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function createStripeCheckoutSession(
  request: Request,
  env: Env,
  input: {
    attemptId: string;
    cohort: CohortRow;
    priceId: string;
    expiresAt: number;
    parentEmail: string;
  },
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient(env);
  const siteOrigin = getSiteOrigin(request, env);
  const metadata = {
    registration_id: input.attemptId,
    cohort_id: input.cohort.id,
  };

  return stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: input.attemptId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    payment_method_types: ["card"],
    customer_creation: "always",
    customer_email: input.parentEmail,
    billing_address_collection: "auto",
    submit_type: "book",
    custom_text: {
      submit: {
        message: "Your family information is saved. Complete payment to reserve the student's place.",
      },
    },
    metadata,
    payment_intent_data: {
      description: input.cohort.name,
      metadata,
    },
    expires_at: input.expiresAt,
    success_url:
      `${siteOrigin}/sat-math-bootcamp/enrollment-confirmed?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteOrigin}/sat-math-bootcamp?checkout=cancelled#enrollment`,
  });
}

export async function expireStripeCheckoutSession(
  env: Env,
  sessionId: string,
): Promise<void> {
  const stripe = getStripeClient(env);
  await stripe.checkout.sessions.expire(sessionId);
}

export async function constructStripeEvent(
  env: Env,
  rawBody: string,
  signature: string,
): Promise<Stripe.Event> {
  const stripe = getStripeClient(env);
  return stripe.webhooks.constructEventAsync(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}
