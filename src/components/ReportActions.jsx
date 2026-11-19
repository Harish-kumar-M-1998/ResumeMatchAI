import { downloadText, reportToMarkdown } from "../lib/report.js";

export default function ReportActions({ report, onReset }) {
  function downloadMarkdown() {
    const date = new Date();
    downloadText(`resumematch-report-${date.toISOString().slice(0, 10)}.md`, reportToMarkdown(report, { date }));
  }

  return (
    <div className="report-actions no-print">
      <button type="button" className="btn btn--ghost btn--small" onClick={downloadMarkdown}>
        Download .md
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--small"
        onClick={() => window.print()}
        title="Opens the print dialog — choose “Save as PDF”"
      >
        Save as PDF
      </button>
      <button type="button" className="btn btn--ghost btn--small" onClick={onReset}>
        Start over
      </button>
    </div>
  );
}
