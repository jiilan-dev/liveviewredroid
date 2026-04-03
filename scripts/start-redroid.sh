#!/usr/bin/env bash
set -euo pipefail

COUNT="${1:-1}"
# Optional: comma-separated profile names for each instance
# e.g. "profile-a,profile-b" means instance-1 uses profile-a, instance-2 uses profile-b
PROFILE_MAP="${2:-}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker belum terpasang. Install Docker dulu ya."
  exit 1
fi

# Parse profile map into array
IFS=',' read -r -a PROFILES <<< "$PROFILE_MAP"

echo "Menjalankan $COUNT instance redroid..."

PROFILES_BASE="./data/profiles"

for i in $(seq 1 "$COUNT"); do
  PORT=$((5554 + i))
  NAME="redroid-$i"

  # Determine data directory: use profile if provided, else legacy instance-N
  IDX=$((i - 1))
  if [ -n "${PROFILES[$IDX]:-}" ]; then
    DATA_DIR="$PROFILES_BASE/${PROFILES[$IDX]}"
    echo "Instance $i → profile: ${PROFILES[$IDX]}"
  else
    DATA_DIR="./data/instance-$i"
    echo "Instance $i → default: instance-$i"
  fi

  mkdir -p "$DATA_DIR"

  # Hapus container lama jika ada
  if docker ps -a --format '{{.Names}}' | grep -q "^${NAME}$"; then
    echo "Container $NAME sudah ada, replace..."
    docker rm -f "$NAME" >/dev/null 2>&1
  fi

  echo "Starting $NAME → host port $PORT..."
  docker run -d \
    --name "$NAME" \
    --privileged \
    --restart unless-stopped \
    --dns 8.8.8.8 \
    --dns 8.8.4.4 \
    -p "$PORT:5555" \
    -v "$(pwd)/$DATA_DIR:/data" \
    redroid/redroid:11.0.0-latest \
    androidboot.redroid_width=720 \
    androidboot.redroid_height=1280 \
    androidboot.redroid_dpi=320 \
    androidboot.redroid_gpu_mode=guest
done

echo ""
echo "Menunggu instance siap (8 detik)..."
sleep 8

echo ""
echo "Instance yang berjalan:"
docker ps --filter "name=redroid-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Selanjutnya: ./scripts/adb-connect.sh $COUNT"
