#!/usr/bin/env bash
set -euo pipefail

COUNT="${1:-1}"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb belum terpasang."
  echo "Ubuntu/Debian: sudo apt install -y adb"
  echo "Arch: sudo pacman -S android-tools"
  exit 1
fi

echo "Restart adb server..."
adb kill-server >/dev/null 2>&1 || true
adb start-server >/dev/null

for i in $(seq 1 "$COUNT"); do
  PORT=$((5554 + i))
  echo "Menghubungkan ke redroid-$i (localhost:$PORT)..."
  adb connect "localhost:$PORT" || echo "  Gagal konek localhost:$PORT, coba lagi manual."
done

echo ""
echo "Daftar device:"
adb devices

echo ""
echo "Semua instance sudah terhubung via ADB."
