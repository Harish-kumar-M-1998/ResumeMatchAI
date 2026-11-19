export default function Suggestions({ suggestions, redFlags, atsIssues }) {
  return (
    <>
      <section className="card" aria-labelledby="sg-title">
        <h3 id="sg-title" className="card__title">Top suggestions</h3>
        {suggestions.length ? (
          <ol className="suggestions">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        ) : (
          <p className="muted">No further suggestions.</p>
        )}
      </section>

      <div className="grid-2">
        <section className="card card--flags" aria-labelledby="rf-title">
          <h3 id="rf-title" className="card__title">
            <span aria-hidden="true">⚑ </span>Red flags
          </h3>
          {redFlags.length ? (
            <ul className="flags">
              {redFlags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No red flags spotted.</p>
          )}
        </section>

        <section className="card" aria-labelledby="ats-title">
          <h3 id="ats-title" className="card__title">ATS issues</h3>
          {atsIssues.length ? (
            <ul className="issues">
              {atsIssues.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No ATS formatting issues found.</p>
          )}
        </section>
      </div>
    </>
  );
}
