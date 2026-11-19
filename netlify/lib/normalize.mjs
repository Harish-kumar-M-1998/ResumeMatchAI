export function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.min(100, Math.max(0, v)));
}

const str = (v, fallback = "") => (typeof v === "string" ? v.trim() : fallback);
const strArray = (v) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];

export function stripFences(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last > first) t = t.slice(first, last + 1);
  return t;
}

export function parseReport(text) {
  return normalizeReport(JSON.parse(stripFences(text)));
}

export function normalizeReport(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const sf = r.section_feedback && typeof r.section_feedback === "object" ? r.section_feedback : {};
  const NA = "No feedback provided for this section.";

  return {
    match_score: clampScore(r.match_score),
    ats_score: clampScore(r.ats_score),
    verdict: str(r.verdict) || "Analysis complete.",
    matched_keywords: strArray(r.matched_keywords),
    missing_keywords: Array.isArray(r.missing_keywords)
      ? r.missing_keywords
          .map((k) =>
            typeof k === "string"
              ? { keyword: k.trim(), importance: "nice_to_have" }
              : {
                  keyword: str(k?.keyword),
                  importance: k?.importance === "critical" ? "critical" : "nice_to_have",
                }
          )
          .filter((k) => k.keyword)
      : [],
    ats_issues: strArray(r.ats_issues),
    section_feedback: {
      summary: str(sf.summary) || NA,
      experience: str(sf.experience) || NA,
      skills: str(sf.skills) || NA,
      education: str(sf.education) || NA,
      projects: str(sf.projects) || NA,
    },
    bullet_rewrites: Array.isArray(r.bullet_rewrites)
      ? r.bullet_rewrites
          .map((b) => ({ original: str(b?.original), improved: str(b?.improved), reason: str(b?.reason) }))
          .filter((b) => b.original && b.improved)
      : [],
    top_suggestions: strArray(r.top_suggestions),
    red_flags: strArray(r.red_flags),
  };
}
