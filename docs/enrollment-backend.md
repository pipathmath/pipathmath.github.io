# Enrollment backend: how it works

## Current architecture

PiPath uses a lead-first Google Sheets and Stripe Payment Link workflow. A parent must submit the family form before the website reveals the configured Stripe link. Google Sheets is the staff-facing operational record; Stripe is the financial source of truth.

Cloudflare Pages serves the Astro site and runs two active API Functions:

- `POST /api/checkout` validates and saves the lead, then returns the Stripe Payment Link.
- `POST /api/stripe-webhook` verifies Stripe events and updates the matching Sheet row.

Cloudflare D1, the previous onboarding workflow, Resend delivery ledger, and an owner dashboard are not part of the active enrollment path. Their code/schema history remains available as future reference, but the deployed project must not configure a second active store without a new architecture decision.

## End-to-end flow

1. The enrollment form asks for parent name, student name, parent email, and parent phone. SAT/PSAT Math score and an additional note are optional.
2. The browser performs immediate client-side validation and sends the form, cohort ID, and available attribution to `POST /api/checkout`.
3. The Cloudflare Function enforces same-origin submission, JSON type/size, server-known cohort availability, required fields, email format, phone digit length, SAT/PSAT score range, and text limits.
4. The Function generates a random UUID lead ID and sends the sanitized lead to the Google Apps Script receiver using a server-only URL and shared secret.
5. Apps Script acquires a script lock, verifies its schema and shared secret, neutralizes spreadsheet-formula prefixes, and appends the lead to the private `Leads` tab. It stores the expected server-owned amount and currency with the lead.
6. Only after Apps Script confirms the write does the Function return the configured Stripe Payment Link with `client_reference_id=<lead UUID>` and `locked_prefilled_email=<validated parent email>`.
7. The parent completes payment on Stripe's hosted page. PiPath never receives card information.
8. Stripe sends a signed event to `POST /api/stripe-webhook`. The Function verifies the signature from the raw request body and ignores unrelated events without PiPath's UUID lead-reference shape.
9. The Function sends the verified payment state and Stripe identifiers to Apps Script. Apps Script finds the lead row by lead ID, confirms paid amount/currency against the expected row values, updates the row, and records the Stripe event ID in the `Stripe Events` tab.
10. Staff uses the Sheet for follow-up. Stripe remains authoritative for money, refunds, disputes, and the Payment Link's completed-payment limit.

## Seat capacity

Form submission does not reserve a seat. Payment confirms the seat.

PiPath supplies and configures the Payment Link for each cohort. The Stripe Payment Link must enforce the business's completed-payment limit, including a 15-payment cap when that is the cohort capacity. Multiple families may have Checkout open for the last seat; Stripe's accepted completed payments decide the enrollment order.

A timed seat reservation requires transactional state and is explicitly deferred. If it becomes necessary, reconsider D1 as a replacement architecture rather than adding a silent dual-write.

## Sheet schema and operational behavior

The Apps Script creates:

- `Leads`, containing family, cohort, expected price, lead status, payment status, Stripe IDs, timestamps, attribution, follow-up status, and internal notes;
- `Stripe Events`, containing processed event IDs for audit and idempotency.

Automated writes never intentionally overwrite `follow_up_status` or `internal_notes` after the lead is created. Staff can filter, add views, or build charts using the Sheet without changing the website backend.

The Sheet contains personal information. It must remain restricted to authorized PiPath accounts, use the minimum necessary editors, and never be published or shared by public link.

## Webhook behavior

The active handler supports:

- `checkout.session.completed`: marks the lead paid only when `payment_status` is already `paid`; otherwise marks it processing;
- `checkout.session.async_payment_succeeded`: marks a delayed payment paid;
- `checkout.session.async_payment_failed`: marks the attempt failed for follow-up;
- `checkout.session.expired`: marks the attempt expired for follow-up;
- `charge.refunded`: matches the Payment Intent and records a partial or full refund. An unrelated/unmatched refund is recorded in the event ledger without causing repeated delivery failures.

Stripe event IDs are written under a script lock. A duplicate event returns success without repeating the business update. If Apps Script cannot update the Sheet, Cloudflare returns an error so Stripe can retry.

The webhook secret is specific to its registered endpoint/environment. It is not the same value as the Google shared secret.

## Security boundaries

- Browser validation improves usability; Cloudflare validation is authoritative for form acceptance.
- The browser never receives the Apps Script deployment URL or either shared/signing secret.
- Apps Script accepts only a strong shared secret stored in Script Properties.
- Spreadsheet cells beginning with `=`, `+`, `-`, or `@` are neutralized before insertion.
- Stripe signatures are verified against the raw request body.
- Stripe's paid amount and currency are validated for shape and recorded as the payment source of truth.
- Unsupported or unrelated Stripe events do not modify the Sheet.
- Request and response bodies are marked as non-cacheable at the API layer.
- No card number or Stripe secret key is stored by PiPath.

The shared-secret design is proportionate for this private, low-volume integration. If public form abuse appears, add Cloudflare Turnstile or a Cloudflare rate-limit rule. Same-origin checks alone are not a complete anti-bot control.

## Failure behavior

- Lead write failure: show a retryable website error and do not send the parent to Stripe.
- Payment update failure: return a webhook error so Stripe retries.
- Duplicate webhook: acknowledge it without a second update.
- Invalid or missing paid amount/currency: refuse the malformed update so Stripe retries.
- Missing lead reference: ignore an unrelated Stripe event; a PiPath event with a missing row produces an update failure and retry.
- Sheet/Stripe disagreement: use Stripe as the financial truth and reconcile the Sheet manually using lead, Checkout Session, or Payment Intent ID.

## Configuration

Server-only settings:

- `STRIPE_PAYMENT_LINK_URL_AUGUST_2026`
- `GOOGLE_SHEETS_WEB_APP_URL`
- `GOOGLE_SHEETS_SHARED_SECRET`
- `STRIPE_WEBHOOK_SECRET`

Build-time browser behavior:

- `PUBLIC_ENROLLMENT_ENABLED=true` enables the form's payment action only after the receiver is configured.

Never place server-only values in an Astro `PUBLIC_` variable. Local values belong in ignored `.dev.vars`; Cloudflare values belong in project environment variables/secrets.

## Local and external testing

Automated tests cover input validation, Payment Link URL construction, the Google request adapter, and the retained future D1 migration reference. The build also compiles all active Pages Functions.

A real lead-to-Sheet test requires the owner-run Apps Script deployment described in `docs/google-sheets-setup.md`. A safe end-to-end webhook payment test requires Stripe sandbox resources or a deliberately authorized real transaction. Never enter Stripe test-card numbers into the supplied live July Payment Link.

## Decision and reference documents

- `docs/decisions/0001-google-sheets-enrollment.md` records why Sheets replaced D1 for the current scale and preserves the tradeoffs.
- `docs/google-sheets-setup.md` is the exact owner setup and recovery guide.
- `docs/local-review.md` is the current local test procedure.
- `docs/implementation-log.md` is the chronological change record; earlier D1 entries remain historical rather than describing the active system.
