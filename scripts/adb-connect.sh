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
  SERIAL="localhost:$PORT"
  echo "Menghubungkan ke redroid-$i ($SERIAL)..."
  adb connect "$SERIAL" || { echo "  Gagal konek $SERIAL, coba lagi manual."; continue; }

  # Tunggu device ready
  echo "  Menunggu device ready..."
  adb -s "$SERIAL" wait-for-device 2>/dev/null || true
  sleep 2

  # Setup internet: DNS + disable captive portal
  echo "  Setup internet untuk $SERIAL..."
  adb -s "$SERIAL" shell "setprop net.dns1 8.8.8.8" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop net.dns2 8.8.4.4" 2>/dev/null || true
  adb -s "$SERIAL" shell "settings put global captive_portal_detection_enabled 0" 2>/dev/null || true
  adb -s "$SERIAL" shell "settings put global captive_portal_mode 0" 2>/dev/null || true
  adb -s "$SERIAL" shell "ndc resolver setnetdns 100 '' 8.8.8.8 8.8.4.4" 2>/dev/null || true
  echo "  ✓ redroid-$i internet configured"
done

echo ""
echo "Daftar device:"
adb devices

echo ""
echo "Semua instance sudah terhubung via ADB."
