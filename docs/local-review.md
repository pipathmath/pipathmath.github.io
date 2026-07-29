# Local website and enrollment review

This guide runs the Astro site and Cloudflare Pages Functions on this computer. It does not deploy the website or change DNS.

## Review the pages

From the repository:

```powershell
npm run dev:review
```

Open:

- `http://localhost:8788/`
- `http://localhost:8788/sat-math-bootcamp/`
- `http://localhost:8788/sat-math-bootcamp/enrollment-confirmed/`

Review at 390px mobile, 768px tablet, and 1440px desktop. Confirm there is no horizontal scrolling; keyboard focus is visible; the video remains 16:9; its two actions remain below the card; and all enrollment actions reach the family form.

## Safe form-only review

Keep this ignored `.env` value when the Google receiver is not configured:

```dotenv
PUBLIC_ENROLLMENT_ENABLED=false
```

The family form remains visible and fillable, but its final payment button is disabled. This is useful for visual and validation review without creating a lead.

## Real lead-to-Sheet review

Complete `docs/google-sheets-setup.md` first. Then configure the ignored `.dev.vars` file:

```dotenv
GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/macros/s/your-deployment-id/exec
GOOGLE_SHEETS_SHARED_SECRET=your-matching-random-secret
STRIPE_PAYMENT_LINK_URL_AUGUST_2026=https://buy.stripe.com/dRmeVcbzcgMf8rd3kG9MY00
```

Enable the payment action in the ignored `.env` file:

```dotenv
PUBLIC_ENROLLMENT_ENABLED=true
```

Restart `npm run dev:review`, submit a clearly labeled test family, and confirm:

1. Required fields and email validation work before submission.
2. The website shows a retryable error if Apps Script is unavailable or rejects the secret.
3. A successful submission adds one row to the private `Leads` tab.
4. The row contains a UUID lead ID, family fields, and `Not paid` status; the legacy expected-price columns remain blank.
5. Stripe opens only after the row exists.
6. Stripe receives the same lead ID as `client_reference_id` and locks the validated parent email.

Wrangler reads `.dev.vars` when the Pages server starts. If the form says “Online enrollment is being configured” after adding or changing the Google URL/secret, stop the existing review process and restart `npm run dev:review`; refreshing the browser alone does not reload server environment values.

The July Payment Link is live. Stop when its hosted Checkout page opens unless the owner deliberately intends to make a real payment. Never enter Stripe test-card data into a live Payment Link.

For a controlled server-to-server check without opening a browser or following Stripe, run the opt-in integration test after `.dev.vars` is configured:

```powershell
$env:RUN_GOOGLE_SHEETS_INTEGRATION = "true"
npm test -- tests/google-sheets.integration.test.ts
Remove-Item Env:RUN_GOOGLE_SHEETS_INTEGRATION
```

This deliberately creates one clearly labeled `PiPath Integration Test` row and verifies that the checkout Function returns Stripe only after Apps Script accepts the write. It never follows the returned Stripe URL or submits a payment. The test is skipped during ordinary `npm test` runs.

## Webhook review

Use a Stripe sandbox/test-mode Payment Link for safe payment testing. In a separate terminal, use the Stripe CLI to forward supported events:

```powershell
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded --forward-to http://localhost:8788/api/stripe-webhook
```

Copy the CLI's `whsec_...` value into ignored `.dev.vars`:

```dotenv
STRIPE_WEBHOOK_SECRET=whsec_from_the_current_stripe_cli_listener
```

Restart the review server and complete a test-mode payment. Confirm:

- `Leads.payment_status` becomes `Paid` only for a paid event;
- the amount, currency, Checkout Session ID, Payment Intent ID, Stripe event ID, and paid timestamp are present;
- `Stripe Events` receives the processed event;
- resending the same event does not create a second lead or event row;
- a wrong shared secret or wrong payment amount does not mark the lead paid;
- refund events update the matching row without erasing staff follow-up/internal notes.

## Payment-flow matrix

| Scenario | Expected result |
| --- | --- |
| Required field omitted | Browser validation focuses the missing field; no Sheet write occurs |
| Invalid email | Inline and server validation reject it |
| Optional fields blank | Lead writes successfully with blank score/note cells |
| Apps Script unavailable | Website stays on the form and does not reveal Stripe |
| Successful lead write | Exactly one lead row exists before Stripe opens |
| Parent abandons Stripe | Lead remains `Not paid` for follow-up; no seat is reserved |
| Successful instant payment | Verified webhook marks the row `Paid` |
| Delayed payment | Completed event marks `Processing`; later async event marks `Paid` or `Failed` |
| Duplicate event | Existing event is acknowledged without a duplicate business update |
| Wrong amount/currency | Sheet refuses to mark the lead paid; Stripe delivery shows an error for investigation |
| Partial refund | Payment becomes `Partially refunded`; lead remains visible for staff handling |
| Full refund | Payment and lead status become `Refunded` |
| Payment Link cap reached | Stripe prevents further completed payments according to the owner-configured limit |

## Current data and capacity rule

Google Sheets is the active lead/operations record. Stripe is the active payment record. D1 is not required for local review or deployment.

There is no temporary seat hold. A lead row means the parent reached Checkout; it does not mean the student owns a seat. Payment accepted by the capped Stripe Payment Link confirms the seat.

## Automated verification

Run:

```powershell
npm run verify
```

This checks request validation, Payment Link construction, Google adapter behavior, retained migration references, Astro diagnostics/build, and the Pages Functions build.

## Deployment boundary

Local review does not configure Cloudflare, Stripe, or Google automatically. Deployment variables and the public webhook registration are later owner-approved steps. See `docs/google-sheets-setup.md` and `docs/decisions/0001-google-sheets-enrollment.md`.
