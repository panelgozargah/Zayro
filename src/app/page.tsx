"use client";

import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ALL_BOOKS, GRADES, TOTAL_BOOKS, type BookData } from "@/lib/books-data";
import { getRecentSnapshot, subscribeLibrary } from "@/lib/library-store";
import { faNum } from "@/lib/ui-utils";
import HomeView from "@/components/library/HomeView";
import StageView from "@/components/library/StageView";
import GradeView from "@/components/library/GradeView";
import Reader from "@/components/library/Reader";
import SearchOverlay from "@/components/library/SearchOverlay";
import { isDesktop, fetchSyncStatus, type SyncStatus } from "@/lib/desktop";
import { BookOpen, Library as LibraryIcon, Search as SearchIcon, Zap, CloudDownload, CircleCheck } from "lucide-react";

type View =
  | { kind: "home" }
  | { kind: "stage"; stage: "elementary" | "middle" }
  | { kind: "grade"; grade: number }
  | { kind: "reader"; book: BookData };

interface Crumb {
  label: string;
  go: () => void;
}

/* Desktop-only: live smart-sync progress pill (library auto-downloads on first run). */
function SyncChip() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;
    let stop = false;
    const tick = async () => {
      const s = await fetchSyncStatus();
      if (!stop) {
        setStatus(s);
        setVisible(true);
      }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  if (!status || !visible) return null;
  const { total, done, failed } = status;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = done >= total && total > 0;
  const idle = complete && failed === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative hidden items-center gap-2 overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 sm:flex"
      title={idle ? "همه کتاب‌ها آماده‌ست" : `${done} از ${total} کتاب آماده شده`}
    >
      {idle ? (
        <CircleCheck className="h-4 w-4 text-emerald-400" />
      ) : (
        <CloudDownload className="h-4 w-4 animate-pulse text-violet-300" />
      )}
      <span className="text-[11px] font-bold leading-none text-white/70">
        {idle ? "کتابخانه کامل" : `${faNum(done)} / ${faNum(total)}`}
      </span>
      {!idle && (
        <span className="absolute bottom-0 right-0 h-[2.5px] bg-gradient-to-l from-violet-400 to-fuchsia-400 transition-all duration-700" style={{ width: `${pct}%` }} />
      )}
    </motion.div>
  );
}

