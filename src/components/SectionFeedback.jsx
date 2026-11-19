const SECTIONS = [
  { key: "summary", label: "Summary" },
  { key: "experience", label: "Experience" },
  { key: "skills", label: "Skills" },
  { key: "education", label: "Education" },
  { key: "projects", label: "Projects" },
];

export default function SectionFeedback({ feedback }) {
  const rows = SECTIONS.filter(({ key }) => feedback[key]);
  if (!rows.length) return null;
  return (
    <section className="card" aria-labelledby="sf-title">
      <h3 id="sf-title" className="card__title">Section-by-section feedback</h3>
      <dl className="sections">
        {rows.map(({ key, label }) => (
          <div key={key} className="sections__row">
            <dt>{label}</dt>
            <dd>{feedback[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
