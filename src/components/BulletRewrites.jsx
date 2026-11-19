import CopyButton from "./CopyButton.jsx";

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
                <CopyButton text={b.improved} className="no-print" />
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
