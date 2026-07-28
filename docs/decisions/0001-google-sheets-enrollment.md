# Architecture decision: Google Sheets enrollment operations

Date: 2026-07-27  
Status: approved for implementation

## Context

PiPath currently needs a dependable lead-first enrollment flow for a small number of SAT Math Bootcamp cohorts. The prior Batch 2 design used Cloudflare D1 for temporary seat holds, enrollment records, payment records, webhook idempotency, onboarding, email-delivery state, and an eventual owner dashboard.

That design is technically sound, but its operational cost is larger than PiPath currently needs. Staff would have to maintain the database and build an owner interface before the data became as easy to use as the existing Google Form response sheet.

The owner confirmed these business decisions:

- PiPath must capture the family lead before sending the parent to Stripe.
- A submitted lead does not reserve a seat.
- Payment, not form submission, confirms the seat.
- PiPath will create and configure each cohort's Stripe Payment Link and provide its URL to the website.
- Stripe is responsible for enforcing the completed-payment limit, including the 15-payment cap for the cohort.
- Google Sheets will be the short-term operational record for leads and enrollment payment status.
- D1 remains future architecture rather than a second active system.

## Decision

Use a small three-part integration:

1. The PiPath browser form sends family information to the same-origin Cloudflare Pages Function at `POST /api/checkout`.
2. The Function validates the request, creates a non-sensitive lead ID, and sends the sanitized record to a Google Apps Script web app. Apps Script writes or updates the row in a private Google Sheet.
3. Only after Google confirms the lead write does the Function return the cohort's Stripe Payment Link with the lead ID in `client_reference_id` and the validated parent email in `locked_prefilled_email`.
4. Stripe sends signed payment events to `POST /api/stripe-webhook`. The Function verifies the raw request body and Stripe signature, then sends a payment update to Apps Script. Apps Script locates the row by lead ID and updates it instead of appending another lead.

The browser never writes directly to Google Sheets and never receives the Apps Script URL, the Apps Script shared secret, or the Stripe webhook signing secret.

## Data ownership

- Google Sheets is the operational source of truth for leads and the staff-facing payment-status view.
- Stripe is the financial source of truth for payments, refunds, receipts, disputes, and the completed-payment cap.
- Cloudflare is a validation and integration layer, not the long-term record.
- PiPath does not receive or store card numbers.
- The supplied private spreadsheet is owned and editable only by the owner's personal account and the PiPath account. Its spreadsheet ID is not treated as an authentication secret; access still depends on Google permissions and the Apps Script shared secret.

## Lead data

Required family fields:

- parent or guardian name;
- student name;
- parent or guardian email;
- parent or guardian phone.

Optional fields:

- recent SAT/PSAT Math score;
- additional family note.

Operational fields include the lead ID, cohort, expected amount and currency, lead/payment status, Stripe identifiers, timestamps, attribution, follow-up status, and internal notes.

## Validation boundary

The browser performs immediate validation for a smooth experience. The Cloudflare Function repeats all material validation because browser checks can be bypassed. It enforces request method, same-origin submission, JSON type and size, allowed cohort, required fields, email format, phone digit length, score range, and text-length limits.

Apps Script is a second trust boundary. It requires a shared secret stored in Script Properties, uses a script lock for concurrent changes, neutralizes spreadsheet-formula prefixes in text cells, validates operation shapes, prevents duplicate Stripe event processing, and refuses to mark a row paid when the event amount or currency differs from the expected values stored with the lead.

The Apps Script web app must permit anonymous invocation because Cloudflare cannot complete an interactive Google sign-in. This does not make the Sheet public: Apps Script runs as the authorized owner, while the random shared secret authenticates the calling application. Keeping the deployment URL server-only reduces discovery, but rejected requests can still consume Apps Script quota if the URL leaks. A service-account Google Sheets API integration is the stronger, more complex alternative if this lightweight boundary becomes insufficient.

## Payment and webhook behavior

The Payment Link receives a random lead ID through Stripe's supported `client_reference_id` URL parameter. Stripe returns that reference in Checkout Session webhook events, allowing PiPath to update the correct Sheet row without matching by name.

The active webhook handles:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `checkout.session.expired`;
- `charge.refunded` when the Payment Intent can be matched to an existing row; unmatched account-level refunds are logged for review without changing a lead.

Only a paid Checkout Session marks a seat as paid. A completed session with a delayed payment remains processing until Stripe reports success or failure.

Stripe can retry and duplicate events, so Apps Script records each processed event ID. A duplicate returns success without repeating the update. If the Sheet update fails, the Cloudflare webhook returns an error so Stripe can retry.

## Capacity tradeoff

There is deliberately no temporary seat hold. Multiple parents may have Checkout open for the last seat. The first successful payments accepted by the Stripe Payment Link receive the available seats. The website must not claim that a form submission reserves a place.

If PiPath later needs a timed reservation, atomic cross-cohort capacity, parent accounts, multi-student relationships, attendance, or a richer operational dashboard, D1 can be reconsidered. It must then replace the Sheet workflow deliberately rather than creating an undocumented dual-write system.

## Cost decision

This design does not require a paid Cloudflare database. The two dynamic operations are one lead Function request and normally one payment webhook Function request per enrollment. This is expected to remain inside the Cloudflare Workers/Pages Functions free allowance at PiPath's current scale. Static asset requests do not consume the Functions allowance.

Google Apps Script and Google Sheets are quota-limited services attached to the owning Google account. Current expected volume is small, but quota failures must still produce visible errors and Stripe retries rather than silent success.

## Secret inventory

The following values must never be committed to Git or placed in public Astro variables:

- `GOOGLE_SHEETS_WEB_APP_URL` — treated as server-only configuration even though the shared secret is the actual authorization control;
- `GOOGLE_SHEETS_SHARED_SECRET` — identical to the Apps Script `PIPATH_SHARED_SECRET` Script Property;
- `STRIPE_WEBHOOK_SECRET` — unique to the registered Stripe webhook endpoint and environment.

The cohort Payment Link URL is server-side configuration. It is not a credential, but keeping it server-side prevents bypassing lead capture through normal website use.

## Recovery and operations

- If the initial Sheet write fails, do not redirect the parent to Stripe. Show a retryable error so PiPath does not receive an unmatched payment.
- If a webhook Sheet update fails, return a non-success response so Stripe retries.
- Staff can reconcile a row manually using the lead ID, parent email, Stripe Checkout Session ID, or Payment Intent ID.
- The Sheet keeps follow-up and internal-note columns editable by staff; automated updates must not overwrite them.
- The Stripe Dashboard remains authoritative when the Sheet and Stripe disagree about money.

## External setup gate

The code can be built and tested with mocked Google responses locally. A real lead-to-Sheet test requires the owner to deploy the repository's Apps Script as a web app and configure the matching secrets locally. A real payment webhook test additionally requires a Stripe test-mode Payment Link or a deliberate low-risk live transaction; the existing July Payment Link must not be used with Stripe test-card numbers.
