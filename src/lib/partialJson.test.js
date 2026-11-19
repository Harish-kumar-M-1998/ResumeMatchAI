import { describe, expect, it } from "vitest";
import { parsePartialJson } from "./partialJson.js";

const FULL = JSON.stringify({
  match_score: 78,
  ats_score: 64,
  verdict: 'Good "fit" overall',
  matched_keywords: ["React", "Redux"],
  missing_keywords: [{ keyword: "TypeScript", importance: "critical" }],
});

describe("parsePartialJson", () => {
  it("returns null for empty or non-object input", () => {
    expect(parsePartialJson("")).toBeNull();
    expect(parsePartialJson("hello")).toBeNull();
  });

  it("parses complete JSON, including inside code fences", () => {
    expect(parsePartialJson(FULL).match_score).toBe(78);
    expect(parsePartialJson("```json\n" + FULL).ats_score).toBe(64);
  });

  it("never exposes a half-written number", () => {
    const upTo7 = FULL.slice(0, FULL.indexOf("78") + 1); // ...:"7
    expect(parsePartialJson(upTo7)).toEqual({});
  });

  it("closes an unfinished string value so text streams in", () => {
    const cut = FULL.slice(0, FULL.indexOf("overall") + 3);
    expect(parsePartialJson(cut).verdict).toBe('Good "fit" ove');
  });

  it("handles a cut in the middle of an escape sequence", () => {
    const cut = FULL.slice(0, FULL.indexOf('\\"fit') + 1); // ends with a backslash
    expect(parsePartialJson(cut).verdict).toBe("Good ");
  });

  it("drops a dangling key without a value", () => {
    const cut = FULL.slice(0, FULL.indexOf('"verdict"') + 5);
    expect(parsePartialJson(cut)).toEqual({ match_score: 78, ats_score: 64 });
  });

  it("is monotonic enough to stream: every prefix parses to an object or null", () => {
    for (let i = 0; i <= FULL.length; i++) {
      const v = parsePartialJson(FULL.slice(0, i));
      expect(v === null || typeof v === "object").toBe(true);
    }
  });
});
