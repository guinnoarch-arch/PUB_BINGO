import { itemsToLines } from "./core/menuImport.js";

export const MENU_MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 20;

export function validateMenuFile(file) {
  if (!file) return "Choose a PDF menu first.";
  if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name || "")) return "That isn't a PDF. Upload the menu as a PDF file.";
  if (file.size > MENU_MAX_BYTES) return "That PDF is over 10 MB.";
  return null;
}

// Reads the text of a PDF in the browser, line by line. pdf.js is loaded only when needed
// (admin pages), and evaluation of embedded code is switched off.
export async function extractPdfLines(file) {
  // The "legacy" build supports older browsers (e.g. older iPhones), which the modern build doesn't.
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true });
  const doc = await task.promise;
  try {
    const lines = [];
    const pages = Math.min(doc.numPages, MAX_PAGES);
    for (let n = 1; n <= pages; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      lines.push(...itemsToLines(content.items));
    }
    return { lines, pageCount: doc.numPages, truncated: doc.numPages > MAX_PAGES };
  } finally {
    await task.destroy();
  }
}
