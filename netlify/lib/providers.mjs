// LLM provider adapters. Each adapter is an async generator that yields text
// chunks as the model streams them. All keys are read from process.env here,
// on the server only.

export const PROVIDERS = {
  groq: {
    label: "Groq",
    tagline: "Fastest",
    description: "Open models (Llama) on Groq's custom inference chips. Usually answers in a few seconds.",
    keyVar: "GROQ_API_KEY",
    modelVar: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
    timeoutMs: 15_000,
    stream: (opts) =>
      streamOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", opts),
  },
  gemini: {
    label: "Gemini",
    tagline: "Google",
    description: "Google's Flash model. Detailed, nuanced feedback; can be a little slower.",
    keyVar: "GEMINI_API_KEY",
    modelVar: "GEMINI_MODEL",
    defaultModel: "gemini-flash-latest",
    timeoutMs: 20_000,
    stream: streamGemini,
  },
};

const DEFAULT_ORDER = ["groq", "gemini"];

export const PROVIDER_CHOICES = ["auto", ...Object.keys(PROVIDERS)];

/** Normalizes a client's provider choice; unknown values become "auto". */
export function parseChoice(value) {
  return PROVIDER_CHOICES.includes(value) ? value : "auto";
}

/** Public, key-free description of the configured providers. */
export function publicProviderList(env = process.env) {
  return configuredProviders(env).map(({ name, label, tagline, description, model }) => ({
    id: name,
    label,
    tagline,
    description,
    model,
  }));
}

/**
 * Providers that have an API key configured, in priority order.
 * Order can be overridden with LLM_PROVIDERS="gemini,groq".
 */
export function configuredProviders(env = process.env, choice = "auto") {
  const order = (env.LLM_PROVIDERS || DEFAULT_ORDER.join(","))
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((name, i, arr) => PROVIDERS[name] && arr.indexOf(name) === i);

  return order
    .filter((name) => env[PROVIDERS[name].keyVar]?.trim())
    .filter((name) => choice === "auto" || name === choice)
    .map((name) => {
      const p = PROVIDERS[name];
      return {
        name,
        label: p.label,
        tagline: p.tagline,
        description: p.description,
        apiKey: env[p.keyVar].trim(),
        model: env[p.modelVar]?.trim() || p.defaultModel,
        timeoutMs: p.timeoutMs,
        stream: p.stream,
      };
    });
}

function httpError(status, detail, provider) {
  const err = new Error(`${provider} HTTP ${status}`);
  err.status = status;
  err.detail = String(detail || "").slice(0, 500);
  err.provider = provider;
  return err;
}

/** Parses a Server-Sent Events body and yields each `data:` payload. */
export async function* readSse(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
    const rest = buffer.trim();
    if (rest.startsWith("data:")) yield rest.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible (Groq, and any other provider with the same API shape)
// ---------------------------------------------------------------------------
export async function* streamOpenAICompatible(url, { apiKey, model, prompt, json, signal }) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: json ? 0.3 : 0.6,
      max_tokens: 4096,
      stream: true,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal,
  });
  if (!res.ok) throw httpError(res.status, await res.text().catch(() => ""), "groq");

  for await (const data of readSse(res.body)) {
    if (data === "[DONE]") return;
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    if (event.error) throw httpError(502, JSON.stringify(event.error), "groq");
    const text = event.choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}

// ---------------------------------------------------------------------------
// Google Gemini
// Newer models "think" before answering, which is slow. We ask for minimal
// thinking: Gemini 3+ uses thinkingLevel, 2.5 uses thinkingBudget. If a model
// rejects one form we try the next, ending with no thinkingConfig.
// ---------------------------------------------------------------------------
const THINKING_VARIANTS = [{ thinkingLevel: "low" }, { thinkingBudget: 0 }, null];

export async function* streamGemini({ apiKey, model, prompt, json, signal }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:streamGenerateContent?alt=sse`;

  let res;
  for (const thinking of THINKING_VARIANTS) {
    const generationConfig = {
      temperature: json ? 0.3 : 0.6,
      maxOutputTokens: 8192,
      ...(json ? { responseMimeType: "application/json" } : {}),
      ...(thinking ? { thinkingConfig: thinking } : {}),
    };
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey, // header, not query string, so it never shows in URL logs
      },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig }),
      signal,
    });
    if (res.ok) break;

    const detail = await res.text().catch(() => "");
    if (res.status === 400 && /thinking/i.test(detail) && thinking) {
      console.error(`[llm] ${model} rejected thinkingConfig ${JSON.stringify(thinking)}, retrying`);
      continue;
    }
    throw httpError(res.status, detail, "gemini");
  }

  let produced = false;
  let finishReason;
  for await (const data of readSse(res.body)) {
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    const candidate = event.candidates?.[0];
    finishReason = candidate?.finishReason || finishReason;
    if (event.promptFeedback?.blockReason) {
      throw httpError(502, `blocked: ${event.promptFeedback.blockReason}`, "gemini");
    }
    for (const part of candidate?.content?.parts || []) {
      if (part.text && !part.thought) {
        produced = true;
        yield part.text;
      }
    }
  }
  if (!produced) throw httpError(502, `empty response (finishReason=${finishReason || "unknown"})`, "gemini");
}

// ---------------------------------------------------------------------------
// Error mapping — user-facing messages never include keys or upstream bodies.
// ---------------------------------------------------------------------------
export function describeLlmError(err, provider) {
  const label = provider ? PROVIDERS[provider.name]?.label || provider.name : "The AI service";
  if (err?.name === "AbortError" || err?.name === "TimeoutError") {
    return { code: "LLM_TIMEOUT", message: "The AI took too long to respond. Please try again in a moment." };
  }
  switch (err?.status) {
    case 429:
      return {
        code: "LLM_BUSY",
        message: "The AI service is busy right now (quota reached). Please wait a minute and try again.",
      };
    case 400:
    case 401:
    case 403:
      return {
        code: "LLM_AUTH",
        message: `${label} rejected the request. If you own this site, check its API key in Netlify's environment variables, then redeploy.`,
      };
    case 404:
      return {
        code: "LLM_MODEL_NOT_FOUND",
        message: `The ${label} model "${provider?.model}" was not found. If you own this site, fix the model name in Netlify's environment variables, then redeploy.`,
      };
    default:
      return { code: "LLM_ERROR", message: "The AI service returned an error. Please try again shortly." };
  }
}
