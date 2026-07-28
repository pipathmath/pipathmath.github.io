# PiPath backend architecture

## Active stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Marketing/enrollment UI | Astro + React + TypeScript | Static content, client validation, lead-first form |
| Runtime | Cloudflare Pages + Pages Functions | Static hosting, authoritative request validation, Google/Stripe integration |
| Operations record | Private Google Sheet + Apps Script | Lead rows, payment status, staff follow-up, Stripe event idempotency |
| Payments | Stripe Payment Links + signed webhooks | Hosted payment collection, payment/refund truth, completed-payment cap |
| Tests | Vitest + TypeScript/Astro checks | Validation, URL construction, adapter behavior, compilation |

D1, onboarding tokens, Resend delivery ledgers, and an owner dashboard are deferred/reference infrastructure.

## Active repository map

- `src/components/sat/EnrollmentForm.tsx`: family intake and same-origin checkout request.
- `functions/api/checkout.ts`: validation, lead ID, Sheet write, Payment Link response.
- `functions/api/stripe-webhook.ts`: Stripe signature verification and payment/refund Sheet updates.
- `server/google-sheets.ts`: server-only Apps Script adapter.
- `server/config.ts`: allowed cohort, price/currency, Payment Link mapping, required config.
- `server/payment-link.ts`: `client_reference_id`, locked email, and UTM URL construction.
- `server/stripe.ts`: raw-body webhook signature verification.
- `server/http.ts` and `server/validation.ts`: request boundary and family-field validation.
- `integrations/google-apps-script/Code.gs`: Sheet schema, authorization, locking, writes, deduplication.
- `docs/google-sheets-setup.md`: owner-run installation/deployment procedure.

## Lead flow

1. Browser posts family fields, cohort, and bounded attribution to `/api/checkout`.
2. Function validates same origin, body, cohort, contacts, score, and lengths.
3. Function creates a UUID lead ID and sends the sanitized lead plus expected server-owned amount/currency to Apps Script.
4. Apps Script authenticates the shared secret, locks, validates headers, neutralizes formula prefixes, and appends `Leads`.
5. Only after success does the Function return the cohort Payment Link with UUID `client_reference_id` and locked parent email.

## Webhook flow

1. Stripe posts to `/api/stripe-webhook`.
2. Cloudflare verifies the raw body and `Stripe-Signature` using the endpoint secret.
3. Relevant Checkout events require PiPath's UUID-shaped lead reference.
4. Apps Script locks, rejects duplicate event IDs, finds the lead, and compares paid amount/currency with the saved expected values.
5. Apps Script updates the lead and appends `Stripe Events`. Failures cause Cloudflare to return an error for Stripe retry.

Supported events are completed, async success/failure, expired, and charge refunded.

## Sources of truth

- Stripe: payment, refund, dispute, receipt, and Payment Link cap facts.
- Google Sheet: operational lead and staff follow-up view.
- `Code.gs` headers: active Sheet schema.
- source modules: current runtime behavior.
- architecture decision: why the current tradeoff was chosen.
- implementation log: history, including inactive D1 work.

When sources disagree, do not guess or edit financial status to make the Sheet look correct. Reconcile Stripe IDs and webhook deliveries first.
