import { Download, Printer, RotateCcw } from "lucide-react";
import { downloadText, reportToMarkdown } from "../lib/report.js";

export default function ReportActions({ report, onReset }) {
  function downloadMarkdown() {
    const date = new Date();
    downloadText(`resumematch-report-${date.toISOString().slice(0, 10)}.md`, reportToMarkdown(report, { date }));
  }

  return (
    <div className="report-actions no-print">
      <button type="button" className="btn btn--ghost btn--small" onClick={downloadMarkdown}>
        <Download size={14} aria-hidden="true" /> Download .md
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--small"
        onClick={() => window.print()}
        title="Opens the print dialog — choose “Save as PDF”"
      >
        <Printer size={14} aria-hidden="true" /> Save as PDF
      </button>
      <button type="button" className="btn btn--ghost btn--small" onClick={onReset}>
        <RotateCcw size={14} aria-hidden="true" /> Start over
      </button>
    </div>
  );
}
