export const LIMITS = {
  resume: { min: 200, max: 15_000 },
  jd: { min: 100, max: 10_000 },
};

/** Returns { ok: true, resume, jd } or { ok: false, message, code }. */
export function validateInputs(body) {
  const resume = typeof body?.resume === "string" ? body.resume.trim() : "";
  const jd = typeof body?.jobDescription === "string" ? body.jobDescription.trim() : "";

  if (!resume || !jd) {
    return { ok: false, code: "MISSING_FIELDS", message: "Both the resume and the job description are required." };
  }
  if (resume.length < LIMITS.resume.min || resume.length > LIMITS.resume.max) {
    return {
      ok: false,
      code: "RESUME_LENGTH",
      message: `Your resume must be between ${LIMITS.resume.min} and ${LIMITS.resume.max.toLocaleString(
        "en-US"
      )} characters (currently ${resume.length.toLocaleString("en-US")}).`,
    };
  }
  if (jd.length < LIMITS.jd.min || jd.length > LIMITS.jd.max) {
    return {
      ok: false,
      code: "JD_LENGTH",
      message: `The job description must be between ${LIMITS.jd.min} and ${LIMITS.jd.max.toLocaleString(
        "en-US"
      )} characters (currently ${jd.length.toLocaleString("en-US")}).`,
    };
  }
  return { ok: true, resume, jd };
}
