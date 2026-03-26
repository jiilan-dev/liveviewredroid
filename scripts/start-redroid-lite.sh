#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker belum terpasang. Install Docker dulu ya."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin belum tersedia."
  echo "Pastikan perintah docker compose bisa dipakai."
  exit 1
fi

echo "Menjalankan redroid mode lite (hemat resource)..."
docker compose -f docker-compose.yml -f docker-compose.lite.yml up -d

echo "Menunggu service siap..."
sleep 6

docker compose -f docker-compose.yml -f docker-compose.lite.yml ps

echo
echo "Mode lite aktif: 360x640, 12 FPS, CPU/RAM dibatasi."
