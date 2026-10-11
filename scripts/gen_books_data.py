#!/usr/bin/env python3
"""Generate src/lib/books-data.ts from catalog.json + downloaded file sizes."""
import json
import os
import re

CATALOG = "/home/z/my-project/scripts/catalog.json"
BOOKS_ROOT = "/home/z/my-project/public/books"
OUT = "/home/z/my-project/src/lib/books-data.ts"

# ---------- subject taxonomy ----------
# key: (subject_name, icon, gradient_from, gradient_to, hex)
SUBJECTS = {
    "farsi":      ("فارسی",              "BookOpenText",   "#f43f5e", "#fb7185"),
    "negarsh":    ("نگارش",              "PenLine",        "#e11d48", "#f472b6"),
    "riazi":      ("ریاضی",              "Sigma",          "#f59e0b", "#fbbf24"),
    "oloom":      ("علوم تجربی",         "FlaskConical",   "#10b981", "#34d399"),
    "motaleat":   ("مطالعات اجتماعی",    "Globe2",         "#0ea5e9", "#38bdf8"),
    "hedieh":     ("هدیه‌های آسمان",     "MoonStar",       "#8b5cf6", "#a78bfa"),
    "payam":      ("پیام‌های آسمان",     "MoonStar",       "#8b5cf6", "#a78bfa"),
    "quran":      ("آموزش قرآن",         "Sparkles",       "#7c3aed", "#a78bfa"),
    "arabi":      ("عربی",               "Languages",      "#14b8a6", "#2dd4bf"),
    "english":    ("انگلیسی",            "BookMarked",     "#3b82f6", "#60a5fa"),
    "karofan":    ("کار و فناوری",       "Wrench",         "#ea580c", "#fb923c"),
    "farhang":    ("فرهنگ و هنر",        "Palette",        "#ec4899", "#f472b6"),
    "tafakkor":   ("تفکر و سبک زندگی",   "Lightbulb",      "#06b6d4", "#22d3ee"),
    "defa":       ("آمادگی دفاعی",       "ShieldCheck",    "#dc2626", "#ef4444"),
    "varzesh":    ("حرکت و بازی",        "Zap",            "#84cc16", "#a3e635"),
    "honarkar":   ("هنر و خلاقیت",       "Palette",        "#ec4899", "#f472b6"),
    "jahan":      ("جهان پیرامون",       "Globe2",         "#0ea5e9", "#38bdf8"),
    "farsikhan":  ("فارسی بخوانیم",      "BookOpenText",   "#f43f5e", "#fb7185"),
    "riazidoust": ("ریاضی دوست‌داشتنی",  "Sigma",          "#f59e0b", "#fbbf24"),
    "other":      ("کتاب درسی",          "BookOpen",       "#64748b", "#94a3b8"),
}

SUPP_PAT = re.compile(r"ضمیمه|اقلیت|اهل سنت|تحریری|راهنما|استعداد درخشان")

GRADE_META = {
    1: {"name": "پایه اول", "stage": "elementary", "color": "#f43f5e", "icon": "Sparkles"},
    2: {"name": "پایه دوم", "stage": "elementary", "color": "#f97316", "icon": "Pencil"},
    3: {"name": "پایه سوم", "stage": "elementary", "color": "#eab308", "icon": "BookOpen"},
    4: {"name": "پایه چهارم", "stage": "elementary", "color": "#22c55e", "icon": "Calculator"},
    5: {"name": "پایه پنجم", "stage": "elementary", "color": "#14b8a6", "icon": "FlaskConical"},
    6: {"name": "پایه ششم", "stage": "elementary", "color": "#06b6d4", "icon": "Globe"},
    7: {"name": "پایه هفتم", "stage": "middle", "color": "#8b5cf6", "icon": "Compass"},
    8: {"name": "پایه هشتم", "stage": "middle", "color": "#ec4899", "icon": "Atom"},
    9: {"name": "پایه نهم", "stage": "middle", "color": "#f59e0b", "icon": "GraduationCap"},
}

FA_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def classify(title: str):
    t = title
    if "حرکت و بازی" in t: return "varzesh"
    if "هنر و خلاقیت" in t: return "honarkar"
    if "جهان پیرامون" in t: return "jahan"
    if "فارسی می خوانم" in t or "فارسی می‌خوانم" in t: return "farsikhan"
    if "ریاضی دوست" in t: return "riazidoust"
    if "فارسی می نویسم" in t or "فارسی می‌نویسم" in t: return "negarsh"
    if "ریاضی" in t: return "riazi"
    if "علوم تجربی" in t: return "oloom"
    if "مطالعات" in t: return "motaleat"
    if "پیام های آسمان" in t or "پیام‌های آسمان" in t: return "payam"
    if "هدیه" in t: return "hedieh"
    if "قرآن" in t or "قران" in t: return "quran"
    if "ادیان" in t: return "hedieh"
    if "عربی" in t: return "arabi"
    if "انگلیسی" in t: return "english"
    if "کار و فناوری" in t: return "karofan"
    if "فرهنگ و هنر" in t: return "farhang"
    if "تفکر" in t: return "tafakkor"
    if "دفاعی" in t: return "defa"
    if "فارسی" in t and "نگارش" in t: return "negarsh"
    if "نگارش" in t: return "negarsh"
    if "فارسی" in t: return "farsi"
    return "other"


