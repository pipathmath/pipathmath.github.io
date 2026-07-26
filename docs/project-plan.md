# PiPath Academy project plan

Last updated: 2026-07-26

## Current state

- Active branch: `croquette`.
- Active local workspace: `C:\Users\SerenaLi\Projects\PiPath\pipathmath.github.io`.
- Production remains on the legacy site.
- Batch 1 closeout and Batch 2 local implementation are complete and verified.
- A private local D1 database and Pages/Functions review server are available for Batch 2 review; neither is connected to Cloudflare.
- A real Stripe test-mode checkout still requires sandbox credentials and deliberate local enrollment activation.
- Batch 2 review is approved for commit and push to the `croquette` branch.
- Next product gate: begin the Home redesign after the `croquette` push is confirmed.
- No reviewed work is to be merged to `main` or connected to Cloudflare at this gate.
- One August SAT cohort is in scope. Multiple cohorts remain a later task.

## Approved sequence and gates

1. **Complete:** finish and verify the Batch 1 closeout.
2. **Complete locally:** implement Batch 2 checkout, D1 enrollment, verified webhook, onboarding, confirmation, email adapter, attribution, and purchase analytics.
3. **Complete:** review Batch 2 behavior, external setup, launch blockers, and local verification.
4. **Approved now:** commit and push the reviewed work to `croquette` only.
5. Redesign Home using the SAT design system; remove the Duke campus image.
6. Review the Home design and interactions before implementation expands to Math Tutoring and Contact.
7. Build and review a protected owner dashboard before live enrollment operations depend on raw D1 queries.
8. Continue private syllabus/resources and the remaining full-site migration.
9. Complete launch QA, approve policies/content, merge to `main`, and wire Cloudflare only at the final cutover gate.

## Batch 2 approved behavior

- Payment is the enrollment event.
- There is no registration form before Stripe Checkout.
- The server verifies that the one supported cohort is open and has capacity.
- Stripe collects the parent or guardian name, email, phone, and payment details.
- PiPath never receives or stores card details.
- Stripe metadata carries the cohort ID and marketing attribution.
- A verified Stripe webhook creates exactly one paid enrollment in D1.
- The confirmation page says "You're enrolled" before requesting academic information.
- Post-payment onboarding collects the current Google Form questions and can be completed immediately or later.
- Orlando is notified at `pipathmath@gmail.com`; the parent receives confirmation and next steps.
- The successful paid webhook, not an enroll-button click, is the primary purchase conversion.
- August capacity is technically capped at 15.

## Batch 2 technical safeguards

- Stripe secrets and webhook secrets exist only in Cloudflare secrets/local development variables.
- Checkout price and cohort eligibility are determined server-side, never trusted from browser input.
- Webhook signatures are verified from the raw request body.
- Stripe event IDs and Checkout Session IDs are unique in D1 for idempotency.
- Capacity reservations expire and cannot oversell the cohort under concurrent checkout starts.
- Onboarding links use non-guessable tokens and private pages are no-index.
- Only the minimum useful student information is collected.
- Logs do not contain card data, Stripe secrets, or full onboarding responses.
- Database migrations are versioned in the repository.

## Inputs or external setup needed before a complete live test

- Cloudflare D1 preview database and binding; the private local D1 review database is already available.
- Stripe test secret key.
- Stripe test Price ID for the $299 bootcamp.
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
