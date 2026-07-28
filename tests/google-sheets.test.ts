import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGoogleSheetInquiry,
  createGoogleSheetLead,
  updateGoogleSheetPayment,
} from "../server/google-sheets";
import type {
  CheckoutRequest,
  EnrollmentCohortDefinition,
  Env,
  InquiryRequest,
} from "../server/types";

const env = {
  GOOGLE_SHEETS_WEB_APP_URL:
    "https://script.google.com/macros/s/test-deployment/exec",
  GOOGLE_SHEETS_SHARED_SECRET: "test-shared-secret",
} as Env;

const cohort: EnrollmentCohortDefinition = {
  id: "august-2026",
  name: "August Digital SAT Math Bootcamp",
  status: "enrolling",
  priceCents: 29_900,
  currency: "usd",
};

const checkout: CheckoutRequest = {
  cohortId: cohort.id,
  parentName: "Grace Hopper",
  studentName: "Ada Lovelace",
  parentEmail: "parent@example.com",
  parentPhone: "919-555-0123",
  studentMathScore: 620,
  additionalNotes: "Geometry is the main concern.",
  attribution: {
    gaClientId: "123.456",
    utmSource: "newsletter",
    utmMedium: "email",
    utmCampaign: "august_bootcamp",
    utmContent: null,
    utmTerm: null,
    gclid: null,
    landingPage: "https://www.pipathacademy.com/sat-math-bootcamp",
    referrer: null,
  },
};

const inquiry: InquiryRequest = {
  contactName: "Grace Hopper",
  email: "parent@example.com",
  phone: "919-555-0123",
  inquiryType: "math-tutoring",
  studentCourse: "10th grade, Algebra II",
  message: "The current unit is the main concern.",
  website: null,
  attribution: checkout.attribution,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Google Sheets lead adapter", () => {
  it("sends the complete lead and server-owned price to Apps Script", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: true, result: "lead_created" }),
    );

    await createGoogleSheetLead(
      env,
      "3f434684-1b29-4d09-b2d6-8be0403b43b6",
      cohort,
      checkout,
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(env.GOOGLE_SHEETS_WEB_APP_URL);
    expect(options?.method).toBe("POST");

    const body = JSON.parse(String(options?.body));
    expect(body).toMatchObject({
      action: "create_lead",
      secret: "test-shared-secret",
      lead: {
        leadId: "3f434684-1b29-4d09-b2d6-8be0403b43b6",
        cohortId: "august-2026",
        expectedAmountCents: 29_900,
        expectedCurrency: "usd",
        parentEmail: "parent@example.com",
        studentMathScore: 620,
        utmSource: "newsletter",
      },
    });
  });

  it("sends payment updates using the same lead reference", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: true, result: "payment_updated" }),
    );

    await updateGoogleSheetPayment(env, {
      eventId: "evt_test_123",
      eventType: "checkout.session.completed",
      leadId: "3f434684-1b29-4d09-b2d6-8be0403b43b6",
      paymentIntentId: "pi_test_123",
      checkoutSessionId: "cs_test_123",
      paymentStatus: "paid",
      amountCents: 29_900,
      currency: "usd",
      paidAt: "2026-07-27T20:00:00.000Z",
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      action: "payment_update",
      payment: {
        eventId: "evt_test_123",
        leadId: "3f434684-1b29-4d09-b2d6-8be0403b43b6",
        paymentStatus: "paid",
        amountCents: 29_900,
      },
    });
  });

  it("sends contact inquiries to a separate receiver action", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: true, result: "inquiry_created" }),
    );

    await createGoogleSheetInquiry(
      env,
      "3f434684-1b29-4d09-b2d6-8be0403b43b6",
      inquiry,
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      action: "create_inquiry",
      secret: "test-shared-secret",
      inquiry: {
        inquiryId: "3f434684-1b29-4d09-b2d6-8be0403b43b6",
        inquiryType: "math-tutoring",
        contactName: "Grace Hopper",
        studentCourse: "10th grade, Algebra II",
        utmSource: "newsletter",
      },
    });
    expect(body.inquiry.website).toBeUndefined();
  });

  it("rejects a non-Google receiver URL before sending family data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      createGoogleSheetLead(
        {
          ...env,
          GOOGLE_SHEETS_WEB_APP_URL: "https://example.com/collect",
        },
        "3f434684-1b29-4d09-b2d6-8be0403b43b6",
        cohort,
        checkout,
      ),
    ).rejects.toMatchObject({ code: "lead_store_not_configured" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats an Apps Script rejection as a failed lead save", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: false, code: "unauthorized" }),
    );

    await expect(
      createGoogleSheetLead(
        env,
        "3f434684-1b29-4d09-b2d6-8be0403b43b6",
        cohort,
        checkout,
      ),
    ).rejects.toMatchObject({ code: "lead_store_rejected" });
  });
});
