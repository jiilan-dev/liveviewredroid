#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${1:-./shopee.apk}"
PACKAGE_NAME="${2:-}"
BUTTON_TEXT="${3:-Masuk Live}"
ADB_SERIAL="${ADB_SERIAL:-localhost:5555}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-60}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 belum terpasang."
  exit 1
fi

echo "Step 1/4: start redroid..."
./scripts/start-redroid.sh

echo "Step 2/4: konek adb..."
./scripts/adb-connect.sh

echo "Step 3/4: install dan buka app..."
ADB_SERIAL="$ADB_SERIAL" ./scripts/open-liveview.sh "$APK_PATH" "$PACKAGE_NAME"

echo "Step 4/4: tunggu dan tap tombol target..."
python3 ./scripts/tap-ui-element.py \
  --serial "$ADB_SERIAL" \
  --text "$BUTTON_TEXT" \
  --timeout "$WAIT_TIMEOUT"

echo "Selesai."
