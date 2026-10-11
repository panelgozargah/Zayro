"use client";

/**
 * Library store — persisted reading state in localStorage, exposed as a
 * React external store (useSyncExternalStore-friendly, with stable snapshots).
 * Tracks: reading progress per book, recent books, bookmarks, favorites.
 */

import { ALL_BOOKS, type BookData } from "./books-data";

const KEY_PROGRESS = "zayro.progress.v1";
const KEY_RECENT = "zayro.recent.v1";
const KEY_BOOKMARKS = "zayro.bookmarks.v1";
const KEY_FAVS = "zayro.favs.v1";

export interface BookProgress {
  page: number;
  total: number;
  updatedAt: number;
}

export interface RecentEntry {
  id: string;
  updatedAt: number;
}

/* ---------------- external store plumbing ---------------- */

let version = 0;
const listeners = new Set<() => void>();

export function subscribeLibrary(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function bump() {
  version++;
  listeners.forEach((l) => l());
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full — ignore
  }
}

/* ---------------- raw accessors ---------------- */

export function getProgress(bookId: string): BookProgress | null {
  const all = readJSON<Record<string, BookProgress>>(KEY_PROGRESS, {});
  return all[bookId] ?? null;
}

export function saveProgress(bookId: string, page: number, total: number) {
  const all = readJSON<Record<string, BookProgress>>(KEY_PROGRESS, {});
  const prev = all[bookId];
  if (prev && prev.page === page && prev.total === total) return;
  all[bookId] = { page, total, updatedAt: Date.now() };
  writeJSON(KEY_PROGRESS, all);
  touchRecent(bookId);
}

export function getRecent(): RecentEntry[] {
  return readJSON<RecentEntry[]>(KEY_RECENT, []);
}

export function touchRecent(bookId: string) {
  const list = getRecent().filter((r) => r.id !== bookId);
  list.unshift({ id: bookId, updatedAt: Date.now() });
  writeJSON(KEY_RECENT, list.slice(0, 12));
  bump();
}

export function getBookmarks(bookId: string): number[] {
  const all = readJSON<Record<string, number[]>>(KEY_BOOKMARKS, {});
  return all[bookId] ?? [];
}

export function toggleBookmark(bookId: string, page: number): number[] {
  const all = readJSON<Record<string, number[]>>(KEY_BOOKMARKS, {});
  const list = all[bookId] ?? [];
  const i = list.indexOf(page);
  if (i >= 0) list.splice(i, 1);
  else {
    list.push(page);
    list.sort((a, b) => a - b);
  }
  all[bookId] = list;
  writeJSON(KEY_BOOKMARKS, all);
  bump();
  return list;
}

export function getFavorites(): string[] {
  return readJSON<string[]>(KEY_FAVS, []);
}

export function toggleFavorite(bookId: string): string[] {
  const list = getFavorites();
  const i = list.indexOf(bookId);
  if (i >= 0) list.splice(i, 1);
  else list.unshift(bookId);
  writeJSON(KEY_FAVS, list);
  bump();
  return list;
}

/* ---------------- stable snapshots (for useSyncExternalStore) ---------------- */

/** Shared stable empty array for server snapshots (must be referentially stable). */
const EMPTY_RECENT: RecentEntry[] = [];
const EMPTY_FAVS: string[] = [];

let recentCache: RecentEntry[] = [];
let recentVer = -1;

export function getRecentSnapshot(): RecentEntry[] {
  if (typeof window === "undefined") return EMPTY_RECENT;
  if (recentVer !== version) {
    recentCache = getRecent();
    recentVer = version;
  }
  return recentCache;
}

let favsCache: string[] = [];
let favsVer = -1;

export function getFavoritesSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY_FAVS;
  if (favsVer !== version) {
    favsCache = getFavorites();
    favsVer = version;
  }
  return favsCache;
}

const progressCache = new Map<string, BookProgress | null>();
let progressVer = -1;

export function getProgressSnapshot(bookId: string): BookProgress | null {
  if (typeof window === "undefined") return null;
  if (progressVer !== version) {
    progressCache.clear();
    progressVer = version;
  }
  if (!progressCache.has(bookId)) {
    progressCache.set(bookId, getProgress(bookId));
  }
  return progressCache.get(bookId) ?? null;
}

/* ---------------- helpers ---------------- */

/** Resolve book ids to BookData (skips unknown ids). */
export function booksByIds(ids: string[]): BookData[] {
  const byId = new Map(ALL_BOOKS.map((b) => [b.id, b]));
  return ids.map((id) => byId.get(id)).filter((b): b is BookData => !!b);
}
