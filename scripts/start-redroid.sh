#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker belum terpasang. Install Docker dulu ya."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin belum tersedia."
  echo "Pastikan perintah 'docker compose' bisa dipakai."
  exit 1
fi

echo "Menjalankan redroid..."
docker compose up -d

echo "Menunggu service siap..."
sleep 6

docker compose ps

echo
echo "Langkah berikutnya:"
echo "1) Install adb di host (android-tools/adb)"
echo "2) Jalankan: ./scripts/adb-connect.sh"
echo "3) Buka UI dengan: scrcpy -s localhost:5555"
