// Test helpers. Lives outside netlify/functions so Netlify never deploys it.
export const VALID_BODY = { resume: "R".repeat(300), jobDescription: "J".repeat(150) };

export function sseResponse(payloads, status = 200) {
  const body = payloads.map((p) => `data: ${typeof p === "string" ? p : JSON.stringify(p)}\n\n`).join("");
  return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } });
}

export const geminiChunk = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });
export const groqChunk = (text) => ({ choices: [{ delta: { content: text } }] });

export function post(body, headers = {}) {
  return new Request("http://localhost/.netlify/functions/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export async function readEvents(res) {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export const SAMPLE_REPORT = {
  match_score: 72,
  ats_score: 81,
  verdict: "Solid fit with a few gaps.",
  matched_keywords: ["React", "Redux"],
  missing_keywords: [{ keyword: "TypeScript", importance: "critical" }],
  ats_issues: [],
  section_feedback: { summary: "Clear.", experience: "Good.", skills: "OK.", education: "Fine.", projects: "Nice." },
  bullet_rewrites: [{ original: "Did stuff", improved: "Built X", reason: "Specific" }],
  top_suggestions: ["Add TypeScript"],
  red_flags: [],
};
