#!/bin/bash
# Downloads electron win32 builds + portable NSIS in background
cd /home/z/my-project/desktop-build

(
  curl -sL --retry 3 -o electron-x64.zip "https://github.com/electron/electron/releases/download/v38.2.0/electron-v38.2.0-win32-x64.zip" && touch x64.done
) &
(
  curl -sL --retry 3 -o electron-ia32.zip "https://github.com/electron/electron/releases/download/v38.2.0/electron-v38.2.0-win32-ia32.zip" && touch ia32.done
) &
(
  curl -sL --retry 3 -o nsis.7z "https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z" && touch nsis.done
) &
wait
echo "ALL DOWNLOADS FINISHED" > all.done
