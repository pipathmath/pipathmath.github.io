import { describe, expect, it } from "vitest";
import { buildPaymentLinkUrl } from "../server/payment-link";

const attribution = {
  gaClientId: null,
  utmSource: "newsletter",
  utmMedium: "email",
  utmCampaign: "august_bootcamp",
  utmContent: null,
  utmTerm: null,
  gclid: null,
  landingPage: "https://www.pipathacademy.com/sat-math-bootcamp",
  referrer: null,
};

describe("Stripe Payment Link handoff", () => {
  it("links the saved lead and locks its validated email", () => {
    const result = new URL(buildPaymentLinkUrl(
      "https://buy.stripe.com/dRmeVcbzcgMf8rd3kG9MY00",
      {
        attemptId: "3f434684-1b29-4d09-b2d6-8be0403b43b6",
        parentEmail: "parent+sat@example.com",
        attribution,
      },
    ));

    expect(result.origin).toBe("https://buy.stripe.com");
    expect(result.searchParams.get("client_reference_id")).toBe(
      "3f434684-1b29-4d09-b2d6-8be0403b43b6",
    );
    expect(result.searchParams.get("locked_prefilled_email")).toBe(
      "parent+sat@example.com",
    );
    expect(result.searchParams.get("utm_source")).toBe("newsletter");
    expect(result.searchParams.get("utm_medium")).toBe("email");
    expect(result.searchParams.get("utm_campaign")).toBe("august_bootcamp");
  });

  it("rejects a non-HTTPS payment destination", () => {
    expect(() => buildPaymentLinkUrl("http://buy.stripe.com/example", {
      attemptId: "attempt-1",
      parentEmail: "parent@example.com",
      attribution,
    })).toThrow("stripe_payment_link_must_use_https");
  });
});
