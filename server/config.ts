import type { EnrollmentCohortDefinition, Env } from "./types";

export const AUGUST_COHORT_ID = "august-2026";
export const CHECKOUT_HOLD_SECONDS = 30 * 60;
export const CHECKOUT_RATE_LIMIT = 3;
export const CHECKOUT_RATE_WINDOW_MINUTES = 15;
export const ONBOARDING_TOKEN_VALID_DAYS_AFTER_COHORT = 120;

const requiredCheckoutKeys = [
  "STRIPE_PAYMENT_LINK_URL_AUGUST_2026",
  "GOOGLE_SHEETS_WEB_APP_URL",
  "GOOGLE_SHEETS_SHARED_SECRET",
] as const;

const requiredWebhookKeys = [
  "STRIPE_WEBHOOK_SECRET",
  "GOOGLE_SHEETS_WEB_APP_URL",
  "GOOGLE_SHEETS_SHARED_SECRET",
] as const;

const requiredInquiryKeys = [
  "GOOGLE_SHEETS_WEB_APP_URL",
  "GOOGLE_SHEETS_SHARED_SECRET",
] as const;

const enrollmentCohorts: Record<string, EnrollmentCohortDefinition> = {
  [AUGUST_COHORT_ID]: {
    id: AUGUST_COHORT_ID,
    name: "August Digital SAT Math Bootcamp",
    status: "enrolling",
  },
};

export function missingCheckoutConfig(env: Env): string[] {
  return requiredCheckoutKeys.filter((key) => !env[key]?.trim());
}

export function missingWebhookConfig(env: Env): string[] {
  return requiredWebhookKeys.filter((key) => !env[key]?.trim());
}

export function missingInquiryConfig(env: Env): string[] {
  return requiredInquiryKeys.filter((key) => !env[key]?.trim());
}

export function getStripePaymentLinkUrl(env: Env, cohortId: string): string | null {
  if (cohortId !== AUGUST_COHORT_ID) {
    return null;
  }

  return env.STRIPE_PAYMENT_LINK_URL_AUGUST_2026?.trim() || null;
}

export function getEnrollmentCohort(
  cohortId: string,
): EnrollmentCohortDefinition | null {
  return enrollmentCohorts[cohortId] ?? null;
}

export function getSiteOrigin(request: Request, env: Env): string {
  const configuredOrigin = env.SITE_URL?.trim();

  if (configuredOrigin) {
    return new URL(configuredOrigin).origin;
  }

  return new URL(request.url).origin;
}
