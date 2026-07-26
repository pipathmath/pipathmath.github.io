import { describe, expect, it } from "vitest";
import { ApiError } from "../server/http";
import { parseCheckoutRequest, parseOnboardingRequest } from "../server/validation";

describe("checkout request validation", () => {
  it("sanitizes attribution and applies server-side length limits", () => {
    const result = parseCheckoutRequest({
      cohortId: " august-2026\u0000 ",
      attribution: {
        utmSource: "google\nads",
        utmCampaign: "x".repeat(250),
      },
    });

    expect(result.cohortId).toBe("august-2026");
    expect(result.attribution.utmSource).toBe("google ads");
    expect(result.attribution.utmCampaign).toHaveLength(200);
    expect(result.attribution.gaClientId).toBeNull();
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
