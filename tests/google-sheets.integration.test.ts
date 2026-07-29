import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { onRequestPost } from "../functions/api/checkout";
import type { Env } from "../server/types";

const integrationEnabled =
  process.env.RUN_GOOGLE_SHEETS_INTEGRATION === "true";

function localServerVariables(): Record<string, string> {
  const contents = readFileSync(
    new URL("../.dev.vars", import.meta.url),
    "utf8",
  );

  return Object.fromEntries(
    contents
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

describe.skipIf(!integrationEnabled)("Google Sheets external integration", () => {
  it("writes a labeled lead before returning the Stripe Payment Link", async () => {
    const variables = localServerVariables();
    const webAppUrl = variables.GOOGLE_SHEETS_WEB_APP_URL?.trim();
    const sharedSecret = variables.GOOGLE_SHEETS_SHARED_SECRET?.trim();

    expect(webAppUrl, "Configure GOOGLE_SHEETS_WEB_APP_URL in .dev.vars").toBeTruthy();
    expect(
      sharedSecret,
      "Configure GOOGLE_SHEETS_SHARED_SECRET in .dev.vars",
    ).toBeTruthy();

    const origin = "http://localhost:8788";
    const request = new Request(`${origin}/api/checkout`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        cohortId: "august-2026",
        parentName: "PiPath Integration Test",
        studentName: "Test Student - Delete Me",
        parentEmail: "pipathmath+integration-test@example.com",
        parentPhone: "919-555-0100",
        studentMathScore: null,
        additionalNotes:
          "Automated lead-to-Sheet integration test on 2026-07-27. Safe to delete.",
        attribution: {
          utmSource: "local_integration_test",
          utmMedium: "development",
          utmCampaign: "google_sheets_setup",
          landingPage: `${origin}/sat-math-bootcamp/`,
        },
      }),
    });

    const env = {
      GOOGLE_SHEETS_WEB_APP_URL: webAppUrl,
      GOOGLE_SHEETS_SHARED_SECRET: sharedSecret,
      STRIPE_PAYMENT_LINK_URL_AUGUST_2026:
        "https://buy.stripe.com/test_example",
    } as Env;

    const response = await onRequestPost({
      request,
      env,
    } as Parameters<typeof onRequestPost>[0]);
    const result = (await response.json()) as {
      url?: string;
      error?: string;
      message?: string;
    };

    expect(
      response.status,
      result.message ?? result.error ?? "Checkout request failed",
    ).toBe(200);
    expect(result.url).toBeTruthy();

    const stripeUrl = new URL(result.url as string);
    expect(stripeUrl.hostname).toBe("buy.stripe.com");
    expect(stripeUrl.searchParams.get("client_reference_id")).toMatch(
      /^[0-9a-f-]{36}$/u,
    );
    expect(stripeUrl.searchParams.get("locked_prefilled_email")).toBe(
      "pipathmath+integration-test@example.com",
    );
  }, 20_000);
});
