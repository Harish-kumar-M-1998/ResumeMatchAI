const SECTIONS = ["summary", "experience", "skills", "education", "projects"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Shapes a (possibly partial) report so components can render it safely. */
export function toViewReport(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : null);
  const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : []);
  const sf = r.section_feedback && typeof r.section_feedback === "object" ? r.section_feedback : {};

  return {
    match_score: num(r.match_score),
    ats_score: num(r.ats_score),
    verdict: typeof r.verdict === "string" ? r.verdict : "",
    matched_keywords: strs(r.matched_keywords),
    missing_keywords: Array.isArray(r.missing_keywords)
      ? r.missing_keywords
          .filter((k) => k && typeof k.keyword === "string" && k.keyword.trim())
          .map((k) => ({ keyword: k.keyword, importance: k.importance === "critical" ? "critical" : "nice_to_have" }))
      : [],
    ats_issues: strs(r.ats_issues),
    section_feedback: Object.fromEntries(
      SECTIONS.filter((k) => typeof sf[k] === "string" && sf[k].trim()).map((k) => [k, sf[k]])
    ),
    bullet_rewrites: Array.isArray(r.bullet_rewrites)
      ? r.bullet_rewrites.filter((b) => b && typeof b.original === "string" && typeof b.improved === "string")
      : [],
    top_suggestions: strs(r.top_suggestions),
    red_flags: strs(r.red_flags),
  };
}

export function reportToMarkdown(report, { date = new Date() } = {}) {
  const r = toViewReport(report);
  const lines = [];
  const list = (items) => (items.length ? items.map((x) => `- ${x}`) : ["- None"]);

  lines.push("# ResumeMatch AI report", "");
  lines.push(`_Generated ${date.toISOString().slice(0, 10)}_`, "");
  lines.push(`**Job match:** ${r.match_score ?? "–"}/100  `);
  lines.push(`**ATS compatibility:** ${r.ats_score ?? "–"}/100`, "");
  if (r.verdict) lines.push(`> ${r.verdict}`, "");

  lines.push("## Keywords", "");
  lines.push(`**Matched (${r.matched_keywords.length}):** ${r.matched_keywords.join(", ") || "None"}`, "");
  const critical = r.missing_keywords.filter((k) => k.importance === "critical").map((k) => k.keyword);
  const nice = r.missing_keywords.filter((k) => k.importance !== "critical").map((k) => k.keyword);
  lines.push(`**Missing – critical (${critical.length}):** ${critical.join(", ") || "None"}`, "");
  lines.push(`**Missing – nice to have (${nice.length}):** ${nice.join(", ") || "None"}`, "");

  lines.push("## Top suggestions", "");
  lines.push(...(r.top_suggestions.length ? r.top_suggestions.map((s, i) => `${i + 1}. ${s}`) : ["- None"]), "");

  lines.push("## Red flags", "", ...list(r.red_flags), "");
  lines.push("## ATS issues", "", ...list(r.ats_issues), "");

  if (r.bullet_rewrites.length) {
    lines.push("## Bullet rewrites", "");
    r.bullet_rewrites.forEach((b, i) => {
      lines.push(`### ${i + 1}.`, "", `**Before:** ${b.original}`, "", `**After:** ${b.improved}`, "");
      if (b.reason) lines.push(`_Why:_ ${b.reason}`, "");
    });
  }

  lines.push("## Section feedback", "");
  for (const key of SECTIONS) {
    if (r.section_feedback[key]) lines.push(`**${cap(key)}:** ${r.section_feedback[key]}`, "");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function downloadText(filename, text, type = "text/markdown") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fallback for older browsers / insecure contexts.
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}
