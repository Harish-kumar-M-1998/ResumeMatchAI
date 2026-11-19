import { forwardRef } from "react";
import ScoreRing from "./ScoreRing.jsx";
import KeywordChips from "./KeywordChips.jsx";
import SectionFeedback from "./SectionFeedback.jsx";
import BulletRewrites from "./BulletRewrites.jsx";
import Suggestions from "./Suggestions.jsx";

const Results = forwardRef(function Results({ report, onReset }, ref) {
  return (
    <section className="results" ref={ref} tabIndex={-1} aria-labelledby="results-title">
      <div className="results__head">
        <h2 id="results-title">Your match report</h2>
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          Start over
        </button>
      </div>

      <div className="card scores">
        <div className="scores__rings">
          <ScoreRing score={report.match_score} label="Job match" caption="How well you fit this role" />
          <ScoreRing score={report.ats_score} label="ATS compatibility" caption="How well software can parse you" />
        </div>
        <p className="verdict">{report.verdict}</p>
      </div>

      <KeywordChips matched={report.matched_keywords} missing={report.missing_keywords} />
      <Suggestions
        suggestions={report.top_suggestions}
        redFlags={report.red_flags}
        atsIssues={report.ats_issues}
      />
      <BulletRewrites rewrites={report.bullet_rewrites} />
      <SectionFeedback feedback={report.section_feedback} />

      <div className="results__foot">
        <button type="button" className="btn btn--primary" onClick={onReset}>
          Start over
        </button>
      </div>
    </section>
  );
});

export default Results;
