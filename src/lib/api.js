const ENDPOINT = "/.netlify/functions/analyze";
const CLIENT_TIMEOUT_MS = 40_000;

export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export async function analyzeResume(resume, jobDescription) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume, jobDescription }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ApiError(
        "The analysis timed out. The AI may be busy — please try again in a minute.",
        "CLIENT_TIMEOUT"
      );
    }
    throw new ApiError(
      "Couldn't reach the server. Check your internet connection and try again.",
      "NETWORK"
    );
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response (e.g. 404 HTML page when running plain `vite` without Netlify).
  }

  if (!res.ok) {
    if (data?.error?.message) throw new ApiError(data.error.message, data.error.code);
    if (res.status === 404) {
      throw new ApiError(
        "The analysis service wasn't found. If you're running locally, start the app with `npm run netlify:dev` instead of `npm run dev`.",
        "NOT_FOUND"
      );
    }
    throw new ApiError(`The server returned an unexpected error (${res.status}). Please try again.`, "HTTP");
  }

  if (!data || typeof data.match_score !== "number") {
    throw new ApiError("The server returned an unexpected response. Please try again.", "BAD_RESPONSE");
  }
  return data;
}
