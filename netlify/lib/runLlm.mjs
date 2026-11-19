import { describeLlmError } from "./providers.mjs";

// Netlify ends synchronous functions after roughly 26–30 seconds. Stay under it
// so we can always finish the stream with a clean error event.
export const TOTAL_BUDGET_MS = 25_000;

/**
 * Streams a prompt through each configured provider in order until one
 * succeeds. Every text chunk is forwarded as {type:"delta"}. If a provider
 * fails part-way, a {type:"reset"} event tells the client to discard what it
 * has so far before the next provider starts.
 *
 * `finalize(text)` turns the full text into the result (and may throw to
 * reject it, e.g. invalid JSON), which also triggers fallback.
 *
 * Returns { ok: true, result, provider } or { ok: false, code, message }.
 */
export async function runWithFallback({ providers, prompt, json, send, finalize, now = Date.now }) {
  const deadline = now() + TOTAL_BUDGET_MS;
  let lastError = null;

  for (const provider of providers) {
    const remaining = deadline - now();
    if (remaining < 3_000) break;

    send({ type: "status", provider: provider.name });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(provider.timeoutMs, remaining));
    let text = "";

    try {
      for await (const chunk of provider.stream({
        apiKey: provider.apiKey,
        model: provider.model,
        prompt,
        json,
        signal: controller.signal,
      })) {
        text += chunk;
        send({ type: "delta", text: chunk });
      }
      const result = finalize(text);
      return { ok: true, result, provider: provider.name, model: provider.model };
    } catch (err) {
      console.error(
        `[llm] ${provider.name} (${provider.model}) failed:`,
        err?.name === "AbortError" ? "timeout" : err?.message,
        err?.detail || ""
      );
      lastError = describeLlmError(err, provider);
      if (text) send({ type: "reset" });
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, ...(lastError || describeLlmError({ name: "AbortError" })) };
}
