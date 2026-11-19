import { forwardRef } from "react";
import { motion } from "motion/react";
import ScoreRing from "./ScoreRing.jsx";
import KeywordChips from "./KeywordChips.jsx";
import SectionFeedback from "./SectionFeedback.jsx";
import BulletRewrites from "./BulletRewrites.jsx";
import Suggestions from "./Suggestions.jsx";
import ReportActions from "./ReportActions.jsx";
import CoverLetter from "./CoverLetter.jsx";

const Placeholder = ({ label }) => (
  <div className="score-ring score-ring--pending" aria-hidden="true">
    <div className="score-ring__dial skeleton-ring" />
    <span className="score-ring__label">{label}</span>
  </div>
);

/** Renders a full or partial (still streaming) report. */
const Results = forwardRef(function Results(
  { report, streaming, meta, providerLabel = (id) => id, onReset, resume, jobDescription, provider = "auto" },
  ref
) {
  const hasKeywords = report.matched_keywords.length > 0 || report.missing_keywords.length > 0;

  return (
    <section className="results" ref={ref} tabIndex={-1} aria-labelledby="results-title" aria-busy={streaming}>
      <div className="results__head">
        <div>
          <h2 id="results-title">
            Your match report
            {streaming && <span className="live-pill">Writing…</span>}
          </h2>
          {meta?.provider && (
            <p className="answered-by">
              Analyzed by <strong>{providerLabel(meta.provider)}</strong>
              {meta.model && <code>{meta.model}</code>}
            </p>
          )}
        </div>
        {!streaming && <ReportActions report={report} onReset={onReset} />}
      </div>

      <motion.div
        className="card scores"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="scores__rings">
          {report.match_score !== null ? (
            <ScoreRing score={report.match_score} label="Job match" caption="How well you fit this role" />
          ) : (
            <Placeholder label="Job match" />
          )}
          {report.ats_score !== null ? (
            <ScoreRing score={report.ats_score} label="ATS compatibility" caption="How well software can parse you" />
          ) : (
            <Placeholder label="ATS compatibility" />
          )}
        </div>
        {report.verdict && <p className="verdict">{report.verdict}</p>}
      </motion.div>

      <div className="results__grid">

      {(hasKeywords || !streaming) && (
        <KeywordChips matched={report.matched_keywords} missing={report.missing_keywords} />
      )}

      {(!streaming || report.top_suggestions.length > 0 || report.ats_issues.length > 0) && (
        <Suggestions
          suggestions={report.top_suggestions}
          redFlags={report.red_flags}
          atsIssues={report.ats_issues}
          streaming={streaming}
        />
      )}

      <BulletRewrites rewrites={report.bullet_rewrites} />
      <SectionFeedback feedback={report.section_feedback} />

      {!streaming && (
        <>
          <CoverLetter resume={resume} jobDescription={jobDescription} provider={provider} />
        </>
      )}
      </div>

      {!streaming && (
        <>
          <div className="results__foot no-print">
            <button type="button" className="btn btn--primary" onClick={onReset}>
              Start over
            </button>
          </div>
        </>
      )}
    </section>
  );
});

export default Results;
