#!/usr/bin/env python3
"""Visit each book page on chap.sch.ir, extract PDF URL, build catalog JSON."""
import json
import re
import time
import urllib.parse
import urllib.request

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
}

BASE = "http://chap.sch.ir"
# Sidebar recommendations that appear on every category page (NOT grade books)
EXCLUDE_IDS = {"15050", "15051", "15052", "15053", "15054", "15043"}

with open("/home/z/my-project/scripts/chap_books.json", encoding="utf-8") as f:
    grade_books = json.load(f)


def fetch(url: str, retries: int = 3) -> str:
    last_err = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"failed: {last_err}")


def clean_title(t: str) -> str:
    t = re.sub(r"\s+", " ", t).strip()
    return t


def main():
    catalog = []
    total = sum(len(v) for v in grade_books.values())
    done = 0
    for grade_s, books in grade_books.items():
        grade = int(grade_s)
        for bid, info in books.items():
            done += 1
            if bid in EXCLUDE_IDS:
                continue
            title = clean_title(info["title"])
            try:
                html = fetch(BASE + "/books/" + bid)
                pdf_m = re.search(r'href=["\']([^"\']*?\.pdf[^"\']*)["\']', html, re.I)
                # also get cover image if present
                img_m = re.search(r'<img[^>]*src=["\']([^"\']*/files/[^"\']*cover[^"\']*\.(?:jpg|png|jpeg))["\']', html, re.I)
                cover = img_m.group(1) if img_m else None
                if not pdf_m:
                    # fallback: look in onclick / embedded
                    pdf_m = re.search(r'(http://chap\.sch\.ir/sites/default/files/[^\s"\']*\.pdf)', html)
                if pdf_m:
                    pdf_url = pdf_m.group(1)
                    catalog.append({
                        "grade": grade,
                        "book_id": bid,
                        "title": title,
                        "pdf_url": pdf_url,
                        "cover": cover,
                    })
                    print(f"[{done}/{total}] G{grade} OK  {title[:45]} -> {pdf_url[-45:]}")
                else:
                    print(f"[{done}/{total}] G{grade} NO-PDF  {title[:45]}")
            except Exception as e:  # noqa: BLE001
                print(f"[{done}/{total}] G{grade} ERR  {title[:45]}: {e}")
            time.sleep(1.2)

    with open("/home/z/my-project/scripts/catalog.json", "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"\nCatalog saved: {len(catalog)} books with PDFs")


if __name__ == "__main__":
    main()
