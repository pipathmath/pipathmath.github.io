import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../functions/api/inquiry";
import type { Env } from "../server/types";

const env = {
  GOOGLE_SHEETS_WEB_APP_URL:
    "https://script.google.com/macros/s/test-deployment/exec",
  GOOGLE_SHEETS_SHARED_SECRET: "test-shared-secret",
} as Env;

const form = {
  contactName: "Test Parent",
  email: "parent@example.com",
  phone: "919-555-0123",
  inquiryType: "math-tutoring",
  studentCourse: "10th grade, Algebra II",
  message: "The student would like help with the current unit.",
  website: "",
  attribution: {},
};

function inquiryRequest(origin = "https://preview.pipathacademy.pages.dev"): Request {
  return new Request(`${origin}/api/inquiry`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(form),
  });
}

async function callInquiry(request: Request): Promise<Response> {
  return onRequestPost({ request, env } as Parameters<typeof onRequestPost>[0]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("contact inquiry Function", () => {
  it("archives a valid inquiry through Apps Script", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: true, result: "inquiry_created" }),
    );

    const response = await callInquiry(inquiryRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.action).toBe("create_inquiry");
    expect(body.inquiry.inquiryId).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("accepts an inquiry without an optional message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: true, result: "inquiry_created" }),
    );
    const request = inquiryRequest();
    const requestWithoutMessage = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ ...form, message: "" }),
    });

    const response = await callInquiry(requestWithoutMessage);
    expect(response.status).toBe(200);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.inquiry.message).toBeNull();
  });

  it("rejects cross-origin submissions before contacting Google", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const request = inquiryRequest();
    request.headers.set("origin", "https://attacker.example");

    const response = await callInquiry(request);
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("quietly accepts honeypot submissions without storing them", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const request = inquiryRequest();
    const spamRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ ...form, website: "https://spam.example" }),
    });

    const response = await callInquiry(spamRequest);
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a client-safe error when archiving fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: false, code: "unsupported_action" }),
    );

    const response = await callInquiry(inquiryRequest());
    const result = (await response.json()) as { error: string };
    expect(response.status).toBe(502);
    expect(result.error).toBe("lead_store_rejected");
  });
});
