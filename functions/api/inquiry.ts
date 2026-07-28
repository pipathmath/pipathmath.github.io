import { missingInquiryConfig } from "../../server/config";
import { createGoogleSheetInquiry } from "../../server/google-sheets";
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonBody,
} from "../../server/http";
import type { Env } from "../../server/types";
import { parseInquiryRequest } from "../../server/validation";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    assertSameOrigin(request);

    const missingConfig = missingInquiryConfig(env);
    if (missingConfig.length > 0) {
      console.error("Inquiry configuration missing", missingConfig.join(","));
      throw new ApiError(
        503,
        "inquiry_not_configured",
        "The inquiry form is temporarily unavailable.",
      );
    }

    const input = parseInquiryRequest(await readJsonBody(request));

    // Quietly accept the hidden honeypot so automated submissions do not learn
    // that they were detected. No personal data is stored for these requests.
    if (input.website) {
      return jsonResponse({ ok: true });
    }

    await createGoogleSheetInquiry(env, crypto.randomUUID(), input);
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
};
