import { useEffect, useRef, useState } from "react";
import InputPanel from "./components/InputPanel.jsx";
import Results from "./components/Results.jsx";
import { analyzeResume } from "./lib/api.js";
import { SAMPLE_RESUME, SAMPLE_JD } from "./lib/sample.js";

const RESUME_LIMITS = { min: 200, max: 15000 };
const JD_LIMITS = { min: 100, max: 10000 };
const STATUS_MESSAGES = ["Reading your resume…", "Comparing with the job…", "Checking ATS rules…"];

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function App() {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const resultsRef = useRef(null);
  const topRef = useRef(null);

  const rLen = resume.trim().length;
  const jLen = jd.trim().length;
  const resumeOk = rLen >= RESUME_LIMITS.min && rLen <= RESUME_LIMITS.max;
  const jdOk = jLen >= JD_LIMITS.min && jLen <= JD_LIMITS.max;
  const canSubmit = resumeOk && jdOk && !loading;

  useEffect(() => {
    if (!loading) return;
    setStatusIdx(0);
    const id = setInterval(() => setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (report && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      resultsRef.current.focus({ preventScroll: true });
    }
  }, [report]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const data = await analyzeResume(resume.trim(), jd.trim());
      setReport(data);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResume("");
    setJd("");
    setError("");
    setReport(null);
    setFormKey((k) => k + 1);
    topRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
    setTimeout(() => document.getElementById("resume")?.focus({ preventScroll: true }), 300);
  }

  function fillSample() {
    setResume(SAMPLE_RESUME);
    setJd(SAMPLE_JD);
    setError("");
  }

  const disabledReason = !resumeOk
    ? rLen > RESUME_LIMITS.max
      ? "Your resume is too long — trim it below 15,000 characters."
      : `Add your resume (at least ${RESUME_LIMITS.min} characters).`
    : !jdOk
      ? jLen > JD_LIMITS.max
        ? "The job description is too long — trim it below 10,000 characters."
        : `Add the job description (at least ${JD_LIMITS.min} characters).`
      : "";

  return (
    <div className="app" ref={topRef}>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="wrap site-header__inner">
          <div className="brand">
            <img src="/favicon.svg" alt="" width="36" height="36" />
            <span className="brand__name">
              ResumeMatch <em>AI</em>
            </span>
          </div>
          <p className="tagline">See your resume the way a recruiter — and their ATS — will.</p>
        </div>
      </header>

      <main id="main" className="wrap">
        <section className="hero">
          <h1>
            How well does your resume <span className="hl">fit this job?</span>
          </h1>
          <p className="lede">
            Paste your resume and a job description. Get a match score, ATS check, missing keywords and
            rewritten bullets in about 15 seconds.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="form" aria-busy={loading} key={formKey}>
          <div className="panels">
            <InputPanel
              id="resume"
              label="Your resume"
              description="Paste the text, or upload a text-based PDF."
              value={resume}
              onChange={setResume}
              min={RESUME_LIMITS.min}
              max={RESUME_LIMITS.max}
              placeholder="Jane Doe — Frontend Developer&#10;&#10;EXPERIENCE&#10;…"
              allowPdf
              disabled={loading}
            />
            <InputPanel
              id="jd"
              label="Job description"
              description="Paste the full posting, including requirements."
              value={jd}
              onChange={setJd}
              min={JD_LIMITS.min}
              max={JD_LIMITS.max}
              placeholder="We're looking for a Frontend Developer who…"
              disabled={loading}
            />
          </div>

          <div className="actions">
            <button type="submit" className="btn btn--primary btn--lg" disabled={!canSubmit} aria-describedby="submit-hint">
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Analyzing…
                </>
              ) : (
                "Analyze match"
              )}
            </button>
            <button type="button" className="btn btn--ghost" onClick={fillSample} disabled={loading}>
              Try with sample data
            </button>
            <p id="submit-hint" className="actions__hint">
              {!loading && disabledReason}
            </p>
          </div>

          {loading && (
            <div className="loading" role="status" aria-live="polite">
              <div className="loading__bar" aria-hidden="true">
                <span />
              </div>
              <p key={statusIdx} className="loading__msg">
                {STATUS_MESSAGES[statusIdx]}
              </p>
            </div>
          )}

          {error && (
            <div className="alert" role="alert">
              <strong>Analysis failed.</strong> {error}
            </div>
          )}
        </form>

        {report && <Results ref={resultsRef} report={report} onReset={handleReset} />}
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p>Your data is sent to an AI for analysis and is not stored.</p>
          <p className="muted small">AI feedback can be wrong — always review suggestions before using them.</p>
        </div>
      </footer>
    </div>
  );
}
