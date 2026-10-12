
Unicode true
!include "MUI2.nsh"

; ================= Zayro Setup (ia32) =================
!define ARCH "ia32"
!define APPNAME "Zayro"
!define VERSION "1.0.0.0"
!define INSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Zayro"

Name "Zayro"
OutFile "/home/z/my-project/desktop-build/dist/Zayro-Setup-ia32.exe"
InstallDir "$LOCALAPPDATA\Programs\Zayro"
InstallDirRegKey HKCU "$INSTKEY" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUnInstDetails show

!define MUI_ICON "/home/z/my-project/desktop-build/zayro.ico"
!define MUI_UNICON "/home/z/my-project/desktop-build/zayro.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Zayro.exe"
!define MUI_FINISHPAGE_RUN_TEXT "اجرای زَیرو"
!define MUI_WELCOMEPAGE_TITLE "به نصب زَیرو خوش آمدید"
!define MUI_WELCOMEPAGE_TEXT "زَیرو؛ کتابخانه هوشمند همه کتاب‌های درسی پایه اول تا نهم$\r$\n$\r$\nبا کتاب‌خوان پیشرفته، حالت شب، جست‌وجو در متن و ذخیره خودکار ادامه مطالعه.$\r$\n$\r$\nبرای ادامه، روید Next."
!define MUI_UNWELCOMEPAGE_TITLE "حذف زَیرو"
!define MUI_UNWELCOMEPAGE_TEXT "زَیرو از سیستم شما حذف خواهد شد.$\r$\n$\r$\nکتاب‌های دانلودشده و پیشرفت مطالعه شما حفظ می‌شوند."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_TEXT_FINISH_INFO_TITLE "نصب زَیرو کامل شد"
!define MUI_TEXT_FINISH_INFO_TEXT "زَیرو نصب شد.$\r$\n$\r$\nنکته: در اولین اجرا، کتاب‌ها به‌صورت هوشمند و خودکار دانلود می‌شوند (فقط بار اول، نیازی به کار شما نیست)."
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Farsi"

VIProductVersion ${VERSION}
VIAddVersionKey "CompanyName" "Zayro"
VIAddVersionKey "FileDescription" "Zayro Setup (ia32)"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductName" "Zayro"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "(c) 2026 Zayro"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "/home/z/my-project/desktop-build/app-ia32\*.*"

  ; start menu shortcuts
  CreateDirectory "$SMPROGRAMS\Zayro"
  CreateShortCut "$SMPROGRAMS\Zayro\Zayro.lnk" "$INSTDIR\Zayro.exe"
  CreateShortCut "$SMPROGRAMS\Zayro\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  ; desktop shortcut
  CreateShortCut "$DESKTOP\Zayro.lnk" "$INSTDIR\Zayro.exe"

  ; uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "$INSTKEY" "DisplayName" "Zayro - کتابخانه هوشمند کتاب‌های درسی"
  WriteRegStr HKCU "$INSTKEY" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "$INSTKEY" "Publisher" "Zayro"
  WriteRegStr HKCU "$INSTKEY" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "$INSTKEY" "DisplayIcon" "$INSTDIR\Zayro.exe"
  WriteRegStr HKCU "$INSTKEY" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "$INSTKEY" "NoModify" 1
  WriteRegDWORD HKCU "$INSTKEY" "NoRepair" 1
  WriteRegDWORD HKCU "$INSTKEY" "EstimatedSize" 280000
SectionEnd

Section "un.Uninstall"
  Delete "$DESKTOP\Zayro.lnk"
  RMDir /r "$SMPROGRAMS\Zayro"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "$INSTKEY"
SectionEnd
