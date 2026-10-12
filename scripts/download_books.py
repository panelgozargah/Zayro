#!/usr/bin/env python3
"""Download all textbook PDFs from catalog.json with parallel workers + validation."""
import json
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
    "Referer": "http://chap.sch.ir/",
}

DEST_ROOT = "/home/z/my-project/books_raw"
CATALOG = "/home/z/my-project/scripts/catalog.json"


def download_one(book: dict, retries: int = 3) -> dict:
    grade = book["grade"]
    book_id = book["book_id"]
    url = book["pdf_url"]
    out_dir = os.path.join(DEST_ROOT, f"g{grade}")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{book_id}.pdf")

    result = {"grade": grade, "book_id": book_id, "title": book["title"], "path": out_path, "ok": False, "size": 0, "err": None}

    # skip if already downloaded and valid
    if os.path.exists(out_path) and os.path.getsize(out_path) > 50_000:
        with open(out_path, "rb") as f:
            if f.read(5).startswith(b"%PDF"):
                result["ok"] = True
                result["size"] = os.path.getsize(out_path)
                return result

    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            if not data.startswith(b"%PDF"):
                raise RuntimeError(f"not a PDF (magic={data[:8]!r}), size={len(data)}")
            with open(out_path, "wb") as f:
                f.write(data)
            result["ok"] = True
            result["size"] = len(data)
            return result
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(2 * (attempt + 1))
    result["err"] = str(last_err)
    return result


def main():
    import sys
    grade_filter = None
    if len(sys.argv) > 1:
        grade_filter = int(sys.argv[1])
    with open(CATALOG, encoding="utf-8") as f:
        catalog = json.load(f)
    if grade_filter is not None:
        catalog = [b for b in catalog if b["grade"] == grade_filter]
    print(f"Downloading {len(catalog)} books (grade={grade_filter})...")
    ok, fail = 0, 0
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(download_one, b): b for b in catalog}
        for fut in as_completed(futures):
            r = fut.result()
            if r["ok"]:
                ok += 1
                total_bytes += r["size"]
                print(f"  OK  G{r['grade']} {r['book_id']} {r['size']/1e6:6.1f}MB  {r['title'][:40]}")
            else:
                fail += 1
                print(f"  FAIL G{r['grade']} {r['book_id']} {r['title'][:40]} ERR: {r['err'][:80]}")
    print(f"\nDone: {ok} ok, {fail} failed, {total_bytes/1e9:.2f} GB total")


if __name__ == "__main__":
    main()
