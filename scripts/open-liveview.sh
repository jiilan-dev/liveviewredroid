#!/usr/bin/env bash
set -euo pipefail

# Default APK path: current folder (./liveview.apk)
APK_PATH="${1:-./liveview.apk}"
PACKAGE_NAME="${2:-}"
ADB_SERIAL="${ADB_SERIAL:-localhost:5555}"

adb_cmd() {
  adb -s "$ADB_SERIAL" "$@"
}

if ! command -v adb >/dev/null 2>&1; then
  echo "adb belum terpasang."
  echo "Ubuntu/Debian: sudo apt install -y adb"
  echo "Arch: sudo pacman -S android-tools"
  exit 1
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "APK tidak ditemukan di: $APK_PATH"
  echo "Contoh pakai path manual: ./scripts/open-liveview.sh /path/ke/liveview.apk"
  exit 1
fi

ensure_device_connected() {
  if adb_cmd get-state >/dev/null 2>&1; then
    return 0
  fi

  echo "Device adb belum terhubung, mencoba connect ke $ADB_SERIAL..."
  adb connect "$ADB_SERIAL" >/dev/null || true

  if ! adb_cmd get-state >/dev/null 2>&1; then
    echo "Gagal terhubung ke redroid via adb."
    echo "Jalankan dulu: ./scripts/adb-connect.sh"
    exit 1
  fi
}

wait_for_android_ready() {
  local timeout_seconds=180
  local elapsed=0

  echo "Menunggu Android selesai boot..."
  while (( elapsed < timeout_seconds )); do
    local boot_completed
    boot_completed="$(adb_cmd shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"

    if [[ "$boot_completed" == "1" ]] && adb_cmd shell cmd package list packages >/dev/null 2>&1; then
      echo "Android siap digunakan."
      return 0
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "Android belum siap dalam ${timeout_seconds} detik."
  echo "Coba tunggu sebentar lalu jalankan ulang script ini."
  exit 1
}

extract_package_name() {
  local apk_path="$1"

  if command -v aapt >/dev/null 2>&1; then
    aapt dump badging "$apk_path" 2>/dev/null \
      | sed -n "s/^package: name='\([^']*\)'.*/\1/p" \
      | head -n1
    return 0
  fi

  if command -v apkanalyzer >/dev/null 2>&1; then
    apkanalyzer manifest application-id "$apk_path" 2>/dev/null | head -n1
    return 0
  fi

  return 1
}

launch_app() {
  local package_name="$1"
  local activity

  activity="$(adb_cmd shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER "$package_name" 2>/dev/null | tr -d '\r' | tail -n1)"

  if [[ -n "$activity" && "$activity" == */* ]]; then
    adb_cmd shell am start -n "$activity" >/dev/null
    return 0
  fi

  adb_cmd shell monkey -p "$package_name" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
}

ensure_device_connected
wait_for_android_ready

echo "Install APK: $APK_PATH"
adb_cmd install -r "$APK_PATH"

if [[ -z "$PACKAGE_NAME" ]]; then
  PACKAGE_NAME="$(extract_package_name "$APK_PATH" || true)"
fi

if [[ -z "$PACKAGE_NAME" ]]; then
  PACKAGE_NAME="$(adb_cmd shell pm list packages | tr -d '\r' | sed 's/^package://' | grep -i 'liveview' | head -n1 || true)"
fi

if [[ -z "$PACKAGE_NAME" ]]; then
  echo "APK berhasil di-install, tapi package name belum ketemu otomatis."
  echo "Coba jalankan lagi dengan package manual:"
  echo "  ./scripts/open-liveview.sh ${APK_PATH@Q} com.contoh.package"
  exit 1
fi

echo "Membuka app package: $PACKAGE_NAME"
launch_app "$PACKAGE_NAME"

echo "Aplikasi LiveView sudah dicoba dibuka."
