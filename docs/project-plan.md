# PiPath Academy project plan

Last updated: 2026-07-28

## Current state

- Active branch: `croquette`.
- Active local workspace: `C:\Users\SerenaLi\Projects\PiPath\pipathmath.github.io`.
- Production remains on the legacy site; no DNS or production cutover is included in the current gate.
- The redesigned Home and SAT pages are implemented and owner-approved.
- The SAT page captures family information before sending a parent to a reusable Stripe Payment Link.
- The owner approved Google Sheets as the short-term operations record and confirmed that form submission does not reserve a seat; accepted payment confirms the seat.
- The private enrollment Sheet has been created and is restricted to the owner's personal account and the PiPath account.
- The Google Apps Script receiver is deployed, the real lead-to-Sheet handoff is confirmed, and the owner has completed a separate $10 Stripe-hosted sandbox payment. The test webhook remains pending, so that payment did not verify Stripe-to-Sheet reconciliation.
- The active Cloudflare-to-Sheets adapters, Stripe-to-Sheets webhook code, setup guide, and architecture decision are implemented and verified locally.
- The owner will supply the Payment Link for each cohort and configure its Stripe-side completed-payment limit.
- D1 remains future/reference infrastructure and is not part of the active configuration.

## Current implementation gate

1. **Complete:** agree on Sheets as the active operational backend and Stripe as the payment source of truth.
2. **Complete:** record the no-temporary-hold decision and the Cloudflare/Apps Script security boundaries.
3. **Complete locally:** implement and verify the Google Sheets integration code and documentation.
4. **Complete:** the owner deployed Apps Script with the private Script Properties.
5. **Complete:** the local workflow proved that a lead row exists before the Stripe page opens.
6. **Stripe test gate:** register/forward a test webhook and prove paid, delayed, duplicate, expired, and refund behavior without using a live Payment Link for test-card data.
7. **Cloudflare preview gate:** configure the same server-only values in the existing Pages project and deploy `croquette` for private review.
8. **Launch gate:** repeat responsive, accessibility, form, Sheet, Stripe, recovery, policy, and monitoring checks before any domain cutover.

## Approved enrollment behavior

- Parent name, student name, parent email, and parent phone are required.
- Recent SAT/PSAT Math score and an additional note are optional.
- The browser gives immediate field feedback; Cloudflare repeats authoritative validation.
- A valid submission is written to Google Sheets before the Stripe URL is returned.
- The Payment Link receives a random lead reference and the locked, validated parent email.
- PiPath never receives or stores card details.
- A verified Stripe webhook updates the existing lead row rather than creating a second customer record.
- Google Sheets is used for lead follow-up and enrollment operations; Stripe remains authoritative for payment/refund status.
- A form submission does not reserve capacity. Payment accepted through the owner-capped Payment Link confirms a seat.
- The post-payment page does not ask the family to repeat information already captured.

## Active technical safeguards

- Apps Script URL, Google shared secret, and Stripe webhook signing secret are server-only.
- Cohort availability and Payment Link selection are server-owned configuration; Stripe is authoritative for the amount and currency actually paid.
- The browser cannot write directly to the Sheet.
- Apps Script runs under the owner, uses a script lock, validates schema, neutralizes formula-leading text, and preserves staff follow-up/internal-note columns.
- Stripe signatures are verified using the raw request body.
- Paid updates must contain a valid Stripe-reported amount and currency, which Apps Script records on the lead.
- Stripe event IDs provide Sheet-level idempotency.
- Lead-store failures stop checkout; payment-update failures cause webhook retry.
- The Sheet remains private and contains only the family/course/operational information PiPath currently needs.

## Inputs and external setup still needed

- A Stripe test-mode Payment Link at a controlled test amount for webhook reconciliation testing.
- Stripe webhook endpoint/signing secret for each preview or production environment.
- Owner-supplied Payment Link for each future cohort, with its capacity limit configured in Stripe.
- Final parent-facing privacy, refund/cancellation, attendance, recording, and enrollment policy language.

The exact Google steps are in `docs/google-sheets-setup.md`. Secrets must not be pasted into documentation, Git, screenshots, or chat.

## Future infrastructure, not active dependencies

- D1 transactional enrollment storage and timed seat reservations.
- Protected owner dashboard.
- Parent portal/passwordless access.
- Multi-student family relationships.
- Attendance, recordings, homework links, notes, and progress summaries.
- Automated email-delivery ledger and retry interface.
- Owner-editable cohort management.
- Private syllabus and secure resources.

These are retained as future ideas, not launch requirements for the current Sheets workflow.
