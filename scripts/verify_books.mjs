// Verify: every book in books-data.ts has a real PDF on disk + per-grade stats
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = "/home/z/my-project";
const src = readFileSync(join(ROOT, "src/lib/books-data.ts"), "utf8");

const entries = [...src.matchAll(/id: '([^']+)',\s*\n\s*grade: (\d+),[\s\S]*?file: '([^']+)',\s*\n\s*sizeMB: ([\d.]+)/g)];
console.log(`catalog entries: ${entries.length}`);

let missing = 0;
const perGrade = {};
for (const [, id, grade, file, sizeMB] of entries) {
  const disk = join(ROOT, "public", file);
  perGrade[grade] = perGrade[grade] || { n: 0, mb: 0 };
  perGrade[grade].n++;
  perGrade[grade].mb += parseFloat(sizeMB);
  if (!existsSync(disk)) {
    console.log(`MISSING: ${id} grade ${grade} -> ${file}`);
    missing++;
  } else {
    const realMB = statSync(disk).size / 1048576;
    if (Math.abs(realMB - parseFloat(sizeMB)) > 1.5) {
      console.log(`SIZE-DRIFT: ${id} catalog=${sizeMB}MB disk=${realMB.toFixed(1)}MB`);
    }
    const fd = readFileSync(disk).subarray(0, 5).toString();
    if (fd !== "%PDF-") console.log(`BAD-HEADER: ${id} -> ${fd}`);
  }
}

// also check for stray PDFs on disk not in catalog
for (let g = 1; g <= 9; g++) {
  const dir = join(ROOT, "public/books/g" + g);
  const onDisk = readdirSync(dir).filter((f) => f.endsWith(".pdf")).map((f) => f.replace(".pdf", ""));
  const inCat = entries.filter((e) => e[2] === String(g)).map((e) => e[0]);
  const stray = onDisk.filter((f) => !inCat.includes(f));
  if (stray.length) console.log(`STRAY g${g}:`, stray.join(", "));
}

for (const g of Object.keys(perGrade).sort((a, b) => a - b)) {
  console.log(`g${g}: ${perGrade[g].n} books, ${perGrade[g].mb.toFixed(0)}MB`);
}
console.log(missing === 0 ? "ALL FILES OK ✅" : `${missing} MISSING ❌`);
