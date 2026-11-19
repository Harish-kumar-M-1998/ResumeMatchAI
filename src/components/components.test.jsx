// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import KeywordChips from "./KeywordChips.jsx";
import ScoreRing, { scoreTone } from "./ScoreRing.jsx";
import Results from "./Results.jsx";
import { toViewReport } from "../lib/report.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("scoreTone", () => {
  it("uses red < 50, amber 50–74, green ≥ 75", () => {
    expect([scoreTone(49), scoreTone(50), scoreTone(74), scoreTone(75)]).toEqual(["bad", "warn", "warn", "good"]);
  });
});

describe("ScoreRing", () => {
  it("has an accessible label with score and rating", () => {
    render(<ScoreRing score={82} label="Job match" />);
    expect(screen.getByRole("img", { name: "Job match: 82 out of 100 (Strong)" })).toBeTruthy();
  });
});

describe("KeywordChips", () => {
  it("copies all missing keywords, critical first, and shows Copied for 2s", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <KeywordChips
        matched={["React"]}
        missing={[
          { keyword: "Storybook", importance: "nice_to_have" },
          { keyword: "TypeScript", importance: "critical" },
        ]}
      />
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /copy all/i })));
    expect(writeText).toHaveBeenCalledWith("TypeScript, Storybook");
    expect(screen.getByRole("button", { name: /copied/i })).toBeTruthy();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("button", { name: /copy all/i })).toBeTruthy();
  });

  it("hides Copy all when nothing is missing", () => {
    render(<KeywordChips matched={["React"]} missing={[]} />);
    expect(screen.queryByRole("button", { name: /copy all/i })).toBeNull();
  });
});

describe("Results", () => {
  const full = toViewReport({
    match_score: 72,
    ats_score: 40,
    verdict: "Solid fit.",
    matched_keywords: ["React"],
    missing_keywords: [],
    section_feedback: { summary: "Clear." },
  });

  it("shows placeholders and hides actions while streaming", () => {
    render(<Results report={toViewReport({ verdict: "Partial" })} streaming onReset={() => {}} />);
    expect(screen.getByText("Writing…")).toBeTruthy();
    expect(screen.getByText("Partial")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /generate cover letter/i })).toBeNull();
  });

  it("shows scores, report actions and the cover letter once complete", () => {
    const onReset = vi.fn();
    render(<Results report={full} streaming={false} onReset={onReset} resume="r" jobDescription="j" />);
    expect(screen.getByRole("img", { name: /Job match: 72/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download .md" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save as PDF" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /generate cover letter/i })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Start over" })[0]);
    expect(onReset).toHaveBeenCalled();
  });
});
