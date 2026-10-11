
Unicode true
!include "LogicLib.nsh"
; ================= Zayro Portable (x64) =================
; Double-click → (first time) silently unpacks and launches.
; Next runs launch instantly (already unpacked).

!define APPNAME "Zayro"
!define VERSION "1.0.0.0"

SilentInstall silent
InstallDir "$LOCALAPPDATA\ZayroPortable"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "/home/z/my-project/desktop-build/zayro.ico"
OutFile "/home/z/my-project/desktop-build/dist/Zayro-Portable-x64.exe"

VIProductVersion ${VERSION}
VIAddVersionKey "CompanyName" "Zayro"
VIAddVersionKey "FileDescription" "Zayro Portable (x64)"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductName" "Zayro"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "(c) 2026 Zayro"

Section "Unpack & Run"
  Var /GLOBAL ALREADY_OK
  StrCpy $ALREADY_OK "0"
  IfFileExists "$INSTDIR\zayro-1.0.0.marker" 0 do_extract
    StrCpy $ALREADY_OK "1"
  do_extract:

  ${If} $ALREADY_OK == "0"
    SetOutPath "$INSTDIR"
    File /r "/home/z/my-project/desktop-build/app-x64\*.*"
    FileOpen $0 "$INSTDIR\zayro-1.0.0.marker" w
    FileWrite $0 "Zayro portable 1.0.0"
    FileClose $0
  ${EndIf}

  Exec '"$INSTDIR\Zayro.exe"'
SectionEnd
