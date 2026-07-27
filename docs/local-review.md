# Batch 2 local review guide

This guide covers the private review environment only. It does not deploy the site, create a Cloudflare database, affect production, or charge a real card.

## Review the pages and interactions now

From the C-drive working copy:

```powershell
npm run dev:review
```

Then open:

- `http://localhost:8788/sat-math-bootcamp/`
- `http://localhost:8788/sat-math-bootcamp/enrollment-confirmed/`
- `http://localhost:8788/` for the redesigned Home page

Use the trailing slash in the SAT URLs. Wrangler redirects the no-slash form, but the slash form is the clearest review URL.

The default build keeps the family form fillable and makes every cohort enrollment action scroll to it, while deliberately disabling only the final payment button. This allows safe review of the complete intake layout, responsive behavior, navigation, dates, selling points, payment-availability messaging, and the confirmation-page recovery state without accepting a payment.

Review each page at minimum at 390px mobile, 768px tablet, and 1440px desktop widths. Confirm that:

- no content scrolls horizontally;
- keyboard focus is visible and follows the visual order;
- the SAT overview video retains a 16:9 ratio;
- both SAT video actions remain directly below the video;
- the schedule jump lands with the heading visible;
- external consultation and YouTube links open correctly;
- the mobile enrollment/consultation bar appears only after the main call to action leaves the viewport;
- YouTube's unavailable state does not obscure the surrounding actions.

## What the private local D1 database is

Wrangler provides a local SQLite-backed implementation of the Cloudflare D1 binding. The Function code still uses `env.DB`, so the local environment exercises the same database interface intended for Cloudflare while keeping all records on this computer.

The database state is stored below the ignored `.wrangler/` directory in this working copy. It is not committed, pushed, synchronized to Cloudflare, or visible to website visitors.

Apply any new migrations and list the tables:

```powershell
npm run d1:local:migrate
npm run d1:local:tables
```

Inspect the cohort and recent records:

```powershell
npx wrangler d1 execute DB --local --command "SELECT id, name, status, capacity, price_cents, starts_at, ends_at FROM cohorts;"
npx wrangler d1 execute DB --local --command "SELECT id, cohort_id, status, parent_name, parent_email, parent_phone, student_name, student_math_score, additional_notes, created_at FROM checkout_attempts ORDER BY created_at DESC LIMIT 20;"
npx wrangler d1 execute DB --local --command "SELECT id, cohort_id, status, created_at FROM enrollments ORDER BY created_at DESC LIMIT 20;"
npx wrangler d1 execute DB --local --command "SELECT enrollment_id, status, amount_cents, refunded_cents, currency, created_at FROM payments ORDER BY created_at DESC LIMIT 20;"
npx wrangler d1 execute DB --local --command "SELECT s.id, s.parent_id, s.display_name, ca.student_math_score, s.checkout_attempt_id, s.score_range, s.onboarding_completed_at, s.updated_at FROM students s LEFT JOIN checkout_attempts ca ON ca.id = s.checkout_attempt_id ORDER BY s.updated_at DESC LIMIT 20;"
npx wrangler d1 execute DB --local --command "SELECT event_id, event_type, status, processed_at, error_code, created_at FROM stripe_events ORDER BY created_at DESC LIMIT 20;"
npx wrangler d1 execute DB --local --command "SELECT enrollment_id, kind, recipient, status, attempts, provider_message_id, last_error, updated_at FROM email_deliveries ORDER BY updated_at DESC LIMIT 20;"
```

The planned owner dashboard will replace most routine command-line inspection before live operations begin.

## Enable a real Stripe test-mode checkout locally

This is a separate review gate. Keep enrollment disabled until all test-only values below are ready.

1. In Stripe test mode, create or select the $299 SAT Bootcamp Price.
2. Copy `.dev.vars.example` to the ignored `.dev.vars` file.
3. In `.dev.vars`, replace the examples with:
   - the Stripe test secret key (`sk_test_...`);
   - the $299 test Price ID (`price_...`);
   - two different, strong random values for `ONBOARDING_TOKEN_SECRET` and `RATE_LIMIT_SALT`.
