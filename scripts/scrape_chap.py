#!/usr/bin/env python3
"""Fetch grade category pages from chap.sch.ir and extract book links."""
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

GRADE_CATS = {
    1: "/category/دوره/دوره-آموزش-ابتدایی/پایه-اول",
    2: "/category/دوره/دوره-آموزش-ابتدایی/پایه-دوم",
    3: "/category/دوره/دوره-آموزش-ابتدایی/پایه-سوم",
    4: "/category/دوره/دوره-آموزش-ابتدایی/پایه-چهارم",
    5: "/category/دوره/دوره-آموزش-ابتدایی/پایه-پنجم",
    6: "/category/دوره/دوره-آموزش-ابتدایی/پایه-ششم",
    7: "/category/دوره/دوره-اول-متوسطه-جدید/پایه-هفتم",
    8: "/category/دوره/دوره-اول-متوسطه-جدید/پایه-هشتم",
    9: "/category/دوره/دوره-اول-متوسطه-جدید/پایه-نهم",
}


def fetch(url: str, retries: int = 3) -> str:
    last_err = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"failed: {last_err}")


def extract_books(html: str):
    """Extract /books/ID links with their titles."""
    books = {}
    # Drupal view rows: <a href="/books/NNNNN">title</a>
    for m in re.finditer(r'href=["\'](/books/(\d+))["\'][^>]*>([^<]{2,120})<', html):
        path, bid, title = m.group(1), m.group(2), m.group(3).strip()
        if title and bid not in books:
            books[bid] = {"path": path, "title": title}
    return books


def main():
    all_data = {}
    for grade, cat in GRADE_CATS.items():
        url = BASE + urllib.parse.quote(cat)
        try:
            html = fetch(url)
            books = extract_books(html)
            all_data[grade] = books
            print(f"Grade {grade}: {len(books)} books")
            for bid, b in books.items():
                print(f"   [{bid}] {b['title'][:70]}")
        except Exception as e:  # noqa: BLE001
            print(f"Grade {grade}: ERROR {e}")
        time.sleep(1.5)
    import json
    with open("/home/z/my-project/scripts/chap_books.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print("\nSaved to chap_books.json")


if __name__ == "__main__":
    main()
