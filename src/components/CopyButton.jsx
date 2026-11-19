import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "../lib/report.js";

export default function CopyButton({ text, label = "Copy", doneLabel = "Copied", className = "", disabled = false }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    await copyText(typeof text === "function" ? text() : text);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      className={`btn btn--small ${copied ? "btn--done" : "btn--ghost"} ${className}`}
      onClick={copy}
      disabled={disabled}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? doneLabel : label}
      <span className="sr-only" aria-live="polite">
        {copied ? " to clipboard" : ""}
      </span>
    </button>
  );
}
