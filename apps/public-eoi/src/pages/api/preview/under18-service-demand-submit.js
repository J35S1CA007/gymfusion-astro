const LOCAL_PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const APPROVED_AGE_BANDS = new Set(["16-17", "14-15", "10-13", "Under 10", "PREFER_NOT_TO_SAY", ""]);

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });

const isLocalPreviewRequest = (request) => {
  try {
    return LOCAL_PREVIEW_HOSTS.has(new URL(request.url).hostname);
  } catch {
    return false;
  }
};

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export const POST = async ({ request }) => {
  if (!isLocalPreviewRequest(request)) {
    return new Response("Not found", { status: 404 });
  }

  const payload = await readJson(request);
  if (!payload || typeof payload !== "object") {
    return json({ ok: false, code: "invalid_preview_payload" }, { status: 400 });
  }

  const turnstileToken = String(payload.turnstileToken || "").trim();
  const submissionNonce = String(payload.submissionNonce || "").trim();
  const under18AgeBand = String(payload.under18AgeBand || "").trim();

  if (!turnstileToken) {
    return json({ ok: false, code: "turnstile_token_required" }, { status: 400 });
  }

  if (!submissionNonce) {
    return json({ ok: false, code: "submission_nonce_required" }, { status: 400 });
  }

  if (!APPROVED_AGE_BANDS.has(under18AgeBand)) {
    return json({ ok: false, code: "invalid_age_band" }, { status: 400 });
  }

  return json({
    ok: true,
    preview: true,
    recordedAgeBand: under18AgeBand,
    receivedAt: new Date().toISOString(),
  });
};
