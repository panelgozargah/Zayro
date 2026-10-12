"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GRADES, type BookData } from "@/lib/books-data";
import { SUBJECT_ICONS, GRADE_ICONS } from "@/lib/subject-meta";
import { faNum, faSize } from "@/lib/ui-utils";
import {
  getProgressSnapshot,
  getFavoritesSnapshot,
  getRecentSnapshot,
  subscribeLibrary,
} from "@/lib/library-store";
import BookCard from "./BookCard";
import {
  ChevronDown,
  ChevronLeft,
  Heart,
  LayoutGrid,
  List,
  Search,
  X,
  History,
  ArrowRight,
  BookMarked,
} from "lucide-react";

interface Props {
  grade: number;
  onOpenBook: (book: BookData) => void;
  onBack?: () => void;
}

const VIEW_KEY = "zayro-grade-view";

/** light Arabic→Persian char normalization for in-grade search */
const norm = (s: string) => s.replace(/ي/g, "ی").replace(/ك/g, "ک");

/* ------------------------------------------------------------------ */
/* List row — the compact "menu" style for choosing a lesson           */
/* ------------------------------------------------------------------ */
function BookRow({
  book,
  onOpen,
  index,
  color,
}: {
  book: BookData;
  onOpen: (b: BookData) => void;
  index: number;
  color: string;
}) {
  const Icon = SUBJECT_ICONS[book.subjectKey] ?? SUBJECT_ICONS.other;
  const progress = useSyncExternalStore(
    subscribeLibrary,
    () => getProgressSnapshot(book.id),
    () => null
  );
  const fav = useSyncExternalStore(
    subscribeLibrary,
    () => getFavoritesSnapshot().includes(book.id),
    () => false
  );
  const pct =
    progress && progress.total > 0 && progress.page > 1
      ? Math.min(100, Math.round((progress.page / progress.total) * 100))
      : null;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onOpen(book)}
      className="group flex w-full items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-right transition-all duration-300 hover:border-white/[0.16] hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105"
        style={{ background: `${color}1f`, color }}
      >
        <Icon className="h-5.5 w-5.5" strokeWidth={1.6} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-white/90">{book.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-white/45">
          <span>{book.subject}</span>
          <span className="text-white/20">•</span>
          <span>{faSize(book.sizeMB)}</span>
          {pct !== null && (
            <>
              <span className="text-white/20">•</span>
              <span className="font-semibold text-violet-300/85">{faNum(pct)}٪ خوانده شده</span>
            </>
          )}
        </span>
        {pct !== null && (
          <span className="mt-1.5 block h-1 w-full max-w-48 overflow-hidden rounded-full bg-white/[0.08]">
            <span className="block h-full rounded-full grad-brand" style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>

      {fav && (
        <span className="shrink-0 rounded-full bg-rose-500/15 p-1.5">
          <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
        </span>
      )}
      <ChevronLeft className="h-4.5 w-4.5 shrink-0 text-white/25 transition-all duration-300 group-hover:-translate-x-0.5 group-hover:text-white/70" />
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Continue-reading mini card                                          */
/* ------------------------------------------------------------------ */
function ContinueCard({
  book,
  page,
  total,
  pct,
  onOpen,
  color,
}: {
  book: BookData;
  page: number;
  total: number;
  pct: number;
  onOpen: (b: BookData) => void;
  color: string;
}) {
  const Icon = SUBJECT_ICONS[book.subjectKey] ?? SUBJECT_ICONS.other;
  return (
    <button
      onClick={() => onOpen(book)}
      className="group w-60 shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-right transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
    >
      <span className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${color}1f`, color }}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-white/90">{book.title}</span>
          <span className="mt-0.5 block text-[10.5px] text-white/45">
            ادامه از صفحهٔ {faNum(page)} از {faNum(total)}
          </span>
        </span>
      </span>
      <span className="mt-2.5 block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <span
          className="block h-full rounded-full grad-brand transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="mt-1.5 flex items-center justify-between text-[10px]">
        <span className="font-bold text-violet-300/85">{faNum(pct)}٪</span>
        <span className="text-white/30 transition group-hover:text-violet-300/80">ادامهٔ مطالعه ←</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* GradeView — smart menu of the chosen grade's books                  */
/* ------------------------------------------------------------------ */
export default function GradeView({ grade, onOpenBook, onBack }: Props) {
  const gradeData = GRADES.find((g) => g.grade === grade);
  const [subject, setSubject] = useState<string | null>(null);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [query, setQuery] = useState("");
  const [showSupp, setShowSupp] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // restore persisted view mode (grid | list)
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "list" || v === "grid") setViewMode(v);
    } catch {}
  }, []);
  const switchView = (m: "grid" | "list") => {
    setViewMode(m);
    try {
      localStorage.setItem(VIEW_KEY, m);
    } catch {}
  };

  const favs = useSyncExternalStore(subscribeLibrary, getFavoritesSnapshot, getFavoritesSnapshot);
  const recentsRaw = useSyncExternalStore(subscribeLibrary, getRecentSnapshot, getRecentSnapshot);

  /* all hooks MUST run before any early return (rules of hooks) */
  const main = useMemo(
    () => (gradeData ? gradeData.books.filter((b) => !b.supplementary) : []),
    [gradeData]
  );
  const supp = useMemo(
    () => (gradeData ? gradeData.books.filter((b) => b.supplementary) : []),
    [gradeData]
  );

  const subjects = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>();
    for (const b of main) {
      const cur = map.get(b.subjectKey);
      if (cur) cur.count++;
      else map.set(b.subjectKey, { key: b.subjectKey, name: b.subject, count: 1 });
    }
    return [...map.values()];
  }, [main]);

  const totalMB = useMemo(() => main.reduce((s, b) => s + b.sizeMB, 0), [main]);

  const matches = (b: BookData) => {
    if (subject && b.subjectKey !== subject) return false;
    if (onlyFavs && !favs.includes(b.id)) return false;
    const q = norm(query.trim());
    if (q && !norm(b.title).includes(q) && !norm(b.subject).includes(q)) return false;
    return true;
  };

  const mainShown = main.filter(matches);
  const suppShown = supp.filter(matches);
  const filtered = subject !== null || onlyFavs || query.trim() !== "";

  /* continue-reading entries scoped to this grade (ordered by recency) */
  const continueList = useMemo(() => {
    const out: { book: BookData; page: number; total: number; pct: number }[] = [];
    if (!gradeData) return out;
    for (const r of recentsRaw) {
      const b = gradeData.books.find((x) => x.id === r.id);
      if (!b) continue;
      const p = getProgressSnapshot(b.id);
      if (p && p.total > 0 && p.page > 1) {
        out.push({
          book: b,
          page: p.page,
          total: p.total,
          pct: Math.min(100, Math.round((p.page / p.total) * 100)),
        });
      }
    }
    return out.slice(0, 8);
  }, [recentsRaw, gradeData]);

  if (!gradeData) return null;
  const GIcon = GRADE_ICONS[grade];
  const color = gradeData.color;

  const resetFilters = () => {
    setSubject(null);
    setOnlyFavs(false);
    setQuery("");
  };

  const renderGrid = (items: BookData[]) => (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <AnimatePresence mode="popLayout">
        {items.map((b, i) => (
          <motion.div
            layout
            key={b.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ delay: Math.min(i * 0.04, 0.35), duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <BookCard book={b} onOpen={onOpenBook} index={i} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  const renderList = (items: BookData[]) => (
    <div className="flex flex-col gap-2.5">
      <AnimatePresence mode="popLayout">
        {items.map((b, i) => (
          <BookRow key={b.id} book={b} onOpen={onOpenBook} index={i} color={color} />
        ))}
      </AnimatePresence>
    </div>
  );

  const renderItems = viewMode === "grid" ? renderGrid : renderList;

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
      {/* ============ grade banner ============ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-white/[0.08] p-5 sm:p-8"
        style={{
          background: `linear-gradient(140deg, ${color}26 0%, ${color}0f 45%, rgba(7,7,15,0) 100%), rgba(255,255,255,0.025)`,
        }}
      >
        <div
          className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full blur-3xl pulse-glow"
          style={{ background: `${color}2e` }}
        />

        <div className="relative flex items-center gap-4">
          {/* mobile back */}
          {onBack && (
            <button
              onClick={onBack}
              aria-label="بازگشت به مقطع"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] text-white/60 transition hover:text-white md:hidden"
            >
              <ArrowRight className="h-4.5 w-4.5" />
            </button>
          )}
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg sm:h-16 sm:w-16 sm:rounded-3xl"
            style={{
              background: `linear-gradient(135deg, ${color}, ${color}99)`,
              boxShadow: `0 10px 32px -10px ${color}88`,
            }}
          >
            {GIcon && <GIcon className="h-7 w-7 text-black/80 sm:h-8 sm:w-8" strokeWidth={2} />}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold text-white">{gradeData.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/50 sm:text-sm">
              <span className="flex items-center gap-1">
                <BookMarked className="h-3.5 w-3.5" style={{ color }} />
                {faNum(main.length)} درس اصلی
              </span>
              {supp.length > 0 && (
                <>
                  <span className="text-white/20">•</span>
                  <span>{faNum(supp.length)} کتاب تکمیلی</span>
                </>
              )}
              <span className="text-white/20">•</span>
              <span>مجموعاً {faSize(totalMB)}</span>
            </p>
          </div>
        </div>
      </motion.section>

      {/* ============ continue reading (this grade) ============ */}
      {continueList.length > 0 && (
        <section className="mt-7">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4.5 w-4.5 text-violet-300" />
            <h2 className="text-sm font-bold text-white/85">ادامهٔ مطالعه در {gradeData.name}</h2>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {continueList.map((c) => (
              <ContinueCard
                key={c.book.id}
                book={c.book}
                page={c.page}
                total={c.total}
                pct={c.pct}
                onOpen={onOpenBook}
                color={color}
              />
            ))}
          </div>
        </section>
      )}

      {/* ============ toolbar: search + view toggle ============ */}
      <div className="mt-7 flex flex-wrap items-center gap-2">
        <div className="relative order-2 min-w-0 flex-1 sm:order-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی درس در این پایه…"
            className="w-full rounded-xl border border-white/[0.09] bg-white/[0.04] py-2.5 pl-9 pr-9 text-xs font-medium text-white/85 placeholder:text-white/30 focus:border-violet-400/40 focus:bg-white/[0.06] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="پاک کردن جست‌وجو"
              className="absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/35 transition hover:bg-white/[0.08] hover:text-white/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="order-1 mr-auto flex items-center gap-1 rounded-xl border border-white/[0.09] bg-white/[0.04] p-1 sm:order-2">
          <button
            onClick={() => switchView("grid")}
            aria-label="نمایش کارت‌ها"
            title="نمایش کارت‌ها"
            className={`flex h-8 w-9 items-center justify-center rounded-lg transition ${
              viewMode === "grid"
                ? "bg-white/[0.1] text-white shadow-sm"
                : "text-white/40 hover:text-white/75"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => switchView("list")}
            aria-label="نمایش فهرستی"
            title="نمایش فهرستی"
            className={`flex h-8 w-9 items-center justify-center rounded-lg transition ${
              viewMode === "list"
                ? "bg-white/[0.1] text-white shadow-sm"
                : "text-white/40 hover:text-white/75"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ============ subject filter chips ============ */}
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <FilterChip active={subject === null && !onlyFavs} onClick={() => setSubject(null)} color={color}>
          همه ({faNum(main.length)})
        </FilterChip>
        {subjects.map((s) => {
          const SIcon = SUBJECT_ICONS[s.key] ?? SUBJECT_ICONS.other;
          return (
            <FilterChip
              key={s.key}
              active={subject === s.key}
              onClick={() => setSubject(subject === s.key ? null : s.key)}
              color={color}
            >
              <SIcon className="h-3.5 w-3.5" />
              {s.name}
              <span className="opacity-55">({faNum(s.count)})</span>
            </FilterChip>
          );
        })}
        <FilterChip active={onlyFavs} onClick={() => setOnlyFavs((v) => !v)} color={color} fav>
          <Heart className={`h-3.5 w-3.5 ${onlyFavs ? "fill-rose-300" : ""}`} />
          علاقه‌مندی‌ها
        </FilterChip>
      </div>

      {/* ============ books ============ */}
      <section className="mt-5">
        <div className="mb-3.5 flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-white/90">درس‌های این پایه</h2>
          <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-semibold text-white/50">
            {faNum(mainShown.length)} درس
          </span>
          {filtered && (
            <button
              onClick={resetFilters}
              className="mr-auto flex items-center gap-1 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-[10.5px] font-semibold text-white/55 transition hover:border-violet-400/30 hover:text-white/85"
            >
              <X className="h-3 w-3" />
              پاک کردن فیلترها
            </button>
          )}
        </div>

        {mainShown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <p className="text-sm text-white/45">
              {onlyFavs && subject === null && !query
                ? "هنوز کتابی به علاقه‌مندی‌ها اضافه نکردی — داخل کتاب‌خوان دکمهٔ قلب را بزن"
                : "درسی با این مشخصات پیدا نشد"}
            </p>
            {filtered && (
              <button
                onClick={resetFilters}
                className="mt-4 rounded-full bg-violet-500/20 px-4 py-2 text-xs font-bold text-violet-200 transition hover:bg-violet-500/30"
              >
                پاک کردن فیلترها
              </button>
            )}
          </div>
        ) : (
          renderItems(mainShown)
        )}
      </section>

      {/* ============ supplementary ============ */}
      {supp.length > 0 && (suppShown.length > 0 || !filtered) && (
        <div className="mt-9">
          <button
            onClick={() => setShowSupp((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 text-right transition hover:bg-white/[0.04]"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-white/70">
              کتاب‌های تکمیلی و نسخه‌های خاص
              <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-medium text-white/50">
                {faNum(suppShown.length)} کتاب
              </span>
            </span>
            <ChevronDown
              className={`h-4.5 w-4.5 text-white/40 transition-transform duration-300 ${
                showSupp ? "rotate-180" : ""
              }`}
            />
          </button>
          <AnimatePresence>
            {showSupp && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-5">
                  {suppShown.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-white/40">
                      کتاب تکمیلی‌ای با این فیلترها پیدا نشد
                    </p>
                  ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {suppShown.map((b, i) => (
                        <BookCard key={b.id} book={b} onOpen={onOpenBook} index={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {suppShown.map((b, i) => (
                        <BookRow key={b.id} book={b} onOpen={onOpenBook} index={i} color={color} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filter chip                                                         */
/* ------------------------------------------------------------------ */
function FilterChip({
  active,
  onClick,
  children,
  color,
  fav = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  color: string;
  fav?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
        active
          ? fav
            ? "border-rose-400/40 bg-rose-500/20 text-rose-200"
            : "text-white"
          : "border-white/[0.09] bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/85"
      }`}
      style={active && !fav ? { background: `${color}2e`, borderColor: `${color}66` } : undefined}
    >
      {children}
    </button>
  );
}
