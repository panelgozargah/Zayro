/**
 * Zayro Desktop — Smart Library Sync Engine
 * Downloads all official textbooks (109 PDFs) from chap.sch.ir in the
 * background, fully automatic: no user action required.
 * - Queue with bounded concurrency + priority jump (book opened before download)
 * - Resume-safe: partial files go to `.part`, validated (`%PDF-` magic) before rename
 * - Retries with backoff; periodic re-scan for failed/missing files
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const CONCURRENCY = 3;
const MAX_TRIES = 5;
const RESCAN_INTERVAL = 3 * 60 * 1000; // re-check failed books every 3 min
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const state = {
  booksDir: null,
  embedBooksDir: null,
  catalog: [],
  tasks: new Map(), // rel -> task
  queue: [], // rel[]
  active: new Set(), // rel[]
  started: false,
  scanTimer: null,
};

/* ---------------- status (served to the UI) ---------------- */

function getStatus() {
  let done = 0;
  let failed = 0;
  let pending = 0;
  const downloading = [];
  const failedList = [];
  for (const t of state.tasks.values()) {
    if (t.ok) done++;
    else if (t.tries >= MAX_TRIES && !t.ok) {
      failed++;
      failedList.push({ id: t.id, title: t.title });
    } else pending++;
  }
  for (const rel of state.active) {
    const t = state.tasks.get(rel);
    if (t) downloading.push({ id: t.id, title: t.title, rel });
  }
  let embedded = 0;
  for (const t of state.tasks.values()) if (t.embedded && t.ok) embedded++;
  return {
    total: state.tasks.size,
    done,
    failed,
    pending,
    downloading,
    failedList,
    embedded,
    booksDir: state.booksDir,
  };
}

/* ---------------- helpers ---------------- */

function isPdfValid(fp) {
  try {
    const st = fs.statSync(fp);
    if (st.size < 1200) return false;
    const fd = fs.openSync(fp, "r");
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    return buf.toString("latin1") === "%PDF-";
  } catch {
    return false;
  }
}

function get(url, redirects, cb) {
  const mod = url.startsWith("https:") ? https : http;
  const req = mod.get(
    url,
    { headers: { "User-Agent": UA, Referer: "https://chap.sch.ir/" }, timeout: 45000 },
    (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return get(next, redirects - 1, cb);
      }
      cb(null, res);
    }
  );
  req.on("error", (e) => cb(e));
  req.on("timeout", () => req.destroy(new Error("timeout")));
}

/* ---------------- core download ---------------- */

function pump() {
  while (state.active.size < CONCURRENCY && state.queue.length > 0) {
    const rel = state.queue.shift();
    if (!rel) break;
    const t = state.tasks.get(rel);
    if (!t || t.ok || state.active.has(rel)) continue;
    state.active.add(rel);
    downloadTask(t)
      .then(() => {})
      .catch(() => {})
      .finally(() => {
        state.active.delete(rel);
        pump();
      });
  }
}

function downloadTask(t) {
  return new Promise((resolve) => {
    if (t.ok) return resolve();
    if (isPdfValid(t.dest)) {
      t.ok = true;
      t.error = null;
      return resolve();
    }
    t.tries++;
    const partPath = t.dest + ".part";
    try {
      fs.mkdirSync(path.dirname(t.dest), { recursive: true });
      if (fs.existsSync(partPath)) fs.rmSync(partPath, { force: true });
    } catch {}

    const attempt = (triesLeft) => {
      get(t.url, 4, (err, res) => {
        if (err || !res || res.statusCode !== 200) {
          if (res && res.resume) res.resume();
          if (triesLeft > 0) return setTimeout(() => attempt(triesLeft - 1), 2500);
          t.error = (err && err.message) || "HTTP " + (res ? res.statusCode : "?");
          return resolve();
        }
        const out = fs.createWriteStream(partPath);
        res.pipe(out);
        out.on("finish", () => {
          if (isPdfValid(partPath)) {
            try {
              fs.renameSync(partPath, t.dest);
              t.ok = true;
              t.error = null;
            } catch (e) {
              t.error = e.message;
            }
          } else {
            t.error = "invalid pdf";
            try {
              fs.rmSync(partPath, { force: true });
            } catch {}
            if (triesLeft > 0) return setTimeout(() => attempt(triesLeft - 1), 2500);
          }
          resolve();
        });
        out.on("error", () => {
          if (triesLeft > 0) return setTimeout(() => attempt(triesLeft - 1), 2500);
          t.error = "disk write error";
          resolve();
        });
      });
    };

    attempt(MAX_TRIES);
  });
}

/* ---------------- public API ---------------- */

/** Move a book to the front of the queue (user just opened it). */
function prioritize(rel) {
  const t = state.tasks.get(rel);
  if (!t || t.ok || state.active.has(rel)) return false;
  t.tries = Math.min(t.tries, MAX_TRIES - 1); // give it fresh attempts
  const i = state.queue.indexOf(rel);
  if (i >= 0) state.queue.splice(i, 1);
  state.queue.unshift(rel);
  pump();
  return true;
}

function startSync({ booksDir, catalog, embedBooksDir }) {
  if (state.started) return getStatus();
  state.started = true;
  state.booksDir = booksDir;
  state.embedBooksDir = embedBooksDir || null;

  for (const b of catalog) {
    const rel = "g" + b.grade + "/" + b.book_id + ".pdf";
    const t = {
      id: b.book_id,
      grade: b.grade,
      title: b.title,
      url: b.pdf_url,
      rel,
      dest: path.join(booksDir, "g" + b.grade, b.book_id + ".pdf"),
      ok: false,
      tries: 0,
      error: null,
    };
    // Books shipped inside the app payload are instantly ready — no download needed.
    if (state.embedBooksDir && isPdfValid(path.join(state.embedBooksDir, rel))) {
      t.ok = true;
      t.embedded = true;
    }
    state.tasks.set(rel, t);
  }

  const scan = () => {
    state.queue = [];
    for (const [rel, t] of state.tasks) {
      if (!t.ok) {
        if (state.embedBooksDir && isPdfValid(path.join(state.embedBooksDir, rel))) {
          t.ok = true;
          t.embedded = true;
        } else if (isPdfValid(t.dest)) {
          t.ok = true;
        } else {
          t.tries = 0; // fresh scan → fresh attempts
          state.queue.push(rel);
        }
      }
    }
    pump();
  };

  scan();
  state.scanTimer = setInterval(scan, RESCAN_INTERVAL);

  return getStatus();
}

module.exports = { startSync, getStatus, prioritize };
