# SandboxAI Dashboard

Dashboard do monitorowania serwera, aplikacji i serwisow. React + FastAPI + SQLite.

Aplikacja jest serwowana pod subpath `/dashboard/` — gotowa do pracy za centralnym reverse proxy.

## Co robi

- **Dashboard** (`/dashboard/`) — lista aplikacji z live statusem, healthchecki, szybkie metryki CPU/RAM/GPU
- **Monitoring** (`/dashboard/resources`) — wykresy CPU/RAM/Disk/GPU, procesy, siec, kontenery Docker
- **Activity Feed** (`/dashboard/events`) — timeline zmian statusow, alertow, spike'ow, zmian w Docker
- **Admin** (`/dashboard/admin`) — CRUD aplikacji i healthcheckow (zabezpieczony haslem)

---

## Architektura

```
Internet (HTTPS :443)
        |
   Centralny Nginx        <-- SSL cert (Let's Encrypt)
   (reverse proxy)
        |
   /dashboard/* --> monitor-frontend:80
        |
   Wewnetrzny Nginx       <-- statyczne pliki React + proxy API
        |
   /dashboard/api/* --> monitor-backend:8000
```

- **Centralny nginx** — terminacja SSL, routing do roznych aplikacji po subpath
- **Wewnetrzny nginx** (w kontenerze frontend) — serwuje React SPA + proxy do backendu
- Ruch miedzy kontenerami po HTTP (siec Docker) — SSL nie potrzebny wewnatrz

---

## Wdrozenie krok po kroku

### Wymagania

- Docker + Docker Compose
- Git
- Centralny nginx (reverse proxy) z certyfikatem SSL
- (Opcjonalnie) NVIDIA GPU + NVIDIA Container Toolkit (Linux)

### Krok 1: Sklonuj repo

```bash
git clone <repo-url> /opt/monitor
cd /opt/monitor
```

### Krok 2: Skonfiguruj zmienne srodowiskowe

```bash
cp .env.example .env
nano .env
```

```env
# Haslo do panelu admina (ZMIEN NA SWOJE!)
ADMIN_PASSWORD=TwojeSilneHaslo123!

# Port na ktorym bedzie dostepna aplikacja wewnatrz serwera
APP_PORT=3100

# CORS - domena przez ktora uzytkownik wchodzi
CORS_ORIGINS=https://twojadomena.pl

# Sciezka do bazy (nie zmieniaj)
DB_PATH=/data/dashboard.db
```

### Krok 3: Uruchom

**Standardowo (bez GPU):**
```bash
docker compose up -d --build
```

**Z GPU (NVIDIA — wymaga Container Toolkit na Linux):**
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

**Z ignorowaniem certyfikatow SSL (jesli pip/npm nie ufa CA serwera):**
```bash
docker compose -f docker-compose.yml -f docker-compose.nocert.yml up -d --build
```

**GPU + ignorowanie certyfikatow:**
```bash
docker compose -f docker-compose.yml -f docker-compose.nocert.yml -f docker-compose.gpu.yml up -d --build
```

### Krok 4: Sprawdz status

```bash
docker ps
# NAMES              STATUS
# monitor-backend    Up 30s (healthy)
# monitor-frontend   Up 25s (healthy)
```

```bash
# Sprawdz logi backendu
docker logs monitor-backend 2>&1 | head -20

# Szukaj linii:
# API Key: PXlUhnO7...bEB0
# Admin Password: ********
```

### Krok 5: Skonfiguruj centralny nginx

Dodaj do konfiguracji centralnego nginx:

```nginx
# Monitor Dashboard
location /dashboard/ {
    proxy_pass http://127.0.0.1:3100/dashboard/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

> **Uwaga:** Port `3100` musi odpowiadac `APP_PORT` w `.env`.

Zrestartuj centralny nginx:

```bash
nginx -t && nginx -s reload
```

### Krok 6: Otworz w przegladarce

```
https://twojadomena.pl/dashboard/
```

Zaloguj sie do admina: kliknij **Admin** w nawigacji, wpisz haslo z `.env`.

---

## GPU Monitoring (NVIDIA)

### Windows (Docker Desktop)

Dziala automatycznie jesli masz karte NVIDIA z zainstalowanymi sterownikami. Docker Desktop na Windows korzysta z WSL2 ktory przekazuje GPU do kontenerow bez dodatkowej konfiguracji. Nie uzywaj `docker-compose.gpu.yml` na Windows — spowoduje blad.

### Linux

```bash
# 1. Sprawdz czy sterowniki dzialaja
nvidia-smi

# 2. Zainstaluj NVIDIA Container Toolkit
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# 3. Uruchom z GPU
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

### Multi-GPU

Aktualnie dashboard wyswietla metryki **pierwszego GPU**. Jesli masz wiele kart (np. 2x H100), widoczna bedzie tylko GPU 0. Monitoring wielu GPU wymaga rozszerzenia backendu.

