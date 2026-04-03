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

  # Anti-detection: override properties that can't be set at boot
  echo "  Applying anti-detection props..."

  # Hide root/emulator indicators
  adb -s "$SERIAL" shell "setprop ro.debuggable 0" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop ro.secure 1" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop ro.build.type user" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop ro.build.tags release-keys" 2>/dev/null || true

  # Disable emulator detection signals
  adb -s "$SERIAL" shell "setprop ro.kernel.qemu 0" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop ro.kernel.qemu.gles 0" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop init.svc.qemud stopped" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop ro.hardware.chipname mt6765" 2>/dev/null || true

  # Fake network operator (Telkomsel Indonesia)
  adb -s "$SERIAL" shell "setprop gsm.operator.alpha Telkomsel" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop gsm.operator.numeric 51010" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop gsm.operator.iso-country id" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop gsm.sim.operator.alpha Telkomsel" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop gsm.sim.operator.numeric 51010" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop gsm.sim.operator.iso-country id" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop gsm.sim.state READY" 2>/dev/null || true

  # Set timezone to Asia/Jakarta
  adb -s "$SERIAL" shell "setprop persist.sys.timezone Asia/Jakarta" 2>/dev/null || true
  adb -s "$SERIAL" shell "settings put global auto_time_zone 0" 2>/dev/null || true

  # Disable developer options indicators
  adb -s "$SERIAL" shell "settings put global development_settings_enabled 0" 2>/dev/null || true
  adb -s "$SERIAL" shell "settings put global adb_enabled 1" 2>/dev/null || true

  # Set locale to Indonesian
  adb -s "$SERIAL" shell "setprop persist.sys.language id" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop persist.sys.country ID" 2>/dev/null || true
  adb -s "$SERIAL" shell "setprop persist.sys.locale id-ID" 2>/dev/null || true

  echo "  ✓ redroid-$i anti-detection configured"
done

echo ""
echo "Daftar device:"
adb devices

echo ""
echo "Semua instance sudah terhubung via ADB."
