import CopyButton from "./CopyButton.jsx";

export default function KeywordChips({ matched, missing }) {
  const critical = missing.filter((k) => k.importance === "critical");
  const nice = missing.filter((k) => k.importance !== "critical");
  // Critical first, so pasting into a skills section puts the important ones up front.
  const allMissing = [...critical, ...nice].map((k) => k.keyword).join(", ");

  return (
    <section className="card" aria-labelledby="kw-title">
      <h3 id="kw-title" className="card__title">Keywords</h3>

      <div className="kw-group">
        <h4 className="kw-group__title">
          Matched <span className="count">{matched.length}</span>
        </h4>
        {matched.length ? (
          <ul className="chips">
            {matched.map((k) => (
              <li key={k} className="chip chip--matched">
                <span aria-hidden="true">✓</span> {k}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No keywords from the job description were found in your resume.</p>
        )}
      </div>

      <div className="kw-group">
        <div className="kw-group__head">
          <h4 className="kw-group__title">
            Missing <span className="count">{missing.length}</span>
          </h4>
          {missing.length > 0 && (
            <CopyButton text={allMissing} label="Copy all" className="no-print" />
          )}
        </div>
        {missing.length ? (
          <ul className="chips">
            {critical.map((k) => (
              <li key={k.keyword} className="chip chip--critical">
                <span aria-hidden="true">!</span> {k.keyword}
                <span className="sr-only"> (critical)</span>
              </li>
            ))}
            {nice.map((k) => (
              <li key={k.keyword} className="chip chip--nice">
                {k.keyword}
                <span className="sr-only"> (nice to have)</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing important is missing — nice work.</p>
        )}
        {missing.length > 0 && (
          <p className="legend">
            <span className="legend__dot legend__dot--critical" /> Critical
            <span className="legend__dot legend__dot--nice" /> Nice to have
          </p>
        )}
      </div>
    </section>
  );
}
