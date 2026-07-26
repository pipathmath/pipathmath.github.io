import { missingWebhookConfig } from "../../server/config";
import {
  ApiError,
  errorResponse,
  jsonResponse,
} from "../../server/http";
import {
  enrollmentStatusBySession,
  enrollmentStatusByToken,
} from "../../server/onboarding";
import type { Env } from "../../server/types";

function cleanCredential(value: string | null): string | null {
  const cleaned = value?.trim() ?? "";
  return cleaned && cleaned.length <= 300 ? cleaned : null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (missingWebhookConfig(env).includes("ONBOARDING_TOKEN_SECRET")) {
      throw new ApiError(
        503,
        "onboarding_not_configured",
        "Student onboarding is being configured. Please use the link in your confirmation email later.",
      );
    }

    const url = new URL(request.url);
    const sessionId = cleanCredential(url.searchParams.get("session_id"));
    const token = cleanCredential(url.searchParams.get("token"));

    if ((sessionId && token) || (!sessionId && !token)) {
      throw new ApiError(
        400,
        "invalid_enrollment_lookup",
        "Use one secure enrollment reference.",
      );
    }

    const status = sessionId
      ? await enrollmentStatusBySession(env, sessionId)
      : await enrollmentStatusByToken(env, token as string);

    return jsonResponse(status);
  } catch (error) {
    return errorResponse(error);
  }
};
