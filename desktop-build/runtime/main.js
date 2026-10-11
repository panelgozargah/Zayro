/**
 * Zayro Desktop — Electron main process
 * - Runs a tiny local HTTP server (127.0.0.1) that serves:
 *     /            → the exported Zayro web app (app-dist/)
 *     /books/*     → downloaded textbooks from the user-data dir
 *     /api/*       → sync status / health endpoints
 *   with full HTTP Range support (pdf.js streams + seeks pages fast).
 * - Smart library sync: downloads all books automatically in background.
 * - Windows: single instance, no menu, custom icon & title.
 */

const { app, BrowserWindow, Menu, shell } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { startSync, getStatus, prioritize } = require("./sync");

const ROOT = __dirname;
const DIST = path.join(ROOT, "app-dist");
// Books shipped INSIDE the app payload (resources/app/books) — installed offline by Setup/Portable.
const EMBED_BOOKS = path.join(ROOT, "books");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".bcmap": "application/octet-stream",
  ".pfb": "application/octet-stream",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

let booksDir = null;
let win = null;
let server = null;

/* ---------------- static file serving with Range ---------------- */

function serveFile(req, res, fp) {
  let st;
  try {
    st = fs.statSync(fp);
  } catch {
    res.writeHead(404);
    return res.end("not found");
  }
  const size = st.size;
  const ext = path.extname(fp).toLowerCase();
  const headers = {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": ext === ".pdf" ? "no-cache" : "public, max-age=3600",
  };

  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] !== "" ? parseInt(m[1], 10) : undefined;
    let end = m && m[2] !== "" ? parseInt(m[2], 10) : undefined;
    if (start === undefined && end !== undefined) {
      // suffix range: last N bytes
      start = Math.max(0, size - end);
      end = size - 1;
    }
    if (end === undefined || end >= size) end = size - 1;
    if (start === undefined || start > end || start >= size) {
      res.writeHead(416, { "Content-Range": "bytes */" + size });
      return res.end();
    }
    res.writeHead(206, {
      ...headers,
      "Content-Range": "bytes " + start + "-" + end + "/" + size,
      "Content-Length": end - start + 1,
    });
    fs.createReadStream(fp, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...headers, "Content-Length": size });
    fs.createReadStream(fp).pipe(res);
  }
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/** /books/g1/14142.pdf → relative "g1/14142.pdf" (path-traversal safe) */
function safeBooksRel(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  rel = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel || rel.includes("..") || rel.includes(":")) return null;
  return rel;
}

/* ---------------- request router ---------------- */

function handler(req, res) {
  const urlPath = (req.url || "/").split("?")[0];

  // health
  if (urlPath === "/api/health") return json(res, 200, { ok: true, app: "zayro-desktop" });

  // sync status for the UI chip
  if (urlPath === "/api/sync-status") return json(res, 200, getStatus());

  // books → embedded payload first, then user-data (updated/extra downloads);
  // missing book → 202 pending + jump the queue
  if (urlPath.startsWith("/books/")) {
    const rel = safeBooksRel(urlPath.slice("/books/".length));
    if (!rel) {
      res.writeHead(403);
      return res.end();
    }
    const embedded = path.join(EMBED_BOOKS, rel);
    if (fs.existsSync(embedded) && fs.statSync(embedded).isFile()) return serveFile(req, res, embedded);
    const fp = path.join(booksDir, rel);
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return serveFile(req, res, fp);

    prioritize(rel); // smart: open-before-download → download first
    return json(res, 202, { pending: true, rel });
  }

  // everything else → exported web app
  let rel = urlPath === "/" ? "index.html" : urlPath.slice(1);
  let fp = path.join(DIST, rel);
  if (!fp.startsWith(DIST)) {
    res.writeHead(403);
    return res.end();
  }
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return serveFile(req, res, fp);

  // extension-less fallback → SPA index
  if (!path.extname(rel)) return serveFile(req, res, path.join(DIST, "index.html"));

  res.writeHead(404);
  res.end("not found");
}

/* ---------------- window ---------------- */

function createWindow(port) {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#07070f",
    autoHideMenuBar: true,
    icon: path.join(ROOT, "zayro.ico"),
    webPreferences: {
      preload: path.join(ROOT, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadURL("http://127.0.0.1:" + port + "/");

  win.once("ready-to-show", () => win.show());
  win.on("page-title-updated", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("closed", () => {
    win = null;
  });
}

/* ---------------- lifecycle ---------------- */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.setAppUserModelId("ir.zayro.library");
  Menu.setApplicationMenu(null);

  app.whenReady().then(() => {
    booksDir = path.join(app.getPath("userData"), "books");
    fs.mkdirSync(booksDir, { recursive: true });

    let catalog = [];
    try {
      catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "catalog.json"), "utf8"));
    } catch (e) {
      console.error("catalog.json missing", e);
    }
    startSync({ booksDir, catalog, embedBooksDir: EMBED_BOOKS });

    server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      createWindow(port);
    });
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
