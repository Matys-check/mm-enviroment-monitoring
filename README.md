# SandboxAI Dashboard

Dashboard do monitorowania serwera, aplikacji i serwisow. React + FastAPI + SQLite.

## Co robi

- **Dashboard** (`/`) — lista aplikacji z live statusem, healthchecki, szybkie metryki CPU/RAM/GPU
- **Monitoring** (`/resources`) — wykresy CPU/RAM/Disk/GPU, procesy, siec, kontenery Docker
- **Activity Feed** (`/events`) — timeline zmian statusow, alertow, spike'ow, zmian w Docker
- **Admin** (`/admin`) — CRUD aplikacji i healthcheckow (zabezpieczony haslem)

---

## Wdrozenie na serwerze (Docker Compose)

### Wymagania

- Docker + Docker Compose
- Git
- (Opcjonalnie) NVIDIA GPU + sterowniki do monitoringu GPU

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

Edytuj `.env`:

```env
# Haslo do panelu admina (ZMIEN NA SWOJE!)
ADMIN_PASSWORD=TwojeSilneHaslo123!

# Port na ktorym bedzie dostepna aplikacja
APP_PORT=80

# CORS - jesli za reverse proxy, podaj domene
# Dla jednej domeny:
CORS_ORIGINS=https://monitor.twojadomena.pl
# Dla wielu:
# CORS_ORIGINS=https://monitor.twojadomena.pl,https://admin.twojadomena.pl
# Pozwol na wszystko (dev):
# CORS_ORIGINS=*

# Sciezka do bazy (nie zmieniaj jesli nie musisz)
DB_PATH=/data/dashboard.db
```

### Krok 3: Uruchom

```bash
docker compose up -d --build
```

Poczekaj az oba kontenery beda healthy:

```bash
docker ps
# NAMES              STATUS
# monitor-backend    Up 30s (healthy)
# monitor-frontend   Up 25s (healthy)
```

### Krok 4: Sprawdz logi

```bash
docker logs monitor-backend 2>&1 | head -20

# Szukaj linii:
# 🔑 API Key: PXlUhnO7...bEB0
# 🔐 Admin Password: ********
```

### Krok 5: Otworz w przegladarce

```
http://<IP-serwera>:80
```

Zaloguj sie do admina: kliknij **Admin** w nawigacji, wpisz haslo z `.env`.

---

## Konfiguracja za reverse proxy

Aplikacja wystawia **jeden port** (domyslnie `80`). Frontend nginx wewnatrz kontenera obsluguje i pliki React (`/`) i proxy do API (`/api/*`). Wystarczy wskazac reverse proxy na ten jeden port.

### Nginx Proxy Manager / nginx

```nginx
server {
    listen 443 ssl;
    server_name monitor.twojadomena.pl;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Traefik (labels w docker-compose.yml)

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.monitor.rule=Host(`monitor.twojadomena.pl`)"
  - "traefik.http.services.monitor.loadbalancer.server.port=80"
```

### Zmiana portu

```bash
# Jesli port 80 jest zajety:
APP_PORT=8090 docker compose up -d --build
```

---

## GPU Monitoring (NVIDIA)

### Windows (Docker Desktop)

Dziala automatycznie jesli masz karte NVIDIA z zainstalowanymi sterownikami.

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

# 3. Zrestartuj aplikacje
docker compose up -d --build
```

Bez GPU toolkit dashboard dziala normalnie — sekcja GPU po prostu sie nie wyswietla.

---

## Aktualizacja

```bash
cd /opt/monitor
git pull
docker compose up -d --build
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

Dokumentacja Swagger: `http://<IP>:<PORT>/docs`

---

## Rozwiazywanie problemow

| Problem | Rozwiazanie |
|---------|------------|
| Backend nie startuje | `docker logs monitor-backend` — sprawdz bledy |
| Frontend nie laduje API | `curl http://localhost/api/dashboard` — czy backend odpowiada? |
| GPU nie wyswietla sie | `docker exec monitor-backend nvidia-smi` — czy dziala w kontenerze? |
| Docker eventy nie pojawiaja sie | Poczekaj ~60s (2 cykle po 30s — pierwszy buduje stan, drugi porownuje) |
| Baza uszkodzona | `docker compose down && docker volume rm monitor_db_data && docker compose up -d --build` |
