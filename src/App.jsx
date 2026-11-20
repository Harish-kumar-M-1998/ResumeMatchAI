import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Gauge, ScanSearch, PenLine, Mail, ShieldCheck, Code2, ArrowRight, FlaskConical, Briefcase } from "lucide-react";
import InputPanel from "./components/InputPanel.jsx";
import ModelPicker from "./components/ModelPicker.jsx";
import Results from "./components/Results.jsx";
import { analyzeResume, fetchProviders } from "./lib/api.js";
import { parsePartialJson } from "./lib/partialJson.js";
import { toViewReport } from "./lib/report.js";
import { SAMPLE_RESUME, SAMPLE_JD } from "./lib/sample.js";

const RESUME_LIMITS = { min: 200, max: 15000 };
const JD_LIMITS = { min: 100, max: 10000 };
const STATUS_MESSAGES = ["Reading your resume…", "Comparing with the job…", "Checking ATS rules…"];
const FEATURES = [
  { icon: Gauge, title: "Match & ATS scores", text: "Two 0–100 scores with a one-line verdict." },
  { icon: ScanSearch, title: "Keyword gaps", text: "Critical vs nice-to-have, copy all in one click." },
  { icon: PenLine, title: "Bullet rewrites", text: "Weak bullets rewritten with the reason why." },
  { icon: Mail, title: "Cover letter", text: "A tailored draft in the tone you choose." },
  {
    icon: Sparkles,
    title: "Pick your AI",
    text: "Groq for speed, Gemini for depth, or Auto with fallback. Results stream in live.",
    wide: true,
  },
];
const PROVIDER_STORAGE_KEY = "resumematch:provider";

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function loadProviderChoice() {
  try {
    return localStorage.getItem(PROVIDER_STORAGE_KEY) || "auto";
  } catch {
    return "auto";
  }
}

function saveProviderChoice(value) {
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode etc.) — choice just won't persist.
  }
}

