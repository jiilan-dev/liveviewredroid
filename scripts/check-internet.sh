#!/usr/bin/env bash
# check-internet.sh — Check and auto-fix internet for all Redroid instances
# Usage: ./scripts/check-internet.sh [--fix]
#   --fix   Automatically attempt to fix issues (requires sudo)
set -euo pipefail

AUTO_FIX=false
[[ "${1:-}" == "--fix" ]] && AUTO_FIX=true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC} $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "  [INFO] $1"; }

ISSUES=0

echo ""
echo "=============================="
echo " Redroid Internet Health Check"
echo "=============================="
echo ""

# ─── 1. Host-level checks ───

echo "── Host Network ──"

# IP forwarding
IPFWD=$(cat /proc/sys/net/ipv4/ip_forward)
if [[ "$IPFWD" == "1" ]]; then
  ok "IP forwarding enabled"
else
  fail "IP forwarding DISABLED"
  ISSUES=$((ISSUES + 1))
  if $AUTO_FIX; then
    warn "Fixing: enabling ip_forward (needs sudo)..."
    sudo sysctl -w net.ipv4.ip_forward=1 >/dev/null
    ok "IP forwarding enabled"
  fi
fi

# Host internet
if ping -c 1 -W 2 8.8.8.8 &>/dev/null; then
  ok "Host has internet (ping 8.8.8.8)"
else
  fail "Host cannot reach 8.8.8.8 — fix host network first"
  ISSUES=$((ISSUES + 1))
fi

# nftables inet filter forward chain
if sudo nft list chain inet filter forward &>/dev/null 2>&1; then
  RULES=$(sudo nft list chain inet filter forward 2>/dev/null)
  if echo "$RULES" | grep -q 'iifname "docker0" accept'; then
    ok "nftables: Docker forwarding rules present"
  else
    fail "nftables: inet filter forward has DROP policy without Docker allow rules"
    ISSUES=$((ISSUES + 1))
    if $AUTO_FIX; then
      warn "Fixing: adding nftables Docker forwarding rules (needs sudo)..."
      sudo nft add rule inet filter forward iifname "docker0" accept
      sudo nft add rule inet filter forward oifname "docker0" ct state related,established accept
      sudo nft add rule inet filter forward iifname "br-*" accept
      sudo nft add rule inet filter forward oifname "br-*" ct state related,established accept
      ok "nftables forwarding rules added"
    fi
  fi
else
  ok "No inet filter forward chain — no nftables blocking"
fi

echo ""

# ─── 2. Docker-level checks ───

echo "── Docker ──"

if ! command -v docker &>/dev/null; then
  fail "Docker not installed"
  exit 1
fi

# Test with a quick Alpine container
echo "  Testing Docker internet (alpine ping)..."
if docker run --rm alpine ping -c 1 -W 3 8.8.8.8 &>/dev/null; then
  ok "Docker containers have internet"
else
  fail "Docker containers CANNOT reach internet"
  ISSUES=$((ISSUES + 1))
  if $AUTO_FIX; then
    warn "Running fix-docker-network.sh..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$SCRIPT_DIR/fix-docker-network.sh" ]]; then
      sudo bash "$SCRIPT_DIR/fix-docker-network.sh"
    else
      warn "fix-docker-network.sh not found at $SCRIPT_DIR"
    fi
  fi
fi

echo ""

# ─── 3. Per-instance checks ───

echo "── Redroid Instances ──"

CONTAINERS=$(docker ps --filter "name=redroid-" --format "{{.Names}}" 2>/dev/null | sort)

if [[ -z "$CONTAINERS" ]]; then
  warn "No running Redroid instances found"
else
  for CNAME in $CONTAINERS; do
    NUM=$(echo "$CNAME" | grep -oP '\d+$')
    PORT=$((5554 + NUM))
    SERIAL="localhost:$PORT"

    echo ""
    echo "  ── $CNAME ($SERIAL) ──"

    # Check container has default route
    ROUTES=$(docker exec "$CNAME" ip route show 2>/dev/null || echo "")
    if echo "$ROUTES" | grep -q "^default"; then
      ok "Default route exists"
    else
      warn "No default route (may still work via Docker bridge NAT)"
    fi

    # Ping test from container
    if docker exec "$CNAME" ping -c 1 -W 3 8.8.8.8 &>/dev/null; then
      ok "Container can ping 8.8.8.8"
    else
      fail "Container CANNOT ping 8.8.8.8"
      ISSUES=$((ISSUES + 1))
    fi

    # DNS test from container
    if docker exec "$CNAME" ping -c 1 -W 3 google.com &>/dev/null; then
      ok "DNS resolution works (google.com)"
    else
      fail "DNS resolution failed"
      ISSUES=$((ISSUES + 1))
      if $AUTO_FIX; then
        warn "Fixing DNS settings..."
        docker exec "$CNAME" setprop net.dns1 8.8.8.8 2>/dev/null || true
        docker exec "$CNAME" setprop net.dns2 8.8.4.4 2>/dev/null || true
        ok "DNS properties set"
      fi
    fi

    # ADB-level checks
    if adb devices 2>/dev/null | grep -q "$SERIAL.*device"; then
      ok "ADB connected"

      # Check Android internet via ADB
      if adb -s "$SERIAL" shell "ping -c 1 -W 3 8.8.8.8" &>/dev/null; then
        ok "Android has internet (via ADB)"
      else
        fail "Android CANNOT reach internet (via ADB)"
        ISSUES=$((ISSUES + 1))
        if $AUTO_FIX; then
          warn "Configuring Android DNS + captive portal..."
          adb -s "$SERIAL" shell "setprop net.dns1 8.8.8.8" 2>/dev/null || true
          adb -s "$SERIAL" shell "setprop net.dns2 8.8.4.4" 2>/dev/null || true
          adb -s "$SERIAL" shell "settings put global captive_portal_detection_enabled 0" 2>/dev/null || true
          adb -s "$SERIAL" shell "settings put global captive_portal_mode 0" 2>/dev/null || true
          adb -s "$SERIAL" shell "ndc resolver setnetdns 100 '' 8.8.8.8 8.8.4.4" 2>/dev/null || true
          ok "Android DNS configured"
        fi
      fi
    else
      warn "ADB not connected to $SERIAL — skipping Android checks"
    fi
  done
fi

echo ""
echo "=============================="
if [[ "$ISSUES" -eq 0 ]]; then
  echo -e " ${GREEN}All checks passed!${NC}"
else
  echo -e " ${RED}$ISSUES issue(s) found${NC}"
  if ! $AUTO_FIX; then
    echo " Run with --fix to auto-repair: ./scripts/check-internet.sh --fix"
  fi
fi
echo "=============================="
echo ""
