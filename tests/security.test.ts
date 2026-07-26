import { describe, expect, it } from "vitest";
import {
  createOnboardingToken,
  createRequestFingerprint,
  maskEmail,
  sha256Hex,
} from "../server/security";
import type { Env } from "../server/types";

const env = {
  ONBOARDING_TOKEN_SECRET: "test-onboarding-secret-with-sufficient-entropy",
  RATE_LIMIT_SALT: "test-rate-limit-salt-with-sufficient-entropy",
} as Env;

describe("secure enrollment tokens", () => {
  it("creates deterministic opaque tokens and stores a different hash", async () => {
    const first = await createOnboardingToken(env, "enrollment-123");
    const second = await createOnboardingToken(env, "enrollment-123");
    const other = await createOnboardingToken(env, "enrollment-456");
    const storedHash = await sha256Hex(first);

    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(storedHash).not.toContain(first);
  });
});

describe("privacy helpers", () => {
  it("fingerprints requests without returning the raw IP or user agent", async () => {
    const request = new Request("https://www.pipathacademy.com/api/checkout", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "user-agent": "PiPath test browser",
      },
    });
    const repeatedRequest = new Request(request);
    const otherRequest = new Request(request.url, {
      headers: {
        "cf-connecting-ip": "203.0.113.11",
        "user-agent": "PiPath test browser",
      },
    });

    const first = await createRequestFingerprint(request, env);
    const second = await createRequestFingerprint(repeatedRequest, env);
    const other = await createRequestFingerprint(otherRequest, env);

    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).not.toContain("203.0.113.10");
    expect(first).not.toContain("PiPath test browser");
  });

  it("masks parent email addresses in enrollment status responses", () => {
    expect(maskEmail("serena@example.com")).toBe("se****@example.com");
    expect(maskEmail("a@example.com")).toBe("a**@example.com");
    expect(maskEmail("invalid-email")).toBe("your email");
  });
});
