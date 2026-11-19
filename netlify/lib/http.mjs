export const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

export function errorResponse(status, message, code, extraHeaders) {
  return json(status, { error: { message, code } }, extraHeaders);
}

export function methodNotAllowed(allowed = "POST") {
  return errorResponse(405, `Method not allowed. Use ${allowed}.`, "METHOD_NOT_ALLOWED", { Allow: allowed });
}

export function getClientIp(req, context) {
  return (
    context?.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Streams newline-delimited JSON events to the client. Keeping bytes flowing
 * also stops the CDN from closing an idle connection while the LLM works.
 * `run(send)` receives a `send(event)` function; anything it throws is logged
 * and turned into a clean `{type:"error"}` event (never a stack trace).
 */
export function ndjsonStream(run) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await run(send);
      } catch (err) {
        console.error("[stream] unexpected error:", err?.message || err);
        send({ type: "error", code: "INTERNAL", message: "Something went wrong on the server. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
