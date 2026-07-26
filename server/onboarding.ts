import { ApiError } from "./http";
import {
  createOnboardingToken,
  maskEmail,
  sha256Hex,
} from "./security";
import type {
  Env,
  EnrollmentStatusRow,
  OnboardingRequest,
} from "./types";

interface EnrollmentAccessRow extends EnrollmentStatusRow {
  token_hash: string;
  expires_at: string | null;
}

export type EnrollmentStatus =
  | { state: "processing" }
  | {
      state: "enrolled";
      cohortId: string;
      cohortName: string;
      startsAt: string;
      endsAt: string;
      maskedParentEmail: string;
      onboardingComplete: boolean;
      onboardingToken: string;
    }
  | { state: "unavailable" };

async function statusFromEnrollment(
  env: Env,
  row: EnrollmentAccessRow,
  suppliedToken?: string,
): Promise<EnrollmentStatus> {
  if (row.enrollment_status === "refunded" || row.enrollment_status === "cancelled") {
    return { state: "unavailable" };
  }

  const token =
    suppliedToken ?? (await createOnboardingToken(env, row.enrollment_id));
  const tokenHash = await sha256Hex(token);

  if (tokenHash !== row.token_hash) {
    throw new ApiError(403, "invalid_enrollment_link", "This enrollment link is not valid.");
  }

  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    throw new ApiError(410, "enrollment_link_expired", "This enrollment link has expired.");
  }

  return {
    state: "enrolled",
    cohortId: row.cohort_id,
    cohortName: row.cohort_name,
    startsAt: row.cohort_starts_at,
    endsAt: row.cohort_ends_at,
    maskedParentEmail: maskEmail(row.parent_email),
    onboardingComplete: Boolean(row.student_id),
    onboardingToken: token,
  };
}

export async function enrollmentStatusBySession(
  env: Env,
  sessionId: string,
): Promise<EnrollmentStatus> {
  const enrollment = await env.DB.prepare(
    `SELECT
       e.id AS enrollment_id,
       e.status AS enrollment_status,
       e.student_id,
       c.id AS cohort_id,
       c.name AS cohort_name,
       c.starts_at AS cohort_starts_at,
       c.ends_at AS cohort_ends_at,
       p.email AS parent_email,
       t.token_hash,
       t.expires_at
     FROM enrollments e
     JOIN cohorts c ON c.id = e.cohort_id
     JOIN parents p ON p.id = e.parent_id
     JOIN access_tokens t
       ON t.enrollment_id = e.id
      AND t.purpose = 'onboarding'
     WHERE e.stripe_checkout_session_id = ?`,
  )
    .bind(sessionId)
    .first<EnrollmentAccessRow>();

  if (enrollment) {
    return statusFromEnrollment(env, enrollment);
  }

  const attempt = await env.DB.prepare(
    `SELECT status
     FROM checkout_attempts
     WHERE stripe_checkout_session_id = ?`,
  )
    .bind(sessionId)
    .first<{ status: string }>();

  if (attempt?.status === "held" || attempt?.status === "checkout_created") {
    return { state: "processing" };
  }

  return { state: "unavailable" };
}

export async function enrollmentStatusByToken(
  env: Env,
  token: string,
): Promise<EnrollmentStatus> {
  const tokenHash = await sha256Hex(token);
  const enrollment = await env.DB.prepare(
    `SELECT
       e.id AS enrollment_id,
       e.status AS enrollment_status,
       e.student_id,
       c.id AS cohort_id,
       c.name AS cohort_name,
       c.starts_at AS cohort_starts_at,
       c.ends_at AS cohort_ends_at,
       p.email AS parent_email,
       t.token_hash,
       t.expires_at
     FROM access_tokens t
     JOIN enrollments e ON e.id = t.enrollment_id
     JOIN cohorts c ON c.id = e.cohort_id
     JOIN parents p ON p.id = e.parent_id
     WHERE t.token_hash = ?
       AND t.purpose = 'onboarding'`,
  )
    .bind(tokenHash)
    .first<EnrollmentAccessRow>();

  if (!enrollment) {
    throw new ApiError(403, "invalid_enrollment_link", "This enrollment link is not valid.");
  }

  return statusFromEnrollment(env, enrollment, token);
}

export async function completeOnboarding(
  env: Env,
  input: OnboardingRequest,
): Promise<{ firstName: string }> {
  const tokenHash = await sha256Hex(input.token);
  const access = await env.DB.prepare(
    `SELECT
       t.enrollment_id,
       t.expires_at,
       e.parent_id,
       e.student_id,
       e.status AS enrollment_status
     FROM access_tokens t
     JOIN enrollments e ON e.id = t.enrollment_id
     WHERE t.token_hash = ?
       AND t.purpose = 'onboarding'`,
  )
    .bind(tokenHash)
    .first<{
      enrollment_id: string;
      expires_at: string | null;
      parent_id: string;
      student_id: string | null;
      enrollment_status: "paid" | "active" | "refunded" | "cancelled";
    }>();

  if (!access) {
    throw new ApiError(403, "invalid_enrollment_link", "This enrollment link is not valid.");
  }

  if (access.expires_at && new Date(access.expires_at).getTime() <= Date.now()) {
    throw new ApiError(410, "enrollment_link_expired", "This enrollment link has expired.");
  }

  if (access.enrollment_status === "refunded" || access.enrollment_status === "cancelled") {
    throw new ApiError(409, "enrollment_inactive", "This enrollment is no longer active.");
  }

  const studentId = access.student_id ?? crypto.randomUUID();
  const studentStatement = access.student_id
    ? env.DB.prepare(
        `UPDATE students
         SET first_name = ?,
             last_name = ?,
             grade = ?,
             score_range = ?,
             target_and_challenges = ?,
             onboarding_completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?
           AND parent_id = ?`,
      ).bind(
        input.studentFirstName,
        input.studentLastName,
        input.grade,
        input.scoreRange,
        input.targetAndChallenges,
        studentId,
        access.parent_id,
      )
    : env.DB.prepare(
        `INSERT INTO students (
           id,
           parent_id,
           first_name,
           last_name,
           grade,
           score_range,
           target_and_challenges,
           onboarding_completed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      ).bind(
        studentId,
        access.parent_id,
        input.studentFirstName,
        input.studentLastName,
        input.grade,
        input.scoreRange,
        input.targetAndChallenges,
      );

  await env.DB.batch([
    studentStatement,
    env.DB.prepare(
      `UPDATE enrollments
       SET student_id = ?,
           status = 'active',
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    ).bind(studentId, access.enrollment_id),
    env.DB.prepare(
      `INSERT INTO audit_events (
         id, action, entity_type, entity_id, metadata_json
       ) VALUES (?, 'student_onboarding_completed', 'enrollment', ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      access.enrollment_id,
      JSON.stringify({ grade: input.grade, scoreRange: input.scoreRange }),
    ),
  ]);

  return { firstName: input.studentFirstName };
}
