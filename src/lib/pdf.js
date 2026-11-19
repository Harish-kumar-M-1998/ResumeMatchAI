import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function extractPdfText(file) {
  if (!file) throw new Error("No file selected.");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) throw new Error("That file isn't a PDF. Please choose a .pdf file, or paste your resume text.");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("That PDF is larger than 5 MB. Please upload a smaller file or paste the text instead.");
  }

  let pdf;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    pdf = await pdfjsLib.getDocument({ data }).promise;
  } catch (err) {
    if (err?.name === "PasswordException") {
      throw new Error("This PDF is password-protected. Remove the password or paste the text instead.");
    }
    throw new Error("We couldn't open that PDF — it may be damaged. Try re-exporting it, or paste the text.");
  }

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    let lastY = null;
    const lines = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) {
        lines.push(line.trimEnd());
        line = "";
      }
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trimEnd());
        line = "";
        lastY = null;
      } else {
        lastY = y ?? lastY;
      }
    }
    if (line) lines.push(line.trimEnd());
    pages.push(lines.join("\n"));
  }
  await pdf.destroy();

  const text = pages
    .join("\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.replace(/\s/g, "").length < 50) {
    throw new Error(
      "We couldn't find any text in this PDF — it looks like a scanned image. Export your resume as a text-based PDF, or paste the text directly."
    );
  }
  return text;
}
