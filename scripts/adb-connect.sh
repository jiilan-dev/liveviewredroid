#!/usr/bin/env bash
set -euo pipefail

if ! command -v adb >/dev/null 2>&1; then
  echo "adb belum terpasang."
  echo "Ubuntu/Debian: sudo apt install -y adb"
  echo "Arch: sudo pacman -S android-tools"
  exit 1
fi

echo "Restart adb server..."
adb kill-server >/dev/null 2>&1 || true
adb start-server >/dev/null

echo "Menghubungkan ke redroid..."
adb connect localhost:5555

echo "Daftar device:"
adb devices

echo
echo "Kalau status device sudah 'device', redroid siap dipakai."
