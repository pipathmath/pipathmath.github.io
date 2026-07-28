# PiPath deferred D1 database reference

Status: inactive future/reference architecture as of 2026-07-27. Google Sheets is the active operations record, there is no D1 binding in the current Wrangler configuration, and the `d1:local:*` package commands were removed. Do not use the SQL below as current enrollment operations or add D1 beside Sheets without an approved replacement/dual-write decision.

## Schema map

Migration `migrations/0001_enrollment.sql` currently creates:

| Table | Purpose and important keys |
| --- | --- |
| `cohorts` | Offer, status, capacity, price, currency, dates; `id` and `slug` unique |
| `checkout_attempts` | Seat holds, Stripe Session link, rate-limit fingerprint, attribution; Session ID unique |
| `parents` | Guardian contact and Stripe Customer ID; case-insensitive email unique |
| `students` | Academic onboarding data linked to a parent |
| `enrollments` | Cohort/parent/student relationship; checkout attempt and Stripe Session unique |
| `payments` | Payment Intent, amount/refund status, receipt; Payment Intent unique |
| `access_tokens` | Hashed onboarding/syllabus access; token hash and enrollment/purpose unique |
| `stripe_events` | Minimal webhook idempotency ledger; Stripe event ID primary key |
| `email_deliveries` | Parent/owner delivery state; enrollment/kind unique |
| `inquiries` | Future/general contact inquiries |
| `audit_events` | Operational action history and privacy-conscious JSON metadata |

Current seed: `august-2026`, `enrolling`, capacity `15`, price `29900` cents USD, August 18 through September 10, 2026.

## Relationships

```text
cohorts --< checkout_attempts
cohorts --< enrollments >-- parents --< students
checkout_attempts --1 enrollment
enrollments --< payments
enrollments --< access_tokens
enrollments --< email_deliveries
```

`stripe_events` is an event ledger rather than a foreign-key child. `audit_events` uses generic `entity_type` and `entity_id` so future owner operations can be logged without coupling the table to one entity.

## Status lifecycles

- Cohort: `draft | enrolling | waitlist | closed`.
- Checkout attempt: `held -> checkout_created -> completed`; or `held/checkout_created -> expired|failed`.
- Enrollment: `paid -> active`; `paid|active -> refunded|cancelled` as approved business behavior permits.
- Payment: `paid -> partially_refunded|refunded`; `failed` is available for reconciled failure records.
- Stripe event: `processing -> processed|failed`; failed events may be retried and re-enter `processing`.
- Email delivery: `pending -> sent|failed`; already-sent enrollment/kind pairs are not sent twice.

## Historical/future local database workflow

The commands below require deliberately restoring a local D1 binding and are not valid in the current active configuration. They are retained to support a future transactional-storage evaluation.

If D1 is reconsidered, create a separate approved local configuration, apply the retained migrations to disposable state, and keep every inspection explicitly `--local`.

Inspect the cohort:

```powershell
npx wrangler d1 execute DB --local --command "SELECT id, name, status, capacity, price_cents, currency, starts_at, ends_at FROM cohorts;"
```

Inspect capacity and live holds:

```powershell
npx wrangler d1 execute DB --local --command "SELECT c.id, c.capacity, (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id AND e.status IN ('paid','active')) AS enrolled_seats, (SELECT COUNT(*) FROM checkout_attempts a WHERE a.cohort_id = c.id AND a.status IN ('held','checkout_created') AND a.reservation_expires_at > unixepoch()) AS live_holds FROM cohorts c;"
```

Inspect recent checkout attempts:

```powershell
npx wrangler d1 execute DB --local --command "SELECT id, cohort_id, stripe_checkout_session_id, status, reservation_expires_at, created_at, updated_at FROM checkout_attempts ORDER BY created_at DESC LIMIT 20;"
```

Inspect enrollments with parent/payment/onboarding state:

