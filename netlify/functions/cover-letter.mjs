// ResumeMatch AI – cover letter endpoint (streams NDJSON).
import { errorResponse, getClientIp, methodNotAllowed, ndjsonStream } from "../lib/http.mjs";
import { createRateLimiter } from "../lib/rateLimit.mjs";
import { validateInputs } from "../lib/validate.mjs";
import { buildCoverLetterPrompt, TONES } from "../lib/prompts.mjs";
import { configuredProviders } from "../lib/providers.mjs";
import { runWithFallback } from "../lib/runLlm.mjs";

// Best-effort in-memory limit (resets on cold start), see analyze.mjs.
const isRateLimited = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

export default async function handler(req, context) {
  if (req.method !== "POST") return methodNotAllowed();

  if (isRateLimited(getClientIp(req, context))) {
    return errorResponse(
      429,
      "You've generated 10 cover letters in the last 10 minutes. Please take a short break and try again.",
      "RATE_LIMITED"
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Request body must be valid JSON.", "BAD_JSON");
  }

  const input = validateInputs(body);
  if (!input.ok) return errorResponse(400, input.message, input.code);

  const tone = Object.hasOwn(TONES, body?.tone) ? body.tone : "professional";

  const providers = configuredProviders();
  if (!providers.length) {
    console.error("[cover-letter] No LLM API key is configured");
    return errorResponse(
      500,
      "The server is not configured yet (missing AI API key). If you own this site, set GROQ_API_KEY or GEMINI_API_KEY in Netlify's environment variables.",
      "NOT_CONFIGURED"
    );
  }

  const prompt = buildCoverLetterPrompt(input.resume, input.jd, tone);

  return ndjsonStream(async (send) => {
    const outcome = await runWithFallback({
      providers,
      prompt,
      json: false,
      send,
      finalize: (text) => {
        const letter = text.trim();
        if (letter.length < 100) throw new Error("Cover letter too short");
        return letter;
      },
    });
    if (outcome.ok) send({ type: "result", letter: outcome.result, provider: outcome.provider });
    else send({ type: "error", code: outcome.code, message: outcome.message });
  });
}
