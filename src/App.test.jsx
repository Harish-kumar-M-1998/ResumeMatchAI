// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App.jsx";

function ndjsonResponse(events) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      for (const e of events) c.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      c.close();
    },
  });
  return new Response(stream, { status: 200 });
}

beforeEach(() => {
  window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("disables Analyze until both inputs are long enough; sample data enables it", () => {
    render(<App />);
    const analyze = screen.getByRole("button", { name: "Analyze match" });
    expect(analyze.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /try with sample data/i }));
    expect(analyze.disabled).toBe(false);
  });

  it("runs an analysis, renders the report, and Start over clears everything", async () => {
    const report = {
      match_score: 68,
      ats_score: 77,
      verdict: "Promising junior fit.",
      matched_keywords: ["React"],
      missing_keywords: [{ keyword: "TypeScript", importance: "critical" }],
      ats_issues: [],
      section_feedback: { summary: "Clear." },
      bullet_rewrites: [],
      top_suggestions: ["Learn TypeScript"],
      red_flags: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ndjsonResponse([
          { type: "status", provider: "groq" },
          { type: "delta", text: JSON.stringify(report) },
          { type: "result", report, provider: "groq" },
        ])
      )
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /try with sample data/i }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze match" }));

    expect(await screen.findByText("Promising junior fit.")).toBeTruthy();
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.getByRole("img", { name: /ATS compatibility: 77/ })).toBeTruthy();
    // Split view: inputs stay editable with a Re-analyze button.
    expect(screen.getByRole("button", { name: "Re-analyze" })).toBeTruthy();
    expect(document.querySelector(".workspace.is-split")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Start over" })[0]);
    await waitFor(() => expect(screen.queryByText("Promising junior fit.")).toBeNull());
    expect(screen.getByLabelText("Your resume").value).toBe("");
  });

  it("shows the server's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ndjsonResponse([{ type: "error", code: "LLM_BUSY", message: "The AI service is busy right now." }]))
    );
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /try with sample data/i }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze match" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/busy right now/);
  });
});
