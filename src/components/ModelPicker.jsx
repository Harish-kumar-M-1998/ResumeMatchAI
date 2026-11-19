const AUTO = {
  id: "auto",
  label: "Auto",
  tagline: "Recommended",
  description: "Uses the fastest available model and switches to the other automatically if it's busy or fails.",
};

const ICONS = { auto: "✦", groq: "⚡", gemini: "◆" };

/**
 * Lets the user choose which AI analyzes their resume.
 * `providers` comes from /.netlify/functions/providers (only ones with keys).
 */
export default function ModelPicker({ providers, value, onChange, disabled = false }) {
  const options = providers.length > 1 ? [AUTO, ...providers] : providers.length ? providers : [AUTO];

  return (
    <fieldset className="model-picker" disabled={disabled}>
      <legend className="model-picker__legend">AI model</legend>
      <div className="model-picker__options">
        {options.map((p) => {
          const checked = options.length === 1 || value === p.id;
          return (
            <label key={p.id} className={`model-option ${checked ? "is-active" : ""}`}>
              <input
                type="radio"
                name="provider"
                value={p.id}
                checked={checked}
                onChange={() => onChange(p.id)}
              />
              <span className="model-option__icon" aria-hidden="true">
                {ICONS[p.id] || "●"}
              </span>
              <span className="model-option__body">
                <span className="model-option__title">
                  {p.label}
                  {p.tagline && <span className="model-option__tag">{p.tagline}</span>}
                </span>
                <span className="model-option__desc">{p.description}</span>
                {p.model && <code className="model-option__model">{p.model}</code>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
