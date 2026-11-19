const CLIENT_TIMEOUT_MS = 45_000;

export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/**
 * POSTs to a streaming Netlify function and dispatches its NDJSON events.
 * Handlers: onStatus(provider), onDelta(textSoFar), onReset().
 * Resolves with the final `result` event; rejects with ApiError.
 */
export async function streamFunction(path, payload, { onStatus, onDelta, onReset, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), CLIENT_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort("cancelled");
  signal?.addEventListener("abort", abortFromCaller);

  try {
    let res;
    try {
      res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      throw toNetworkError(err, controller);
    }

    if (!res.ok) {
      let data = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON (e.g. Netlify's HTML 404/502 page).
      }
      if (data?.error?.message) throw new ApiError(data.error.message, data.error.code);
      if (res.status === 404) {
        throw new ApiError(
          "The analysis service wasn't found. If you're running locally, start the app with `npm run netlify:dev` instead of `npm run dev`.",
          "NOT_FOUND"
        );
      }
      if (res.status === 502 || res.status === 504) {
        throw new ApiError("The server took too long to respond. Please try again in a moment.", "GATEWAY");
      }
      throw new ApiError(`The server returned an unexpected error (${res.status}). Please try again.`, "HTTP");
    }

    if (!res.body) throw new ApiError("Your browser doesn't support streaming responses. Please update it.", "NO_STREAM");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    const handle = (line) => {
      if (!line.trim()) return undefined;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return undefined;
      }
      switch (event.type) {
        case "status":
          onStatus?.(event.provider);
          return undefined;
        case "delta":
          text += event.text;
          onDelta?.(text);
          return undefined;
        case "reset":
          text = "";
          onReset?.();
          return undefined;
        case "result":
          return { done: event };
        case "error":
          throw new ApiError(event.message || "The analysis failed. Please try again.", event.code);
        default:
          return undefined;
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const out = handle(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
          if (out?.done) return out.done;
        }
      }
      const out = handle(buffer);
      if (out?.done) return out.done;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw toNetworkError(err, controller);
    }

    throw new ApiError("The connection closed before the analysis finished. Please try again.", "INCOMPLETE");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

function toNetworkError(err, controller) {
  if (controller.signal.aborted) {
    if (controller.signal.reason === "cancelled") return new ApiError("Cancelled.", "CANCELLED");
    return new ApiError("The request timed out. The AI may be busy — please try again in a minute.", "CLIENT_TIMEOUT");
  }
  return new ApiError("Couldn't reach the server. Check your internet connection and try again.", "NETWORK");
}

export async function analyzeResume(resume, jobDescription, handlers) {
  const event = await streamFunction("/.netlify/functions/analyze", { resume, jobDescription }, handlers);
  if (!event.report || typeof event.report.match_score !== "number") {
    throw new ApiError("The server returned an unexpected response. Please try again.", "BAD_RESPONSE");
  }
  return event.report;
}

export async function generateCoverLetter(resume, jobDescription, tone, handlers) {
  const event = await streamFunction("/.netlify/functions/cover-letter", { resume, jobDescription, tone }, handlers);
  if (typeof event.letter !== "string") {
    throw new ApiError("The server returned an unexpected response. Please try again.", "BAD_RESPONSE");
  }
  return event.letter;
}
