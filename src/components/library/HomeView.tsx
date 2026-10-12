"use client";

import { useMemo, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { GRADES, TOTAL_BOOKS, type BookData } from "@/lib/books-data";
import { GRADE_ICONS } from "@/lib/subject-meta";
import {
  booksByIds,
  getProgressSnapshot,
  getRecentSnapshot,
  subscribeLibrary,
} from "@/lib/library-store";
import { faNum, timeAgo, STAGE_LABEL } from "@/lib/ui-utils";
import BookCard from "./BookCard";
import { ArrowLeft, BookOpen, Clock3, Library, Sparkles, Layers3 } from "lucide-react";

interface Props {
  onOpenStage: (stage: "elementary" | "middle") => void;
  onOpenBook: (book: BookData) => void;
  onOpenSearch: () => void;
}

interface RecentWithBook {
  book: BookData;
  updatedAt: number;
  pct: number;
}

export default function HomeView({ onOpenStage, onOpenBook, onOpenSearch }: Props) {
  const recentsRaw = useSyncExternalStore(subscribeLibrary, getRecentSnapshot, getRecentSnapshot);

  const recents = useMemo<RecentWithBook[]>(() => {
    const books = booksByIds(recentsRaw.map((e) => e.id));
    const merged: RecentWithBook[] = [];
    for (const b of books) {
      const entry = recentsRaw.find((e) => e.id === b.id);
      if (!entry) continue;
      const p = getProgressSnapshot(b.id);
      const pct = p && p.total ? Math.min(100, Math.round((p.page / p.total) * 100)) : 0;
      merged.push({ book: b, updatedAt: entry.updatedAt, pct });
    }
    return merged;
  }, [recentsRaw]);

  const elementaryCount = GRADES.filter((g) => g.stage === "elementary").reduce(
    (s, g) => s + g.books.filter((b) => !b.supplementary).length,
    0
  );
  const middleCount = GRADES.filter((g) => g.stage === "middle").reduce(
    (s, g) => s + g.books.filter((b) => !b.supplementary).length,
    0
  );

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      {/* ============ hero ============ */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-white/[0.08] p-6 sm:p-10"
        style={{
          background:
            "linear-gradient(140deg, rgba(139,92,246,0.14) 0%, rgba(217,70,239,0.08) 45%, rgba(7,7,15,0) 100%), rgba(255,255,255,0.025)",
        }}
      >
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl pulse-glow" />
        <div className="pointer-events-none absolute -bottom-28 right-10 h-64 w-64 rounded-full bg-fuchsia-500/12 blur-3xl" />

        <div className="relative flex flex-col gap-6">
          <div className="flex items-center gap-2 text-[11px] font-medium text-violet-300/90">
            <Sparkles className="h-3.5 w-3.5" />
            کتابخانهٔ رسمی کتاب‌های درسی ایران
          </div>

          <h1 className="max-w-2xl text-2xl font-extrabold leading-[1.5] text-white sm:text-4xl sm:leading-[1.5]">
            همهٔ کتاب‌های درسی،
            <span className="grad-brand-text"> یک‌جا و همیشه همراهت</span>
          </h1>
          <p className="max-w-xl text-sm leading-7 text-white/55 sm:text-[15px] sm:leading-8">
            مقطع را انتخاب کن، پایه را بزن و مستقیم برو سراغ درس‌ها. بدون نیاز به دانلودِ دستی،
            بدون تب‌های شلوغ — با کتاب‌خوانِ حرفه‌ای، حالت شب و ذخیرهٔ خودکار ادامهٔ مطالعه.
          </p>

          {/* stats */}
          <div className="flex flex-wrap items-center gap-3">
            {[
              { icon: Library, label: `${faNum(TOTAL_BOOKS)} کتاب رسمی` },
              { icon: Layers3, label: "۲ مقطع تحصیلی" },
              { icon: BookOpen, label: "پایه ۱ تا ۹" },
            ].map(({ icon: Icon, label }, i) => (
              <span
                key={i}
                className="flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-white/75"
              >
                <Icon className="h-3.5 w-3.5 text-violet-300" />
                {label}
              </span>
            ))}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/15 px-3.5 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/25"
            >
              جست‌وجوی سریع
            </button>
          </div>
        </div>
      </motion.section>

      {/* ============ stages ============ */}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-white/90">انتخاب مقطع</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              {
                stage: "elementary" as const,
                title: "دبستان",
                grades: [1, 2, 3, 4, 5, 6],
                count: elementaryCount,
                from: "#f43f5e",
                to: "#06b6d4",
                desc: "از اول دبستان تا ششم — جهان پیرامون، ریاضی دوست‌داشتنی و...",
              },
              {
                stage: "middle" as const,
                title: "متوسطهٔ اول",
                grades: [7, 8, 9],
                count: middleCount,
                from: "#8b5cf6",
                to: "#f59e0b",
                desc: "هفتم، هشتم و نهم — عربی، انگلیسی، کار و فناوری و...",
              },
            ]
          ).map((s, i) => (
            <motion.button
              key={s.stage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => onOpenStage(s.stage)}
              className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 text-right transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.18] hover:shadow-2xl hover:shadow-black/60"
            >
              <div
                className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-45"
                style={{ background: `radial-gradient(circle, ${s.from}, transparent 70%)` }}
              />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="rounded-lg px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: `linear-gradient(120deg, ${s.from}, ${s.to})` }}
                    >
                      {STAGE_LABEL[s.stage]}
                    </span>
                    <span className="text-[11px] text-white/45">
                      {faNum(s.count)} کتاب اصلی
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white/95">{s.title}</h3>
                  <p className="mt-1.5 text-xs leading-6 text-white/50">{s.desc}</p>
                  <div className="mt-4 flex items-center gap-1.5">
                    {s.grades.map((g) => {
                      const grade = GRADES.find((x) => x.grade === g);
                      const GIcon = GRADE_ICONS[g];
                      return (
                        <span
                          key={g}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] text-[11px] font-bold text-white/70 transition group-hover:border-white/[0.16] group-hover:bg-white/[0.07]"
                          style={{ color: grade?.color }}
                          title={grade?.name}
                        >
                          {GIcon ? <GIcon className="h-4 w-4" /> : faNum(g)}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.05] text-white/60 transition group-hover:-translate-x-1 group-hover:text-white">
                  <ArrowLeft className="h-5 w-5" />
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ============ continue reading ============ */}
      {recents.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="h-4.5 w-4.5 text-violet-300" />
            <h2 className="text-lg font-bold text-white/90">ادامهٔ مطالعه</h2>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {recents.map((r, i) => (
              <div key={r.book.id} className="relative">
                <BookCard book={r.book} onOpen={onOpenBook} index={i} />
                <span className="absolute -top-1 right-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-medium text-white/70 backdrop-blur-md">
                  {timeAgo(r.updatedAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
