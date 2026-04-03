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
    androidboot.redroid_gpu_mode=guest \
    \
    ro.product.brand="$DEVICE_BRAND" \
    ro.product.manufacturer="$DEVICE_MANUFACTURER" \
    ro.product.model="$DEVICE_MODEL" \
    ro.product.name="$DEVICE_NAME" \
    ro.product.device="$DEVICE_DEVICE" \
    ro.build.product="$DEVICE_PRODUCT" \
    ro.hardware="$DEVICE_HARDWARE" \
    ro.board.platform="$DEVICE_PLATFORM" \
    ro.product.board="$DEVICE_BOARD" \
    ro.build.fingerprint="$DEVICE_FINGERPRINT" \
    ro.build.description="$DEVICE_DESCRIPTION" \
    ro.build.version.incremental="$DEVICE_INCREMENTAL" \
    ro.build.version.release="$DEVICE_RELEASE" \
    ro.build.version.sdk="$DEVICE_SDK" \
    ro.build.version.security_patch="$DEVICE_SECURITY_PATCH" \
    ro.build.display.id="$DEVICE_BUILD_ID" \
    ro.build.id="$DEVICE_BUILD_ID" \
    ro.build.type="$DEVICE_TYPE" \
    ro.build.tags="$DEVICE_TAGS" \
    ro.serialno="$FAKE_SERIAL" \
    ro.boot.serialno="$FAKE_SERIAL" \
    \
    ro.debuggable=0 \
    ro.secure=1 \
    ro.adb.secure=0 \
    persist.sys.usb.config=adb \
    ro.build.selinux=1
done

echo ""
echo "Menunggu instance siap (8 detik)..."
sleep 8

echo ""
echo "Instance yang berjalan:"
docker ps --filter "name=redroid-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Selanjutnya: ./scripts/adb-connect.sh $COUNT"
