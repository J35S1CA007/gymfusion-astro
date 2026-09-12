const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_MAX_TOKEN_LENGTH = 2048;
const TURNSTILE_ACTION = "member_login";
const TURNSTILE_HOSTNAME = "portal.gymfusion.com.au";
const REQUEST_TIMEOUT_MS = 12_000;

type TurnstileRuntimeBindings = { TURNSTILE_SECRET_KEY?: string };

export class AuthProblem extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 502) {
    super(code);
    this.name = "AuthProblem";
    this.code = code;
    this.status = status;
  }
}

export async function verifyTurnstileToken(token: unknown, bindings?: TurnstileRuntimeBindings): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > TURNSTILE_MAX_TOKEN_LENGTH) return false;
  const secret = String(bindings?.TURNSTILE_SECRET_KEY ?? process.env.TURNSTILE_SECRET_KEY ?? "").trim();
  if (!secret) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      body: JSON.stringify({ secret, response: token }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const payload = await response.json() as { action?: unknown; hostname?: unknown; success?: unknown };
    return payload.success === true && payload.action === TURNSTILE_ACTION && payload.hostname === TURNSTILE_HOSTNAME;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function errorMessage(error: unknown): { message: string; status: number } {
  if (!(error instanceof AuthProblem)) return { message: "We could not complete that request. Please try again.", status: 502 };
  const messages: Record<string, string> = {
    configuration: "Member login is temporarily unavailable.",
    invalid_credentials: "The email or password is incorrect.",
    malformed_response: "We could not complete that request. Please try again.",
    network: "We could not reach the authentication service. Please try again.",
    rate_limited: "Too many attempts. Please wait and try again.",
    timeout: "The authentication service took too long to respond. Please try again.",
  };
  return { message: messages[error.code] || "We could not complete that request. Please try again.", status: error.status };
}
