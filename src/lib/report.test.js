import { describe, expect, it } from "vitest";
import { reportToMarkdown, toViewReport } from "./report.js";

const REPORT = {
  match_score: 72,
  ats_score: 81,
  verdict: "Solid fit.",
  matched_keywords: ["React"],
  missing_keywords: [
    { keyword: "TypeScript", importance: "critical" },
    { keyword: "Storybook", importance: "nice_to_have" },
  ],
  ats_issues: ["Uses a two-column layout"],
  section_feedback: { summary: "Clear.", skills: "Add TS." },
  bullet_rewrites: [{ original: "Did stuff", improved: "Built [X] dashboards", reason: "Specific" }],
  top_suggestions: ["Learn TypeScript", "Add tests"],
  red_flags: [],
};

describe("toViewReport", () => {
  it("keeps missing scores as null while streaming", () => {
    const v = toViewReport({ verdict: "Hi" });
    expect(v.match_score).toBeNull();
    expect(v.matched_keywords).toEqual([]);
    expect(v.section_feedback).toEqual({});
  });
  it("drops incomplete items", () => {
    const v = toViewReport({ missing_keywords: [{ keyword: "TS" }, {}], bullet_rewrites: [{ original: "a" }] });
    expect(v.missing_keywords).toEqual([{ keyword: "TS", importance: "nice_to_have" }]);
    expect(v.bullet_rewrites).toEqual([]);
  });
});

describe("reportToMarkdown", () => {
  const md = reportToMarkdown(REPORT, { date: new Date("2026-11-19T00:00:00Z") });

  it("includes scores, verdict and date", () => {
    expect(md).toContain("# ResumeMatch AI report");
    expect(md).toContain("_Generated 2026-11-19_");
    expect(md).toContain("**Job match:** 72/100");
    expect(md).toContain("> Solid fit.");
  });
  it("splits missing keywords by importance", () => {
    expect(md).toContain("**Missing – critical (1):** TypeScript");
    expect(md).toContain("**Missing – nice to have (1):** Storybook");
  });
  it("numbers suggestions and renders rewrites and sections", () => {
    expect(md).toContain("1. Learn TypeScript\n2. Add tests");
    expect(md).toContain("**After:** Built [X] dashboards");
    expect(md).toContain("**Skills:** Add TS.");
    expect(md).toMatch(/## Red flags\n\n- None/);
  });
});
