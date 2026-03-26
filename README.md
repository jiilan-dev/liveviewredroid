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

## Install dan buka liveview.apk

Default script akan mencari APK di `./liveview.apk`.

```bash
./scripts/open-liveview.sh
```

Kalau path APK beda:

```bash
./scripts/open-liveview.sh /path/ke/liveview.apk
```

Kalau auto-detect package gagal, bisa isi package manual:

```bash
./scripts/open-liveview.sh /path/ke/liveview.apk com.nama.package
```

## Otomatis buka app lalu tap tombol

Script ini akan:

- install + buka APK target
- start redroid dan konek adb otomatis
- cari tombol berdasarkan text (default: `Masuk Live`)
- tap tombol otomatis

```bash
./scripts/automate-liveview.sh
```

Custom text tombol target:

```bash
./scripts/automate-liveview.sh ./liveview.apk "" "Allow"
```

Custom timeout tunggu tombol (detik):

```bash
WAIT_TIMEOUT=90 ./scripts/automate-liveview.sh
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
