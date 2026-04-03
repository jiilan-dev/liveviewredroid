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

# Function to setup a single instance (runs in background)
setup_instance() {
  local i="$1"
  local PORT=$((5554 + i))
  local SERIAL="localhost:$PORT"

  echo "[$i] Connecting to redroid-$i ($SERIAL)..."
  adb connect "$SERIAL" || { echo "[$i] Failed to connect $SERIAL"; return 1; }

  echo "[$i] Waiting for device..."
  adb -s "$SERIAL" wait-for-device 2>/dev/null || true
  sleep 2

  echo "[$i] Applying runtime anti-detection props..."

  # Only set WRITABLE props here — ro.* are handled by /data/local.prop at boot
  adb -s "$SERIAL" shell "
    setprop net.dns1 8.8.8.8;
    setprop net.dns2 8.8.4.4;
    settings put global captive_portal_detection_enabled 0;
    settings put global captive_portal_mode 0;
    ndc resolver setnetdns 100 '' 8.8.8.8 8.8.4.4;

    setprop gsm.operator.alpha Telkomsel;
    setprop gsm.operator.numeric 51010;
    setprop gsm.operator.iso-country id;
    setprop gsm.sim.operator.alpha Telkomsel;
    setprop gsm.sim.operator.numeric 51010;
    setprop gsm.sim.operator.iso-country id;
    setprop gsm.sim.state READY;

    setprop persist.sys.timezone Asia/Jakarta;
    settings put global auto_time_zone 0;
    settings put global development_settings_enabled 0;
    settings put global adb_enabled 1;
    setprop persist.sys.language id;
    setprop persist.sys.country ID;
    setprop persist.sys.locale id-ID;
  " 2>/dev/null || true

  echo "[$i] ✓ redroid-$i ready"
}

# Export function for subshells
export -f setup_instance

# Run all instance setups in parallel
PIDS=()
for i in $(seq 1 "$COUNT"); do
  setup_instance "$i" &
  PIDS+=($!)
done

# Wait for all background jobs
FAILED=0
for pid in "${PIDS[@]}"; do
  wait "$pid" || ((FAILED++))
done

echo ""
echo "Daftar device:"
adb devices

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "Warning: $FAILED instance(s) had issues during setup."
fi

echo ""
echo "Semua instance sudah terhubung via ADB."
