# Enrollment backend: how it works

## The important distinction

PiPath uses a hybrid flow: its own backend captures the family lead and checks capacity first, then redirects the parent to a reusable Stripe Payment Link. The configured link is not sent to the browser until the lead has passed validation and a temporary seat hold has been created.

The Payment Link is deliberately simpler than creating a new Checkout Session through Stripe's API for every parent. PiPath adds a unique `client_reference_id` and locked, validated parent email to the link so the signed payment webhook can reconcile the payment with the saved lead.

## End-to-end flow

1. The enrollment section first asks for parent name, student name, parent email, and parent phone. SAT/PSAT Math score and an additional note are optional.
2. The form sends those fields, the cohort ID, and optional marketing attribution to `POST /api/checkout`.
3. The endpoint rejects cross-origin requests, invalid JSON, missing configuration, unknown cohorts, closed cohorts, and rate-limited clients.
4. A single conditional D1 insert saves the lead and reserves a seat for 30 minutes. Paid enrollments plus unexpired holds cannot exceed the technical capacity.
5. Only after that insert succeeds does the server append the lead reference, locked email, and available UTM attribution to the configured Stripe Payment Link.
6. The parent pays on Stripe's hosted page. The browser redirect is only a user-experience step; it is not trusted as proof of payment. If the parent returns without paying, the entered form values remain in that browser and the hold expires normally.
7. Stripe signs and sends a `checkout.session.completed` webhook containing the `client_reference_id`. PiPath verifies that signature, checks the payment status, saved cohort, checkout reference, amount, and currency, then promotes the saved lead into the parent, student, enrollment, payment, and hashed enrollment credential.
8. PiPath records each Stripe event by event ID so Stripe retries do not normally create duplicate business records. Database uniqueness constraints provide another idempotency layer.
9. The confirmation page polls `GET /api/enrollment-status`. When the webhook has finished, it confirms enrollment without asking the family to re-enter the pre-checkout information. Only a masked parent email is returned.

Unpaid D1 holds stop counting toward capacity after 30 minutes. Partial and full refunds update payment state; a full refund also revokes the enrollment state used by onboarding.

## Where data lives

Cloudflare Pages serves the static Astro site and runs the API Functions. Cloudflare D1 stores the pre-payment lead on the checkout attempt, along with cohorts, parents, students, enrollments, payments, hashed access tokens, Stripe event receipts, email delivery state, and an audit trail. Stripe stores card data; PiPath never receives or stores card numbers.

Resend and server-side GA4 are optional downstream integrations. Their missing configuration does not undo a paid enrollment. Email delivery state and analytics decisions are recorded for later inspection.

## Existing safeguards

- The price and currency are checked again when the signed payment webhook arrives.
- Capacity is reserved atomically in D1, including unexpired checkout holds.
- The permanent August Payment Link must also be configured in Stripe with a 15-completed-payment limit. D1 prevents the website from issuing new checkout links when full, but a copied reusable link can bypass the website check.
- Raw IP addresses are not stored; rate limiting uses an HMAC fingerprint of IP plus user agent.
- Checkout and legacy onboarding writes require the request's `Origin` to match the site origin.
- Request bodies, text fields, enum values, and attribution lengths are bounded and sanitized.
- Webhook signatures are verified with Stripe's webhook secret.
- Stripe event IDs and database uniqueness constraints make fulfillment retry-safe in normal operation.
- Enrollment credentials are HMAC-derived, stored only as SHA-256 hashes, expire after the cohort, and are not exposed in database inspection.
- API responses are marked `no-store`, and enrollment lookups return masked email addresses.
- Refunds, enrollment changes, email outcomes, and analytics outcomes produce operational records.

## Robustness assessment and launch gates

The transactional core is sensibly designed for a small cohort launch, but it is not production-proven until the full Stripe test matrix has run in a Cloudflare preview environment.

Before enabling enrollment publicly:

1. Create a clean August Payment Link, verify that its Price is exactly $299 USD, and set its completed-payment limit to 15. A wrong Price would be collected by Stripe and then rejected by PiPath's webhook amount check, requiring a refund and manual recovery.
2. Run required-field, optional-field, successful, declined, cancelled, expired, duplicate-webhook, sold-out, partial-refund, and full-refund tests.
3. Configure and verify webhook delivery alerts in Stripe. The confirmation page depends on the webhook, not the redirect alone.
4. Configure Resend, verify the sending domain, and prove both parent and owner emails. Add an operational retry procedure for failed deliveries.
5. Add remote monitoring/error alerts and a simple owner view or documented D1 runbook for paid enrollments, failed events, and failed email deliveries.
6. Add integration tests around webhook fulfillment and endpoint behavior. The current automated suite covers validation, token/privacy helpers, schema migration, and atomic capacity, but not the full external Stripe lifecycle.
7. Consider a stale-event recovery job and stronger event-level locking if volume grows. Database constraints prevent duplicate enrollments/payments, but two truly simultaneous deliveries of the same new Stripe event are not explicitly leased to one worker.
8. Confirm privacy, refund, terms, and enrollment policies with the business owner before launch.

## What can be tested without secrets

The site build, responsive layouts, fillable family form, Payment Link URL construction, navigation, confirmation-page recovery state, database migration, request validation, token helpers, and D1 capacity behavior are testable locally without a Stripe API secret key.

The temporary July Payment Link is live-mode and is included only for visual handoff testing; do not submit a real payment through it. A complete safe payment test requires a new Stripe test-mode Payment Link and the Stripe CLI to forward signed webhook events. Never commit or paste webhook or application secrets into source, documentation, screenshots, or chat.
