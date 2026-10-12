/**
 * Injects Windows PE resources (icon + version info) into Zayro.exe
 * using resedit v2 (pure JS — no wine needed). Run per-arch:
 *   node inject-resources.js <path-to-Zayro.exe> <path-to-zayro.ico>
 */
const fs = require("fs");
const path = require("path");
const RE_LOADER = require(path.join(__dirname, "tools/node_modules/resedit/cjs.cjs"));

async function main() {
  const { Data, NtExecutable, NtExecutableResource, Resource } = await RE_LOADER.load();

  const exePath = process.argv[2];
  const icoPath = process.argv[3];
  const LANG = { lang: 1033, codepage: 1200 }; // en-US, UTF-16

  console.log("parsing", exePath);
  const exe = NtExecutable.from(new Uint8Array(fs.readFileSync(exePath)));
  const res = NtExecutableResource.from(exe);

  // --- icon group (resource id 1) ---
  const iconFile = Data.IconFile.from(new Uint8Array(fs.readFileSync(icoPath)));
  const iconItems = iconFile.icons.map((ic) => ic.data); // RawIconItem instances
  Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, LANG.lang, iconItems);

  // --- version info ---
  const vi = Resource.VersionInfo.createEmpty();
  vi.setFileVersion(1, 1, 0, 0);
  vi.setProductVersion(1, 1, 0, 0);
  vi.setStringValue(LANG, "CompanyName", "Zayro");
  vi.setStringValue(LANG, "FileDescription", "Zayro - Persian Smart Textbook Library");
  vi.setStringValue(LANG, "FileVersion", "1.1.0.0");
  vi.setStringValue(LANG, "InternalName", "Zayro");
  vi.setStringValue(LANG, "LegalCopyright", "(c) 2026 Zayro. MIT License.");
  vi.setStringValue(LANG, "OriginalFilename", "Zayro.exe");
  vi.setStringValue(LANG, "ProductName", "Zayro");
  vi.setStringValue(LANG, "ProductVersion", "1.1.0.0");
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log("OK — icon + version injected:", exePath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
