# PiPath Academy project plan

Last updated: 2026-07-27

## Current state

- Active branch: `croquette`.
- Active local workspace: `C:\Users\SerenaLi\Projects\PiPath\pipathmath.github.io`.
- Production remains on the legacy site.
- Batch 1 closeout and Batch 2 were committed and pushed to `croquette` in `a98d50d`.
- A private local D1 database and Pages/Functions review server remain available; neither is connected to Cloudflare.
- The supplied July Payment Link is wired for visual handoff testing only; a real safe payment test still requires a new test-mode Payment Link and deliberate local enrollment activation.
- The redesigned Home and SAT hero refinements are implemented, verified, and owner-approved for this `croquette` commit/push.
- Next gate: create clean test/live August Payment Links, set the live link's completed-payment limit to 15, and verify lead promotion through the test webhook.
- No reviewed work is to be merged to `main` or connected to Cloudflare at this gate.
- One August SAT cohort is in scope. Multiple cohorts remain a later task.

## Approved sequence and gates

1. **Complete:** finish and verify the Batch 1 closeout.
2. **Complete locally:** implement Batch 2 checkout, D1 enrollment, verified webhook, onboarding, confirmation, email adapter, attribution, and purchase analytics.
3. **Complete:** review Batch 2 behavior, external setup, launch blockers, and local verification.
4. **Complete:** commit and push reviewed Batch 2 work to `croquette` only (`a98d50d`).
5. **Complete:** redesign and review Home using the shared design system while making it visually distinct from the SAT page.
6. **Complete:** add and review the SAT overview video with schedule and consultation actions outside the video card.
7. Build and review a protected owner dashboard before live enrollment operations depend on raw D1 queries.
8. Continue private syllabus/resources and the remaining full-site migration.
9. Complete launch QA, approve policies/content, merge to `main`, and wire Cloudflare only at the final cutover gate.

## Batch 2 approved behavior

- The parent chooses the cohort and completes a short PiPath family form before payment.
- Parent name, student name, parent email, and parent phone are required. SAT/PSAT Math score and an additional note are optional.
- A valid submission saves the lead and creates a 30-minute seat hold before the Stripe Payment Link is returned.
- The Payment Link receives a unique lead reference and locked parent email; Stripe collects payment details on its hosted page.
- PiPath never receives or stores card details.
- The Payment Link carries the checkout reference and available UTM attribution; the saved D1 lead supplies the cohort and family details.
- A verified Stripe webhook promotes the saved lead into exactly one parent, student, payment, and active enrollment in D1.
- The confirmation page says "You're enrolled" without asking the family to repeat the information already submitted.
- Orlando is notified at `pipathmath@gmail.com`; the parent receives confirmation and next steps.
- The successful paid webhook, not an enroll-button click, is the primary purchase conversion. `generate_lead` and `begin_checkout` occur only after a secure Checkout URL is returned.
- August capacity is technically capped at 15.

## Batch 2 technical safeguards

- Stripe webhook and application secrets exist only in Cloudflare secrets/local development variables. The Payment Link URL is non-secret configuration.
- Checkout price and cohort eligibility are determined server-side, never trusted from browser input.
- Webhook signatures are verified from the raw request body.
- Stripe event IDs and Checkout Session IDs are unique in D1 for idempotency.
- D1 capacity reservations expire and prevent the website from issuing more checkout links when its 15 seats are paid or temporarily held. The live Payment Link must separately have a Stripe limit of 15 completed payments to prevent copied-link bypass.
- Enrollment-detail links use non-guessable tokens and private pages are no-index. The legacy onboarding endpoint remains available only for older incomplete records.
- Only the minimum useful student information is collected.
- Logs do not contain card data, Stripe secrets, or full onboarding responses.
- Database migrations are versioned in the repository.

## Inputs or external setup needed before a complete live test

- Cloudflare D1 preview database and binding; the private local D1 review database is already available.
- Clean Stripe test and live Payment Links for the $299 August bootcamp.
- A 15-completed-payment restriction on the live August Payment Link.
- Stripe preview webhook endpoint and signing secret.
- Strong onboarding-token and checkout-rate-limit secrets for each preview/production environment.
- Resend account, verified domain/sender, and API key, or an approved replacement mail provider.
- GA4 Measurement Protocol API secret for verified server-side purchase events.
- Deliberate activation of `PUBLIC_ENROLLMENT_ENABLED` after the preview dependencies are ready.
- Final parent-facing policy language before live sales.

The current public Google Form fields were recovered and implemented; its question list is no longer an outstanding input.

These items do not block local code, schema, unit tests, or mocked integration tests. They do block a real end-to-end payment and email test.

## Protected owner dashboard plan

The owner dashboard is a planned pre-launch operations tool, not part of the public website.

Version 1 should provide:

- owner-only authentication and no public indexing;
- August cohort capacity, paid enrollment, active onboarding, and temporary-hold totals;
- a searchable parent/student roster with payment, onboarding, and refund status;
- email-delivery and Stripe-webhook failure visibility;
- read-only enrollment detail and privacy-conscious CSV export;
- links to Stripe for financial actions rather than direct payment-row editing.

A later controlled-actions version may add student-profile correction, cohort open/close controls, and confirmation-email resend. Every owner mutation must be validated and written to the audit log. Broad cohort editing, parent accounts, and multiple children remain separate future work.

## Home redesign note

Home is the next design priority after Batch 2 review and the approved `croquette` push. The redesign must be client-facing, consistent with the SAT page, and must not use the Duke campus image. It should present the family value proposition, tutoring and SAT pathways, proof, process, and consultation action in a deliberate marketing order.

## Deferred product ideas

- Multiple simultaneous cohorts.
- Owner-editable cohort management.
- Private syllabus and secure resources.
- Parent portal and passwordless login.
- Multiple children under one parent.
- Attendance, recordings, homework links, notes, and progress summaries.
