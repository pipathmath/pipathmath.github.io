PRAGMA foreign_keys = ON;

CREATE TABLE cohorts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'enrolling', 'waitlist', 'closed')),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE checkout_attempts (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL REFERENCES cohorts(id),
  stripe_checkout_session_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('held', 'checkout_created', 'completed', 'expired', 'failed')),
  reservation_expires_at INTEGER NOT NULL,
  request_fingerprint TEXT NOT NULL,
  ga_client_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  gclid TEXT,
  landing_page TEXT,
  referrer TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE parents (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE students (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('9', '10', '11', '12', 'other')),
  score_range TEXT NOT NULL CHECK (score_range IN ('baseline_needed', 'under_500', '500_600', '600_700', '700_plus')),
  target_and_challenges TEXT NOT NULL,
  onboarding_completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE enrollments (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL REFERENCES cohorts(id),
  parent_id TEXT NOT NULL REFERENCES parents(id),
  student_id TEXT REFERENCES students(id),
  checkout_attempt_id TEXT NOT NULL UNIQUE REFERENCES checkout_attempts(id),
  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('paid', 'active', 'refunded', 'cancelled')),
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'refunded', 'partially_refunded', 'failed')),
  refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  receipt_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE access_tokens (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('onboarding', 'syllabus')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (enrollment_id, purpose)
);

CREATE TABLE stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'processed', 'failed')),
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  processed_at TEXT
);

CREATE TABLE email_deliveries (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  kind TEXT NOT NULL CHECK (kind IN ('parent_confirmation', 'owner_notification')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (enrollment_id, kind)
);

CREATE TABLE inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX checkout_attempts_capacity_idx
  ON checkout_attempts (cohort_id, status, reservation_expires_at);

CREATE INDEX checkout_attempts_fingerprint_idx
  ON checkout_attempts (request_fingerprint, created_at);

CREATE INDEX enrollments_cohort_status_idx
  ON enrollments (cohort_id, status);

CREATE INDEX students_parent_idx
  ON students (parent_id);

CREATE INDEX payments_enrollment_idx
  ON payments (enrollment_id);

CREATE INDEX access_tokens_enrollment_idx
  ON access_tokens (enrollment_id, purpose);

CREATE INDEX audit_events_entity_idx
  ON audit_events (entity_type, entity_id, created_at);

INSERT OR IGNORE INTO cohorts (
  id,
  slug,
  name,
  status,
  capacity,
  price_cents,
  currency,
  starts_at,
  ends_at
) VALUES (
  'august-2026',
  'august-2026',
  'August Digital SAT Math Bootcamp',
  'enrolling',
  15,
  29900,
  'usd',
  '2026-08-18T19:00:00-04:00',
  '2026-09-10T20:15:00-04:00'
);
