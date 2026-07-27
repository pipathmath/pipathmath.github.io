# Enrollment backend: how it works

## The important distinction

PiPath does not have one permanent Stripe payment link in the page source. The browser asks the PiPath backend to create a new, short-lived Stripe Checkout Session for the selected cohort. Stripe returns a unique hosted checkout URL, and the browser redirects the parent there.

This is preferable to a pasted link because PiPath can check cohort status, rate limits, price configuration, and remaining capacity before a payment session exists.

## End-to-end flow

1. The `EnrollmentButton` sends the cohort ID and optional marketing attribution to `POST /api/checkout`.
2. The endpoint rejects cross-origin requests, invalid JSON, missing configuration, unknown cohorts, closed cohorts, and rate-limited clients.
3. A single conditional D1 insert reserves a seat for 30 minutes. Paid enrollments plus unexpired holds cannot exceed the technical capacity.
4. The server creates a card-only Stripe Checkout Session using the configured Stripe Price ID. Stripe collects the parent's name, email, phone, and billing details.
5. The parent pays on Stripe's hosted page. The browser redirect is only a user-experience step; it is not trusted as proof of payment.
6. Stripe signs and sends a `checkout.session.completed` webhook. PiPath verifies that signature, checks the payment status, cohort reference, checkout reference, amount, and currency, then stores the parent, enrollment, payment, and hashed onboarding credential.
7. PiPath records each Stripe event by event ID so Stripe retries do not normally create duplicate business records. Database uniqueness constraints provide another idempotency layer.
8. The confirmation page polls `GET /api/enrollment-status`. When the webhook has finished, it shows the student's onboarding form. Only a masked parent email is returned.
9. `POST /api/onboarding` validates and stores the academic profile, links the student to the enrollment, and changes the enrollment from `paid` to `active`.

Checkout expiry and payment failure release the checkout attempt. Partial and full refunds update payment state; a full refund also revokes the enrollment state used by onboarding.

## Where data lives

Cloudflare Pages serves the static Astro site and runs the API Functions. Cloudflare D1 stores cohorts, checkout attempts, parents, students, enrollments, payments, hashed access tokens, Stripe event receipts, email delivery state, and an audit trail. Stripe stores card data; PiPath never receives or stores card numbers.

Resend and server-side GA4 are optional downstream integrations. Their missing configuration does not undo a paid enrollment. Email delivery state and analytics decisions are recorded for later inspection.

## Existing safeguards

- The price and currency are checked again when the signed payment webhook arrives.
- Capacity is reserved atomically in D1, including unexpired checkout holds.
- Raw IP addresses are not stored; rate limiting uses an HMAC fingerprint of IP plus user agent.
- Checkout and onboarding writes require the request's `Origin` to match the site origin.
- Request bodies, text fields, enum values, and attribution lengths are bounded and sanitized.
- Webhook signatures are verified with Stripe's webhook secret.
- Stripe event IDs and database uniqueness constraints make fulfillment retry-safe in normal operation.
- Onboarding credentials are HMAC-derived, stored only as SHA-256 hashes, expire after the cohort, and are not exposed in database inspection.
- API responses are marked `no-store`, and enrollment lookups return masked email addresses.
- Refunds, enrollment changes, email outcomes, and analytics outcomes produce operational records.

## Robustness assessment and launch gates

The transactional core is sensibly designed for a small cohort launch, but it is not production-proven until the full Stripe test matrix has run in a Cloudflare preview environment.

Before enabling enrollment publicly:

1. Verify that the configured Stripe Price is exactly $299 USD. A wrong Price would be collected by Stripe and then rejected by PiPath's webhook amount check, requiring a refund and manual recovery.
2. Run successful, declined, cancelled, expired, duplicate-webhook, sold-out, onboarding-retry, partial-refund, and full-refund tests.
3. Configure and verify webhook delivery alerts in Stripe. The confirmation page depends on the webhook, not the redirect alone.
4. Configure Resend, verify the sending domain, and prove both parent and owner emails. Add an operational retry procedure for failed deliveries.
5. Add remote monitoring/error alerts and a simple owner view or documented D1 runbook for paid enrollments, failed events, and failed email deliveries.
6. Add integration tests around webhook fulfillment and endpoint behavior. The current automated suite covers validation, token/privacy helpers, schema migration, and atomic capacity, but not the full external Stripe lifecycle.
7. Consider a stale-event recovery job and stronger event-level locking if volume grows. Database constraints prevent duplicate enrollments/payments, but two truly simultaneous deliveries of the same new Stripe event are not explicitly leased to one worker.
8. Confirm privacy, refund, terms, and enrollment policies with the business owner before launch.

## What can be tested without secrets

The site build, responsive layouts, disabled enrollment state, navigation, confirmation-page recovery state, database migration, request validation, token helpers, and capacity behavior are testable locally without Stripe credentials.

An actual hosted Checkout URL cannot be inspected until Stripe test credentials and the test Price ID are placed in the ignored `.dev.vars` file. The Stripe CLI is also needed locally to forward signed webhook events. Never commit or paste those secrets into source, documentation, screenshots, or chat.
