"""
Configuration and constants for the dashboard backend.
All tunable values in one place.
"""
import os

# ─── Server ───────────────────────────────────────────────
SERVER_HOST = "0.0.0.0"
SERVER_PORT = 8000

# ─── Admin ────────────────────────────────────────────────
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

# ─── Database ────────────────────────────────────────────
DB_PATH = os.environ.get("DB_PATH", "dashboard.db")

# ─── CORS ─────────────────────────────────────────────────
_cors_env = os.environ.get("CORS_ORIGINS", "")
if _cors_env == "*":
    CORS_ORIGINS = ["*"]
elif _cors_env:
    CORS_ORIGINS = [o.strip() for o in _cors_env.split(",")]
else:
    CORS_ORIGINS = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
        "http://localhost:8000",  # Backend itself
    ]

# ─── API ──────────────────────────────────────────────────
API_TITLE = "SandboxAI Dashboard API"
API_VERSION = "10.0"

# ─── Timeouts (seconds) ──────────────────────────────────
HEALTHCHECK_TIMEOUT = 5       # HTTP client timeout for healthchecks
APP_CHECK_TIMEOUT = 3         # HTTP client timeout for app status checks
GPU_CHECK_TIMEOUT = 2         # nvidia-smi subprocess timeout

# ─── Background task intervals (seconds) ─────────────────
HEALTHCHECK_INTERVAL = 30     # How often to check healthchecks & apps
METRICS_INTERVAL = 60         # How often to save system metrics
CLEANUP_INTERVAL = 3600       # How often to run data cleanup (1 hour)
DOCKER_MONITOR_INTERVAL = 30  # How often to check Docker container changes

# ─── Cache TTLs (seconds) ────────────────────────────────
IP_CACHE_TTL = 60             # Local IP address cache
DASHBOARD_CACHE_TTL = 5       # Dashboard endpoint in-memory cache
CPU_CACHE_TTL = 2             # CPU percent measurement cache
PROCESSES_CACHE_TTL = 30      # Top processes list cache
DOCKER_CACHE_TTL = 120        # Docker containers list cache

# ─── Data retention (days) ───────────────────────────────
HEALTHCHECK_RETENTION_DAYS = 3
APP_STATUS_RETENTION_DAYS = 3
METRICS_RETENTION_DAYS = 30
EVENTS_RETENTION_DAYS = 30

# ─── Alerting ────────────────────────────────────────────
SPIKE_THRESHOLD_PERCENT = 90  # CPU/RAM/GPU alert threshold
SPIKE_HYSTERESIS = 10         # Must drop this much below threshold to clear alert
