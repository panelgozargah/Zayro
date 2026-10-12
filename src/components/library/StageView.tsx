"use client";

import { motion } from "framer-motion";
import { GRADES } from "@/lib/books-data";
import { GRADE_ICONS } from "@/lib/subject-meta";
import { faNum, STAGE_LABEL } from "@/lib/ui-utils";
import { ArrowLeft, ArrowRight, BookMarked } from "lucide-react";

interface Props {
  stage: "elementary" | "middle";
  onOpenGrade: (grade: number) => void;
  onBack?: () => void;
}

export default function StageView({ stage, onOpenGrade, onBack }: Props) {
  const grades = GRADES.filter((g) => g.stage === stage);

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="بازگشت به خانه"
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] text-white/60 transition hover:text-white md:hidden"
        >
          <ArrowRight className="h-4.5 w-4.5" />
        </button>
      )}
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-1.5 text-2xl font-extrabold text-white"
      >
        {STAGE_LABEL[stage]}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="mb-8 text-sm text-white/50"
      >
        یکی از پایه‌ها را انتخاب کن تا کتاب‌های درسی‌اش را ببینی
      </motion.p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grades.map((g, i) => {
          const Icon = GRADE_ICONS[g.grade];
          const mainBooks = g.books.filter((b) => !b.supplementary);
          return (
            <motion.button
              key={g.grade}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => onOpenGrade(g.grade)}
              className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 text-right transition-all duration-300 hover:-translate-y-1.5 hover:border-white/[0.18] hover:shadow-2xl hover:shadow-black/60"
            >
              <div
                className="pointer-events-none absolute -left-14 -top-14 h-44 w-44 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-50"
                style={{ background: `radial-gradient(circle, ${g.color}, transparent 70%)` }}
              />
              <div className="relative flex items-center gap-4">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                  style={{
                    background: `linear-gradient(135deg, ${g.color}, ${g.color}99)`,
                    boxShadow: `0 8px 24px -8px ${g.color}66`,
                  }}
                >
                  {Icon && <Icon className="h-7 w-7 text-black/80" strokeWidth={2} />}
                </span>
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-white/95">{g.name}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/50">
                    <BookMarked className="h-3.5 w-3.5" style={{ color: g.color }} />
                    {faNum(mainBooks.length)} کتاب اصلی
                    {g.books.length > mainBooks.length && (
                      <span className="text-white/35">
                        + {faNum(g.books.length - mainBooks.length)} تکمیلی
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-white/35 transition-all duration-300 group-hover:-translate-x-1 group-hover:text-white">
                  <ArrowLeft className="h-5 w-5" />
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
