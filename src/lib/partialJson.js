const CLOSERS = { "{": "}", "[": "]" };
const close = (stack) => [...stack].reverse().map((c) => CLOSERS[c]).join("");

/**
 * Best-effort parse of an incomplete JSON object while it streams in.
 * Returns the most complete object it can, or null.
 *
 * Unfinished strings are closed so text appears as it's typed. Unfinished
 * numbers/literals are dropped (so a score of "7" never flashes before "78").
 */
export function parsePartialJson(input) {
  if (!input) return null;
  const text = String(input).replace(/^\s*```(?:json)?\s*/i, "");
  const start = text.indexOf("{");
  if (start === -1) return null;
  const s = text.slice(start);

  try {
    return JSON.parse(s);
  } catch {
    // fall through to repair
  }

  const stack = [];
  const cuts = []; // [index, closers] positions where the prefix is a complete value
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") {
      stack.push(ch);
      cuts.push([i + 1, close(stack)]);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      cuts.push([i + 1, close(stack)]);
    } else if (ch === ",") {
      cuts.push([i, close(stack)]);
    }
  }

  const attempts = [];
  if (inString) {
    // Close a dangling string (drop a trailing lone backslash first).
    const body = escaped ? s.slice(0, -1) : s;
    attempts.push(body + '"' + close(stack));
  }
  for (let i = cuts.length - 1; i >= 0 && attempts.length < 6; i--) {
    attempts.push(s.slice(0, cuts[i][0]) + cuts[i][1]);
  }

  for (const candidate of attempts) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object") return value;
    } catch {
      // try next
    }
  }
  return null;
}