def clean_title(t: str) -> str:
    t = re.sub(r"\s+", " ", t).strip()
    t = t.replace("(", " (").replace("  ", " ")
    # convert latin digits to Persian
    t = t.translate(FA_DIGITS)
    # normalize spacing around parens
    t = re.sub(r"\s*\(\s*", " (", t)
    t = re.sub(r"\s*\)\s*", ") ", t)
    t = re.sub(r"\s+-\s+", " - ", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = t.replace("هفتم)", "هفتم)").replace(" )", ")")
    return t


def short_title(t: str, subject_key: str) -> str:
    """Produce a short display title without grade repetition."""
    return clean_title(t)


def main():
    with open(CATALOG, encoding="utf-8") as f:
        catalog = json.load(f)

    books = []
    for b in catalog:
        grade = b["grade"]
        path = f"/books/g{grade}/{b['book_id']}.pdf"
        fs = os.path.join(BOOKS_ROOT, f"g{grade}", f"{b['book_id']}.pdf")
        size_mb = round(os.path.getsize(fs) / 1e6, 1) if os.path.exists(fs) else 0
        key = classify(b["title"])
        name, icon, c1, c2 = SUBJECTS[key]
        supp = bool(SUPP_PAT.search(b["title"]))
        books.append({
            "id": b["book_id"],
            "grade": grade,
            "title": clean_title(b["title"]),
            "subject": name,
            "subjectKey": key,
            "file": path,
            "sizeMB": size_mb,
            "supplementary": supp,
            "experimental": "آزمایشی" in b["title"],
        })

    grades = []
    for g, meta in GRADE_META.items():
        gbooks = sorted(
            [b for b in books if b["grade"] == g],
            key=lambda b: (b["supplementary"], {"quran": 0, "farsi": 1, "farsikhan": 1, "riazi": 2, "riazidoust": 2, "oloom": 3, "jahan": 3, "motaleat": 4, "hedieh": 5, "payam": 5}.get(b["subjectKey"], 9), b["id"]),
        )
        grades.append({"meta": meta, "grade": g, "books": gbooks})

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// AUTO-GENERATED by scripts/gen_books_data.py — do not edit manually\n")
        f.write("// Source: official Iranian textbook organization (chap.sch.ir)\n\n")
        f.write("export interface BookData {\n")
        f.write("  id: string;\n  grade: number;\n  title: string;\n  subject: string;\n")
        f.write("  subjectKey: string;\n  file: string;\n  sizeMB: number;\n")
        f.write("  supplementary: boolean;\n  experimental: boolean;\n}\n\n")
        f.write("export interface GradeData {\n  grade: number;\n  name: string;\n  stage: 'elementary' | 'middle';\n")
        f.write("  color: string;\n  icon: string;\n  books: BookData[];\n}\n\n")
        f.write("export const GRADES: GradeData[] = [\n")
        for g in grades:
            m = g["meta"]
            f.write("  {\n")
            f.write(f"    grade: {g['grade']},\n")
            f.write(f"    name: '{m['name']}',\n")
            f.write(f"    stage: '{m['stage']}',\n")
            f.write(f"    color: '{m['color']}',\n")
            f.write(f"    icon: '{m['icon']}',\n")
            f.write("    books: [\n")
            for b in g["books"]:
                f.write("      {\n")
                for k in ("id", "grade", "title", "subject", "subjectKey", "file", "sizeMB", "supplementary", "experimental"):
                    v = b[k]
                    if isinstance(v, bool):
                        f.write(f"        {k}: {'true' if v else 'false'},\n")
                    elif isinstance(v, (int, float)):
                        f.write(f"        {k}: {v},\n")
                    else:
                        vs = str(v).replace("'", "\\'")
                        f.write(f"        {k}: '{vs}',\n")
                f.write("      },\n")
            f.write("    ],\n  },\n")
        f.write("];\n\n")
        f.write("export const ALL_BOOKS: BookData[] = GRADES.flatMap((g) => g.books);\n")
        f.write("export const TOTAL_BOOKS = ALL_BOOKS.length;\n")

    total = len(books)
    supp = sum(1 for b in books if b["supplementary"])
    total_mb = sum(b["sizeMB"] for b in books)
    print(f"Generated {OUT}: {total} books ({supp} supplementary), {total_mb:.0f} MB")


if __name__ == "__main__":
    main()
