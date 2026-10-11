"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ALL_BOOKS, GRADES, type BookData } from "@/lib/books-data";
import { SUBJECT_ICONS } from "@/lib/subject-meta";
import { faNum } from "@/lib/ui-utils";
import { Search, X, FileText, CornerDownLeft } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenBook: (book: BookData) => void;
}

function norm(s: string) {
  return s
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200C\u200F\u200E]/g, "")
    .toLowerCase();
}

export default function SearchOverlay({ open, onClose, onOpenBook }: Props) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const results = useMemo<BookData[]>(() => {
    const query = norm(q.trim());
    if (!query) return [];
    const scored: { b: BookData; s: number }[] = [];
    for (const b of ALL_BOOKS) {
      const title = norm(b.title);
      const subject = norm(b.subject);
      let s = 0;
      if (title.includes(query)) s += 10;
      if (subject.includes(query)) s += 6;
      if (title.startsWith(query)) s += 6;
      if (norm(`${b.subject} پایه ${faNum(b.grade)}`).includes(query)) s += 4;
      if (query.includes(norm("پایه")) ) {
        const m = query.match(/پایه\s*([۱۲۳۴۵۶۷۸۹0-9]+)/);
        if (m) {
          const digits = "۰۱۲۳۴۵۶۷۸۹";
          const num = Number(m[1].replace(/[۰-۹]/g, (d) => String(digits.indexOf(d))));
          if (num === b.grade) s += 8;
        }
      }
      if (s > 0) scored.push({ b, s });
    }
    return scored.sort((a, b2) => b2.s - a.s).slice(0, 12).map((x) => x.b);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
      else if (e.key === "Enter" && results[sel]) { onOpenBook(results[sel]); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, sel, onClose, onOpenBook]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full max-w-xl overflow-hidden rounded-3xl shadow-2xl"
          >
            {/* input */}
            <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
              <Search className="h-5 w-5 shrink-0 text-violet-300" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setSel(0); }}
                placeholder="نام درس یا پایه را بنویس… مثلاً ریاضی نهم"
                className="flex-1 bg-transparent py-4 text-sm text-white outline-none placeholder:text-white/30"
              />
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* results */}
            <div className="max-h-[46vh] overflow-y-auto p-2">
              {q.trim() === "" ? (
                <div className="px-3 py-6">
                  <div className="mb-3 text-[11px] font-bold text-white/35">پیشنهاد جست‌وجو</div>
                  <div className="flex flex-wrap gap-2">
                    {["ریاضی نهم", "علوم هشتم", "فارسی", "انگلیسی", "عربی", "مطالعات"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setQ(s)}
                        className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 text-xs text-white/65 transition hover:border-violet-400/40 hover:text-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-white/40">چیزی پیدا نشد</div>
              ) : (
                results.map((b, i) => {
                  const Icon = SUBJECT_ICONS[b.subjectKey] ?? SUBJECT_ICONS.other;
                  const color = GRADES.find((g) => g.grade === b.grade)?.color ?? "#a78bfa";
                  return (
                    <button
                      key={b.id}
                      onClick={() => { onOpenBook(b); onClose(); }}
                      onMouseEnter={() => setSel(i)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right transition ${
                        i === sel ? "bg-violet-500/15" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: `${color}1f`, border: `1px solid ${color}33` }}
                      >
                        <Icon className="h-4 w-4" style={{ color }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-white/90">{b.title}</span>
                        <span className="text-[10px] text-white/40">
                          {b.subject} · پایه {faNum(b.grade)} · {faNum(b.sizeMB)} مگابایت
                        </span>
                      </span>
                      {i === sel && (
                        <CornerDownLeft className="h-4 w-4 shrink-0 text-violet-300" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* footer hint */}
            <div className="flex items-center gap-3 border-t border-white/[0.07] px-4 py-2 text-[10px] text-white/30">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {q ? `${faNum(results.length)} نتیجه` : `${faNum(ALL_BOOKS.length)} کتاب آمادهٔ خواندن`}
              </span>
              <span className="mr-auto flex items-center gap-1">
                ↑↓ حرکت · Enter باز کردن · Esc بستن
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
