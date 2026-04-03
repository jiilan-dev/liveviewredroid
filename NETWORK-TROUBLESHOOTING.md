# Redroid Network Troubleshooting Guide

Dokumen ini berisi masalah-masalah jaringan yang pernah ditemukan di setup Redroid dan cara fix-nya.

---

## Problem 1: Redroid Container Tidak Bisa Akses Internet

### Gejala
- Android di dalam Redroid menunjukkan "No Internet"
- `ping 8.8.8.8` dari dalam container → 100% packet loss
- App seperti Shopee tidak bisa connect ke server

### Penyebab
Ada **2 layer** masalah:

#### 1a. nftables `inet filter forward` chain DROP policy
System menggunakan `iptables-nft` (nftables backend). Chain `inet filter forward` memiliki **policy DROP** tanpa rule apapun, sehingga semua forwarded traffic (termasuk Docker bridge → internet) langsung di-drop.

**Cek:**
```bash
sudo nft list chain inet filter forward
```
Output bermasalah:
```
chain forward {
    type filter hook forward priority filter; policy drop;
}
```
→ Tidak ada rule `accept`, semua traffic di-DROP.

**Fix:**
```bash
sudo nft add rule inet filter forward iifname "docker0" accept
sudo nft add rule inet filter forward oifname "docker0" ct state related,established accept
sudo nft add rule inet filter forward iifname "br-*" accept
sudo nft add rule inet filter forward oifname "br-*" ct state related,established accept
```

#### 1b. Missing Default Route di Container
Container Redroid hanya punya route ke subnet lokal, tanpa default gateway.

**Cek:**
```bash
docker exec redroid-1 ip route show
```
Output bermasalah (tidak ada baris `default via ...`):
```
172.17.0.0/16 dev eth0 proto kernel scope link src 172.17.0.2
```

**Fix:**
```bash
docker exec redroid-1 ip route add default via 172.17.0.1
```
> Biasanya fix nftables di atas sudah cukup — Docker otomatis manage route. Tapi kalau masih missing, tambahkan manual.

---

## Problem 2: DNS Tidak Resolve di Android

### Gejala
- `ping 8.8.8.8` works, tapi `ping google.com` gagal
- App menunjukkan "No Internet" padahal IP reachable

### Penyebab
Android di Redroid tidak selalu inherit DNS dari Docker `--dns` flag.

### Fix
Via ADB:
```bash
SERIAL="localhost:5555"
adb -s $SERIAL shell "setprop net.dns1 8.8.8.8"
adb -s $SERIAL shell "setprop net.dns2 8.8.4.4"
adb -s $SERIAL shell "ndc resolver setnetdns 100 '' 8.8.8.8 8.8.4.4"
```

Via Docker (saat start container):
```bash
docker run ... --dns 8.8.8.8 --dns 8.8.4.4 ...
```

---

## Problem 3: Android "Connected, No Internet" (Captive Portal)

### Gejala
- WiFi icon ada tanda "x" atau "!"
- Setting menunjukkan "Connected, no internet"
- Padahal ping ke IP luar berhasil

### Penyebab
Android melakukan captive portal detection (cek koneksi ke `connectivitycheck.gstatic.com`). Kalau gagal, Android menganggap tidak ada internet.

### Fix
```bash
adb -s localhost:5555 shell "settings put global captive_portal_detection_enabled 0"
adb -s localhost:5555 shell "settings put global captive_portal_mode 0"
```

---

## Problem 4: `sudo nft list ruleset > /etc/nftables.conf` — Permission Denied

### Gejala
```
zsh: permission denied: /etc/nftables.conf
```

### Penyebab
Shell redirect `>` dijalankan oleh user biasa, bukan sudo. `sudo` hanya berlaku untuk command sebelum `>`.

### Fix
Gunakan `tee`:
```bash
sudo nft list ruleset | sudo tee /etc/nftables.conf > /dev/null
```

---

## Automation Scripts

### Auto-check & fix internet
```bash
# Check only (no changes)
./scripts/check-internet.sh

# Check and auto-fix issues
./scripts/check-internet.sh --fix
```

### Manual fix Docker network
```bash
sudo bash ./scripts/fix-docker-network.sh
```

### Persist fix across reboots (systemd)
```bash
# Install the service
sudo cp ./scripts/redroid-network-fix.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable redroid-network-fix.service

# Test it
sudo systemctl start redroid-network-fix.service
sudo systemctl status redroid-network-fix.service
```

---

## Quick Diagnosis Checklist

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | IP forwarding | `cat /proc/sys/net/ipv4/ip_forward` | `1` |
| 2 | Host internet | `ping -c 1 8.8.8.8` | Reply OK |
| 3 | nftables forward | `sudo nft list chain inet filter forward` | Has docker0 accept rules |
| 4 | Docker internet | `docker run --rm alpine ping -c 1 8.8.8.8` | Reply OK |
| 5 | Container route | `docker exec redroid-1 ip route show` | Has `default via` line |
| 6 | Container ping | `docker exec redroid-1 ping -c 1 8.8.8.8` | Reply OK |
| 7 | Container DNS | `docker exec redroid-1 ping -c 1 google.com` | Reply OK |
| 8 | ADB ping | `adb -s localhost:5555 shell "ping -c 1 8.8.8.8"` | Reply OK |

Jika langkah N gagal, fix di langkah N sebelum lanjut ke bawah.

---

*Last updated: April 2026*