Bez GPU toolkit dashboard dziala normalnie — sekcja GPU po prostu sie nie wyswietla.

---

## Pliki Docker Compose

| Plik | Opis | Kiedy uzywac |
|------|------|-------------|
| `docker-compose.yml` | Glowna konfiguracja | Zawsze (bazowy plik) |
| `docker-compose.gpu.yml` | NVIDIA GPU passthrough | Linux z NVIDIA Container Toolkit |
| `docker-compose.nocert.yml` | Ignoruje SSL certy przy pip/npm | Serwer za corporate proxy / self-signed CA |

Laczyc przez `-f`:
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml -f docker-compose.nocert.yml up -d --build
```

---

## Aktualizacja

```bash
cd /opt/monitor
git pull
docker compose up -d --build
# Lub z GPU:
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

Baza danych jest w Docker volume (`db_data`) — nie zostanie usunieta przy rebuildzie.

---

## Backup i przywracanie bazy

```bash
# Backup
docker cp monitor-backend:/data/dashboard.db ./backup-$(date +%Y%m%d).db

# Restore
docker cp ./backup.db monitor-backend:/data/dashboard.db
docker compose restart backend
```

---

## Administracja

### Zmiana hasla admina

```bash
nano .env   # Zmien ADMIN_PASSWORD
docker compose up -d
```

### Reset bazy (od zera)

```bash
docker compose down
docker volume rm monitor_db_data
docker compose up -d --build
```

### Logi

```bash
# Backend (API, healthchecki, metryki)
docker logs -f monitor-backend

# Frontend (nginx)
docker logs -f monitor-frontend

# Tylko bledy
docker logs monitor-backend 2>&1 | grep -i error
```

---

## Konfiguracja zaawansowana

Plik `backend/config.py`:

| Parametr | Domyslnie | Opis |
|----------|-----------|------|
| `HEALTHCHECK_INTERVAL` | 30s | Jak czesto sprawdzac healthchecki i aplikacje |
| `METRICS_INTERVAL` | 60s | Jak czesto zapisywac metryki do bazy |
| `DOCKER_MONITOR_INTERVAL` | 30s | Jak czesto sprawdzac zmiany w Docker |
| `CLEANUP_INTERVAL` | 3600s | Jak czesto czyscic stare dane |
| `HEALTHCHECK_RETENTION_DAYS` | 3 | Ile dni trzymac wyniki healthcheckow |
| `METRICS_RETENTION_DAYS` | 30 | Ile dni trzymac historyczne metryki |
| `EVENTS_RETENTION_DAYS` | 30 | Ile dni trzymac eventy |
| `SPIKE_THRESHOLD_PERCENT` | 90% | Prog alertu CPU/RAM/GPU |

Po zmianie config.py:

```bash
docker compose up -d --build backend
```

---

## API

### Endpointy publiczne

| Endpoint | Opis |
|----------|------|
| `GET /api/dashboard` | Wszystko w jednym (apps + status + healthchecks) |
| `GET /api/system/metrics` | Aktualne CPU/RAM/Disk/GPU |
| `GET /api/system/metrics/history?range=1h` | Historia (1h/6h/24h/7d/14d) |
| `GET /api/system/processes` | Top 10 CPU/RAM procesow |
| `GET /api/system/network` | Predkosc sieci |
| `GET /api/system/docker` | Kontenery Docker |
| `GET /api/events?limit=50&type=docker` | Activity feed |

### Endpointy admina (header: `x-api-key`)

| Endpoint | Opis |
|----------|------|
| `POST /api/admin/login` | Login — zwraca API key |
| `POST/PUT/DELETE /api/admin/apps/{id}` | CRUD aplikacji |
| `POST/PUT/DELETE /api/admin/healthchecks/{id}` | CRUD healthcheckow |

Dokumentacja Swagger: `https://twojadomena.pl/dashboard/docs`

---

## Rozwiazywanie problemow

| Problem | Rozwiazanie |
|---------|------------|
| Backend nie startuje | `docker logs monitor-backend` — sprawdz bledy |
| Frontend nie laduje API | `curl http://localhost:3100/dashboard/api/dashboard` |
| GPU nie wyswietla sie | `docker exec monitor-backend nvidia-smi` — czy dziala w kontenerze? |
| Docker eventy nie pojawiaja sie | Poczekaj ~60s (2 cykle po 30s — pierwszy buduje stan, drugi porownuje) |
| Baza uszkodzona | `docker compose down && docker volume rm monitor_db_data && docker compose up -d --build` |
| Blad NVIDIA driver przy starcie | Nie uzywaj `docker-compose.gpu.yml` — uruchom bez GPU override |
| npm/pip SSL error podczas buildu | Uzyj `docker-compose.nocert.yml` override |
