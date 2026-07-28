import { describe, expect, it } from "vitest";
import { ApiError } from "../server/http";
import {
  parseCheckoutRequest,
  parseInquiryRequest,
  parseOnboardingRequest,
} from "../server/validation";

describe("checkout request validation", () => {
  const validCheckout = {
    cohortId: "august-2026",
    parentName: " Grace Hopper ",
    studentName: " Ada Lovelace ",
    parentEmail: " Parent@Example.com ",
    parentPhone: " (919) 555-0123 ",
    studentMathScore: "620",
    additionalNotes: " Geometry is the main concern. ",
  };

  it("sanitizes attribution and applies server-side length limits", () => {
    const result = parseCheckoutRequest({
      ...validCheckout,
      cohortId: " august-2026\u0000 ",
      attribution: {
        utmSource: "google\nads",
        utmCampaign: "x".repeat(250),
      },
    });

    expect(result.cohortId).toBe("august-2026");
    expect(result.parentName).toBe("Grace Hopper");
    expect(result.studentName).toBe("Ada Lovelace");
    expect(result.parentEmail).toBe("parent@example.com");
    expect(result.studentMathScore).toBe(620);
    expect(result.attribution.utmSource).toBe("google ads");
    expect(result.attribution.utmCampaign).toHaveLength(200);
    expect(result.attribution.gaClientId).toBeNull();
  });

  it("accepts blank optional academic information", () => {
    const result = parseCheckoutRequest({
      ...validCheckout,
      studentMathScore: "",
      additionalNotes: "",
    });

    expect(result.studentMathScore).toBeNull();
    expect(result.additionalNotes).toBeNull();
  });

  it("rejects invalid parent contact information and scores", () => {
    expect(() => parseCheckoutRequest({ ...validCheckout, parentEmail: "not-an-email" })).toThrow(
      "Enter a valid parent or guardian email address.",
    );
    expect(() => parseCheckoutRequest({ ...validCheckout, parentPhone: "123" })).toThrow(
      "Please enter the parent or guardian's phone number.",
    );
    expect(() => parseCheckoutRequest({ ...validCheckout, studentMathScore: "900" })).toThrow(
      "Enter a SAT or PSAT Math score from 160 to 800",
    );
  });

  it("rejects requests without a cohort", () => {
    try {
      parseCheckoutRequest([]);
      expect.fail("Expected checkout validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 400,
        code: "invalid_checkout",
      });
    }
  });
});

describe("onboarding request validation", () => {
  const validRequest = {
    token: "secure-onboarding-token-123456",
    studentFirstName: " Ada ",
    studentLastName: " Lovelace ",
    grade: "11",
    scoreRange: "600_700",
    targetAndChallenges: "Target 750; geometry is the main challenge.",
  };

  it("returns a trimmed, typed onboarding payload", () => {
    expect(parseOnboardingRequest(validRequest)).toEqual({
      ...validRequest,
      studentFirstName: "Ada",
      studentLastName: "Lovelace",
    });
  });

  it("rejects an unsupported grade", () => {
    expect(() =>
      parseOnboardingRequest({ ...validRequest, grade: "college" }),
    ).toThrow("Choose the student's grade.");
  });

  it("requires a meaningful target and challenge response", () => {
    expect(() =>
      parseOnboardingRequest({ ...validRequest, targetAndChallenges: "  " }),
    ).toThrow("Please enter the target score and any challenging topics.");
  });
});

describe("contact inquiry validation", () => {
  const validInquiry = {
    contactName: " Grace Hopper ",
    email: " Parent@Example.com ",
    phone: " (919) 555-0123 ",
    inquiryType: "math-tutoring",
    studentCourse: " 10th grade, Algebra II ",
    message: " We would like help with the current unit. ",
    website: "",
    attribution: { utmSource: "newsletter" },
  };

  it("returns a clean inquiry and accepts optional fields", () => {
    expect(parseInquiryRequest(validInquiry)).toMatchObject({
      contactName: "Grace Hopper",
      email: "parent@example.com",
      phone: "(919) 555-0123",
      inquiryType: "math-tutoring",
      studentCourse: "10th grade, Algebra II",
      message: "We would like help with the current unit.",
      website: null,
      attribution: { utmSource: "newsletter" },
    });

    const withoutOptionalFields = parseInquiryRequest({
      ...validInquiry,
      phone: "",
      studentCourse: "",
      message: "",
    });
    expect(withoutOptionalFields.phone).toBeNull();
    expect(withoutOptionalFields.studentCourse).toBeNull();
    expect(withoutOptionalFields.message).toBeNull();

    expect(
      parseInquiryRequest({
        ...validInquiry,
        inquiryType: "admissions-coaching",
      }).inquiryType,
    ).toBe("admissions-coaching");
  });

  it("rejects invalid contact details and inquiry types", () => {
    expect(() => parseInquiryRequest({ ...validInquiry, email: "not-an-email" })).toThrow(
      "Enter a valid email address.",
    );
    expect(() => parseInquiryRequest({ ...validInquiry, phone: "123" })).toThrow(
      "Enter a valid phone number",
    );
    expect(() => parseInquiryRequest({ ...validInquiry, inquiryType: "unknown" })).toThrow(
      "Choose what you are interested in.",
    );
  });
});
