ALTER TABLE checkout_attempts ADD COLUMN parent_name TEXT;
ALTER TABLE checkout_attempts ADD COLUMN parent_email TEXT COLLATE NOCASE;
ALTER TABLE checkout_attempts ADD COLUMN parent_phone TEXT;
ALTER TABLE checkout_attempts ADD COLUMN student_name TEXT;
ALTER TABLE checkout_attempts ADD COLUMN student_math_score INTEGER;
ALTER TABLE checkout_attempts ADD COLUMN additional_notes TEXT;

ALTER TABLE students ADD COLUMN display_name TEXT;
ALTER TABLE students ADD COLUMN checkout_attempt_id TEXT REFERENCES checkout_attempts(id);

CREATE INDEX checkout_attempts_parent_email_idx
  ON checkout_attempts (parent_email, created_at);

CREATE UNIQUE INDEX students_checkout_attempt_idx
  ON students (checkout_attempt_id);
