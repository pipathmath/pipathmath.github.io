# PiPath backend operations

## Configuration inventory

| Binding/variable | Required for | Handling |
| --- | --- | --- |
| `DB` | every database-backed endpoint | local binding in `wrangler.jsonc`; separate preview/production D1 IDs later |
| `STRIPE_SECRET_KEY` | checkout and webhook verification client | secret; test key locally/preview, live key only at production gate |
| `STRIPE_WEBHOOK_SECRET` | signed webhook verification | secret and endpoint-specific; Stripe CLI value differs from deployed endpoint |
| `STRIPE_PRICE_ID_AUGUST_2026` | checkout | server-side test/live Price ID for the one approved cohort |
| `ONBOARDING_TOKEN_SECRET` | onboarding token generation/validation | strong secret; keep stable within an environment or existing links change |
| `RATE_LIMIT_SALT` | HMAC request fingerprint | strong separate secret; never store raw IP as replacement |
| `SITE_URL` | Stripe redirects and onboarding links | localhost, preview hostname, or production origin for that environment |
| `OWNER_EMAIL` | owner notification/reply-to | non-secret |
| `EMAIL_FROM` | Resend sender | must match an approved/verified sender before real delivery |
| `RESEND_API_KEY` | email delivery | optional secret until delivery testing/activation |
| `GA4_MEASUREMENT_ID` | analytics property | non-secret identifier |
| `GA4_API_SECRET` | server-side purchase event | optional secret until Measurement Protocol testing/activation |
| `PUBLIC_ENROLLMENT_ENABLED` | build-time UI gate | leave false until the target environment passes checkout/webhook review |

Never place real secret values in this skill, committed config, documentation, screenshots, logs, or chat. Local secrets belong in ignored `.dev.vars`; deployed secrets belong in Cloudflare's approved secret configuration.

## Safe local review

The root `wrangler.jsonc` uses a non-deployable placeholder database ID and local database name `pipath-enrollment-local`.

```powershell
npm run dev:review
```

Review:

- `http://localhost:8788/sat-math-bootcamp/`
- `http://localhost:8788/sat-math-bootcamp/enrollment-confirmed/`
- `http://localhost:8788/`

Wrangler should report `env.DB (pipath-enrollment-local)` in local mode. The default public build keeps checkout disabled.

## Stripe test-mode local flow

1. Use Stripe test mode and a $299 test Price; never use a live key/card for local review.
2. Copy `.dev.vars.example` to ignored `.dev.vars` and replace examples locally.
3. Use different strong random values for the onboarding secret and rate-limit salt.
4. Start the Stripe CLI in a separate terminal:

   ```powershell
   stripe listen --events checkout.session.completed,checkout.session.expired,payment_intent.payment_failed,charge.refunded --forward-to http://localhost:8788/api/stripe-webhook
   ```

5. Put the CLI-provided test `whsec_...` value in `.dev.vars` and restart Wrangler.
6. Enable the UI only for the build that has all dependencies:

   ```powershell
   $env:PUBLIC_ENROLLMENT_ENABLED = "true"
   npm run dev:review
   ```

7. Complete a successful test checkout, onboarding, duplicate-webhook replay, expiration/failure case, and full/partial refund test.
8. Inspect D1 after each case using [database.md](database.md).

Expected webhook handling:

| Stripe event | Expected D1 effect |
| --- | --- |
| `checkout.session.completed` and paid | complete attempt; upsert parent; create enrollment/payment/token/audit; attempt email/analytics |
| duplicate completed event | `stripe_events` prevents duplicate operational records/sends |
| `checkout.session.expired` | attempt `expired`; live hold no longer counts |
| `payment_intent.payment_failed` | matching attempt `failed` |
| partial `charge.refunded` | payment `partially_refunded`; enrollment remains paid/active |
| full `charge.refunded` | payment and enrollment `refunded`; audit event added |

## Troubleshooting order

### Checkout button remains disabled

