import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import analyze from "../functions/analyze.mjs";
import coverLetter from "../functions/cover-letter.mjs";
import { SAMPLE_REPORT, VALID_BODY, geminiChunk, groqChunk, post, readEvents, sseResponse } from "./helpers.mjs";

let ipCounter = 0;
const ctx = () => ({ ip: `10.0.0.${++ipCounter}` }); // fresh IP per test → no rate-limit bleed

beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("LLM_PROVIDERS", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("analyze function", () => {
  it("rejects non-POST with 405", async () => {
    const res = await analyze(new Request("http://x/", { method: "GET" }), ctx());
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });

  it("returns 400 for bad JSON and invalid input", async () => {
    expect((await analyze(post("{oops"), ctx())).status).toBe(400);
    const res = await analyze(post({ resume: "short", jobDescription: "short" }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("RESUME_LENGTH");
  });

  it("returns 500 NOT_CONFIGURED when no key is set", async () => {
    const res = await analyze(post(VALID_BODY), ctx());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_CONFIGURED");
  });

  it("rate-limits after 10 requests from one IP", async () => {
    const c = ctx();
    for (let i = 0; i < 10; i++) await analyze(post({}), c);
    const res = await analyze(post({}), c);
    expect(res.status).toBe(429);
  });

  it("streams deltas and a normalized result from Gemini", async () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-gemini");
    const json = JSON.stringify({ ...SAMPLE_REPORT, match_score: 140 });
    const fetchMock = vi.fn(async () => sseResponse([geminiChunk(json.slice(0, 40)), geminiChunk(json.slice(40))]));
    vi.stubGlobal("fetch", fetchMock);

    const res = await analyze(post(VALID_BODY), ctx());
    expect(res.headers.get("content-type")).toMatch(/ndjson/);
    const events = await readEvents(res);

    expect(events.filter((e) => e.type === "delta")).toHaveLength(2);
    const result = events.at(-1);
    expect(result.type).toBe("result");
    expect(result.provider).toBe("gemini");
    expect(result.report.match_score).toBe(100); // clamped
    // Key goes in a header, never the URL.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain("secret-gemini");
    expect(init.headers["x-goog-api-key"]).toBe("secret-gemini");
  });

  it("falls back from Groq to Gemini and never leaks keys or upstream bodies", async () => {
    vi.stubEnv("GROQ_API_KEY", "secret-groq");
    vi.stubEnv("GEMINI_API_KEY", "secret-gemini");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        url.includes("groq.com")
          ? new Response("upstream detail secret-groq", { status: 429 })
          : sseResponse([geminiChunk(JSON.stringify(SAMPLE_REPORT))])
      )
    );

    const res = await analyze(post(VALID_BODY), ctx());
    const raw = await res.clone().text();
    const events = await readEvents(res);
    expect(events.filter((e) => e.type === "status").map((e) => e.provider)).toEqual(["groq", "gemini"]);
    expect(events.at(-1)).toMatchObject({ type: "result", provider: "gemini" });
    expect(raw).not.toContain("secret");
  });

  it("sends reset when a provider fails mid-stream, then uses the next one", async () => {
    vi.stubEnv("GROQ_API_KEY", "q");
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        url.includes("groq.com")
          ? sseResponse([groqChunk('{"match_score": 5, "verd'), "[DONE]"]) // truncated → invalid JSON
          : sseResponse([geminiChunk(JSON.stringify(SAMPLE_REPORT))])
      )
    );
    const events = await readEvents(await analyze(post(VALID_BODY), ctx()));
    const types = events.map((e) => e.type);
    expect(types).toContain("reset");
    expect(types.indexOf("reset")).toBeLessThan(types.lastIndexOf("delta"));
    expect(events.at(-1).report.match_score).toBe(72);
  });

  it("retries Gemini without thinkingConfig when the model rejects it", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g");
    const bodies = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        bodies.push(body.generationConfig.thinkingConfig);
        if (body.generationConfig.thinkingConfig) {
          return new Response('{"error":{"message":"thinking is not supported"}}', { status: 400 });
        }
        return sseResponse([geminiChunk(JSON.stringify(SAMPLE_REPORT))]);
      })
    );
    const events = await readEvents(await analyze(post(VALID_BODY), ctx()));
    expect(bodies).toEqual([{ thinkingLevel: "low" }, { thinkingBudget: 0 }, undefined]);
    expect(events.at(-1).type).toBe("result");
  });

  it("emits a clean error event when every provider fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    const events = await readEvents(await analyze(post(VALID_BODY), ctx()));
    expect(events.at(-1)).toMatchObject({ type: "error", code: "LLM_MODEL_NOT_FOUND" });
  });
});

describe("cover-letter function", () => {
  it("streams a letter using the requested tone", async () => {
    vi.stubEnv("GROQ_API_KEY", "q");
    let sentPrompt = "";
    const letter = "Dear Hiring Manager,\n\n" + "I am excited to apply. ".repeat(10);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        sentPrompt = body.messages[0].content;
        expect(body.response_format).toBeUndefined(); // plain text, not JSON mode
        return sseResponse([groqChunk(letter.slice(0, 50)), groqChunk(letter.slice(50)), "[DONE]"]);
      })
    );
    const events = await readEvents(await coverLetter(post({ ...VALID_BODY, tone: "enthusiastic" }), ctx()));
    expect(sentPrompt).toMatch(/warm and enthusiastic/);
    expect(events.at(-1)).toMatchObject({ type: "result", letter: letter.trim(), provider: "groq" });
  });

  it("validates input like analyze", async () => {
    const res = await coverLetter(post({ resume: "", jobDescription: "" }), ctx());
    expect(res.status).toBe(400);
  });
});
