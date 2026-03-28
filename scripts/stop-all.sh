#!/usr/bin/env bash
set -euo pipefail

echo "Memutus semua koneksi ADB..."
if command -v adb >/dev/null 2>&1; then
  # Disconnect semua localhost:* yang terhubung via ADB
  adb devices | grep 'localhost:' | awk '{print $1}' | while read -r host; do
    echo "  Disconnect $host..."
    adb disconnect "$host" >/dev/null 2>&1 || true
  done
  adb kill-server >/dev/null 2>&1 || true
  echo "Semua koneksi ADB diputus."
else
  echo "adb tidak ditemukan, lewati tahap disconnect adb."
fi

echo "Mematikan semua container redroid..."
CONTAINERS=$(docker ps -a --filter "name=redroid" --format "{{.Names}}" 2>/dev/null || true)
if [ -n "$CONTAINERS" ]; then
  echo "$CONTAINERS" | xargs docker rm -f >/dev/null 2>&1
  echo "Container dihentikan: $(echo "$CONTAINERS" | tr '\n' ' ')"
else
  echo "Tidak ada container redroid yang aktif."
fi

# Fallback: compose down kalau masih ada
docker compose down >/dev/null 2>&1 || true

echo "Semua proses redroid sudah dihentikan."
