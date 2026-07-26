export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function readJsonBody(request: Request, maxBytes = 12_000): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Send this request as JSON.");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(413, "request_too_large", "The request is too large.");
  }

  const rawBody = await request.text();
  if (rawBody.length > maxBytes) {
    throw new ApiError(413, "request_too_large", "The request is too large.");
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new ApiError(400, "invalid_json", "The request could not be read.");
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;

  if (!origin || origin !== requestOrigin) {
    throw new ApiError(403, "invalid_origin", "This request must start on the PiPath website.");
  }
}

export function methodNotAllowed(allowed: string[]): Response {
  return jsonResponse(
    { error: "method_not_allowed", message: "That request method is not supported." },
    405,
    { allow: allowed.join(", ") },
  );
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse({ error: error.code, message: error.message }, error.status);
  }

  console.error("Unhandled API error", error instanceof Error ? error.message : "unknown");
  return jsonResponse(
    {
      error: "server_error",
      message: "We could not complete that request. Please try again.",
    },
    500,
  );
}
