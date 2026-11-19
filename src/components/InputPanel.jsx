import { useRef, useState } from "react";
import { FileText, Briefcase, Upload } from "lucide-react";


function Counter({ length, min, max }) {
  const state = length > max ? "over" : length >= min ? "ok" : "under";
  const hint =
    state === "under"
      ? `${(min - length).toLocaleString()} more needed`
      : state === "over"
        ? `${(length - max).toLocaleString()} over the limit`
        : "Looks good";
  return (
    <p className={`counter counter--${state}`} aria-live="polite">
      <span>
        {length.toLocaleString()} / {max.toLocaleString()}
      </span>
      <span className="counter__hint">{hint}</span>
    </p>
  );
}

export default function InputPanel({
  id,
  label,
  description,
  value,
  onChange,
  min,
  max,
  placeholder,
  allowPdf = false,
  disabled = false,
}) {
  const fileRef = useRef(null);
  const [pdfState, setPdfState] = useState({ loading: false, error: "", name: "" });

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPdfState({ loading: true, error: "", name: file.name });
    try {
      const { extractPdfText } = await import("../lib/pdf.js");
      const text = await extractPdfText(file);
      onChange(text.slice(0, max));
      setPdfState({
        loading: false,
        error: text.length > max ? `Text was trimmed to ${max.toLocaleString()} characters.` : "",
        name: file.name,
      });
    } catch (err) {
      setPdfState({ loading: false, error: err.message, name: "" });
    }
  }

  return (
    <div className="panel">
      <div className="panel__head">
        <div className="panel__title">
          <span className="panel__icon" aria-hidden="true">
            {allowPdf ? <FileText size={18} /> : <Briefcase size={18} />}
          </span>
          <div>
          <label htmlFor={id} className="panel__label">
            {label}
          </label>
          <p className="panel__desc" id={`${id}-desc`}>
            {description}
          </p>
          </div>
        </div>
        {allowPdf && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={handleFile}
            />
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || pdfState.loading}
            >
              <Upload size={14} aria-hidden="true" />
              {pdfState.loading ? "Reading PDF…" : "Upload PDF"}
            </button>
          </>
        )}
      </div>

      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={`${id}-desc`}
        spellCheck="false"
        disabled={disabled}
      />

      <Counter length={value.trim().length} min={min} max={max} />

      {pdfState.name && !pdfState.error && !pdfState.loading && (
        <p className="note note--ok" role="status">
          Imported text from <strong>{pdfState.name}</strong>. Check it over before analyzing.
        </p>
      )}
      {pdfState.error && (
        <p className="note note--error" role="alert">
          {pdfState.error}
        </p>
      )}
    </div>
  );
}
