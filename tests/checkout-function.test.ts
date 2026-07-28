import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../functions/api/checkout";
import type { Env } from "../server/types";

const env = {
  STRIPE_PAYMENT_LINK_URL_AUGUST_2026:
    "https://buy.stripe.com/dRmeVcbzcgMf8rd3kG9MY00",
  GOOGLE_SHEETS_WEB_APP_URL:
    "https://script.google.com/macros/s/test-deployment/exec",
  GOOGLE_SHEETS_SHARED_SECRET: "test-shared-secret",
} as Env;

const form = {
  cohortId: "august-2026",
  parentName: "Test Parent",
  studentName: "Test Student",
  parentEmail: "parent@example.com",
  parentPhone: "919-555-0123",
  studentMathScore: "620",
  additionalNotes: "Local automated test.",
  attribution: {},
};

function checkoutRequest(origin = "https://preview.pipathacademy.pages.dev"): Request {
  return new Request(`${origin}/api/checkout`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(form),
  });
}

async function callCheckout(request: Request): Promise<Response> {
  return onRequestPost({ request, env } as Parameters<typeof onRequestPost>[0]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lead-first checkout Function", () => {
  it("returns Stripe only after Apps Script accepts the lead", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: true, result: "lead_created" }),
    );

    const response = await callCheckout(checkoutRequest());
    const result = (await response.json()) as { url: string };
    const stripeUrl = new URL(result.url);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(stripeUrl.origin).toBe("https://buy.stripe.com");
    expect(stripeUrl.searchParams.get("client_reference_id")).toMatch(
      /^[0-9a-f-]{36}$/u,
    );
    expect(stripeUrl.searchParams.get("locked_prefilled_email")).toBe(
      "parent@example.com",
    );
  });

  it("does not return a payment destination when the lead write fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: false, code: "unauthorized" }),
    );

    const response = await callCheckout(checkoutRequest());
    const result = (await response.json()) as { error: string; url?: string };

    expect(response.status).toBe(502);
    expect(result.error).toBe("lead_store_rejected");
    expect(result.url).toBeUndefined();
  });

  it("rejects cross-origin submissions before contacting Google", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const request = checkoutRequest();
    request.headers.set("origin", "https://attacker.example");

    const response = await callCheckout(request);

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
