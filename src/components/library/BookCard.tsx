"use client";

import { memo, useSyncExternalStore } from "react";
import { GRADES, type BookData } from "@/lib/books-data";
import { SUBJECT_ICONS } from "@/lib/subject-meta";
import { getProgressSnapshot, getFavoritesSnapshot, subscribeLibrary } from "@/lib/library-store";
import { faNum, faSize } from "@/lib/ui-utils";
import ThumbCover from "./ThumbCover";
import { Heart } from "lucide-react";

interface Props {
  book: BookData;
  onOpen: (book: BookData) => void;
  index?: number;
}

function BookCard({ book, onOpen, index = 0 }: Props) {
  const Icon = SUBJECT_ICONS[book.subjectKey] ?? SUBJECT_ICONS.other;
  const gradeColor = GRADES.find((g) => g.grade === book.grade)?.color ?? "#a78bfa";
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
  const progressPct =
    progress && progress.total > 0 && progress.page > 1
      ? Math.min(100, Math.round((progress.page / progress.total) * 100))
      : null;

  return (
    <button
      onClick={() => onOpen(book)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] text-right transition-all duration-300 hover:-translate-y-1.5 hover:border-white/[0.16] hover:bg-white/[0.05] hover:shadow-2xl hover:shadow-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* cover */}
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <ThumbCover file={book.file} color={gradeColor} className="h-full w-full" icon={<Icon className="h-9 w-9" strokeWidth={1.4} />} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* size badge */}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur-md">
          {faSize(book.sizeMB)}
        </span>

        {book.experimental && (
          <span className="absolute top-2 right-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
            برنامهٔ جدید
          </span>
        )}

        {fav && (
          <span className="absolute top-2 left-2 rounded-full bg-rose-500/90 p-1.5 shadow-lg">
            <Heart className="h-3 w-3 fill-white text-white" />
          </span>
        )}

        {/* hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
          <span
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-black shadow-xl"
            style={{ background: "linear-gradient(120deg,#c4b5fd,#f0abfc)" }}
          >
            خواندن کتاب
          </span>
        </div>
      </div>

      {/* info */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 min-h-[2.4em] text-[13px] font-bold leading-snug text-white/92">
          {book.title}
        </h3>
        <div className="flex items-center justify-between text-[11px] text-white/45">
          <span className="flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" style={{ color: gradeColor }} />
            {book.subject}
          </span>
          <span>پایه {faNum(book.grade)}</span>
        </div>

        {progressPct !== null && (
          <div className="mt-1">
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full grad-brand transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="mt-1 block text-[10px] text-violet-300/80">
              {faNum(progressPct)}٪ خوانده شده
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

export default memo(BookCard);
