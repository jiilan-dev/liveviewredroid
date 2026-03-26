#!/usr/bin/env bash
set -euo pipefail

echo "Menghentikan koneksi adb ke redroid..."
if command -v adb >/dev/null 2>&1; then
  adb disconnect localhost:5555 >/dev/null 2>&1 || true
  adb kill-server >/dev/null 2>&1 || true
  echo "ADB diputus dan server adb dihentikan."
else
  echo "adb tidak ditemukan, lewati tahap disconnect adb."
fi

echo "Mematikan container redroid..."
docker compose down

echo "Semua proses terkait redroid sudah dihentikan."
