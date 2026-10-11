"use client";

/**
 * ThumbCover — renders page-1 of the PDF as a cover image, lazily.
 * Uses IntersectionObserver so off-screen covers never load.
 */

import { useEffect, useRef, useState } from "react";
import { renderThumbnail } from "@/lib/pdf-engine";
import { isDesktop, waitForBook } from "@/lib/desktop";
import { BookOpen } from "lucide-react";

interface Props {
  file: string;
  color: string;
  className?: string;
  icon?: React.ReactNode;
}

const thumbCache = new Map<string, string>();

export default function ThumbCover({ file, color, className, icon }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(() => thumbCache.get(file) ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // desktop: cover may 404 while the book is still being smart-synced →
  // wait for the file, then re-arm the lazy loader
  useEffect(() => {
    if (!failed || !isDesktop()) return;
    let cancelled = false;
    (async () => {
      const ok = await waitForBook(file, { intervalMs: 5000, signal: { get cancelled() { return cancelled; } } });
      if (!cancelled && ok) {
        setFailed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, failed]);

  useEffect(() => {
    if (src || failed) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        if (loading || cancelled) return;
        setLoading(true);
        try {
          const dataUrl = await renderThumbnail(file, 260);
          if (!cancelled) {
            thumbCache.set(file, dataUrl);
            setSrc(dataUrl);
          }
        } catch {
          if (!cancelled) setFailed(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, src, failed]);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-white/[0.03] ${className ?? ""}`}
      style={{ contain: "paint" }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${
            loading ? "shimmer" : ""
          }`}
          style={{
            background: loading
              ? undefined
              : `linear-gradient(150deg, ${color}22 0%, ${color}0a 60%, transparent)`,
          }}
        >
          {!loading && (
            <div className="flex flex-col items-center gap-2 opacity-70" style={{ color }}>
              {icon ?? <BookOpen className="h-8 w-8" strokeWidth={1.5} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
