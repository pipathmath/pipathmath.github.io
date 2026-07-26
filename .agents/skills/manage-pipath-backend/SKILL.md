---
name: manage-pipath-backend
description: Operate, inspect, explain, troubleshoot, or safely change the PiPath Academy enrollment backend built with Cloudflare Pages Functions, D1, Stripe Checkout/webhooks, Resend, and GA4. Use for database schema or migration work, local/preview/production D1 setup, enrollment/payment/onboarding/refund record review, environment configuration, webhook debugging, backend tests, owner-dashboard data design, or explanations of how PiPath backend records are created and maintained.
---

# Manage PiPath Backend

Use the repository implementation as the source of truth. Keep payment processing, enrollment state, student onboarding, email delivery, analytics, and owner operations consistent across local, preview, and production environments.

## Start every task

1. Work from the approved PiPath repository and inspect `git status`, the active branch, `docs/project-plan.md`, and the latest `docs/implementation-log.md` entry.
2. Identify the target environment before running commands:
   - **local**: ignored Wrangler state under `.wrangler/`; safe default for implementation and inspection;
   - **preview**: remote non-production Cloudflare/Stripe resources; require explicit approval and preview credentials;
   - **production**: live customer/payment data; never access or mutate without explicit user authorization and exact targets.
3. Read the relevant bundled reference before acting:
   - [architecture.md](references/architecture.md) for stack, code ownership, and request flows;
   - [database.md](references/database.md) for tables, relationships, lifecycle, migrations, and inspection queries;
   - [operations.md](references/operations.md) for configuration, Stripe testing, troubleshooting, deployment gates, and owner operations.
4. Re-read the actual migration and affected source modules. If a reference and code differ, treat code/migrations as authoritative, correct the stale reference, and record the correction.
5. State whether the task is inspection-only, local implementation, remote preview work, or production work before making external changes.

## Preserve these invariants

- Treat Stripe as the payment processor and verified Stripe webhooks as the only authority that creates paid enrollments. Never simulate payment by manually inserting a paid enrollment.
- Treat D1 as PiPath's operational record. Do not store card numbers, CVCs, full Stripe event payloads, plaintext onboarding tokens, or raw request IPs.
- Determine cohort eligibility, price, amount, currency, and capacity server-side. Never trust browser-supplied price or paid status.
- Preserve webhook idempotency through unique Stripe event, Checkout Session, Payment Intent, and checkout-attempt identifiers.
- Count paid/active enrollments plus unexpired holds when enforcing capacity. Do not replace the conditional seat-reservation SQL with a read-then-write sequence.
- Keep same-origin, JSON size/type, enum, length, and required-field validation on public write endpoints.
- Hash onboarding tokens before storage; mask parent email in status responses; keep confirmation/onboarding pages out of search and analytics.
- Keep email and analytics failures non-fatal to a verified paid enrollment. Record their status for later review.
- Link financial actions to Stripe. Do not make the owner dashboard a second refund/payment system.
- Record every future owner mutation in `audit_events` with the actor, action, entity, and privacy-conscious metadata.

## Change the database safely

1. Add a new numbered SQL file under `migrations/`; never rewrite an already-applied migration merely to change a deployed schema.
2. Make schema and application changes together. Update TypeScript row types, prepared SQL, validation, tests, inspection queries, and owner-dashboard projections in the same task.
3. Apply and test locally first with `npm run d1:local:migrate`.
4. Inspect the resulting schema and representative records using [database.md](references/database.md).
5. Run `npm run test`, `npm run check`, `npm run build`, and `git diff --check`.
6. Apply remotely only at the approved preview/production gate. Confirm the exact Cloudflare account, database, binding, branch, and migration list before using `--remote`.
7. Do not perform ad hoc production corrections until the owner has approved the exact record and the correction includes an audit trail.

## Diagnose by lifecycle, not by one table

Trace a transaction in this order:

1. `checkout_attempts`: Was a hold created? Did Stripe Session creation succeed? Did the hold expire or fail?
2. Stripe Dashboard/CLI: Was the Checkout Session paid, expired, or failed? Was the expected webhook delivered?
3. `stripe_events`: Was the event received, deduplicated, processed, or failed with an error code?
4. `parents`, `enrollments`, and `payments`: Did the verified paid webhook create the operational records exactly once?
5. `access_tokens` and `students`: Was onboarding access created, and did onboarding activate the enrollment?
6. `email_deliveries` and `audit_events`: Were notifications/analytics attempted, skipped, sent, or failed?

Do not infer a successful payment from a checkout attempt alone. Reconcile with Stripe before correcting financial or enrollment state.

## Owner dashboard rules

Keep the first dashboard owner-only, no-index, privacy-conscious, and primarily read-only. Show capacity, holds, paid/active/refunded counts, searchable enrollment detail, onboarding status, webhook/email failures, and CSV export. Mask or omit sensitive fields in list views. Add narrowly controlled corrections, resend, and cohort controls only later; validate them server-side and audit every mutation.

## Required handoff

For each backend task, report:

- environment and authorization boundary;
- files, schema, bindings, or records examined/changed;
- user-visible and record-lifecycle effects;
- secrets or external setup still required, without exposing values;
- tests and inspection queries run with results;
- commit, push, preview, remote D1, and production status;
- follow-up work and the next approval gate.

Append material implementation decisions and corrections to `docs/implementation-log.md`. Keep `docs/project-plan.md` synchronized when scope or sequencing changes.
