import { ApiError } from "./http";
import type {
  Attribution,
  CheckoutRequest,
  Grade,
  InquiryRequest,
  InquiryType,
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

const inquiryTypeValues = new Set<InquiryType>([
  "math-tutoring",
  "small-group",
  "admissions-coaching",
  "sat-bootcamp",
  "other",
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
  errorCode = "invalid_onboarding",
): string {
  const cleaned = cleanOptionalString(value, maxLength);
  if (!cleaned || cleaned.length < minLength) {
    throw new ApiError(400, errorCode, `Please enter ${fieldName}.`);
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

  const parentName = cleanRequiredString(value.parentName, "the parent or guardian's name", 2, 120, "invalid_checkout");
  const parentEmail = cleanRequiredString(value.parentEmail, "the parent or guardian's email", 3, 254, "invalid_checkout").toLowerCase();
  const parentPhone = cleanRequiredString(value.parentPhone, "the parent or guardian's phone number", 7, 30, "invalid_checkout");
  const studentName = cleanRequiredString(value.studentName, "the student's name", 1, 120, "invalid_checkout");
  const studentMathScoreRaw = cleanOptionalString(value.studentMathScore, 4);
  const additionalNotes = cleanOptionalString(value.additionalNotes, 1_000);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(parentEmail)) {
    throw new ApiError(400, "invalid_checkout", "Enter a valid parent or guardian email address.");
  }

  const phoneDigits = parentPhone.replace(/\D/gu, "");
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    throw new ApiError(400, "invalid_checkout", "Enter a valid parent or guardian phone number.");
  }

  let studentMathScore: number | null = null;
  if (studentMathScoreRaw) {
    studentMathScore = Number(studentMathScoreRaw);
    if (!Number.isInteger(studentMathScore) || studentMathScore < 160 || studentMathScore > 800) {
      throw new ApiError(400, "invalid_checkout", "Enter a SAT or PSAT Math score from 160 to 800, or leave it blank.");
    }
  }

  return {
    cohortId,
    parentName,
    parentEmail,
    parentPhone,
    studentName,
    studentMathScore,
    additionalNotes,
    attribution: parseAttribution(value.attribution),
  };
}

export function parseInquiryRequest(value: unknown): InquiryRequest {
  if (!isRecord(value)) {
    throw new ApiError(400, "invalid_inquiry", "The inquiry is incomplete.");
  }

  const contactName = cleanRequiredString(
    value.contactName,
    "your name",
    2,
    120,
    "invalid_inquiry",
  );
  const email = cleanRequiredString(
    value.email,
    "your email address",
    3,
    254,
    "invalid_inquiry",
  ).toLowerCase();
  const phone = cleanOptionalString(value.phone, 30);
  const inquiryType = cleanOptionalString(value.inquiryType, 30) as InquiryType | null;
  const studentCourse = cleanOptionalString(value.studentCourse, 160);
  const message = cleanOptionalString(value.message, 1_500);
  const website = cleanOptionalString(value.website, 200);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new ApiError(400, "invalid_inquiry", "Enter a valid email address.");
  }

  if (phone) {
    const phoneDigits = phone.replace(/\D/gu, "");
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      throw new ApiError(400, "invalid_inquiry", "Enter a valid phone number or leave it blank.");
    }
  }

  if (!inquiryType || !inquiryTypeValues.has(inquiryType)) {
    throw new ApiError(400, "invalid_inquiry", "Choose what you are interested in.");
  }

  return {
    contactName,
    email,
    phone,
    inquiryType,
    studentCourse,
    message,
    website,
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
