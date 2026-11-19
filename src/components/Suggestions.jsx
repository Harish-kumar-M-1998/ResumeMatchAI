import { Lightbulb, Flag, ScanLine } from "lucide-react";

export default function Suggestions({ suggestions, redFlags, atsIssues, streaming = false }) {
  const pending = (label) => <p className="muted">{streaming ? "Writing…" : label}</p>;

  return (
    <>
      <section className="card span-2" aria-labelledby="sg-title">
        <h3 id="sg-title" className="card__title"><Lightbulb size={18} aria-hidden="true" /> Top suggestions</h3>
        {suggestions.length ? (
          <ol className="suggestions">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        ) : (
          pending("No further suggestions.")
        )}
      </section>

      <div className="grid-2 span-2">
        <section className="card card--flags" aria-labelledby="rf-title">
          <h3 id="rf-title" className="card__title">
            <Flag size={18} aria-hidden="true" /> Red flags
          </h3>
          {redFlags.length ? (
            <ul className="flags">
              {redFlags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : (
            pending("No red flags spotted.")
          )}
        </section>

        <section className="card" aria-labelledby="ats-title">
          <h3 id="ats-title" className="card__title"><ScanLine size={18} aria-hidden="true" /> ATS issues</h3>
          {atsIssues.length ? (
            <ul className="issues">
              {atsIssues.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : (
            pending("No ATS formatting issues found.")
          )}
        </section>
      </div>
    </>
  );
}
