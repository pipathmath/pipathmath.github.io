# PiPath backend operations

## Active configuration

| Variable | Required for | Handling |
| --- | --- | --- |
| `STRIPE_PAYMENT_LINK_URL_AUGUST_2026` | checkout handoff | server-side cohort setting supplied/configured by owner |
| `GOOGLE_SHEETS_WEB_APP_URL` | lead and payment writes | server-only; standard Apps Script `/exec` URL |
| `GOOGLE_SHEETS_SHARED_SECRET` | Apps Script authorization | strong secret matching `PIPATH_SHARED_SECRET` Script Property |
| `STRIPE_WEBHOOK_SECRET` | signed payment updates | endpoint/environment-specific secret |
| `SITE_URL` | environment origin | localhost, preview, or production origin |
| `GA4_MEASUREMENT_ID` | browser analytics | non-secret identifier |
| `PUBLIC_ENROLLMENT_ENABLED` | build-time payment-action gate | false until Sheet receiver is configured and tested |

Google Script Properties:

- `PIPATH_SPREADSHEET_ID`
- `PIPATH_SHARED_SECRET`

Never place server-only values in `PUBLIC_` variables, committed configuration, documentation, screenshots, logs, or chat. Local values belong in ignored `.dev.vars`; deployed values belong in Cloudflare's environment configuration.

## Owner-run Google setup

Use `docs/google-sheets-setup.md`. The owner must:

1. open the private Sheet's bound Apps Script project;
2. paste `integrations/google-apps-script/Code.gs`;
3. add both Script Properties;
4. deploy as a web app that executes as the owner and is callable by anyone;
5. copy the `/exec` URL into the local/Cloudflare server configuration.

The Sheet itself stays private. If Workspace policy removes the “Anyone” web-app option, use a service-account Sheets API design rather than public Sheet sharing.

## Local review

```powershell
npm run dev:review
```

Use `PUBLIC_ENROLLMENT_ENABLED=false` for form-only visual review. For a real Sheet write, configure the Apps Script URL/shared secret and set the build-time flag true, then restart the server.

The supplied July Payment Link is live. A test lead may stop when Stripe opens; do not use Stripe test cards there.

## Stripe webhook testing

Use a test-mode Payment Link and Stripe CLI:

```powershell
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded --forward-to http://localhost:8788/api/stripe-webhook
```

Put the current CLI `whsec_...` into ignored `.dev.vars` and restart. Inspect the Sheet and `Stripe Events` after success, delayed methods, duplicate replay, expiration, and refunds.

## Troubleshooting

### Payment action disabled

- Confirm `PUBLIC_ENROLLMENT_ENABLED=true` existed when Astro built.
- Rebuild after changing it.
- Do not enable until Apps Script is ready.

### Checkout returns 403

The browser request failed same-origin protection. Use the page served by the same Wrangler/Cloudflare origin.

### Checkout returns 503

Required Google or Payment Link configuration is missing. Log names only, never values.

### Checkout says information could not be saved

- Inspect Apps Script **Executions** at the matching time.
- Check the `/exec` URL and matching shared secret.
- Confirm both Script Properties and the deployment's owner authorization.
- Confirm `Leads` headers have not been reordered.

The parent must remain on the form; do not reveal Stripe after a failed write.

### Webhook returns 400

The Stripe signature is missing/invalid or the wrong environment's endpoint secret is configured. Preserve the raw body before verification.

### Webhook returns 500

- Inspect Cloudflare logs, Stripe delivery, Apps Script Executions, and `Stripe Events`.
- Confirm lead ID, Sheet row, expected/received amount and currency, and Stripe identifiers.
- Fix the cause and use Stripe retry/resend. Event IDs prevent duplicate updates.

### Stripe is paid but Sheet is not

Stripe is authoritative. Do not ask the parent to pay again. Reconcile using lead ID, Checkout Session ID, Payment Intent ID, and Stripe delivery; then update through a replay or an explicitly documented manual correction.

## Cloudflare preview gate

Remote actions require approval. Then configure server-only variables/secrets in the Pages project, deploy `croquette`, register the preview webhook URL, and repeat lead, payment, retry, responsive, accessibility, and recovery QA. No D1 binding is required.

## Verification and logging

Run:

```powershell
npm run test
npm run check
npm run build
git diff --check
```

Append material behavior, schema, configuration names, tests, owner actions, and deployment state to `docs/implementation-log.md`. Update the Apps Script deployment version whenever `Code.gs` changes.
