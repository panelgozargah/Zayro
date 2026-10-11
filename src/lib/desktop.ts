"use client";

/**
 * Zayro Desktop bridge — detects the Electron runtime and talks to its
 * local server endpoints (sync status etc.). All helpers are safe no-ops
 * in the plain web version.
 */

export function isDesktop(): boolean {
  return typeof window !== "undefined" && (window as any).__ZAYRO_DESKTOP__ === true;
}

export interface SyncStatus {
  total: number;
  done: number;
  failed: number;
  pending: number;
  downloading: { id: string; title: string; rel: string }[];
  failedList: { id: string; title: string }[];
}

export async function fetchSyncStatus(): Promise<SyncStatus | null> {
  if (!isDesktop()) return null;
  try {
    const r = await fetch("/api/sync-status", { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as SyncStatus;
  } catch {
    return null;
  }
}

/** Resolve once the given book file exists on the desktop server (or timeout). */
export function waitForBook(
  file: string,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: { cancelled: boolean } } = {}
): Promise<boolean> {
  const { intervalMs = 2500, timeoutMs = 30 * 60 * 1000, signal } = opts;
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const tick = async () => {
      if (signal?.cancelled) return resolve(false);
      try {
        const r = await fetch(file, { method: "HEAD", cache: "no-store" });
        if (r.ok) return resolve(true);
      } catch {
        /* keep polling */
      }
      if (Date.now() - startedAt > timeoutMs) return resolve(false);
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}