export default function Page() {
  const [view, setView] = useState<View>({ kind: "home" });
  const [searchOpen, setSearchOpen] = useState(false);
  const recentsRaw = useSyncExternalStore(subscribeLibrary, getRecentSnapshot, getRecentSnapshot);
  const readingCount = recentsRaw.length;

  useEffect(() => {
    // global shortcut: Ctrl/Cmd+K → search
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openBook = useCallback((book: BookData) => {
    setView({ kind: "reader", book });
  }, []);

  const viewKey =
    view.kind === "reader" ? `reader-${view.book.id}` : view.kind === "grade" ? `grade-${view.grade}` : view.kind;

  const crumbs: Crumb[] = [];
  if (view.kind !== "home") crumbs.push({ label: "خانه", go: () => setView({ kind: "home" }) });
  if (view.kind === "grade") {
    const g = GRADES.find((x) => x.grade === view.grade);
    if (g) {
      crumbs.push({
        label: g.stage === "elementary" ? "دبستان" : "متوسطهٔ اول",
        go: () => setView({ kind: "stage", stage: g.stage }),
      });
      crumbs.push({ label: g.name, go: () => setView({ kind: "grade", grade: view.grade }) });
    }
  }
  if (view.kind === "stage") {
    crumbs.push({
      label: view.stage === "elementary" ? "دبستان" : "متوسطهٔ اول",
      go: () => setView({ kind: "stage", stage: view.stage }),
    });
  }
  if (view.kind === "reader") {
    const g = GRADES.find((x) => x.grade === view.book.grade);
    crumbs.push({
      label: g?.stage === "elementary" ? "دبستان" : "متوسطهٔ اول",
      go: () => g && setView({ kind: "stage", stage: g.stage }),
    });
    crumbs.push({
      label: g?.name ?? "",
      go: () => g && setView({ kind: "grade", grade: g.grade }),
    });
  }

  return (
    <main className="relative min-h-screen">
      <div className="ambient-glow" />

      {/* ===== header ===== */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          {/* logo */}
          <button
            onClick={() => setView({ kind: "home" })}
            className="flex items-center gap-2.5 transition hover:opacity-90"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl grad-brand shadow-lg shadow-violet-500/25">
              <Zap className="h-5 w-5 text-black" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white/95">
              زَیرو
              <span className="mr-1.5 hidden text-[10px] font-semibold text-white/35 sm:inline">
                کتابخانهٔ هوشمند
              </span>
            </span>
          </button>

          {/* breadcrumbs */}
          <nav className="mr-2 hidden min-w-0 flex-1 items-center gap-1 text-xs text-white/45 md:flex">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-white/20">/</span>}
                <button
                  onClick={c.go}
                  className={`rounded-lg px-1.5 py-1 transition hover:bg-white/[0.06] hover:text-white/80 ${
                    i === crumbs.length - 1 ? "font-bold text-white/70" : ""
                  }`}
                >
                  {c.label}
                </button>
              </span>
            ))}
          </nav>
          <div className="flex-1 md:hidden" />

          {/* desktop smart-sync status */}
          <SyncChip />

          {/* search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="group flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] py-2 pl-2 pr-3 text-xs text-white/45 transition hover:border-violet-400/30 hover:text-white/75"
          >
            <SearchIcon className="h-4 w-4" />
            <span className="hidden sm:inline">جست‌وجوی کتاب…</span>
            <kbd className="hidden rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-white/40 sm:inline">
              Ctrl K
            </kbd>
          </button>

          {/* library stat pill */}
          {readingCount > 0 && (
            <button
              onClick={() => setView({ kind: "home" })}
              className="hidden items-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-500/15 px-3 py-2 text-[11px] font-bold text-violet-200 transition hover:bg-violet-500/25 sm:flex"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {faNum(readingCount)} در حال مطالعه
            </button>
          )}
        </div>
      </header>

      {/* ===== views ===== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewKey}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {view.kind === "home" && (
            <HomeView
              onOpenStage={(stage) => setView({ kind: "stage", stage })}
              onOpenBook={openBook}
              onOpenSearch={() => setSearchOpen(true)}
            />
          )}
          {view.kind === "stage" && (
            <StageView
              stage={view.stage}
              onOpenGrade={(grade) => setView({ kind: "grade", grade })}
              onBack={() => setView({ kind: "home" })}
            />
          )}
          {view.kind === "grade" && (
            <GradeView
              grade={view.grade}
              onOpenBook={openBook}
              onBack={() => {
                const g = GRADES.find((x) => x.grade === view.grade);
                if (g) setView({ kind: "stage", stage: g.stage });
                else setView({ kind: "home" });
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ===== footer ===== */}
      {view.kind !== "reader" && (
        <footer className="relative z-10 mt-auto border-t border-white/[0.06] py-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 text-center">
            <div className="flex items-center gap-2 text-xs text-white/35">
              <LibraryIcon className="h-3.5 w-3.5" />
              {faNum(TOTAL_BOOKS)} کتاب رسمی از سازمان پژوهش و برنامه‌ریزی آموزشی کشور
            </div>
            <p className="text-[10px] leading-5 text-white/25">
              زَیرو — کتابخانهٔ هوشمند کتاب‌های درسی · مطالعهٔ آفلاین‌پسند با ذخیرهٔ خودکار پیشرفت
            </p>
          </div>
        </footer>
      )}

      {/* ===== overlays ===== */}
      {view.kind === "reader" && (
        <Reader book={view.book} onClose={() => setView({ kind: "grade", grade: view.book.grade })} />
      )}

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenBook={openBook}
      />
    </main>
  );
}
