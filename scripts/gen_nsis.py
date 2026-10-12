#!/usr/bin/env python3
"""Generates the 4 NSIS scripts (Setup + Portable × x64/ia32) for Zayro Windows builds.
v1.1.0: all 109 official textbooks (public/books) are embedded INSIDE the payload —
the app works fully offline from the very first run, no first-run download."""

SETUP = r"""
Unicode true
!include "MUI2.nsh"

; ================= Zayro Setup (@@ARCH@@) — books embedded =================
!define ARCH "@@ARCH@@"
!define APPNAME "Zayro"
!define VERSION "1.1.0.0"
!define INSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Zayro"

Name "Zayro"
OutFile "@@OUTFILE@@"
InstallDir "$LOCALAPPDATA\Programs\Zayro"
InstallDirRegKey HKCU ${INSTKEY} "InstallLocation"
RequestExecutionLevel user
SetCompressor lzma
ShowInstDetails show
ShowUnInstDetails show

!define MUI_ICON "@@ICON@@"
!define MUI_UNICON "@@ICON@@"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Zayro.exe"
!define MUI_FINISHPAGE_RUN_TEXT "اجرای زَیرو"
!define MUI_WELCOMEPAGE_TITLE "به نصب زَیرو خوش آمدید"
!define MUI_WELCOMEPAGE_TEXT "زَیرو؛ کتابخانه هوشمند همه کتاب‌های درسی پایه اول تا نهم$\r$\n$\r$\nهر ۱۰۹ کتاب رسمی داخل همین بسته هست — بعد از نصب، همه‌چیز کاملاً آفلاین است.$\r$\n$\r$\nبرای ادامه، روید Next."
!define MUI_UNWELCOMEPAGE_TITLE "حذف زَیرو"
!define MUI_UNWELCOMEPAGE_TEXT "زَیرو از سیستم شما حذف خواهد شد.$\r$\n$\r$\nپیشرفت مطالعه، نشانک‌ها و علاقه‌مندی‌های شما حذف می‌شوند."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_TEXT_FINISH_INFO_TITLE "نصب زَیرو کامل شد"
!define MUI_TEXT_FINISH_INFO_TEXT "زَیرو نصب شد.$\r$\n$\r$\nهمهٔ ۱۰۹ کتاب درسی داخل برنامه جاسازی شده‌اند — همین حالا شروع کن به خواندن!"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Farsi"

VIProductVersion ${VERSION}
VIAddVersionKey "CompanyName" "Zayro"
VIAddVersionKey "FileDescription" "Zayro Setup (@@ARCH@@)"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductName" "Zayro"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "(c) 2026 Zayro"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "@@APPDIR@@/*.*"
  ; --- embedded official textbooks (109 PDFs) → resources/app/books ---
  SetOutPath "$INSTDIR\resources\app\books"
  File /r "/home/z/my-project/public/books/*.*"

  ; start menu shortcuts
  CreateDirectory "$SMPROGRAMS\Zayro"
  CreateShortCut "$SMPROGRAMS\Zayro\Zayro.lnk" "$INSTDIR\Zayro.exe"
  CreateShortCut "$SMPROGRAMS\Zayro\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  ; desktop shortcut
  CreateShortCut "$DESKTOP\Zayro.lnk" "$INSTDIR\Zayro.exe"

  ; uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU ${INSTKEY} "DisplayName" "Zayro - کتابخانه هوشمند کتاب‌های درسی"
  WriteRegStr HKCU ${INSTKEY} "DisplayVersion" "1.1.0"
  WriteRegStr HKCU ${INSTKEY} "Publisher" "Zayro"
  WriteRegStr HKCU ${INSTKEY} "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU ${INSTKEY} "DisplayIcon" "$INSTDIR\Zayro.exe"
  WriteRegStr HKCU ${INSTKEY} "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU ${INSTKEY} "NoModify" 1
  WriteRegDWORD HKCU ${INSTKEY} "NoRepair" 1
  WriteRegDWORD HKCU ${INSTKEY} "EstimatedSize" @@ESTSIZE@@
SectionEnd

Section "un.Uninstall"
  Delete "$DESKTOP\Zayro.lnk"
  RMDir /r "$SMPROGRAMS\Zayro"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU ${INSTKEY}
SectionEnd
"""

PORTABLE = r"""
Unicode true
!include "LogicLib.nsh"
; ================= Zayro Portable (@@ARCH@@) — books embedded =================
; Double-click → (first time) silently unpacks to a persistent folder and launches.
; Next runs launch instantly (already unpacked).

!define APPNAME "Zayro"
!define VERSION "1.1.0.0"

SilentInstall silent
InstallDir "$LOCALAPPDATA\ZayroPortable"
RequestExecutionLevel user
SetCompressor lzma
Icon "@@ICON@@"
OutFile "@@OUTFILE@@"

VIProductVersion ${VERSION}
VIAddVersionKey "CompanyName" "Zayro"
VIAddVersionKey "FileDescription" "Zayro Portable (@@ARCH@@)"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductName" "Zayro"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "(c) 2026 Zayro"

Section "Unpack & Run"
  Var /GLOBAL ALREADY_OK
  StrCpy $ALREADY_OK "0"
  IfFileExists "$INSTDIR\zayro-1.1.0.marker" 0 do_extract
    StrCpy $ALREADY_OK "1"
  do_extract:

  ${If} $ALREADY_OK == "0"
    SetOutPath "$INSTDIR"
    File /r "@@APPDIR@@/*.*"
    ; --- embedded official textbooks (109 PDFs) → resources/app/books ---
    SetOutPath "$INSTDIR\resources\app\books"
    File /r "/home/z/my-project/public/books/*.*"
    SetOutPath "$INSTDIR"
    FileOpen $0 "$INSTDIR\zayro-1.1.0.marker" w
    FileWrite $0 "Zayro portable 1.1.0 — books embedded"
    FileClose $0
  ${EndIf}

  Exec '"$INSTDIR\Zayro.exe"'
SectionEnd
"""

import os

BASE = "/home/z/my-project/desktop-build"
OUT = os.path.join(BASE, "nsis-src")
os.makedirs(OUT, exist_ok=True)
ICON = os.path.join(BASE, "zayro.ico")
# electron (~290MB) + app (~8MB) + 109 books (~1.44GB) ≈ 1.73GB installed
ESTSIZE_KB = 1780000

for arch in ("x64", "ia32"):
    with open(f"{OUT}/setup-{arch}.nsi", "w", encoding="utf-8") as f:
        f.write(
            SETUP.replace("@@ARCH@@", arch)
            .replace("@@OUTFILE@@", f"{BASE}/dist/Zayro-Setup-{arch}.exe")
            .replace("@@ICON@@", ICON)
            .replace("@@APPDIR@@", f"{BASE}/app-{arch}")
            .replace("@@ESTSIZE@@", str(ESTSIZE_KB))
        )
    with open(f"{OUT}/portable-{arch}.nsi", "w", encoding="utf-8") as f:
        f.write(
            PORTABLE.replace("@@ARCH@@", arch)
            .replace("@@OUTFILE@@", f"{BASE}/dist/Zayro-Portable-{arch}.exe")
            .replace("@@ICON@@", ICON)
            .replace("@@APPDIR@@", f"{BASE}/app-{arch}")
        )

print("generated 4 NSIS scripts (v1.1.0, books embedded) in", OUT)
