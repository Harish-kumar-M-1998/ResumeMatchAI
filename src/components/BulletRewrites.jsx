import { useEffect, useRef, useState } from "react";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
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
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className={`btn btn--small ${copied ? "btn--done" : "btn--ghost"}`} onClick={copy}>
      {copied ? "Copied" : "Copy"}
      <span className="sr-only" aria-live="polite">{copied ? " to clipboard" : ""}</span>
    </button>
  );
}

export default function BulletRewrites({ rewrites }) {
  if (!rewrites.length) return null;
  return (
    <section className="card" aria-labelledby="br-title">
      <h3 id="br-title" className="card__title">Bullet rewrites</h3>
      <p className="muted small">
        Placeholders like <code>[X%]</code> mark where a real number from your work would make the bullet stronger.
      </p>
      <ol className="rewrites">
        {rewrites.map((b, i) => (
          <li key={i} className="rewrite">
            <div className="rewrite__before">
              <span className="rewrite__tag">Before</span>
              <p>{b.original}</p>
            </div>
            <div className="rewrite__after">
              <div className="rewrite__head">
                <span className="rewrite__tag rewrite__tag--after">After</span>
                <CopyButton text={b.improved} />
              </div>
              <p>{b.improved}</p>
            </div>
            {b.reason && (
              <p className="rewrite__reason">
                <strong>Why:</strong> {b.reason}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
