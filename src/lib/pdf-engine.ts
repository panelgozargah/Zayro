"use client";

/**
 * Zayro PDF engine — pdf.js wrapper with smart caching.
 * - Document cache (module-level Map) so re-opening a book is instant
 * - Page-1 thumbnail renderer for book covers
 * - High-DPI page rendering with cMaps for correct Persian glyph shaping
 */

import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");

let pdfjsLib: PdfJs | null = null;

export async function getPdfjs(): Promise<PdfJs> {
  if (pdfjsLib) return pdfjsLib;
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  pdfjsLib = lib;
  return lib;
}


/* ---------------- global render queue (bounds concurrent page renders) ---------------- */

type Job = () => Promise<void>;
const jobQueue: Job[] = [];
let activeJobs = 0;
const MAX_CONCURRENT_RENDERS = 2;

function pump() {
  while (activeJobs < MAX_CONCURRENT_RENDERS && jobQueue.length > 0) {
    const job = jobQueue.shift()!;
    activeJobs++;
    job().catch(() => {}).finally(() => {
      activeJobs--;
      pump();
    });
  }
}

/** Run a render task through the bounded queue (latest pages rendered in order). */
export function enqueueRender(job: Job): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    jobQueue.push(async () => {
      try {
        await job();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    pump();
  });
}

/** Render page 1 as a data-URL thumbnail (for covers). */
const MAX_CACHED_DOCS = 6;
const docOpenOrder: string[] = [];
const docCache = new Map<string, Promise<PDFDocumentProxy>>();

export function loadDocument(fileUrl: string): Promise<PDFDocumentProxy> {
  const existing = docCache.get(fileUrl);
  if (existing) return existing;

  const task = (async () => {
    const pdfjs = await getPdfjs();
    const doc = await pdfjs.getDocument({
      url: fileUrl,
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/fonts/",
      disableAutoFetch: false,
      disableStream: false,
      rangeChunkSize: 262144,
    }).promise;
    return doc;
  })();

  docCache.set(fileUrl, task);
  docOpenOrder.push(fileUrl);
  // evict oldest docs beyond cache size (keep memory bounded)
  while (docOpenOrder.length > MAX_CACHED_DOCS) {
    const oldest = docOpenOrder.shift();
    if (oldest && oldest !== fileUrl) {
      const p = docCache.get(oldest);
      if (p) {
        p.then((d) => d.destroy()).catch(() => {});
        docCache.delete(oldest);
      }
    }
  }
  task.catch(() => {
    // remove failed loads so a retry is possible
    docCache.delete(fileUrl);
    const i = docOpenOrder.indexOf(fileUrl);
    if (i >= 0) docOpenOrder.splice(i, 1);
  });
  return task;
}

/** Render one page to a canvas at the given CSS width (device-pixel-ratio aware). */
export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetWidth: number,
  maxHeight?: number
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  let scale = targetWidth / base.width;
  if (maxHeight) {
    const h = base.height * scale;
    if (h > maxHeight) scale = maxHeight / base.height;
  }
  // device pixel ratio, capped so big pages never explode memory
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = base.width * scale * dpr * base.height * scale * dpr;
  const MAX_PIXELS = 4_200_000; // ~4MP per page (≈ 2310×1818)
  if (px > MAX_PIXELS) dpr = Math.max(0.75, dpr * Math.sqrt(MAX_PIXELS / px));
  const viewport = page.getViewport({ scale: scale * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return { width: canvas.width / dpr, height: canvas.height / dpr };
}
export async function renderThumbnail(
  fileUrl: string,
  width = 220
): Promise<string> {
  const doc = await loadDocument(fileUrl);
  const canvas = document.createElement("canvas");
  await renderPageToCanvas(doc, 1, canvas, width);
  return canvas.toDataURL("image/jpeg", 0.72);
}

/** Get number of pages without loading full doc into UI state. */
export async function getNumPages(fileUrl: string): Promise<number> {
  const doc = await loadDocument(fileUrl);
  return doc.numPages;
}

/** Normalize Persian/Arabic text for search. */
function normalizeFa(s: string): string {
  return s
    .replace(/[\u064A\u0649]/g, "\u06CC") // ي ى → ی
    .replace(/[\u0643]/g, "\u06A9") // ك → ک
    .replace(/[\u200C\u200F\u200E]/g, " ") // ZWNJ/marks → space
    .replace(/[\u064B-\u0652\u0670]/g, "") // diacritics
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export interface SearchHit {
  page: number;
  snippet: string;
}

/** Search text across the whole document (normalized Persian). */
export async function searchDocument(
  fileUrl: string,
  query: string,
  onProgress?: (page: number, total: number) => void,
  signal?: { cancelled: boolean }
): Promise<SearchHit[]> {
  const doc = await loadDocument(fileUrl);
  const q = normalizeFa(query);
  if (!q) return [];
  const hits: SearchHit[] = [];
  const total = doc.numPages;
  for (let p = 1; p <= total; p++) {
    if (signal?.cancelled) return hits;
    try {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const text = normalizeFa(
        tc.items
          .map((it) => ("str" in it ? it.str : ""))
          .join(" ")
      );
      const idx = text.indexOf(q);
      if (idx >= 0) {
        const start = Math.max(0, idx - 40);
        const snippet = text.slice(start, Math.min(text.length, idx + q.length + 70));
        hits.push({ page: p, snippet: start > 0 ? "…" + snippet : snippet });
      }
      page.cleanup();
    } catch {
      // skip broken page
    }
    onProgress?.(p, total);
  }
  return hits;
}