4. Run the Stripe CLI listener in a separate terminal:

   ```powershell
   stripe listen --events checkout.session.completed,checkout.session.expired,payment_intent.payment_failed,charge.refunded --forward-to http://localhost:8788/api/stripe-webhook
   ```

5. Put the listener's test webhook secret (`whsec_...`) into `.dev.vars`, then restart the local site with enrollment enabled:

   ```powershell
   $env:PUBLIC_ENROLLMENT_ENABLED = "true"
   npm run dev:review
   ```

6. Open the SAT page, choose Enroll, complete the family form, and continue to Stripe. Confirm the parent email is prefilled, then use a Stripe test card. Stripe's standard successful Visa test number is `4242 4242 4242 4242`, with any future expiration date and any three-digit CVC.
7. After payment, confirm the success page does not ask for the same family information again.
8. Use the D1 inspection commands above to confirm the lead exists on the checkout attempt before payment, then confirm the parent, student, enrollment, payment, access token, Stripe event, and email-delivery records after the webhook.

## Payment-flow test matrix

Run these with Stripe test-mode data only. Use a fresh browser session when checking rate limits or first-touch attribution.

| Scenario | Action | Expected result |
| --- | --- | --- |
| Required lead fields | Leave each required family field blank in turn | Inline browser validation prevents checkout creation and focuses the missing field |
| Optional lead fields | Leave score and notes blank | Checkout opens normally; both values are stored as empty/null |
| Successful card | Submit the family form, then complete Checkout with `4242 4242 4242 4242` | Lead exists before Stripe; redirect confirms enrollment after the webhook without repeating the form |
| Declined card | Use Stripe's generic-decline test card | Stay in Stripe Checkout; no paid enrollment is created |
| Cancelled checkout | Use the Checkout back link | Return to the enrollment form with the entered values restored and cancellation guidance; the hold remains only until expiry |
| Double click | Submit repeatedly while Checkout is opening | One browser request; the submit button remains disabled while pending |
| Duplicate webhook | Resend the completed event from Stripe CLI/dashboard | No duplicate enrollment, payment, email delivery, or analytics transaction |
| Expired session | Expire a test Checkout session | Attempt becomes `expired`; its seat becomes available |
| Full cohort | Temporarily fill all 15 test seats/holds | The next checkout receives the friendly unavailable response and no Stripe session is created |
| Wrong amount/config | Point the test environment at a non-$299 Price without completing payment | Checkout exposes the mismatch visually; stop the test and fix configuration. If completed accidentally, the webhook rejects fulfillment and the payment needs a refund |
| Partial refund | Refund part of the test PaymentIntent | Payment becomes `partially_refunded`; enrollment remains active/paid |
| Full refund | Refund the complete test payment | Payment and enrollment become `refunded`; onboarding access becomes unavailable |
| Email outage | Omit Resend configuration | Payment remains recorded; failed/skipped email delivery is visible for retry |

For a plain-language system walkthrough and the current launch risks, see `docs/enrollment-backend.md`.

Do not paste secret keys into project documents, source files, Git, screenshots, or chat. Add them only to the ignored `.dev.vars` file or an approved secret manager.

## Email and analytics during local payment review

A paid enrollment can be stored even if Resend and server-side GA4 are not configured. Without valid optional credentials:

- the email adapter records the delivery failure/skip for inspection;
- the enrollment remains paid;
- analytics failure does not reverse enrollment.

Add valid test credentials only when email-delivery and server-side purchase-event review becomes part of the approved test scope.

## Later Cloudflare preview setup

The remote preview environment is deliberately separate from local review. At that gate we will:

1. create a non-production D1 database in Cloudflare;
2. replace the placeholder database ID with the preview ID;
3. apply the same versioned migrations remotely;
4. configure preview-only Stripe, webhook, token, email, and analytics secrets in Cloudflare;
5. deploy the `croquette` preview only after the branch review and push are approved;
6. repeat payment, webhook retry, refund, email, mobile, desktop, and accessibility QA before any production cutover.
