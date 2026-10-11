"use client";

/**
 * Zayro Reader — advanced PDF reading experience.
 * Features: lazy high-DPI canvas pages, thumbnails sidebar, zoom (fit-width),
 * night mode, full-text Persian search, bookmarks, fullscreen, keyboard
 * shortcuts, auto-saved reading progress.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { BookData } from "@/lib/books-data";
import { GRADES } from "@/lib/books-data";
import {
  loadDocument,
  renderPageToCanvas,
  enqueueRender,
  searchDocument,
  type SearchHit,
} from "@/lib/pdf-engine";
import {
  getBookmarks,
  getProgress,
  getFavorites,
  saveProgress,
  toggleBookmark,
  toggleFavorite,
} from "@/lib/library-store";
import { isDesktop, waitForBook } from "@/lib/desktop";
import { faNum } from "@/lib/ui-utils";
import { SUBJECT_ICONS, GRADE_ICONS } from "@/lib/subject-meta";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Loader2,
  Maximize,
  Minimize,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  ListOrdered,
} from "lucide-react";

/* ---------------- PageCanvas ---------------- */

const PageCanvas = memo(function PageCanvas({
  doc,
  pageNumber,
  width,
  ratio,
  night,
  active,
  onRendered,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  ratio: number;
  night: boolean;
  active: boolean;
  onRendered?: (page: number, cssH: number) => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<"empty" | "rendering" | "done">("empty");
  const [err, setErr] = useState(false);

  // apply night filter directly on the canvas (cheap, no re-render needed)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.style.filter = night
      ? "invert(0.90) hue-rotate(180deg) brightness(1.06) contrast(0.90)"
      : "";
  }, [night, state]);

  useEffect(() => {
    if (!active) {
      // release memory for far pages
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
        canvasRef.current.remove();
        canvasRef.current = null;
      }
      setState("empty");
      return;
    }
    if (state === "rendering") return;
    let cancelled = false;
    setState("rendering");

    (async () => {
      try {
        const holder = holderRef.current;
        if (!holder || cancelled) return;
        const canvas = document.createElement("canvas");
        canvas.className = "page-shadow block rounded-[4px]";
        if (night) {
          canvas.style.filter =
            "invert(0.90) hue-rotate(180deg) brightness(1.06) contrast(0.90)";
        }
        // render through the bounded queue — pages wait their turn
        await enqueueRender(async () => {
          if (cancelled) return;
          await renderPageToCanvas(doc, pageNumber, canvas, width);
        });
        if (cancelled) return;
        holder.replaceChildren(canvas);
        canvasRef.current = canvas;
        setState("done");
        onRendered?.(pageNumber, canvas.clientHeight);
      } catch {
        if (!cancelled) {
          setErr(true);
          setState("empty");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, width, doc, pageNumber]);

  return (
    <div
      ref={holderRef}
      data-page={pageNumber}
      className="relative mx-auto"
      style={{ width, height: state === "empty" ? width * ratio : undefined }}
    >
      {state === "empty" && (
        <div
          className={`absolute inset-0 rounded-[4px] ${err ? "flex items-center justify-center" : "shimmer"}`}
          style={{ background: err ? undefined : "rgba(255,255,255,0.05)" }}
        >
          {err && (
            <span className="flex items-center gap-1.5 text-xs text-rose-300/80">
              <AlertTriangle className="h-4 w-4" />
              خطا در نمایش صفحه
            </span>
          )}
        </div>
      )}
    </div>
  );
});

/* ---------------- Reader ---------------- */

interface Props {
  book: BookData;
  onClose: () => void;
}

export default function Reader({ book, onClose }: Props) {
  const gradeData = GRADES.find((g) => g.grade === book.grade);
  const gradeColor = gradeData?.color ?? "#a78bfa";
  const SubjectIcon = SUBJECT_ICONS[book.subjectKey] ?? SUBJECT_ICONS.other;
  const GradeIcon = GRADE_ICONS[book.grade];

  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingBook, setPendingBook] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [ratio, setRatio] = useState(1.414); // A4 default
  const [zoom, setZoom] = useState(1); // 1 = fit width
  const [containerW, setContainerW] = useState(0);
  const [pageW, setPageW] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpValue, setJumpValue] = useState("");
  const [night, setNight] = useState(false);
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [marks, setMarks] = useState<number[]>([]);
  const [marksOpen, setMarksOpen] = useState(false);

  // search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState({ page: 0, total: 0 });
  const searchCancel = useRef<{ cancelled: boolean } | null>(null);

  /* ---- load document (desktop-aware: waits for smart sync downloads) ---- */
  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setLoadError(null);
    setPendingBook(false);
    setNumPages(0);
    setCurrentPage(1);
    (async () => {
      const desktop = isDesktop();
      for (let attempt = 0; !cancelled && attempt < (desktop ? 4 : 1); attempt++) {
        try {
          const d = await loadDocument(book.file);
          if (cancelled) return;
          const p1 = await d.getPage(1);
          const vp = p1.getViewport({ scale: 1 });
          setRatio(vp.height / vp.width);
          setNumPages(d.numPages);
          setDoc(d);
          setPendingBook(false);
          return;
        } catch (e) {
          if (cancelled) return;
          if (desktop) {
            // book likely not synced yet → the engine is fetching it; wait & retry
            setPendingBook(true);
            setLoadError(null);
            const ok = await waitForBook(book.file, {
              signal: { get cancelled() { return cancelled; } },
            });
            if (cancelled) return;
            if (!ok) {
              setPendingBook(false);
              setLoadError("دریافت کتاب بیش از حد طول کشید — اتصال اینترنت را بررسی کن");
              return;
            }
            continue;
          }
          setLoadError(e instanceof Error ? e.message : "خطای بارگذاری");
          return;
        }
      }
      if (!cancelled) {
        setLoadError("بارگذاری کتاب ناموفق بود — چند لحظه دیگر دوباره امتحان کن");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book.file, book.id]);

  /* ---- container measurement ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        setContainerW(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const baseWidth = useMemo(() => {
    if (!containerW) return 0;
    const padding = containerW < 640 ? 16 : 48;
    return Math.max(220, containerW - padding);
  }, [containerW]);

  useEffect(() => {
    if (!baseWidth) return;
    const w = Math.min(Math.round(baseWidth * zoom), 2400);
    setPageW(w);
  }, [baseWidth, zoom]);

  /* ---- current page tracking (viewport-truth rect math, self-healing) ---- */
  const userScrolledRef = useRef(false);
  const restoredRef = useRef(false);

  const computeCurrentPage = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !numPages) return;
    const elRect = el.getBoundingClientRect();
    const probeY = elRect.top + elRect.height * 0.32;
    const pages = el.querySelectorAll<HTMLElement>("[data-page]");
    let current = 1;
    for (const p of pages) {
      const r = p.getBoundingClientRect();
      const n = Number(p.dataset.page) || 0;
      if (!n) continue;
      if (r.top <= probeY) current = n;
      else break;
    }
    setCurrentPage((prev) => (prev === current ? prev : current));
  }, [numPages]);

  // mark genuine user interaction (wheel / touch / keys) — programmatic scrolls excluded
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const mark = () => {
      userScrolledRef.current = true;
    };
    el.addEventListener("wheel", mark, { passive: true });
    el.addEventListener("touchstart", mark, { passive: true });
    el.addEventListener("touchmove", mark, { passive: true });
    el.addEventListener("keydown", mark);
    return () => {
      el.removeEventListener("wheel", mark);
      el.removeEventListener("touchstart", mark);
      el.removeEventListener("touchmove", mark);
      el.removeEventListener("keydown", mark);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !numPages) return;
    let raf = 0;
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(computeCurrentPage);
    };
    el.addEventListener("scroll", schedule, { passive: true });
    const list = el.querySelector("[data-pages-list]");
    let mo: MutationObserver | null = null;
    if (list) {
      // canvases streaming in shift layout — recheck position on each mount
      mo = new MutationObserver(schedule);
      mo.observe(list, { childList: true, subtree: true });
    }
    const t = setTimeout(schedule, 450);
    // bulletproof fallback: periodic reconciliation while the reader is open
    const iv = setInterval(schedule, 500);
    return () => {
      el.removeEventListener("scroll", schedule);
      mo?.disconnect();
      clearTimeout(t);
      clearInterval(iv);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [numPages, pageW, doc, computeCurrentPage]);

  /* ---- restore last reading position (once, only if user hasn't scrolled) ---- */
  useEffect(() => {
    if (!doc || !pageW || restoredRef.current) return;
    restoredRef.current = true;
    const saved = getProgress(book.id);
    if (!saved || saved.page <= 1 || saved.page > doc.numPages) return;
    if (userScrolledRef.current) return;
    const target = saved.page;
    const jump = () => {
      if (userScrolledRef.current) return;
      const el = scrollRef.current?.querySelector(`[data-page="${target}"]`);
      el?.scrollIntoView({ block: "start" });
    };
    requestAnimationFrame(jump);
    const t = setTimeout(jump, 500);
    const t2 = setTimeout(jump, 1400);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [doc, pageW, book.id]);

  /* ---- persist progress ---- */
  useEffect(() => {
    if (!doc || currentPage < 1) return;
    // don't clobber a saved position before restore had its chance
    if (!restoredRef.current) {
      const saved = getProgress(book.id);
      if (saved && saved.page > 1) return;
    }
    saveProgress(book.id, currentPage, doc.numPages);
  }, [currentPage, doc, book.id]);

  useEffect(() => {
    setIsFav(getFavorites().includes(book.id));
    setMarks(getBookmarks(book.id));
  }, [book.id]);

  /* ---- keyboard ---- */
  const gotoPage = useCallback(
    (p: number) => {
      const target = Math.max(1, Math.min(numPages || 1, p));
      const el = scrollRef.current?.querySelector(`[data-page="${target}"]`);
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
    },
    [numPages]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); gotoPage(currentPage + 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); gotoPage(currentPage - 1); }
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)));
      else if (e.key === "-") setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)));
      else if (e.key.toLowerCase() === "f") toggleFs();
      else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (searchOpen) setSearchOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, gotoPage, onClose, searchOpen, numPages]);

  const toggleFs = () => {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* ---- search ---- */
  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    if (searchCancel.current) searchCancel.current.cancelled = true;
    const signal = { cancelled: false };
    searchCancel.current = signal;
    setSearching(true);
    setHits([]);
    setSearchProgress({ page: 0, total: 0 });
    try {
      const results = await searchDocument(book.file, q, (page, total) => {
        if (!signal.cancelled) setSearchProgress({ page, total });
      }, signal);
      if (!signal.cancelled) setHits(results);
    } finally {
      if (!signal.cancelled) setSearching(false);
    }
  };

  /* ---- bookmarks ---- */
  const onToggleMark = () => {
    setMarks(toggleBookmark(book.id, currentPage));
  };

  const onToggleFav = () => {
    setIsFav(toggleFavorite(book.id).includes(book.id));
  };

  const progressPct = numPages ? Math.round((currentPage / numPages) * 100) : 0;

  /* ================= render ================= */

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex flex-col bg-[#0b0b16]">
      {/* ======= top toolbar ======= */}
      <header className="glass-strong relative z-20 border-b border-white/[0.08]">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
          {/* back */}
          <button
            onClick={onClose}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 text-xs font-semibold text-white/80 transition hover:bg-white/[0.09]"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت
          </button>

          {/* title */}
          <div className="mx-1 hidden min-w-0 flex-1 items-center gap-2.5 sm:flex">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${gradeColor}22`, border: `1px solid ${gradeColor}44` }}
            >
              <SubjectIcon className="h-4.5 w-4.5" style={{ color: gradeColor }} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-white/90">{book.title}</div>
              <div className="text-[10px] text-white/40">
                {gradeData?.name} · {SubjectIcon && <span className="inline-flex translate-y-px">{book.subject}</span>}
                {GradeIcon && null}
              </div>
            </div>
          </div>
          <div className="flex-1 sm:hidden" />

          {/* page nav */}
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.09] bg-white/[0.04] px-1.5 py-1">
            <button
              onClick={() => gotoPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
              aria-label="صفحه قبل"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 px-1 text-xs font-semibold text-white/85">
              {doc ? (
                <>
                  <input
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value.replace(/[^\d]/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && jumpValue) {
                        gotoPage(Number(jumpValue));
                        setJumpValue("");
                      }
                    }}
                    placeholder={faNum(currentPage)}
                    className="w-9 rounded-md bg-white/[0.07] px-1 py-0.5 text-center text-xs text-white outline-none placeholder:text-white/85 focus:ring-1 focus:ring-violet-400/50"
                    inputMode="numeric"
                  />
                  <span className="text-white/40">/ {faNum(numPages)}</span>
                </>
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
              )}
            </div>
            <button
              onClick={() => gotoPage(currentPage + 1)}
              disabled={!doc || currentPage >= numPages}
              className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
              aria-label="صفحه بعد"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* actions */}
          <div className="flex items-center gap-1">
            <ToolBtn active={searchOpen} onClick={() => setSearchOpen((v) => !v)} title="جست‌وجو در متن">
              <Search className="h-4 w-4" />
            </ToolBtn>

            <div className="relative">
              <ToolBtn active={marksOpen} onClick={() => setMarksOpen((v) => !v)} title="نشانک‌ها">
                <Bookmark className={`h-4 w-4 ${marks.length ? "fill-amber-300 text-amber-300" : ""}`} />
              </ToolBtn>
              {marksOpen && (
                <div className="glass-strong absolute left-0 top-11 z-30 w-56 rounded-2xl p-2 shadow-2xl">
                  <div className="px-2 pb-1.5 pt-1 text-[10px] font-bold text-white/40">نشانک‌های این کتاب</div>
                  {marks.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-white/40">هنوز نشانکی نداری — با دکمهٔ زیر صفحهٔ فعلی را نشان کن</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto">
                      {marks.map((m) => (
                        <button
                          key={m}
                          onClick={() => { gotoPage(m); setMarksOpen(false); }}
                          className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs text-white/80 transition hover:bg-white/[0.07]"
                        >
                          <span>صفحهٔ {faNum(m)}</span>
                          <Bookmark className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={onToggleMark}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-500/20 px-2 py-2 text-xs font-bold text-violet-200 transition hover:bg-violet-500/30"
                  >
                    {marks.includes(currentPage) ? (
                      <><BookmarkCheck className="h-3.5 w-3.5" /> حذف نشانک صفحهٔ {faNum(currentPage)}</>
                    ) : (
                      <><Bookmark className="h-3.5 w-3.5" /> نشانک‌گذاری صفحهٔ {faNum(currentPage)}</>
                    )}
                  </button>
                </div>
              )}
            </div>

            <ToolBtn active={night} onClick={() => setNight((v) => !v)} title="حالت شب">
              {night ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </ToolBtn>

            <ToolBtn onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))} title="کوچک‌نمایی">
              <ZoomOut className="h-4 w-4" />
            </ToolBtn>
            <button
              onClick={() => setZoom(1)}
              title="اندازهٔ صفحه"
              className="hidden min-w-11 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-white/75 transition hover:bg-white/10 sm:block"
            >
              {faNum(Math.round(zoom * 100))}٪
            </button>
            <ToolBtn onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))} title="بزرگ‌نمایی">
              <ZoomIn className="h-4 w-4" />
            </ToolBtn>

            <ToolBtn active={thumbsOpen} onClick={() => setThumbsOpen((v) => !v)} title="تصاویر کوچک صفحات">
              {thumbsOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </ToolBtn>

            <ToolBtn onClick={toggleFs} active={fullscreen} title="تمام‌صفحه">
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </ToolBtn>

            <ToolBtn onClick={onToggleFav} active={isFav} title="علاقه‌مندی">
              <Heart className={`h-4 w-4 ${isFav ? "fill-rose-400 text-rose-400" : ""}`} />
            </ToolBtn>

            <a
              href={book.file}
              download={`${book.title}.pdf`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
              title="دانلود PDF"
            >
              <Download className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* progress bar */}
        <div className="h-[3px] w-full bg-white/[0.05]">
          <div
            className="h-full grad-brand transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {/* ======= search panel ======= */}
      {searchOpen && (
        <div className="glass-strong z-20 border-b border-white/[0.08] px-4 py-3">
          <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="متن مورد نظر را در این کتاب جست‌وجو کن…"
                  className="w-full rounded-xl border border-white/[0.1] bg-white/[0.05] py-2.5 pl-3 pr-9 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <button
                onClick={runSearch}
                disabled={searching || !query.trim()}
                className="flex h-10 items-center gap-1.5 rounded-xl grad-brand px-4 text-xs font-bold text-black transition disabled:opacity-40"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                جست‌وجو
              </button>
            </div>

            {searching && searchProgress.total > 0 && (
              <div className="text-[11px] text-white/45">
                بررسی صفحهٔ {faNum(searchProgress.page)} از {faNum(searchProgress.total)}…
              </div>
            )}

            {hits.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-white/[0.07]">
                {hits.map((h) => (
                  <button
                    key={h.page}
                    onClick={() => gotoPage(h.page)}
                    className="flex w-full items-start gap-3 border-b border-white/[0.05] px-3 py-2.5 text-right transition last:border-0 hover:bg-white/[0.05]"
                  >
                    <span className="mt-0.5 shrink-0 rounded-lg bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                      ص {faNum(h.page)}
                    </span>
                    <span className="line-clamp-2 text-xs leading-6 text-white/65">{h.snippet}</span>
                  </button>
                ))}
              </div>
            )}
            {!searching && query && hits.length === 0 && (
              <div className="text-[11px] text-white/35">نتیجه‌ای پیدا نشد — عبارت دیگری را امتحان کن</div>
            )}
          </div>
        </div>
      )}

      {/* ======= body ======= */}
      <div className="relative flex min-h-0 flex-1">
        {/* pages */}
        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-4 [overflow-anchor:none] sm:px-6"
        >
          {loadError && (
            <div className="mx-auto mt-20 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-rose-300" />
              <p className="text-sm font-bold text-rose-200">بارگذاری کتاب ناموفق بود</p>
              <p className="text-xs leading-6 text-white/50">{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/15"
              >
                تلاش دوباره
              </button>
            </div>
          )}

          {!doc && !loadError && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-violet-400/20 border-t-violet-400" />
                {pendingBook && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Download className="h-6 w-6 animate-pulse text-violet-300" />
                  </span>
                )}
              </div>
              {pendingBook ? (
                <>
                  <p className="text-sm font-bold text-violet-200">در حال آماده‌سازی کتاب…</p>
                  <p className="max-w-xs text-center text-[11px] leading-5 text-white/40">
                    این کتاب اولین بازیه که باز می‌شه — زَیرو به‌صورت هوشمند داره دانلودش می‌کنه؛ چند لحظه دیگه خودکار باز می‌شه
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-white/60">در حال باز کردن کتاب…</p>
                  <p className="text-[11px] text-white/35">{book.title}</p>
                </>
              )}
            </div>
          )}

          {doc && pageW > 0 && (
            <div data-pages-list className="flex flex-col items-center gap-4">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                <PageCanvas
                  key={p}
                  doc={doc}
                  pageNumber={p}
                  width={pageW}
                  ratio={ratio}
                  night={night}
                  active={
                    p >= currentPage - 2 && p <= currentPage + 4
                  }
                />
              ))}
              <div className="py-8 text-center text-[11px] text-white/30">
                پایان کتاب — {faNum(numPages)} صفحه
              </div>
            </div>
          )}
        </div>

        {/* thumbnails rail */}
        <AnimatePresence>
          {thumbsOpen && doc && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 168, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="z-10 shrink-0 overflow-hidden border-l border-white/[0.07] bg-black/25"
            >
              <div className="flex h-full w-[168px] flex-col">
                <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-3 py-2.5 text-[10px] font-bold text-white/45">
                  <ListOrdered className="h-3.5 w-3.5" />
                  صفحات کتاب
                </div>
                <div data-thumbs-scroll className="min-h-0 flex-1 overflow-y-auto p-2">
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                      <ThumbItem
                        key={p}
                        doc={doc}
                        page={p}
                        active={p === currentPage}
                        onClick={() => gotoPage(p)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ======= floating page pill (mobile) ======= */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
        <div className="glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold text-white/80 shadow-2xl">
          صفحهٔ {faNum(currentPage)} از {faNum(numPages)}
          <span className="mx-1 h-3 w-px bg-white/15" />
          {faNum(progressPct)}٪
        </div>
      </div>
    </div>
  );
}

/* ---------------- small pieces ---------------- */

function ToolBtn({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
        active
          ? "bg-violet-500/25 text-violet-200"
          : "text-white/60 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

const thumbCache = new Map<string, string>();

function ThumbItem({
  doc,
  page,
  active,
  onClick,
}: {
  doc: PDFDocumentProxy;
  page: number;
  active: boolean;
  onClick: () => void;
}) {
  const key = `${doc.finger ?? "d"}-${page}`;
  const [src, setSrc] = useState<string | null>(thumbCache.get(key) ?? null);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (src) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      try {
        const canvas = document.createElement("canvas");
        await renderPageToCanvas(doc, page, canvas, 130);
        const url = canvas.toDataURL("image/jpeg", 0.6);
        if (!cancelled) {
          thumbCache.set(key, url);
          setSrc(url);
        }
      } catch { /* ignore */ }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, doc, page]);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    // scroll ONLY the thumbnail rail — never ancestors (scrollIntoView would
    // also scroll the main page container and break the reading position)
    const rail = el?.closest("[data-thumbs-scroll]") as HTMLElement | null;
    if (!el || !rail) return;
    const r = el.getBoundingClientRect();
    const rr = rail.getBoundingClientRect();
    if (r.top < rr.top + 8 || r.bottom > rr.bottom - 8) {
      rail.scrollTop += r.top - rr.top - rr.height / 2 + r.height / 2;
    }
  }, [active]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`relative overflow-hidden rounded-lg border transition ${
        active
          ? "border-violet-400 shadow-[0_0_0_2px_rgba(167,139,250,0.35)]"
          : "border-white/[0.08] hover:border-white/25"
      }`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`صفحه ${page}`} className="block w-full" draggable={false} />
      ) : (
        <div className="shimmer w-full" style={{ aspectRatio: "0.72" }} />
      )}
      <span
        className={`absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
          active ? "bg-violet-400 text-black" : "bg-black/60 text-white/80"
        }`}
      >
        {faNum(page)}
      </span>
    </button>
  );
}