- Confirm `PUBLIC_ENROLLMENT_ENABLED=true` existed when Astro built the page.
- Confirm local/preview dependencies are ready before enabling it.
- Rebuild; changing a build-time variable after startup does not update already-built HTML/JS.

### Checkout returns 403

- Same-origin protection rejected the request. Use the page served by the same Wrangler origin; do not call the endpoint from an unrelated origin.

### Checkout returns 503

- Inspect server logs for missing `STRIPE_SECRET_KEY`, cohort Price ID, or `RATE_LIMIT_SALT`.
- Do not print their values while diagnosing.

### Checkout returns 409

- Confirm the cohort is `enrolling` and mapped to a Price ID.
- Run the capacity/live-hold query. Expired holds should not count even if their stored status has not yet changed.

### Checkout returns 429

- Three attempts were recorded for the HMAC fingerprint inside 15 minutes. Confirm whether this is expected testing or abuse; do not weaken production controls to bypass it.

### Confirmation stays processing/unavailable

- Locate the Checkout Session in Stripe and `checkout_attempts`.
- Check CLI/deployed webhook delivery and signature secret.
- Inspect `stripe_events` status/error code.
- Confirm the Session metadata IDs, paid status, amount, currency, and database records.
- Enrollment-status also requires a configured onboarding-token secret.

### Webhook returns 400

- Missing/invalid Stripe signature or a webhook secret for the wrong endpoint/environment is likely.
- Preserve the raw body; do not JSON-parse/re-serialize before verification.

### Webhook returns 500

- Inspect the `stripe_events.error_code` and server log.
- Reconcile the Stripe event object with attempt, cohort, amount/currency, and unique identifiers.
- Fix the cause and use Stripe's retry/replay; idempotency should prevent duplicates.

### Paid enrollment exists but email is absent

- Inspect `email_deliveries.kind/status/attempts/last_error`.
- Confirm `RESEND_API_KEY`, verified `EMAIL_FROM`, and provider response.
- Do not roll back enrollment because email failed.

### Analytics is absent

- Confirm measurement ID, API secret, and captured GA client ID.
- Inspect `audit_events` for skipped/sent/failed purchase analytics.
- Do not roll back enrollment because analytics failed.

## Preview D1 gate

Do not create or attach remote resources until the user approves the preview gate. Then:

1. confirm Cloudflare account and Pages project;
2. create a separate preview D1 database;
3. place its real ID in the approved preview configuration/binding, never in a secret field;
4. list pending migrations and apply them with the exact preview target and `--remote`;
5. configure preview-only Stripe test, token, email, and analytics secrets;
6. deploy only the approved `croquette` preview;
7. repeat end-to-end, retry/idempotency, refund, responsive, accessibility, and record-inspection QA.

Preview data must never be mistaken for production data. Use conspicuous test parent/student values and Stripe test mode.

## Production gate

Require explicit approval for the exact deployment, database, migrations, bindings, secrets, and enrollment activation. Before enabling live payments:

- approve privacy, refund/cancellation, attendance, recording, retention, and support procedures;
- verify the protected owner dashboard or an adequate operational review path;
- verify domain/sender, webhook endpoint, live Price, capacity, and monitoring;
- test rollback/disable behavior without deleting records;
- keep a reconciliation path from Stripe IDs to D1 records;
- document who handles failed webhooks, refunds, corrections, and parent support.

Do not use destructive Git/database commands, reset the database, delete customer records, rotate token secrets, or edit payment state as a shortcut.

## Verification and logging

Run after backend changes:

```powershell
npm run test
npm run check
npm run build
git diff --check
```

Also apply migrations to a disposable/local state and execute representative inspection queries. For webhook changes, cover success, duplicate delivery, failure/retry, expiration, and refund behavior.

Append a precise entry to `docs/implementation-log.md`: what/why, schema and API behavior, privacy/security decisions, variables/bindings, tests, remaining external setup, and repository/deployment state.
