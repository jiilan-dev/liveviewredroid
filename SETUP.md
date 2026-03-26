# Database Setup Guide

Panduan lengkap untuk setup PostgreSQL dan database liveviewbot.

## Prasyarat

- PostgreSQL 12+ terinstall
- `psql` CLI tools tersedia

## Setup PostgreSQL

### 1. Login ke PostgreSQL (sebagai superuser)

```bash
sudo -u postgres psql
```

### 2. Buat user `palvia` dengan password `soleplayer`

```sql
CREATE USER palvia WITH PASSWORD 'soleplayer';
```

### 3. Buat database `liveviewbot` dengan owner `palvia`

```sql
CREATE DATABASE liveviewbot OWNER palvia;
```

### 4. Grant privileges

```sql
ALTER USER palvia CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE liveviewbot TO palvia;
```

### 5. Exit psql

```sql
\q
```

## Setup Node.js Dependencies

```bash
npm install
```

## Konfigurasi Environment

1. Copy `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

2. Verifikasi DATABASE_URL di `.env`:

```
DATABASE_URL=postgresql://palvia:soleplayer@localhost:5432/liveviewbot
```

## Generate Database Schema

Jalankan Drizzle untuk membuat tables:

```bash
npm run db:generate
npm run db:migrate
```

Atau jika menggunakan drizzle-kit langsung:

```bash
npx drizzle-kit generate:pg
npx drizzle-kit migrate:pg
```

## Mulai Server

Development mode dengan auto-reload:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

Seharusnya melihat output seperti:

```
✓ Database connected
✓ Default admin user created (admin/admin123)
✓ Server running on http://localhost:3000
✓ API docs:
   POST /api/auth/login - Login with credentials
   ...
```

## Test API

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

### System Status (perlu token)

```bash
curl -X GET http://localhost:3000/api/system/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Error: "Database connection failed"

- Pastikan PostgreSQL service running: `sudo systemctl status postgresql`
- Verifikasi credentials di `.env`
- Cek port 5432 tidak diblok firewall

### Error: "User already exists"

Database sudah initialized. Cek table dengan:

```bash
psql -U palvia -d liveviewbot -c "SELECT * FROM users;"
```

### Error: "EADDRINUSE: address already in use"

Port 3000 sudah dipakai. Ganti di `.env`:

```
PORT=3001
```
