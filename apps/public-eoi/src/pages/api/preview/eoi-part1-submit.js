const LOCAL_PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

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
  if (!payload || payload.formId !== "eoi_part1" || payload.formPart !== "PART_1" || typeof payload.fields !== "object" || payload.fields === null) {
    return json({ ok: false, code: "invalid_preview_payload" }, { status: 400 });
  }

  return json({
    ok: true,
    preview: true,
    episodeId: `preview-${Date.now()}`,
    receivedAt: new Date().toISOString(),
  });
};
