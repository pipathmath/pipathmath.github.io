# PiPath backend architecture

## Stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Marketing UI | Astro + React + TypeScript | Static content, enrollment controls, confirmation/onboarding interaction |
| Runtime | Cloudflare Pages + Pages Functions | Serves static pages and `/api/*` server endpoints |
| Database | Cloudflare D1 / local Wrangler SQLite | Cohorts, holds, enrollments, payments, onboarding, delivery ledgers, audits |
| Payments | Stripe Checkout + signed webhooks | Customer/payment collection and payment/refund source events |
| Email | Resend HTTP API | Parent confirmation and owner notification |
| Analytics | GA4 browser events + Measurement Protocol | Checkout intent and verified purchase measurement |
| Tests | Vitest + TypeScript/Astro checks | Validation, security helpers, schema/capacity behavior, compilation |

Only `/api/*` invokes Pages Functions; `public/_routes.json` keeps marketing routes static.

## Repository map

- `functions/api/checkout.ts`: creates a capacity hold and Stripe Checkout Session.
- `functions/api/stripe-webhook.ts`: verifies and processes Stripe events.
- `functions/api/enrollment-status.ts`: returns minimal confirmation/onboarding state by Session ID or secure token.
- `functions/api/onboarding.ts`: validates and stores the student's academic profile.
- `server/config.ts`: cohort constants, holds/rate limits, and required configuration checks.
- `server/db.ts`: cohort lookup, rate limit, atomic capacity reservation, and checkout-attempt updates.
- `server/enrollment.ts`: Stripe event ledger, paid fulfillment, refunds, and audits.
- `server/onboarding.ts`: token lookup, masked status, student create/update, and enrollment activation.
- `server/security.ts`: HMAC token/fingerprint generation, hashing, and email masking.
- `server/stripe.ts`: Stripe client, Checkout Session, expiration, and signature verification.
- `server/email.ts`: Resend adapter and idempotent delivery ledger.
- `server/analytics.ts`: verified server-side GA4 purchase event and audit records.
- `server/http.ts` and `server/validation.ts`: same-origin, JSON, size, enum, and field validation.
- `migrations/`: ordered D1 schema changes and seeds.
- `tests/`: pure/unit schema and safety tests.

## Checkout flow

1. React sends `POST /api/checkout` with the cohort ID and bounded attribution fields.
2. The Function requires same origin and complete checkout configuration.
3. D1 confirms the cohort is `enrolling`; the server maps the cohort to its Stripe Price ID.
4. D1 rate-limits the HMAC request fingerprint to three attempts in 15 minutes.
5. One conditional `INSERT` creates a 30-minute hold only when paid/active seats plus live holds are below capacity.
6. Stripe creates a one-time payment Session with parent name, email, phone, server-selected Price, cohort metadata, and the checkout-attempt ID.
7. D1 changes the attempt from `held` to `checkout_created`; the browser receives only the Stripe URL.
8. If Stripe creation fails, the Function expires any orphan Session and marks the hold `failed`.

An attempt or redirect is not an enrollment. Only a verified paid webhook creates one.

## Paid webhook flow

1. Stripe sends an event to `POST /api/stripe-webhook`.
2. The Function reads the raw body and verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET`.
3. `stripe_events.event_id` provides event-level idempotency; a processed event returns successfully without repeating work.
4. For a paid `checkout.session.completed`, fulfillment rechecks attempt/cohort references, Session ID, amount, and currency.
5. The parent is inserted or updated by normalized email.
6. The enrollment is inserted once using unique checkout-attempt and Checkout Session IDs.
7. The payment is inserted/updated once using the unique Payment Intent ID.
8. The checkout attempt becomes `completed`; a hashed onboarding token and `enrollment_paid` audit event are created.
9. Parent and owner emails are attempted through their delivery ledger.
10. GA4 purchase is attempted only after verified fulfillment and never blocks enrollment.
11. The Stripe event becomes `processed`; processing failures become `failed` with a short error code for retry/debugging.

## Confirmation and onboarding flow

1. Stripe redirects to the confirmation route with `{CHECKOUT_SESSION_ID}`.
2. The page polls `GET /api/enrollment-status?session_id=...` while the webhook is processing.
3. Status returns only cohort dates/name, a masked parent email, onboarding completion, and the secure onboarding token.
4. A parent may return later using the emailed `?token=...` link.
5. `POST /api/onboarding` hashes the supplied token, checks expiration and enrollment status, validates student fields, creates or updates the student, and changes enrollment `paid -> active`.
6. The operation records `student_onboarding_completed` in `audit_events`.

Plaintext onboarding tokens are generated when needed but only their SHA-256 hashes are stored. Token validity extends 120 days after the cohort end date.

## Other event transitions

- `checkout.session.expired`: checkout attempt becomes `expired`.
- `payment_intent.payment_failed`: matching checkout attempt becomes `failed`.
- `charge.refunded`: payment becomes `partially_refunded` or `refunded`; a full refund also changes enrollment to `refunded`.
- Missing email configuration: delivery becomes `failed`, an audit is recorded, and the paid enrollment remains valid.
- Missing GA4 secret/client ID: analytics is skipped and audited without changing enrollment.

## Sources of truth

- Stripe: payment authorization, charge, receipt, and refund facts.
- D1: PiPath cohort capacity and operational enrollment/onboarding state.
- Migrations: database structure.
- Source modules: current business behavior.
- `docs/implementation-log.md`: decision/history record, not a substitute for current code.

When sources disagree, do not guess. Reconcile Stripe and D1 identifiers, inspect the webhook ledger, and report the discrepancy before mutating data.
