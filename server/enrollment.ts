import type Stripe from "stripe";
import {
  ONBOARDING_TOKEN_VALID_DAYS_AFTER_COHORT,
} from "./config";
import { findCheckoutAttempt, getCohort, markCheckoutAttempt } from "./db";
import { createOnboardingToken, sha256Hex } from "./security";
import type { CohortRow, Env } from "./types";

export interface FulfilledEnrollment {
  enrollmentId: string;
  parentEmail: string;
  parentName: string;
  parentPhone: string | null;
  cohort: CohortRow;
  onboardingToken: string;
  gaClientId: string | null;
  transactionId: string;
  paymentIntentId: string;
  amountCents: number;
  currency: string;
}

function stripeObjectId(
  value: string | { id: string } | null,
  fieldName: string,
): string {
  if (typeof value === "string") {
    return value;
  }

  if (value?.id) {
    return value.id;
  }

  throw new Error(`stripe_${fieldName}_missing`);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function paidAtFromSession(session: Stripe.Checkout.Session): string {
  return new Date(session.created * 1_000).toISOString();
}

function tokenExpiration(cohort: CohortRow): string {
  const expiresAt = new Date(cohort.ends_at);
  expiresAt.setUTCDate(
    expiresAt.getUTCDate() + ONBOARDING_TOKEN_VALID_DAYS_AFTER_COHORT,
  );
  return expiresAt.toISOString();
}

export async function beginStripeEvent(
  env: Env,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO stripe_events (event_id, event_type, status)
     VALUES (?, ?, 'processing')`,
  )
    .bind(eventId, eventType)
    .run();

  const existing = await env.DB.prepare(
    `SELECT status FROM stripe_events WHERE event_id = ?`,
  )
    .bind(eventId)
    .first<{ status: "processing" | "processed" | "failed" }>();

  if (existing?.status === "processed") {
    return false;
  }

  await env.DB.prepare(
    `UPDATE stripe_events
     SET status = 'processing',
         error_code = NULL
     WHERE event_id = ?`,
  )
    .bind(eventId)
    .run();

  return true;
}

export async function completeStripeEvent(env: Env, eventId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE stripe_events
     SET status = 'processed',
         error_code = NULL,
         processed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE event_id = ?`,
  )
    .bind(eventId)
    .run();
}

