#!/usr/bin/env bash
# Spoofs device identity inside a running Redroid container by patching build.prop files.
# Must run AFTER container is up but BEFORE apps read properties.
# Usage: ./scripts/spoof-device.sh <container-name> <profile-index>
set -euo pipefail

CONTAINER="${1:?Usage: spoof-device.sh <container-name> <profile-index>}"
PROFILE_IDX="${2:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/device-profiles.sh"

get_device_profile "$PROFILE_IDX"

FAKE_SERIAL="${DEVICE_SERIAL_PREFIX}$(printf '%08x' $((RANDOM * RANDOM + PROFILE_IDX)))"

echo "Spoofing $CONTAINER → $DEVICE_BRAND $DEVICE_MODEL ($DEVICE_NAME)"

# Remount filesystem as writable
docker exec "$CONTAINER" mount -o rw,remount / 2>/dev/null || true

# Patch /system/build.prop
docker exec "$CONTAINER" sh -c "
sed -i \
  -e 's|^ro.build.display.id=.*|ro.build.display.id=$DEVICE_BUILD_ID|' \
  -e 's|^ro.build.version.incremental=.*|ro.build.version.incremental=$DEVICE_INCREMENTAL|' \
  -e 's|^ro.build.version.security_patch=.*|ro.build.version.security_patch=$DEVICE_SECURITY_PATCH|' \
  -e 's|^ro.build.type=.*|ro.build.type=$DEVICE_TYPE|' \
  -e 's|^ro.build.tags=.*|ro.build.tags=$DEVICE_TAGS|' \
  -e 's|^ro.build.flavor=.*|ro.build.flavor=${DEVICE_PRODUCT}-$DEVICE_TYPE|' \
  -e 's|^ro.build.product=.*|ro.build.product=$DEVICE_PRODUCT|' \
  -e 's|^ro.build.description=.*|ro.build.description=$DEVICE_DESCRIPTION|' \
  -e 's|^ro.build.fingerprint=.*|ro.build.fingerprint=$DEVICE_FINGERPRINT|' \
  -e 's|^ro.product.locale=.*|ro.product.locale=id-ID|' \
  -e 's|^ro.product.system.brand=.*|ro.product.system.brand=$DEVICE_BRAND|' \
  -e 's|^ro.product.system.device=.*|ro.product.system.device=$DEVICE_DEVICE|' \
  -e 's|^ro.product.system.manufacturer=.*|ro.product.system.manufacturer=$DEVICE_MANUFACTURER|' \
  -e 's|^ro.product.system.model=.*|ro.product.system.model=$DEVICE_MODEL|' \
  -e 's|^ro.product.system.name=.*|ro.product.system.name=$DEVICE_NAME|' \
  -e 's|^ro.system.build.fingerprint=.*|ro.system.build.fingerprint=$DEVICE_FINGERPRINT|' \
  -e 's|^ro.system.build.type=.*|ro.system.build.type=$DEVICE_TYPE|' \
  -e 's|^ro.system.build.tags=.*|ro.system.build.tags=$DEVICE_TAGS|' \
  /system/build.prop
"

# Patch /vendor/build.prop
docker exec "$CONTAINER" sh -c "
sed -i \
  -e 's|^ro.product.vendor.brand=.*|ro.product.vendor.brand=$DEVICE_BRAND|' \
  -e 's|^ro.product.vendor.device=.*|ro.product.vendor.device=$DEVICE_DEVICE|' \
  -e 's|^ro.product.vendor.manufacturer=.*|ro.product.vendor.manufacturer=$DEVICE_MANUFACTURER|' \
  -e 's|^ro.product.vendor.model=.*|ro.product.vendor.model=$DEVICE_MODEL|' \
  -e 's|^ro.product.vendor.name=.*|ro.product.vendor.name=$DEVICE_NAME|' \
  -e 's|^ro.vendor.build.fingerprint=.*|ro.vendor.build.fingerprint=$DEVICE_FINGERPRINT|' \
  -e 's|^ro.vendor.build.type=.*|ro.vendor.build.type=$DEVICE_TYPE|' \
  -e 's|^ro.vendor.build.tags=.*|ro.vendor.build.tags=$DEVICE_TAGS|' \
  -e 's|^ro.product.board=.*|ro.product.board=$DEVICE_BOARD|' \
  -e 's|^ro.board.platform=.*|ro.board.platform=$DEVICE_PLATFORM|' \
  /vendor/build.prop
