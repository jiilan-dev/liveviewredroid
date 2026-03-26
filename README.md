# LiveView Redroid (Step 1)

Target tahap ini: menjalankan redroid pakai Docker dan memastikan Android bisa diakses.

## Versi Android

Image yang dipakai saat ini adalah `redroid/redroid:11.0.0-latest`, yaitu Android 11.

## Prasyarat

- Linux host dengan Docker aktif
- Docker Compose plugin (`docker compose`)
- Kernel support binder (beberapa distro butuh module binder_linux)
- Untuk akses device: `adb`
- Untuk tampilan layar Android: `scrcpy` (opsional, tapi direkomendasikan)

## Jalankan redroid

```bash
./scripts/start-redroid.sh
```

## Konek ADB

```bash
./scripts/adb-connect.sh
```

## Stop semuanya

```bash
./scripts/stop-all.sh
```

Script ini akan:

- memutus `adb connect localhost:5555`
- menghentikan adb server
- menjalankan `docker compose down`

Cek hasil koneksi:

```bash
adb devices
```

Harus muncul `localhost:5555` dengan status `device`.

## Buka layar Android

```bash
scrcpy -s localhost:5555
```

Kalau `scrcpy` belum ada:

- Ubuntu/Debian: `sudo apt install -y scrcpy`
- Arch: `sudo pacman -S scrcpy`

## Perintah penting

Start container:

```bash
docker compose up -d
```

Lihat log:

```bash
docker compose logs -f redroid
```

Stop container:

```bash
docker compose down
```

## Troubleshooting cepat

- Jika container gagal start, cek log dulu:
  - `docker compose logs redroid`
- Jika `adb connect localhost:5555` gagal:
  - pastikan port `5555` tidak dipakai service lain
  - jalankan ulang: `docker compose restart redroid`
- Jika layar tidak muncul di `scrcpy`:
  - pastikan `adb devices` sudah status `device`
  - coba restart adb server lalu connect ulang
