#!/usr/bin/env bash
# fix-docker-network.sh — Fix Docker container internet by adding nftables forwarding rules
# Run with: sudo bash fix-docker-network.sh
set -euo pipefail

echo "=== Docker Network Fix ==="

# 1. Ensure IP forwarding is enabled
FORWARD=$(cat /proc/sys/net/ipv4/ip_forward)
if [[ "$FORWARD" != "1" ]]; then
  echo "[FIX] Enabling IP forwarding..."
  sysctl -w net.ipv4.ip_forward=1
else
  echo "[OK] IP forwarding already enabled"
fi

# 2. Check if inet filter forward chain exists and has DROP policy
if nft list chain inet filter forward &>/dev/null; then
  echo "[INFO] Found inet filter forward chain"

  # Check if Docker forwarding rules already exist
  EXISTING=$(nft list chain inet filter forward 2>/dev/null)
  if echo "$EXISTING" | grep -q 'iifname "docker0" accept'; then
    echo "[OK] Docker forwarding rules already present"
  else
    echo "[FIX] Adding Docker bridge forwarding rules..."
    nft add rule inet filter forward iifname "docker0" accept
    nft add rule inet filter forward oifname "docker0" ct state related,established accept
    echo "[OK] docker0 rules added"
  fi

  if echo "$EXISTING" | grep -q 'iifname "br-\*" accept'; then
    echo "[OK] Custom bridge forwarding rules already present"
  else
    echo "[FIX] Adding custom bridge (br-*) forwarding rules..."
    nft add rule inet filter forward iifname "br-*" accept
    nft add rule inet filter forward oifname "br-*" ct state related,established accept
    echo "[OK] br-* rules added"
  fi
else
  echo "[OK] No inet filter forward chain found — no fix needed"
fi

# 3. Ensure NAT masquerade for Docker subnets
echo "[INFO] Checking NAT masquerade rules..."

# Get Docker bridge subnet
DOCKER_SUBNET=$(docker network inspect bridge --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null || echo "172.17.0.0/16")

if ! iptables -t nat -C POSTROUTING -s "$DOCKER_SUBNET" ! -o docker0 -j MASQUERADE &>/dev/null; then
  echo "[FIX] Adding MASQUERADE for $DOCKER_SUBNET..."
  iptables -t nat -A POSTROUTING -s "$DOCKER_SUBNET" ! -o docker0 -j MASQUERADE
else
  echo "[OK] MASQUERADE rule for $DOCKER_SUBNET exists"
fi

# Also check custom networks
for NET_ID in $(docker network ls --filter driver=bridge --format '{{.ID}}' 2>/dev/null); do
  SUBNET=$(docker network inspect "$NET_ID" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null || true)
  BRIDGE=$(docker network inspect "$NET_ID" --format '{{index .Options "com.docker.network.bridge.name"}}' 2>/dev/null || true)
  [[ -z "$SUBNET" || "$SUBNET" == "$DOCKER_SUBNET" ]] && continue
  if [[ -n "$BRIDGE" ]]; then
    if ! iptables -t nat -C POSTROUTING -s "$SUBNET" ! -o "$BRIDGE" -j MASQUERADE &>/dev/null; then
      echo "[FIX] Adding MASQUERADE for $SUBNET (bridge: $BRIDGE)..."
      iptables -t nat -A POSTROUTING -s "$SUBNET" ! -o "$BRIDGE" -j MASQUERADE
    fi
  fi
done

echo ""
echo "=== Fix complete ==="
