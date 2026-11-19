import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeResume, fetchProviders, generateCoverLetter } from "./api.js";

function ndjson(events, { split = 7 } = {}) {
  // Deliberately split lines across chunks to test buffering.
  const text = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < text.length; i += split) c.enqueue(enc.encode(text.slice(i, i + split)));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("analyzeResume", () => {
  it("accumulates deltas, handles reset and resolves with the report", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ndjson([
          { type: "status", provider: "groq" },
          { type: "delta", text: "{bad" },
          { type: "reset" },
          { type: "status", provider: "gemini" },
          { type: "delta", text: '{"match_' },
          { type: "delta", text: 'score":5}' },
          { type: "result", report: { match_score: 5 }, provider: "gemini" },
        ])
      )
    );
    const deltas = [];
    const onReset = vi.fn();
    const onStatus = vi.fn();
    const out = await analyzeResume("r", "j", { onDelta: (t) => deltas.push(t), onReset, onStatus });
    expect(out).toEqual({ report: { match_score: 5 }, provider: "gemini", model: undefined });
    expect(deltas).toEqual(["{bad", '{"match_', '{"match_score":5}']);
    expect(onReset).toHaveBeenCalledOnce();
    expect(onStatus.mock.calls.map((c) => c[0])).toEqual(["groq", "gemini"]);
  });

  it("surfaces an in-stream error event", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ndjson([{ type: "error", code: "LLM_BUSY", message: "Busy." }])));
    await expect(analyzeResume("r", "j")).rejects.toMatchObject({ code: "LLM_BUSY", message: "Busy." });
  });

  it("uses the server's JSON error message for non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Too many", code: "RATE_LIMITED" } }), { status: 429 }))
    );
    await expect(analyzeResume("r", "j")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("explains a 404 (running plain vite) and a gateway timeout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 404 })));
    await expect(analyzeResume("r", "j")).rejects.toThrow(/netlify:dev/);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 504 })));
    await expect(analyzeResume("r", "j")).rejects.toMatchObject({ code: "GATEWAY" });
  });

  it("reports a network failure and an incomplete stream", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(analyzeResume("r", "j")).rejects.toMatchObject({ code: "NETWORK" });
    vi.stubGlobal("fetch", vi.fn(async () => ndjson([{ type: "delta", text: "{" }])));
    await expect(analyzeResume("r", "j")).rejects.toMatchObject({ code: "INCOMPLETE" });
  });

  it("reports cancellation distinctly", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_u, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("x", "AbortError")))))
    );
    const p = analyzeResume("r", "j", { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ code: "CANCELLED" });
  });
});

describe("generateCoverLetter", () => {
  it("posts the tone and provider and resolves with the letter", async () => {
    const fetchMock = vi.fn(async () => ndjson([{ type: "result", letter: "Dear team", provider: "groq", model: "m" }]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateCoverLetter("r", "j", "concise", { provider: "groq" })).resolves.toEqual({
      letter: "Dear team",
      provider: "groq",
      model: "m",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/.netlify/functions/cover-letter");
    expect(JSON.parse(init.body)).toEqual({ resume: "r", jobDescription: "j", tone: "concise", provider: "groq" });
  });
});

describe("fetchProviders", () => {
  it("returns the list, or [] on any failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ providers: [{ id: "groq" }] }))));
    await expect(fetchProviders()).resolves.toEqual([{ id: "groq" }]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 404 })));
    await expect(fetchProviders()).resolves.toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(fetchProviders()).resolves.toEqual([]);
  });
});
