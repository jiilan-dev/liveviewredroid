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

# Load device fingerprint profiles
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/device-profiles.sh"

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

  # Load device profile for this instance (each gets a different device)
  get_device_profile "$((i - 1))"

  # Generate a plausible serial number
  FAKE_SERIAL="${DEVICE_SERIAL_PREFIX}$(printf '%08x' $((RANDOM * RANDOM + i)))"

  echo "  Device: $DEVICE_BRAND $DEVICE_MODEL ($DEVICE_NAME)"

  # Write local.prop for props not in any build.prop
  # (local.prop is read on debuggable builds — which Redroid is)
  cat > "$(pwd)/$DATA_DIR/local.prop" <<PROPS
ro.serialno=$FAKE_SERIAL
ro.boot.serialno=$FAKE_SERIAL
ro.hardware.chipname=$DEVICE_HARDWARE
PROPS

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
echo "Semua container dimulai. Menunggu boot awal..."

# Wait for containers to be running (max 30s)
for attempt in $(seq 1 15); do
  RUNNING=$(docker ps --filter "name=redroid-" --filter "status=running" --format "{{.Names}}" | wc -l)
  if [ "$RUNNING" -ge "$COUNT" ]; then
    echo "All $COUNT container(s) running."
    break
  fi
  echo "  Waiting... ($RUNNING/$COUNT running)"
  sleep 2
done

# Spoof device identity by patching build.prop, then restart containers
echo ""
echo "Applying device spoofing..."
for i in $(seq 1 "$COUNT"); do
  "$SCRIPT_DIR/spoof-device.sh" "redroid-$i" "$((i - 1))" &
done
wait

# Wait for restarted containers to be running again
echo ""
echo "Waiting for restarted containers..."
sleep 3
for attempt in $(seq 1 15); do
  RUNNING=$(docker ps --filter "name=redroid-" --filter "status=running" --format "{{.Names}}" | wc -l)
  if [ "$RUNNING" -ge "$COUNT" ]; then
    echo "All $COUNT container(s) running with spoofed identity."
    break
  fi
  echo "  Waiting... ($RUNNING/$COUNT running)"
  sleep 2
done

echo ""
echo "Instance yang berjalan:"
docker ps --filter "name=redroid-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
