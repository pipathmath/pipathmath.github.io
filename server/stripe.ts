import Stripe from "stripe";
import type { Env } from "./types";

export async function constructStripeEvent(
  env: Env,
  rawBody: string,
  signature: string,
): Promise<Stripe.Event> {
  return Stripe.webhooks.constructEventAsync(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}