"

# Patch /vendor/odm/etc/build.prop (highest priority in Android 11)
docker exec "$CONTAINER" sh -c "
sed -i \
  -e 's|^ro.product.odm.brand=.*|ro.product.odm.brand=$DEVICE_BRAND|' \
  -e 's|^ro.product.odm.device=.*|ro.product.odm.device=$DEVICE_DEVICE|' \
  -e 's|^ro.product.odm.manufacturer=.*|ro.product.odm.manufacturer=$DEVICE_MANUFACTURER|' \
  -e 's|^ro.product.odm.model=.*|ro.product.odm.model=$DEVICE_MODEL|' \
  -e 's|^ro.product.odm.name=.*|ro.product.odm.name=$DEVICE_NAME|' \
  -e 's|^ro.odm.build.fingerprint=.*|ro.odm.build.fingerprint=$DEVICE_FINGERPRINT|' \
  -e 's|^ro.odm.build.type=.*|ro.odm.build.type=$DEVICE_TYPE|' \
  -e 's|^ro.odm.build.tags=.*|ro.odm.build.tags=$DEVICE_TAGS|' \
  -e 's|^ro.odm.build.version.incremental=.*|ro.odm.build.version.incremental=$DEVICE_INCREMENTAL|' \
  /vendor/odm/etc/build.prop
"

# Patch /system/product/build.prop
docker exec "$CONTAINER" sh -c "
sed -i \
  -e 's|^ro.product.product.brand=.*|ro.product.product.brand=$DEVICE_BRAND|' \
  -e 's|^ro.product.product.device=.*|ro.product.product.device=$DEVICE_DEVICE|' \
  -e 's|^ro.product.product.manufacturer=.*|ro.product.product.manufacturer=$DEVICE_MANUFACTURER|' \
  -e 's|^ro.product.product.model=.*|ro.product.product.model=$DEVICE_MODEL|' \
  -e 's|^ro.product.product.name=.*|ro.product.product.name=$DEVICE_NAME|' \
  -e 's|^ro.product.build.fingerprint=.*|ro.product.build.fingerprint=$DEVICE_FINGERPRINT|' \
  -e 's|^ro.product.build.type=.*|ro.product.build.type=$DEVICE_TYPE|' \
  -e 's|^ro.product.build.tags=.*|ro.product.build.tags=$DEVICE_TAGS|' \
  -e 's|^ro.product.build.version.incremental=.*|ro.product.build.version.incremental=$DEVICE_INCREMENTAL|' \
  /system/product/build.prop
"

# Patch /system/system_ext/build.prop
docker exec "$CONTAINER" sh -c "
sed -i \
  -e 's|^ro.product.system_ext.brand=.*|ro.product.system_ext.brand=$DEVICE_BRAND|' \
  -e 's|^ro.product.system_ext.device=.*|ro.product.system_ext.device=$DEVICE_DEVICE|' \
  -e 's|^ro.product.system_ext.manufacturer=.*|ro.product.system_ext.manufacturer=$DEVICE_MANUFACTURER|' \
  -e 's|^ro.product.system_ext.model=.*|ro.product.system_ext.model=$DEVICE_MODEL|' \
  -e 's|^ro.product.system_ext.name=.*|ro.product.system_ext.name=$DEVICE_NAME|' \
  /system/system_ext/build.prop
"

# Also write /data/local.prop for any remaining props
docker exec "$CONTAINER" sh -c "
cat > /data/local.prop <<'EOF'
ro.serialno=$FAKE_SERIAL
ro.boot.serialno=$FAKE_SERIAL
ro.hardware.chipname=$DEVICE_HARDWARE
EOF
chmod 644 /data/local.prop
"

echo "✓ $CONTAINER patched. Restarting to apply..."

# Restart container so init re-reads the patched build.prop
docker restart "$CONTAINER" >/dev/null
echo "✓ $CONTAINER restarted with new identity"
