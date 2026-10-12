#!/usr/bin/env python3
"""Zayro Windows build orchestrator (v1.1.0 — books embedded).
Stages app-{arch} from the electron zip, injects icon/version via resedit,
generates NSIS scripts, and compiles Setup + Portable for one architecture.

Usage:
  python3 build_windows.py stage x64
  python3 build_windows.py compile x64
  python3 build_windows.py all x64
"""
import os, shutil, subprocess, sys, zipfile

BASE = "/home/z/my-project/desktop-build"
PUBLIC_BOOKS = "/home/z/my-project/public/books"
RUNTIME = os.path.join(BASE, "runtime")
APP_DIST_SRC = os.path.join(BASE, "app-dist-src")
ICON = os.path.join(BASE, "zayro.ico")
NSIS_DIR = os.path.join(BASE, "nsis")            # electron-builder nsis-3.0.4.1 layout
MAKENSIS = os.path.join(NSIS_DIR, "linux", "makensis")  # linux ELF binary shipped in that package
VERSION = "1.1.0"


def sh(cmd, **kw):
    print("+", cmd)
    subprocess.run(cmd, shell=True, check=True, **kw)


def stage(arch):
    app = os.path.join(BASE, f"app-{arch}")
    if os.path.exists(app):
        shutil.rmtree(app)
    z = os.path.join(BASE, f"electron-{arch}.zip")
    print(f"unpacking {z} ...")
    with zipfile.ZipFile(z) as zf:
        zf.extractall(app)
    # electron.exe → Zayro.exe
    os.rename(os.path.join(app, "electron.exe"), os.path.join(app, "Zayro.exe"))
    # drop the default welcome app — resources/app takes precedence anyway
    da = os.path.join(app, "resources", "default_app.asar")
    if os.path.exists(da):
        os.remove(da)
    # the Zayro app payload
    appdir = os.path.join(app, "resources", "app")
    os.makedirs(appdir, exist_ok=True)
    for name in ("main.js", "sync.js", "preload.js", "package.json", "catalog.json"):
        shutil.copy2(os.path.join(RUNTIME, name), os.path.join(appdir, name))
    shutil.copytree(APP_DIST_SRC, os.path.join(appdir, "app-dist"))
    shutil.copy2(ICON, os.path.join(appdir, "zayro.ico"))
    # inject icon + version metadata into Zayro.exe (resedit, no wine)
    sh(f'node "{os.path.join(BASE, "inject-resources.js")}" "{app}/Zayro.exe" "{ICON}"')
    n_books = sum(len(files) for _, _, files in os.walk(PUBLIC_BOOKS))
    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(PUBLIC_BOOKS) for f in fs)
    print(f"STAGED app-{arch}: ok | books available for embedding: {n_books} files, {size/1e6:.0f} MB")


def compile_exes(arch):
    # ALWAYS use the gen_nsis.py that ships next to this script (same version line)
    sh(f'python3 "{os.path.join(os.path.dirname(os.path.abspath(__file__)), "gen_nsis.py")}"')
    for kind in ("setup", "portable"):
        nsi = os.path.join(BASE, "nsis-src", f"{kind}-{arch}.nsi")
        log = os.path.join(BASE, f"build-{kind}-{arch}.log")
        print(f"compiling {kind}-{arch} ... (log: {log})")
        env = dict(os.environ, NSISDIR=NSIS_DIR)
        with open(log, "w") as lf:
            subprocess.run([MAKENSIS, nsi], stdout=lf, stderr=subprocess.STDOUT, check=True, env=env)
        out = os.path.join(BASE, "dist", f"Zayro-{kind.capitalize()}-{arch}.exe")
        print(f"DONE {out}: {os.path.getsize(out)/1e6:.1f} MB")


if __name__ == "__main__":
    mode, arch = sys.argv[1], sys.argv[2]
    if mode in ("stage", "all"):
        stage(arch)
    if mode in ("compile", "all"):
        compile_exes(arch)
