export interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID_AUGUST_2026: string;
  ONBOARDING_TOKEN_SECRET: string;
  RATE_LIMIT_SALT: string;
  SITE_URL?: string;
  OWNER_EMAIL?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  GA4_MEASUREMENT_ID?: string;
  GA4_API_SECRET?: string;
}

export interface Attribution {
  gaClientId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  gclid: string | null;
  landingPage: string | null;
  referrer: string | null;
}

export interface CheckoutRequest {
  cohortId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  studentName: string;
  studentMathScore: number | null;
  additionalNotes: string | null;
  attribution: Attribution;
}

export type Grade = "9" | "10" | "11" | "12" | "other";

export type ScoreRange =
  | "baseline_needed"
  | "under_500"
  | "500_600"
  | "600_700"
  | "700_plus";

export interface OnboardingRequest {
  token: string;
  studentFirstName: string;
  studentLastName: string;
  grade: Grade;
  scoreRange: ScoreRange;
  targetAndChallenges: string;
}

export interface CohortRow {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "enrolling" | "waitlist" | "closed";
  capacity: number;
  price_cents: number;
  currency: string;
  starts_at: string;
  ends_at: string;
}

export interface CheckoutAttemptRow {
  id: string;
  cohort_id: string;
  stripe_checkout_session_id: string | null;
  status: "held" | "checkout_created" | "completed" | "expired" | "failed";
  reservation_expires_at: number;
  ga_client_id: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  student_name: string | null;
  student_math_score: number | null;
  additional_notes: string | null;
}

export interface EnrollmentStatusRow {
  enrollment_id: string;
  enrollment_status: "paid" | "active" | "refunded" | "cancelled";
  student_id: string | null;
  cohort_id: string;
  cohort_name: string;
  cohort_starts_at: string;
  cohort_ends_at: string;
  parent_email: string;
}
