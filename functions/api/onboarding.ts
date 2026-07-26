import {
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonBody,
} from "../../server/http";
import { completeOnboarding } from "../../server/onboarding";
import type { Env } from "../../server/types";
import { parseOnboardingRequest } from "../../server/validation";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    assertSameOrigin(request);
    const input = parseOnboardingRequest(await readJsonBody(request));
    const result = await completeOnboarding(env, input);

    return jsonResponse({
      completed: true,
      studentFirstName: result.firstName,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
