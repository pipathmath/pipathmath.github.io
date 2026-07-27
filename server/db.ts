import {
  CHECKOUT_RATE_LIMIT,
  CHECKOUT_RATE_WINDOW_MINUTES,
} from "./config";
import { ApiError } from "./http";
import type {
  Attribution,
  CheckoutAttemptRow,
  CohortRow,
  Env,
} from "./types";

export const RESERVE_SEAT_SQL = `
INSERT INTO checkout_attempts (
  id,
  cohort_id,
  status,
  reservation_expires_at,
  request_fingerprint,
  parent_name,
  parent_email,
  parent_phone,
  student_name,
  student_math_score,
  additional_notes,
  ga_client_id,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  utm_term,
  gclid,
  landing_page,
  referrer
)
SELECT
  ?,
  ?,
  'held',
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?
WHERE EXISTS (
  SELECT 1
  FROM cohorts
  WHERE id = ?
    AND status = 'enrolling'
)
AND (
  (
    SELECT COUNT(*)
    FROM enrollments
    WHERE cohort_id = ?
      AND status IN ('paid', 'active')
  ) +
  (
    SELECT COUNT(*)
    FROM checkout_attempts
    WHERE cohort_id = ?
      AND status IN ('held', 'checkout_created')
      AND reservation_expires_at > unixepoch()
  )
) < (
  SELECT capacity
  FROM cohorts
  WHERE id = ?
)
RETURNING id
`;

export async function getCohort(env: Env, cohortId: string): Promise<CohortRow | null> {
  return env.DB.prepare(
    `SELECT id, slug, name, status, capacity, price_cents, currency, starts_at, ends_at
     FROM cohorts
     WHERE id = ?`,
  )
    .bind(cohortId)
    .first<CohortRow>();
}

export async function assertCheckoutRateLimit(
  env: Env,
  requestFingerprint: string,
): Promise<void> {
  const result = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM checkout_attempts
     WHERE request_fingerprint = ?
       AND created_at >= datetime('now', ?)`,
  )
    .bind(requestFingerprint, `-${CHECKOUT_RATE_WINDOW_MINUTES} minutes`)
    .first<{ count: number }>();

  if (Number(result?.count ?? 0) >= CHECKOUT_RATE_LIMIT) {
    throw new ApiError(
      429,
      "checkout_rate_limited",
      "Several checkout attempts were started recently. Please wait a few minutes and try again.",
    );
  }
}

export async function reserveSeat(
  env: Env,
  input: {
    attemptId: string;
    cohortId: string;
    reservationExpiresAt: number;
    requestFingerprint: string;
    parentName: string;
    parentEmail: string;
    parentPhone: string;
    studentName: string;
    studentMathScore: number | null;
    additionalNotes: string | null;
    attribution: Attribution;
  },
): Promise<void> {
  const { attribution } = input;
  const reservation = await env.DB.prepare(RESERVE_SEAT_SQL)
    .bind(
      input.attemptId,
      input.cohortId,
      input.reservationExpiresAt,
      input.requestFingerprint,
      input.parentName,
      input.parentEmail,
      input.parentPhone,
      input.studentName,
      input.studentMathScore,
      input.additionalNotes,
      attribution.gaClientId,
      attribution.utmSource,
      attribution.utmMedium,
      attribution.utmCampaign,
      attribution.utmContent,
      attribution.utmTerm,
      attribution.gclid,
      attribution.landingPage,
      attribution.referrer,
      input.cohortId,
      input.cohortId,
      input.cohortId,
      input.cohortId,
    )
    .first<{ id: string }>();

  if (!reservation) {
    throw new ApiError(
      409,
      "cohort_unavailable",
      "This cohort is full or enrollment is no longer open.",
    );
  }
}

export async function markCheckoutAttempt(
  env: Env,
  attemptId: string,
  status: CheckoutAttemptRow["status"],
): Promise<void> {
  await env.DB.prepare(
    `UPDATE checkout_attempts
     SET status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  )
    .bind(status, attemptId)
    .run();
}

export async function findCheckoutAttempt(
  env: Env,
  attemptId: string,
): Promise<CheckoutAttemptRow | null> {
  return env.DB.prepare(
    `SELECT id, cohort_id, stripe_checkout_session_id, status, reservation_expires_at, ga_client_id,
            parent_name, parent_email, parent_phone, student_name, student_math_score, additional_notes
     FROM checkout_attempts
     WHERE id = ?`,
  )
    .bind(attemptId)
    .first<CheckoutAttemptRow>();
}
