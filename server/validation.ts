import { ApiError } from "./http";
import type {
  Attribution,
  CheckoutRequest,
  Grade,
  OnboardingRequest,
  ScoreRange,
} from "./types";

const gradeValues = new Set<Grade>(["9", "10", "11", "12", "other"]);
const scoreValues = new Set<ScoreRange>([
  "baseline_needed",
  "under_500",
  "500_600",
  "600_700",
  "700_plus",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/[\u0000-\u001F\u007F]/gu, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function cleanRequiredString(
  value: unknown,
  fieldName: string,
  minLength: number,
  maxLength: number,
): string {
  const cleaned = cleanOptionalString(value, maxLength);
  if (!cleaned || cleaned.length < minLength) {
    throw new ApiError(400, "invalid_onboarding", `Please enter ${fieldName}.`);
  }

  return cleaned;
}

function parseAttribution(value: unknown): Attribution {
  const input = isRecord(value) ? value : {};

  return {
    gaClientId: cleanOptionalString(input.gaClientId, 120),
    utmSource: cleanOptionalString(input.utmSource, 200),
    utmMedium: cleanOptionalString(input.utmMedium, 200),
    utmCampaign: cleanOptionalString(input.utmCampaign, 200),
    utmContent: cleanOptionalString(input.utmContent, 200),
    utmTerm: cleanOptionalString(input.utmTerm, 200),
    gclid: cleanOptionalString(input.gclid, 300),
    landingPage: cleanOptionalString(input.landingPage, 2_048),
    referrer: cleanOptionalString(input.referrer, 2_048),
  };
}

export function parseCheckoutRequest(value: unknown): CheckoutRequest {
  if (!isRecord(value)) {
    throw new ApiError(400, "invalid_checkout", "The checkout request is incomplete.");
  }

  const cohortId = cleanOptionalString(value.cohortId, 80);
  if (!cohortId) {
    throw new ApiError(400, "invalid_checkout", "Choose a valid cohort.");
  }

  return {
    cohortId,
    attribution: parseAttribution(value.attribution),
  };
}

export function parseOnboardingRequest(value: unknown): OnboardingRequest {
  if (!isRecord(value)) {
    throw new ApiError(400, "invalid_onboarding", "The onboarding form is incomplete.");
  }

  const token = cleanRequiredString(value.token, "the secure enrollment link", 20, 200);
  const studentFirstName = cleanRequiredString(value.studentFirstName, "the student's first name", 1, 80);
  const studentLastName = cleanRequiredString(value.studentLastName, "the student's last name", 1, 80);
  const grade = cleanOptionalString(value.grade, 10) as Grade | null;
  const scoreRange = cleanOptionalString(value.scoreRange, 30) as ScoreRange | null;
  const targetAndChallenges = cleanRequiredString(
    value.targetAndChallenges,
    "the target score and any challenging topics",
    5,
    1_000,
  );

  if (!grade || !gradeValues.has(grade)) {
    throw new ApiError(400, "invalid_onboarding", "Choose the student's grade.");
  }

  if (!scoreRange || !scoreValues.has(scoreRange)) {
    throw new ApiError(400, "invalid_onboarding", "Choose the most recent score range.");
  }

  return {
    token,
    studentFirstName,
    studentLastName,
    grade,
    scoreRange,
    targetAndChallenges,
  };
}
