#!/usr/bin/env python3
"""Scrape daneshchi.ir tag pages to extract textbook PDF links for grades 1-9."""
import json
import re
import time
import urllib.request

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
}

GRADES = {
    1: "https://www.daneshchi.ir/tag/%DA%A9%D8%AA%D8%A7%D8%A8-%D9%87%D8%A7%DB%8C-%D8%A7%D9%88%D9%84-%D8%AF%D8%A8%D8%B3%D8%AA%D8%A7%D9%86/",
    2: "https://www.daneshchi.ir/tag/%DA%A9%D8%AA%D8%A7%D8%A8-%D9%87%D8%A7%DB%8C-%D8%AF%D9%88%D9%85-%D8%AF%D8%A8%D8%B3%D8%AA%D8%A7%D9%86/",
    3: "https://www.daneshchi.ir/tag/%DA%A9%D8%AA%D8%A7%D8%A8-%D9%87%D8%A7%DB%8C-%D8%B3%D9%88%D9%85-%D8%AF%D8%A8%D8%B3%D8%AA%D8%A7%D9%86/",
    4: "https://www.daneshchi.ir/tag/%DA%A9%D8%AA%D8%A7%D8%A8-%D9%87%D8%A7%DB%8C-%D8%AF%D8%B1%D8%B3%DB%8C-%DA%86%D9%87%D8%A7%D8%B1%D9%85-%D8%AF%D8%A8%D8%B3%D8%AA%D8%A7%D9%86/",
    5: "https://www.daneshchi.ir/tag/%DA%A9%D8%AA%D8%A7%D8%A8-%D9%87%D8%A7%DB%8C-%D8%AF%D8%B1%D8%B3%DB%8C-%D9%BE%D9%86%D8%AC%D9%85-%D8%AF%D8%A8%D8%B3%D8%AA%D8%A7%D9%86/",
    6: "https://www.daneshchi.ir/tag/%DA%A9%D8%AA%D8%A7%D8%A8-%D9%87%D8%A7%DB%8C-%D8%AF%D8%B1%D8%B3%DB%8C-%D8%B4%D8%B4%D9%85-%D8%AF%D8%A8%D8%B3%D8%AA%D8%A7%D9%86/",
    7: "https://www.daneshchi.ir/tag/%DA%A9%D8%AA%D8%A7%D8%A8-%D9%87%D8%A7%DB%8C-%D9%87%D9%81%D8%AA%D9%85-%D9%85%D8%AA%D9%88%D8%B3%D8%B7%D9%87-%D8%A7%D9%88%D9%84/",
    8: "https://www.daneshchi.ir/tag/%DA%A9%D8%AA%D8%A7%D8%A8-%D9%87%D8%A7%DB%8C-%D8%AF%D8%B1%D8%B3%DB%8C-%D9%87%D8%B4%D8%AA%D9%85-%D9%85%D8%AA%D9%88%D8%B3%D8%B7%D9%87-%D8%A7%D9%88%D9%84/",
    9: "https://www.daneshchi.ir/tag/%DA%A9%D8%AA%D8%A7%D8%A8-%D9%87%D8%A7%DB%8C-%D8%AF%D8%B1%D8%B3%DB%8C-%D9%86%D9%87%D9%85-%D9%85%D8%AA%D9%88%D8%B3%D8%B7%D9%87-%D8%A7%D9%88%D9%84/",
}


def fetch(url: str, retries: int = 3) -> str:
    last_err = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def analyze(html: str, grade: int):
    # Find all links containing .pdf
    pdf_links = re.findall(r'href=["\']([^"\']*\.pdf[^"\']*)["\']', html, re.I)
    # Titles from h2 article headings
    titles = re.findall(r"<h2[^>]*>.*?<a[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", html, re.S)
    clean_titles = [(u, re.sub(r"<[^>]+>", "", t).strip()) for u, t in titles]

    print(f"=== Grade {grade} ===")
    print(f"  PDF links found directly: {len(pdf_links)}")
    for p in pdf_links[:5]:
        print(f"    - {p[:120]}")
    print(f"  Post titles found: {len(clean_titles)}")
    for u, t in clean_titles[:15]:
        print(f"    - {t[:60]} => {u[:100]}")
    return pdf_links, clean_titles


def main():
    results = {}
    for grade, url in GRADES.items():
        try:
            html = fetch(url)
            print(f"\nGrade {grade}: fetched {len(html)} bytes, status OK")
            with open(f"/home/z/my-project/scripts/grade_{grade}.html", "w", encoding="utf-8") as f:
                f.write(html)
            results[grade] = analyze(html, grade)
            time.sleep(1)
        except Exception as e:  # noqa: BLE001
            print(f"\nGrade {grade}: ERROR {e}")
    print("\n\nDone.")


if __name__ == "__main__":
    main()
