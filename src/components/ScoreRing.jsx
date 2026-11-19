import { useEffect, useState } from "react";

const SIZE = 148;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function scoreTone(score) {
  if (score >= 75) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

const TONE_LABEL = { good: "Strong", warn: "Fair", bad: "Weak" };

export default function ScoreRing({ score, label, caption }) {
  const [shown, setShown] = useState(0);
  const tone = scoreTone(score);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(score);
      return;
    }
    let raf;
    const start = performance.now();
    const duration = 1100;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(score * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const offset = C * (1 - shown / 100);

  return (
    <figure className={`score-ring tone-${tone}`}>
      <div className="score-ring__dial">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${label}: ${score} out of 100 (${TONE_LABEL[tone]})`}
        >
          <circle className="score-ring__track" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} fill="none" />
          <circle
            className="score-ring__bar"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div className="score-ring__value" aria-hidden="true">
          <span className="score-ring__num">{shown}</span>
          <span className="score-ring__max">/100</span>
        </div>
      </div>
      <figcaption>
        <span className="score-ring__label">{label}</span>
        <span className={`badge badge--${tone}`}>{TONE_LABEL[tone]}</span>
        {caption && <span className="score-ring__caption">{caption}</span>}
      </figcaption>
    </figure>
  );
}
