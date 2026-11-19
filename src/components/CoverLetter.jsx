import { useEffect, useRef, useState } from "react";
import { generateCoverLetter } from "../lib/api.js";
import { downloadText } from "../lib/report.js";
import CopyButton from "./CopyButton.jsx";

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "enthusiastic", label: "Enthusiastic" },
  { value: "concise", label: "Concise" },
];

export default function CoverLetter({ resume, jobDescription }) {
  const [tone, setTone] = useState("professional");
  const [letter, setLetter] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function generate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setError("");
    setLetter("");
    try {
      const final = await generateCoverLetter(resume, jobDescription, tone, {
        signal: controller.signal,
        onDelta: setLetter,
        onReset: () => setLetter(""),
      });
      setLetter(final);
      setStatus("done");
    } catch (err) {
      if (err.code === "CANCELLED") return;
      setError(err.message);
      setStatus("error");
    }
  }

  const loading = status === "loading";

  return (
    <section className="card cover-letter" aria-labelledby="cl-title">
      <div className="cover-letter__head">
        <div>
          <h3 id="cl-title" className="card__title">Cover letter</h3>
          <p className="muted small">
            A first draft built only from your resume. Check every claim and fill in any [placeholders].
          </p>
        </div>
      </div>

      <div className="cover-letter__controls no-print">
        <fieldset className="tone" disabled={loading}>
          <legend className="sr-only">Tone</legend>
          {TONES.map((t) => (
            <label key={t.value} className={`tone__option ${tone === t.value ? "is-active" : ""}`}>
              <input
                type="radio"
                name="tone"
                value={t.value}
                checked={tone === t.value}
                onChange={() => setTone(t.value)}
              />
              {t.label}
            </label>
          ))}
        </fieldset>
        <button type="button" className="btn btn--primary btn--small" onClick={generate} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" /> Writing…
            </>
          ) : letter ? (
            "Regenerate"
          ) : (
            "Generate cover letter"
          )}
        </button>
      </div>

      {error && (
        <div className="alert" role="alert">
          <strong>Couldn't write the letter.</strong> {error}
        </div>
      )}

      {letter && (
        <>
          <div className="letter" aria-live={loading ? "off" : "polite"} aria-busy={loading}>
            {letter}
            {loading && <span className="caret" aria-hidden="true" />}
          </div>
          {status === "done" && (
            <div className="cover-letter__actions no-print">
              <CopyButton text={letter} />
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => downloadText("cover-letter.txt", letter, "text/plain")}
              >
                Download .txt
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