```powershell
npx wrangler d1 execute DB --local --command "SELECT e.id, e.cohort_id, e.status AS enrollment_status, e.paid_at, p.full_name, p.email, pay.status AS payment_status, pay.amount_cents, pay.refunded_cents, CASE WHEN e.student_id IS NULL THEN 'pending' ELSE 'complete' END AS onboarding_status FROM enrollments e JOIN parents p ON p.id = e.parent_id LEFT JOIN payments pay ON pay.enrollment_id = e.id ORDER BY e.created_at DESC LIMIT 20;"
```

Inspect student onboarding without displaying narrative academic notes by default:

```powershell
npx wrangler d1 execute DB --local --command "SELECT s.id, s.parent_id, s.first_name, s.last_name, s.grade, s.score_range, s.onboarding_completed_at, s.updated_at FROM students s ORDER BY s.updated_at DESC LIMIT 20;"
```

Inspect webhook, email, and audit health:

```powershell
npx wrangler d1 execute DB --local --command "SELECT event_id, event_type, status, processed_at, error_code, created_at FROM stripe_events ORDER BY created_at DESC LIMIT 20;"
npx wrangler d1 execute DB --local --command "SELECT enrollment_id, kind, recipient, status, attempts, provider_message_id, last_error, updated_at FROM email_deliveries ORDER BY updated_at DESC LIMIT 20;"
npx wrangler d1 execute DB --local --command "SELECT action, entity_type, entity_id, metadata_json, created_at FROM audit_events ORDER BY created_at DESC LIMIT 30;"
```

Use full parent contact or `students.target_and_challenges` only when the task requires it. Avoid placing PII or academic narratives in screenshots, logs, commits, or chat.

## How records are added or revised

| Record | Normal writer | Revision rule |
| --- | --- | --- |
| `cohorts` | versioned seed/admin operation | change only through approved migration or audited owner control |
| `checkout_attempts` | checkout Function and Stripe lifecycle handlers | attribution is captured at creation; status follows checkout lifecycle |
| `parents` | paid webhook fulfillment | upsert by normalized email; refresh name, phone, Stripe Customer ID |
| `enrollments` | verified paid webhook | unique by attempt and Session; onboarding links student and activates |
| `payments` | paid/refund webhook handlers | reconcile by Payment Intent; Stripe remains financial source |
| `access_tokens` | paid fulfillment | store hash only; rotate/update by enrollment/purpose |
| `students` | secure onboarding endpoint | create once, then update through the same valid token flow |
| `stripe_events` | verified webhook endpoint | event ID deduplicates; processing status supports retry diagnosis |
| `email_deliveries` | email adapter | unique per enrollment/kind; track attempts/provider/error |
| `audit_events` | backend operations | append; do not edit history |

Do not directly insert or edit paid/refunded financial state merely to make the UI look correct. Investigate Stripe and the webhook first. If a manual operational correction becomes necessary, require explicit approval, capture before/after values, use a narrowly scoped prepared statement or protected owner action, and append an audit event.

## Schema change workflow

1. Inspect all migration files and confirm the next numeric filename.
2. Create an additive migration whenever possible. Preserve existing data and constraints.
3. Update application SQL/types/tests and these inspection queries.
4. Apply locally and run verification.
5. Query `d1_migrations` locally to confirm application order.
6. Before a remote migration, inspect the exact target and list pending migrations. Use `--remote` only after the user approves that database/environment.
7. Verify table shape, counts, constraints, representative joins, and application behavior after applying.

Never point local review at production data for convenience. Use a separate preview D1 for remote end-to-end tests.

## Owner dashboard data layer

Build read models/queries for:

- cohort capacity, paid/active/refunded counts, and unexpired holds;
- parent/student roster and onboarding status;
- payment/refund state with Stripe deep links;
- failed/retrying webhook and email rows;
- recent audit history.

Authenticate before every dashboard query, return minimum fields, paginate lists, validate filters, escape CSV cells, set no-store/no-index controls, and audit exports or future mutations. Do not expose token hashes, rate-limit fingerprints, secrets, or raw academic narratives in overview tables.

Retention, deletion, and correction policies require owner-approved business/privacy rules; do not invent them in code.
