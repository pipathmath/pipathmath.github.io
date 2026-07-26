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
- `http://localhost:8788/` for the unchanged legacy Home page

Use the trailing slash in the SAT URLs. Wrangler redirects the no-slash form, but the slash form is the clearest review URL.

The default build deliberately shows enrollment as being set up. This allows safe review of layout, responsive behavior, navigation, dates, selling points, disabled enrollment messaging, and the confirmation-page recovery state without accepting a payment.

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
npx wrangler d1 execute DB --local --command "SELECT id, cohort_id, status, created_at FROM enrollments ORDER BY created_at DESC LIMIT 20;"
npx wrangler d1 execute DB --local --command "SELECT enrollment_id, status, amount_cents, refunded_cents, currency, created_at FROM payments ORDER BY created_at DESC LIMIT 20;"
npx wrangler d1 execute DB --local --command "SELECT id, parent_id, first_name, last_name, grade, score_range, onboarding_completed_at, updated_at FROM students ORDER BY updated_at DESC LIMIT 20;"
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

6. Open the SAT page, choose Enroll, and use a Stripe test card. Stripe's standard successful Visa test number is `4242 4242 4242 4242`, with any future expiration date and any three-digit CVC.
7. Complete the post-payment student onboarding form.
8. Use the D1 inspection commands above to confirm the checkout attempt, parent, enrollment, payment, access token, student, Stripe event, and email-delivery records.

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