export default function App() {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null); // full or partial, shaped by toViewReport
  const [meta, setMeta] = useState(null); // { provider, model } that produced the report
  const [analyzed, setAnalyzed] = useState(null); // { resume, jd } the report was made from
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState(loadProviderChoice);
  const [formKey, setFormKey] = useState(0);
  const resultsRef = useRef(null);
  const abortRef = useRef(null);
  const scrolledRef = useRef(false);
  const topRef = useRef(null);

  const rLen = resume.trim().length;
  const jLen = jd.trim().length;
  const resumeOk = rLen >= RESUME_LIMITS.min && rLen <= RESUME_LIMITS.max;
  const jdOk = jLen >= JD_LIMITS.min && jLen <= JD_LIMITS.max;
  const canSubmit = resumeOk && jdOk && !loading;
  const split = Boolean(report);

  useEffect(() => {
    let alive = true;
    fetchProviders().then((list) => {
      if (!alive) return;
      setProviders(list);
      // Drop a remembered choice the server no longer offers.
      setProvider((current) => (current === "auto" || list.some((p) => p.id === current) ? current : "auto"));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    setStatusIdx(0);
    const id = setInterval(() => setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (report && resultsRef.current && !scrolledRef.current) {
      scrolledRef.current = true;
      resultsRef.current.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      resultsRef.current.focus({ preventScroll: true });
    }
  }, [report]);

  function chooseProvider(value) {
    setProvider(value);
    saveProviderChoice(value);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const input = { resume: resume.trim(), jd: jd.trim() };
    setLoading(true);
    setError("");
    setReport(null);
    setMeta(null);
    setAnalyzed(null);
    scrolledRef.current = false;

    // Re-parse the growing JSON at most ~10x per second.
    let latest = "";
    let scheduled = null;
    const flush = () => {
      scheduled = null;
      const partial = parsePartialJson(latest);
      if (partial && Object.keys(partial).length) setReport(toViewReport(partial));
    };

    try {
      const result = await analyzeResume(input.resume, input.jd, {
        provider,
        signal: controller.signal,
        onDelta: (text) => {
          latest = text;
          if (!scheduled) scheduled = setTimeout(flush, 100);
        },
        onReset: () => {
          latest = "";
          clearTimeout(scheduled);
          scheduled = null;
          setReport(null);
        },
      });
      clearTimeout(scheduled);
      setReport(toViewReport(result.report));
      setMeta({ provider: result.provider, model: result.model });
      setAnalyzed(input);
    } catch (err) {
      clearTimeout(scheduled);
      if (err.code === "CANCELLED") return;
      setReport(null);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }

  function handleReset() {
    abortRef.current?.abort();
    setLoading(false);
    setResume("");
    setJd("");
    setError("");
    setReport(null);
    setMeta(null);
    setAnalyzed(null);
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

  const providerLabel = (id) => providers.find((p) => p.id === id)?.label || id;

  return (
    <div className="app" ref={topRef}>
      <div className="backdrop" aria-hidden="true">
        <span className="blob blob--1" />
        <span className="blob blob--2" />
        <span className="blob blob--3" />
      </div>

      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="wrap">
          <div className="site-header__inner glass">
          <div className="brand">
            <img src="/favicon.svg" alt="" width="34" height="34" />
            <span className="brand__name">
              ResumeMatch <em>AI</em>
            </span>
          </div>
          <div className="header-right">
            <p className="tagline">See your resume the way a recruiter — and their ATS — will.</p>
            <a
              className="btn btn--ghost btn--small"
              href="https://github.com/Harish-kumar-M-1998/ResumeMatchAI"
              target="_blank"
              rel="noreferrer"
            >
              <Code2 size={16} aria-hidden="true" /> Source
            </a>
          </div>
          </div>
        </div>
      </header>

      <main id="main" className={`wrap workspace ${split ? "is-split" : ""}`}>
        {!split && (
          <section className="hero">
            <motion.div
              className="hero__copy"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <p className="eyebrow">
                <span className="eyebrow__dot" aria-hidden="true" />
                Free · No sign-up · Nothing stored
              </p>
              <h1>
                How well does your resume <span className="hl">fit this job?</span>
              </h1>
              <p className="lede">
                Paste your resume and a job description. Get a match score, ATS check, missing keywords, rewritten
                bullets and a tailored cover letter — streamed live as the AI writes.
              </p>
              <div className="hero__stats">
                <div className="hero__stat">
                  <strong>~5s</strong>
                  <span>to a full report</span>
                </div>
                <div className="hero__stat">
                  <strong>2</strong>
                  <span>scores: match + ATS</span>
                </div>
                <div className="hero__stat">
                  <strong>0</strong>
                  <span>data stored</span>
                </div>
              </div>
            </motion.div>

            <ul className="bento" aria-label="What you get">
              {FEATURES.map((f, i) => (
                <motion.li
                  key={f.title}
                  className={`bento__tile glass ${f.wide ? "bento__tile--wide" : ""}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.1 + i * 0.07, ease: "easeOut" }}
                >
                  <span className="bento__icon" aria-hidden="true">
                    <f.icon size={19} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </motion.li>
              ))}
            </ul>
          </section>
        )}

        <form
          onSubmit={handleSubmit}
          className="form workspace__inputs"
          aria-busy={loading}
          aria-label="Resume and job description"
          key={formKey}
        >
          {split && (
            <div className="workspace__inputs-head">
              <h2>Your inputs</h2>
              <p className="muted small">Edit and re-analyze any time.</p>
            </div>
          )}

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

          <div className="form__side">
          <ModelPicker providers={providers} value={provider} onChange={chooseProvider} disabled={loading} />

          <div className="actions">
            <button type="submit" className="btn btn--primary btn--lg" disabled={!canSubmit} aria-describedby="submit-hint">
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Analyzing…
                </>
              ) : (
                <>
                  <Sparkles size={18} aria-hidden="true" /> {split ? "Re-analyze" : "Analyze match"}
                  {!split && <ArrowRight size={18} aria-hidden="true" />}
                </>
              )}
            </button>
            {!split && (
              <button type="button" className="btn btn--ghost" onClick={fillSample} disabled={loading}>
                <FlaskConical size={16} aria-hidden="true" /> Try with sample data
              </button>
            )}
            <p id="submit-hint" className="actions__hint">
              {!loading && disabledReason}
            </p>
          </div>

          {loading && !report && (
            <div className="loading glass" role="status" aria-live="polite">
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
              {provider !== "auto" && (
                <>
                  {" "}
                  You picked {providerLabel(provider)} — try <strong>Auto</strong> so another model can take over.
                </>
              )}
            </div>
          )}
          </div>
        </form>

        {report && (
          <Results
            ref={resultsRef}
            report={report}
            streaming={loading}
            meta={meta}
            providerLabel={providerLabel}
            onReset={handleReset}
            resume={analyzed?.resume || ""}
            jobDescription={analyzed?.jd || ""}
            provider={provider}
          />
        )}
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p>
            <ShieldCheck size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Your data is sent to an AI for analysis and is not stored.
          </p>
          <p className="muted small">AI feedback can be wrong — always review suggestions before using them.</p>
        </div>
        <div className="wrap credit">
          <p>
            Designed &amp; built by <strong>Harish Kumar M</strong> · © {new Date().getFullYear()}
          </p>
          <nav className="credit__links" aria-label="Contact the developer">
            <a href="mailto:harishmano98@gmail.com">
              <Mail size={15} aria-hidden="true" /> harishmano98@gmail.com
            </a>
            <a href="https://github.com/Harish-kumar-M-1998" target="_blank" rel="noreferrer">
              <Code2 size={15} aria-hidden="true" /> GitHub
            </a>
            <a href="https://linkedin.com/in/harish-kumar-m" target="_blank" rel="noreferrer">
              <Briefcase size={15} aria-hidden="true" /> LinkedIn
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