export async function failStripeEvent(
  env: Env,
  eventId: string,
  errorCode: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE stripe_events
     SET status = 'failed',
         error_code = ?
     WHERE event_id = ?`,
  )
    .bind(errorCode.slice(0, 120), eventId)
    .run();
}

export async function recordAudit(
  env: Env,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> | null = null,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_events (id, action, entity_type, entity_id, metadata_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      action,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null,
    )
    .run();
}

export async function fulfillPaidCheckout(
  env: Env,
  session: Stripe.Checkout.Session,
): Promise<FulfilledEnrollment> {
  if (session.payment_status !== "paid") {
    throw new Error("stripe_session_not_paid");
  }

  const attemptId =
    session.metadata?.registration_id ?? session.client_reference_id;
  const cohortId = session.metadata?.cohort_id;

  if (!attemptId || !cohortId) {
    throw new Error("stripe_session_metadata_missing");
  }

  const [attempt, cohort] = await Promise.all([
    findCheckoutAttempt(env, attemptId),
    getCohort(env, cohortId),
  ]);

  if (!attempt || attempt.cohort_id !== cohortId || !cohort) {
    throw new Error("stripe_session_reference_invalid");
  }

  if (
    attempt.stripe_checkout_session_id &&
    attempt.stripe_checkout_session_id !== session.id
  ) {
    throw new Error("stripe_session_attempt_mismatch");
  }

  const amountCents = session.amount_total;
  const currency = session.currency?.toLowerCase();

  if (
    amountCents === null ||
    amountCents !== cohort.price_cents ||
    currency !== cohort.currency.toLowerCase()
  ) {
    throw new Error("stripe_session_amount_mismatch");
  }

  const parentEmail = normalizeEmail(session.customer_details?.email ?? "");
  const parentName = session.customer_details?.name?.trim() ?? "";
  const parentPhone = session.customer_details?.phone?.trim() || null;

  if (!parentEmail || !parentName) {
    throw new Error("stripe_customer_details_missing");
  }

  const stripeCustomerId = stripeObjectId(session.customer, "customer");
  const paymentIntentId = stripeObjectId(
    session.payment_intent as string | Stripe.PaymentIntent | null,
    "payment_intent",
  );

  const parentCandidateId = crypto.randomUUID();
  const parent = await env.DB.prepare(
    `INSERT INTO parents (
       id, email, full_name, phone, stripe_customer_id
     ) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       full_name = excluded.full_name,
       phone = excluded.phone,
       stripe_customer_id = excluded.stripe_customer_id,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     RETURNING id`,
  )
    .bind(
      parentCandidateId,
      parentEmail,
      parentName,
      parentPhone,
      stripeCustomerId,
    )
    .first<{ id: string }>();

  if (!parent?.id) {
    throw new Error("parent_upsert_failed");
  }

  const enrollmentCandidateId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO enrollments (
       id,
       cohort_id,
       parent_id,
       checkout_attempt_id,
       stripe_checkout_session_id,
       status,
       paid_at
     ) VALUES (?, ?, ?, ?, ?, 'paid', ?)`,
  )
    .bind(
      enrollmentCandidateId,
      cohort.id,
      parent.id,
      attemptId,
      session.id,
      paidAtFromSession(session),
    )
    .run();

  const enrollment = await env.DB.prepare(
    `SELECT id
     FROM enrollments
     WHERE stripe_checkout_session_id = ?`,
  )
    .bind(session.id)
    .first<{ id: string }>();

  if (!enrollment?.id) {
    throw new Error("enrollment_upsert_failed");
  }

  const onboardingToken = await createOnboardingToken(env, enrollment.id);
  const onboardingTokenHash = await sha256Hex(onboardingToken);
  const paymentCandidateId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE checkout_attempts
       SET status = 'completed',
           stripe_checkout_session_id = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    ).bind(session.id, attemptId),
    env.DB.prepare(
      `INSERT INTO payments (
         id,
         enrollment_id,
         stripe_payment_intent_id,
         amount_cents,
         currency,
         status
       ) VALUES (?, ?, ?, ?, ?, 'paid')
       ON CONFLICT(stripe_payment_intent_id) DO UPDATE SET
         amount_cents = excluded.amount_cents,
         currency = excluded.currency,
         status = 'paid',
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).bind(
      paymentCandidateId,
      enrollment.id,
      paymentIntentId,
      amountCents,
      currency,
    ),
    env.DB.prepare(
      `INSERT INTO access_tokens (
         id,
         enrollment_id,
         purpose,
         token_hash,
         expires_at
       ) VALUES (?, ?, 'onboarding', ?, ?)
       ON CONFLICT(enrollment_id, purpose) DO UPDATE SET
         token_hash = excluded.token_hash,
         expires_at = excluded.expires_at,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).bind(
      crypto.randomUUID(),
      enrollment.id,
      onboardingTokenHash,
      tokenExpiration(cohort),
    ),
    env.DB.prepare(
      `INSERT INTO audit_events (
         id, action, entity_type, entity_id, metadata_json
       ) VALUES (?, 'enrollment_paid', 'enrollment', ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      enrollment.id,
      JSON.stringify({
        cohortId: cohort.id,
        stripeCheckoutSessionId: session.id,
      }),
    ),
  ]);

  return {
    enrollmentId: enrollment.id,
    parentEmail,
    parentName,
    parentPhone,
    cohort,
    onboardingToken,
    gaClientId: attempt.ga_client_id,
    transactionId: session.id,
    paymentIntentId,
    amountCents,
    currency,
  };
}

export async function expireCheckoutAttemptFromSession(
  env: Env,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const attemptId =
    session.metadata?.registration_id ?? session.client_reference_id;

  if (attemptId) {
    await markCheckoutAttempt(env, attemptId, "expired");
  }
}

export async function failCheckoutAttemptFromPaymentIntent(
  env: Env,
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const attemptId = paymentIntent.metadata.registration_id;

  if (attemptId) {
    await markCheckoutAttempt(env, attemptId, "failed");
  }
}

export async function recordRefund(
  env: Env,
  charge: Stripe.Charge,
): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    throw new Error("refund_payment_intent_missing");
  }

  const payment = await env.DB.prepare(
    `SELECT p.enrollment_id, p.amount_cents
     FROM payments p
     WHERE p.stripe_payment_intent_id = ?`,
  )
    .bind(paymentIntentId)
    .first<{ enrollment_id: string; amount_cents: number }>();

  if (!payment) {
    throw new Error("refund_payment_not_found");
  }

  const fullyRefunded = charge.amount_refunded >= payment.amount_cents;
  const paymentStatus = fullyRefunded ? "refunded" : "partially_refunded";

  const statements = [
    env.DB.prepare(
      `UPDATE payments
       SET status = ?,
           refunded_cents = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE stripe_payment_intent_id = ?`,
    ).bind(paymentStatus, charge.amount_refunded, paymentIntentId),
    env.DB.prepare(
      `INSERT INTO audit_events (
         id, action, entity_type, entity_id, metadata_json
       ) VALUES (?, ?, 'enrollment', ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      fullyRefunded ? "enrollment_refunded" : "payment_partially_refunded",
      payment.enrollment_id,
      JSON.stringify({ refundedCents: charge.amount_refunded }),
    ),
  ];

  if (fullyRefunded) {
    statements.push(
      env.DB.prepare(
        `UPDATE enrollments
         SET status = 'refunded',
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`,
      ).bind(payment.enrollment_id),
    );
  }

  await env.DB.batch(statements);
}
