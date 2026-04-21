# Local Calistirma Rehberi

Bu proje localde iki servis olarak calisir:

- frontend = Next.js App Router
- backend = FastAPI

Local adresler:

- Frontend: http://localhost:3000
- Backend: http://127.0.0.1:8000
- Backend health: http://127.0.0.1:8000/api/v1/health

## 1. Gerekenler

- Node.js 20+
- npm
- Python 3.11+
- backend icin virtual environment
- Supabase proje bilgileri

## 2. Env duzeni

Gercek local env dosyalari:

- frontend/.env.local
- backend/.env

Ornek env dosyalari:

- .env.example
- frontend/.env.example
- backend/.env.example

Production env degerleri repo icinde tutulmaz.

## 3. Bir kerelik kurulum

### Frontend

```powershell
cd "C:\Users\MEHMET YILDIRIM\risknova-platform\frontend"
npm.cmd install
```

### Backend

```powershell
cd "C:\Users\MEHMET YILDIRIM\risknova-platform"
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install --upgrade pip
.\backend\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
```

## 4. Local env icerikleri

### frontend/.env.local

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_API_URL=http://127.0.0.1:8000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

```

### backend/.env

```env
ENV=development
APP_NAME=RiskNova Backend
APP_VERSION=v1

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

JWT_SECRET=

FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://getrisknova.vercel.app
```

## 5. Gunluk baslatma

Iki terminal acilir.

### Terminal 1 - backend

```powershell
cd "C:\Users\MEHMET YILDIRIM\risknova-platform\backend"
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Terminal 2 - frontend

```powershell
cd "C:\Users\MEHMET YILDIRIM\risknova-platform\frontend"
npm.cmd run dev
```

Frontend `next dev` lock hatasi veya eski surec takilmasi yasarsaniz:

```powershell
cd "C:\Users\MEHMET YILDIRIM\risknova-platform\frontend"
npm.cmd run dev:reset
```

Bu komut proje klasorune ait eski `next dev` sureclerini kapatmayi dener, `.next\dev\lock` dosyasini temizler ve dev server'i yeniden baslatir.

## 6. Hizli kontrol

Asagidakiler calisiyorsa local ortam ayaga kalkmistir:

- http://localhost:3000 aciliyor
- http://127.0.0.1:8000/api/v1/health cevap donuyor
- login calisiyor
- dashboard protected calisiyor

## 7. Gunluk rutin

Calismaya baslamadan once:

```powershell
git status --short
```

Ardindan backend ve frontend baslatilir.

Calisma sonunda:

```powershell
git status --short
```

## 8. Sik gorulen sorunlar

### Backend acilmiyor

- backend/.env eksik olabilir
- backend/.venv icine paketler kurulmamis olabilir

### Frontend acilmiyor

- frontend/.env.local eksik olabilir
- npm install yapilmamis olabilir
- `next dev` lock kalmis olabilir, `npm.cmd run dev:reset` kullanin

### PowerShell script policy hatasi

- npm yerine npm.cmd kullan
- Activate.ps1 yerine dogrudan .venv icindeki python.exe kullan

### Port dolu

- 3000 veya 8000 portunu kullanan eski surec kapatilmalidir

## 9. Kapatma

Acik olan terminalde Ctrl + C kullanilir.
