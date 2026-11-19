// ResumeMatch AI – resume/JD analysis endpoint (streams NDJSON).
// API keys are read ONLY on the server (see ../lib/providers.mjs).
import { errorResponse, getClientIp, methodNotAllowed, ndjsonStream } from "../lib/http.mjs";
import { createRateLimiter } from "../lib/rateLimit.mjs";
import { validateInputs } from "../lib/validate.mjs";
import { buildAnalysisPrompt } from "../lib/prompts.mjs";
import { parseReport } from "../lib/normalize.mjs";
import { configuredProviders } from "../lib/providers.mjs";
import { runWithFallback } from "../lib/runLlm.mjs";

// 10 requests per IP per 10 minutes. In-memory, so best-effort only: counters
// reset when the function cold-starts and are not shared between instances.
const isRateLimited = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

export default async function handler(req, context) {
  if (req.method !== "POST") return methodNotAllowed();

  if (isRateLimited(getClientIp(req, context))) {
    return errorResponse(
      429,
      "You've run 10 analyses in the last 10 minutes. Please take a short break and try again shortly.",
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

  const providers = configuredProviders();
  if (!providers.length) {
    console.error("[analyze] No LLM API key is configured (GROQ_API_KEY / GEMINI_API_KEY)");
    return errorResponse(
      500,
      "The server is not configured yet (missing AI API key). If you own this site, set GROQ_API_KEY or GEMINI_API_KEY in Netlify's environment variables.",
      "NOT_CONFIGURED"
    );
  }

  const prompt = buildAnalysisPrompt(input.resume, input.jd);

  return ndjsonStream(async (send) => {
    const outcome = await runWithFallback({
      providers,
      prompt,
      json: true,
      send,
      finalize: parseReport, // throws on invalid JSON → next provider
    });
    if (outcome.ok) send({ type: "result", report: outcome.result, provider: outcome.provider });
    else send({ type: "error", code: outcome.code, message: outcome.message });
  });
}
