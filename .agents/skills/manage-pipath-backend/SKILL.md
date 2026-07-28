---
name: manage-pipath-backend
description: Operate, inspect, explain, troubleshoot, or safely change the PiPath Academy lead-first enrollment backend built with Cloudflare Pages Functions, Google Sheets/Apps Script, Stripe Payment Links, and signed Stripe webhooks. Use for lead capture, Sheet schema/operations, Apps Script deployment, Cloudflare environment configuration, webhook debugging, payment reconciliation, backend tests, or future D1 evaluation.
---

# Manage PiPath Backend

Use current code and `docs/decisions/0001-google-sheets-enrollment.md` as the source of truth. Google Sheets is the active operations record; Stripe is the financial source of truth; Cloudflare is the validation/integration layer. D1 files are future/reference infrastructure and are not an active binding.

## Start every task

1. Inspect `git status`, the branch, `docs/project-plan.md`, the latest `docs/implementation-log.md` entry, and the architecture decision.
2. Name the target environment before acting: local, Cloudflare preview, or production.
3. Read the relevant bundled reference completely:
   - `references/architecture.md` for active flow and code ownership;
   - `references/operations.md` for Google/Stripe/Cloudflare configuration, testing, and recovery;
   - `references/database.md` only when explicitly evaluating or restoring the deferred D1 design.
4. Re-read affected source modules. Correct a stale reference in the same task.
5. Separate local code work from owner-run Google/Stripe steps and remote Cloudflare actions.

## Preserve these invariants

- Save a validated lead before returning a Stripe Payment Link.
- A lead does not reserve a seat; accepted Stripe payment confirms the seat.
- Never trust the browser for price, currency, cohort availability, or paid status.
- Verify Stripe's signature from the raw body before any Sheet payment update.
- Match payments using Stripe `client_reference_id`, never by parent/student name alone.
- Keep Google/Stripe secrets and the Apps Script URL out of browser-visible `PUBLIC_` variables.
- Keep the Sheet private and minimize editors. Do not solve Apps Script access issues by making the Sheet public.
- Use Apps Script locking, event-ID deduplication, expected amount/currency checks, and formula-injection neutralization.
- Do not redirect to Stripe when the lead write fails. Return webhook failure when a payment update fails so Stripe can retry.
- Treat Stripe as authoritative for payments, refunds, disputes, and completed-payment limits.
- Do not activate D1 beside Sheets without an approved replacement/dual-write architecture decision.
- Never store or log card details, webhook/shared secrets, full customer payloads, or unnecessary student narratives.

## Diagnose by lifecycle

1. Browser/UI: did local validation pass and did `/api/checkout` return a URL?
2. Cloudflare checkout Function: did server validation and cohort/link configuration pass?
3. Apps Script execution: did the shared secret validate and did `Leads` receive the UUID row?
4. Stripe: did Checkout receive that UUID as `client_reference_id`; what is the actual payment state?
5. Webhook: was the correct signed event delivered, and did Cloudflare return success?
6. Apps Script/Sheet: is the event in `Stripe Events`; did amount/currency match; did the lead row update?

Never infer payment from an opened Checkout or a success page. Reconcile against Stripe.

## Sheet changes

Treat the header order in `integrations/google-apps-script/Code.gs` as a versioned schema. For a new automated column, update Apps Script, TypeScript payloads, tests, setup/current architecture docs, and the implementation log together. Preserve staff-managed follow-up/internal-note fields.

Deploying an updated Apps Script requires an owner-created new deployment version. Saving code alone does not change the versioned web app.

## D1 future-work rule

The migrations and legacy server modules preserve prior work. They are not current commands or operational truth. Reintroduce D1 only when requirements need transactional holds, relational parent/student state, a protected portal/dashboard, or operations that Sheets cannot reliably support. Plan migration/cutover and a single source of truth before writing code.

## Required handoff

Report:

- environment and authorization boundary;
- code, Sheet schema, configuration names, or external records changed;
- lead/payment lifecycle effect;
- owner-run steps and secrets still needed without exposing values;
- tests/builds and real integration cases completed;
- commit, push, deployment, Google, Stripe, and production status;
- next approval gate.

Append material decisions/corrections to `docs/implementation-log.md` and keep `docs/project-plan.md`, setup instructions, and bundled references synchronized.
