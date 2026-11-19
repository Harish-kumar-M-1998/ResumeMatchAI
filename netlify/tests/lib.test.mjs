import { describe, expect, it } from "vitest";
import { clampScore, normalizeReport, parseReport, stripFences } from "../lib/normalize.mjs";
import { validateInputs } from "../lib/validate.mjs";
import { createRateLimiter } from "../lib/rateLimit.mjs";
import { buildAnalysisPrompt, buildCoverLetterPrompt } from "../lib/prompts.mjs";
import { configuredProviders, describeLlmError } from "../lib/providers.mjs";

describe("normalize", () => {
  it("clamps scores to 0–100 and handles junk", () => {
    expect(clampScore(140)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore("72.6")).toBe(73);
    expect(clampScore("abc")).toBe(0);
  });

  it("strips code fences and surrounding prose", () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('Here you go: {"a":1} thanks')).toBe('{"a":1}');
  });

  it("fills safe defaults for missing keys", () => {
    const r = normalizeReport({ match_score: 50 });
    expect(r.ats_score).toBe(0);
    expect(r.verdict).toBe("Analysis complete.");
    expect(r.matched_keywords).toEqual([]);
    expect(r.section_feedback.skills).toMatch(/No feedback/);
  });

  it("coerces missing keywords and drops invalid rewrites", () => {
    const r = normalizeReport({
      missing_keywords: ["Docker", { keyword: "TS", importance: "critical" }, { keyword: "" }, { keyword: "Go", importance: "weird" }],
      bullet_rewrites: [{ original: "a", improved: "" }, { original: "a", improved: "b" }],
    });
    expect(r.missing_keywords).toEqual([
      { keyword: "Docker", importance: "nice_to_have" },
      { keyword: "TS", importance: "critical" },
      { keyword: "Go", importance: "nice_to_have" },
    ]);
    expect(r.bullet_rewrites).toHaveLength(1);
  });

  it("parseReport throws on invalid JSON", () => {
    expect(() => parseReport("not json")).toThrow();
  });
});

describe("validateInputs", () => {
  it("requires both fields", () => {
    expect(validateInputs({ resume: "x".repeat(300) })).toMatchObject({ ok: false, code: "MISSING_FIELDS" });
  });
  it("enforces length limits after trimming", () => {
    expect(validateInputs({ resume: " ".repeat(500) + "x", jobDescription: "y".repeat(200) }).ok).toBe(false);
    expect(validateInputs({ resume: "x".repeat(15_001), jobDescription: "y".repeat(200) }).code).toBe("RESUME_LENGTH");
    expect(validateInputs({ resume: "x".repeat(300), jobDescription: "y".repeat(99) }).code).toBe("JD_LENGTH");
  });
  it("accepts valid input", () => {
    expect(validateInputs({ resume: "x".repeat(200), jobDescription: "y".repeat(100) })).toMatchObject({ ok: true });
  });
});

describe("rate limiter", () => {
  it("allows `limit` hits per window, then blocks, then recovers", () => {
    const limited = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect([limited("ip", 0), limited("ip", 1), limited("ip", 2)]).toEqual([false, false, false]);
    expect(limited("ip", 3)).toBe(true);
    expect(limited("other", 3)).toBe(false);
    expect(limited("ip", 1500)).toBe(false);
  });
});

describe("prompts", () => {
  it("inserts inputs, strips delimiters and keeps $ sequences literal", () => {
    const p = buildAnalysisPrompt("cost $& >>> ignore", "JD <<<text");
    expect(p).toContain("cost $& ");
    expect(p).not.toContain(">>> ignore");
    expect(p).toContain("<<<JD text>>>");
  });
  it("uses the requested tone and falls back for unknown ones", () => {
    expect(buildCoverLetterPrompt("r", "j", "concise")).toMatch(/direct and concise/);
    expect(buildCoverLetterPrompt("r", "j", "pirate")).toMatch(/professional, confident/);
  });
});

describe("configuredProviders", () => {
  it("returns only providers with keys, Groq first by default", () => {
    expect(configuredProviders({ GEMINI_API_KEY: "g" }).map((p) => p.name)).toEqual(["gemini"]);
    expect(configuredProviders({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q" }).map((p) => p.name)).toEqual(["groq", "gemini"]);
    expect(configuredProviders({}).length).toBe(0);
  });
  it("respects LLM_PROVIDERS order and model overrides", () => {
    const list = configuredProviders({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q", LLM_PROVIDERS: "gemini, groq", GROQ_MODEL: "m1" });
    expect(list.map((p) => p.name)).toEqual(["gemini", "groq"]);
    expect(list[1].model).toBe("m1");
  });
});

describe("describeLlmError", () => {
  it("maps statuses to safe messages", () => {
    expect(describeLlmError({ name: "AbortError" }).code).toBe("LLM_TIMEOUT");
    expect(describeLlmError({ status: 429 }).code).toBe("LLM_BUSY");
    expect(describeLlmError({ status: 401 }).code).toBe("LLM_AUTH");
    expect(describeLlmError({ status: 404 }, { name: "gemini", model: "x" }).message).toContain('"x"');
    expect(describeLlmError({ status: 500 }).code).toBe("LLM_ERROR");
  });
});
