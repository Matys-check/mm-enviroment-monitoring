import sqlite3
import secrets
import threading
import json
from pathlib import Path
from typing import List, Dict, Optional
from contextlib import contextmanager

from config import DB_PATH
DATABASE_PATH = Path(DB_PATH) if DB_PATH != "dashboard.db" else Path(__file__).parent / "dashboard.db"

# Thread-local storage for connection reuse
# Each thread gets its own connection (SQLite requirement) but reuses it across calls
_local = threading.local()


def _get_connection() -> sqlite3.Connection:
    """Get or create a thread-local SQLite connection (reused across calls)"""
    conn = getattr(_local, 'connection', None)
    if conn is None:
        conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")  # Faster writes, still safe with WAL
        conn.execute("PRAGMA cache_size=-8000")     # 8MB page cache (default ~2MB)
        _local.connection = conn
    return conn


@contextmanager
def get_db():
    """Context manager for database operations with thread-local connection reuse"""
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e


def init_database():
    """Initialize database with tables and generate API key"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # WAL mode and PRAGMAs are now set per-connection in _get_connection()
        
        # Create apps table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS apps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                url TEXT NOT NULL,
                icon TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create healthchecks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS healthchecks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                check_url TEXT NOT NULL,
                models_url TEXT,
                show_models INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create healthcheck_results table for caching
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS healthcheck_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                check_id TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT,
                models TEXT,
                response_time_ms INTEGER,
                checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (check_id) REFERENCES healthchecks(id)
            )
        """)
        
        # Indexes for fast queries
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_check_id ON healthcheck_results(check_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_checked_at ON healthcheck_results(checked_at DESC)")
        # Composite index for "latest result per check_id" pattern (covers the MAX(id) GROUP BY)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hr_checkid_id ON healthcheck_results(check_id, id DESC)")
        
        # Create app_status_cache table for app health status
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_status_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                response_time_ms INTEGER,
                checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (app_id) REFERENCES apps(id)
            )
        """)
        
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_app_id ON app_status_cache(app_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_app_checked_at ON app_status_cache(checked_at DESC)")
        # Composite index for "latest status per app_id" pattern (covers the MAX(id) subquery)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_asc_appid_id ON app_status_cache(app_id, id DESC)")
        
        # Create config table for API key and settings
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create metrics table for storing historical data
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cpu_percent REAL,
                ram_percent REAL,
                ram_used_gb REAL,
                ram_total_gb REAL,
                disk_percent REAL,
                disk_used_gb REAL,
                disk_total_gb REAL,
                gpu_available INTEGER DEFAULT 0,
                gpu_utilization REAL,
                gpu_memory_used_mb REAL,
                gpu_memory_total_mb REAL,
                gpu_memory_percent REAL
            )
        """)
        
        # Create index on timestamp for faster queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_metrics_timestamp 
            ON metrics(timestamp DESC)
        """)
        
        # Create events table for activity feed
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                type TEXT NOT NULL,
                severity TEXT NOT NULL,
                source TEXT NOT NULL,
                message TEXT NOT NULL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)")
        
        # Generate and store API key if doesn't exist
        cursor.execute("SELECT value FROM config WHERE key = 'api_key'")
        if not cursor.fetchone():
            api_key = secrets.token_urlsafe(32)
            cursor.execute("INSERT INTO config (key, value) VALUES ('api_key', ?)", (api_key,))
            print(f"🔑 Generated API Key: {api_key}")
            print("⚠️  Save this key - it won't be shown again!")
        
        conn.commit()


def save_metrics(cpu_percent, ram_percent, ram_used_gb, ram_total_gb, 
                 disk_percent, disk_used_gb, disk_total_gb,
                 gpu_available, gpu_utilization, gpu_memory_used_mb, 
                 gpu_memory_total_mb, gpu_memory_percent):
    """Save current metrics to database"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO metrics (
                cpu_percent, ram_percent, ram_used_gb, ram_total_gb,
                disk_percent, disk_used_gb, disk_total_gb,
                gpu_available, gpu_utilization, gpu_memory_used_mb,
                gpu_memory_total_mb, gpu_memory_percent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            cpu_percent, ram_percent, ram_used_gb, ram_total_gb,
            disk_percent, disk_used_gb, disk_total_gb,
            1 if gpu_available else 0, gpu_utilization or 0, 
            gpu_memory_used_mb or 0, gpu_memory_total_mb or 0, 
            gpu_memory_percent or 0
        ))


def get_metrics_history(range_key: str):
    """Get metrics history from database for given range with proper granulation"""
    
    # Granulation: balance detail vs chart readability
    # Short ranges = every data point, longer ranges = aggregated
    range_config = {
        "1h": {"hours": 1, "group_minutes": 1},        # ~60 punktów (każdy odczyt)
        "6h": {"hours": 6, "group_minutes": 5},        # ~72 punktów (co 5 min)
        "24h": {"hours": 24, "group_minutes": 15},     # ~96 punktów (co 15 min)
        "7d": {"hours": 24 * 7, "group_minutes": 60},  # ~168 punktów (co 1h)
        "14d": {"hours": 24 * 14, "group_minutes": 180} # ~112 punktów (co 3h)
    }
    
    if range_key not in range_config:
        range_key = "1h"
    
    config = range_config[range_key]
    hours = config["hours"]
    group_minutes = config["group_minutes"]
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Use bucketed timestamps for clean, predictable intervals
        cursor.execute("""
            SELECT 
                datetime(
                    strftime('%s', timestamp) - (strftime('%s', timestamp) % (? * 60)),
                    'unixepoch'
                ) as time_bucket,
                AVG(cpu_percent) as cpu_percent,
                AVG(ram_percent) as ram_percent,
                AVG(disk_percent) as disk_percent,
                AVG(gpu_utilization) as gpu_utilization,
                AVG(gpu_memory_used_mb) as gpu_memory_used_mb,
                AVG(ram_used_gb) as ram_used_gb,
                AVG(ram_total_gb) as ram_total_gb,
                AVG(gpu_memory_percent) as gpu_memory_percent
            FROM metrics
            WHERE timestamp >= datetime('now', '-' || ? || ' hours')
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        """, (group_minutes, hours))

        rows = cursor.fetchall()
        return [
            {
                "timestamp": row[0],
                "cpu": round(row[1], 1) if row[1] else 0,
                "ram": round(row[2], 1) if row[2] else 0,
                "disk": round(row[3], 1) if row[3] else 0,
                "gpu": round(row[4], 1) if row[4] else 0,
                "gpu_mem": round(row[5], 1) if row[5] else 0,
                "ram_gb": round(row[6], 2) if row[6] else 0,
                "ram_total_gb": round(row[7], 2) if row[7] else 0,
                "gpu_mem_pct": round(row[8], 1) if row[8] else 0
            }
            for row in rows
        ]


def cleanup_old_metrics(days=14):
    """Remove metrics older than specified days"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM metrics 
            WHERE timestamp < datetime('now', '-' || ? || ' days')
        """, (days,))
        deleted = cursor.rowcount
        if deleted > 0:
            print(f"🗑️  Cleaned up {deleted} old metric records")
        return deleted


def vacuum_database():
    """Run VACUUM to reclaim disk space and optimize database.
    VACUUM cannot run inside a transaction, so we use a separate connection."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.execute("VACUUM")
    conn.close()
    print(f"✨ Database VACUUMed - disk space reclaimed")


def get_api_key() -> str:
    """Get the API key from database"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM config WHERE key = 'api_key'")
        result = cursor.fetchone()
        return result['value'] if result else None


# Apps CRUD operations
def get_all_apps() -> List[Dict]:
    """Get all applications"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, description, url, icon FROM apps ORDER BY id")
        return [dict(row) for row in cursor.fetchall()]


def get_app_by_id(app_id: int) -> Optional[Dict]:
    """Get single app by ID"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, description, url, icon FROM apps WHERE id = ?", (app_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def create_app(name: str, description: str, url: str, icon: str) -> int:
    """Create new application"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO apps (name, description, url, icon) VALUES (?, ?, ?, ?)",
            (name, description, url, icon)
        )
        return cursor.lastrowid


def update_app(app_id: int, name: str, description: str, url: str, icon: str) -> bool:
    """Update existing application"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE apps SET name = ?, description = ?, url = ?, icon = ? WHERE id = ?",
            (name, description, url, icon, app_id)
        )
        return cursor.rowcount > 0


def delete_app(app_id: int) -> bool:
    """Delete application"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM apps WHERE id = ?", (app_id,))
        return cursor.rowcount > 0


# Healthchecks CRUD operations
def get_all_healthchecks() -> List[Dict]:
    """Get all healthchecks"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, type, check_url, models_url, show_models FROM healthchecks ORDER BY id")
        return [dict(row) for row in cursor.fetchall()]


def get_healthcheck_by_id(check_id: str) -> Optional[Dict]:
    """Get single healthcheck by ID"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, type, check_url, models_url, show_models FROM healthchecks WHERE id = ?",
            (check_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def create_healthcheck(check_id: str, name: str, type_: str, check_url: str, 
                       models_url: Optional[str] = None, show_models: bool = False) -> str:
    """Create new healthcheck"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO healthchecks (id, name, type, check_url, models_url, show_models) VALUES (?, ?, ?, ?, ?, ?)",
            (check_id, name, type_, check_url, models_url, 1 if show_models else 0)
        )
        return check_id


def update_healthcheck(check_id: str, name: str, type_: str, check_url: str,
                       models_url: Optional[str] = None, show_models: bool = False) -> bool:
    """Update existing healthcheck"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE healthchecks SET name = ?, type = ?, check_url = ?, models_url = ?, show_models = ? WHERE id = ?",
            (name, type_, check_url, models_url, 1 if show_models else 0, check_id)
        )
        return cursor.rowcount > 0


def delete_healthcheck(check_id: str) -> bool:
    """Delete healthcheck"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM healthchecks WHERE id = ?", (check_id,))
        return cursor.rowcount > 0


def save_healthcheck_result(check_id: str, status: str, message: str, 
                            models: Optional[str] = None, response_time_ms: Optional[int] = None) -> int:
    """Save healthcheck result to cache"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO healthcheck_results (check_id, status, message, models, response_time_ms) VALUES (?, ?, ?, ?, ?)",
            (check_id, status, message, models, response_time_ms)
        )
        return cursor.lastrowid


def get_latest_healthcheck_results() -> List[Dict]:
    """Get latest healthcheck result for each check_id"""
    with get_db() as conn:
        cursor = conn.cursor()
        # Get latest result for each check_id using GROUP BY and MAX
        cursor.execute("""
            SELECT hr.check_id, hr.status, hr.message, hr.models, hr.response_time_ms, hr.checked_at,
                   hc.name, hc.type, hc.check_url, hc.show_models
            FROM healthcheck_results hr
            INNER JOIN healthchecks hc ON hr.check_id = hc.id
            WHERE hr.id IN (
                SELECT MAX(id) FROM healthcheck_results GROUP BY check_id
            )
            ORDER BY hr.checked_at DESC
        """)
        results = []
        for row in cursor.fetchall():
            result = dict(row)
            # Parse models JSON if present
            if result.get('models'):
                try:
                    result['models'] = json.loads(result['models'])
                except:
                    result['models'] = []
            else:
                result['models'] = []
            
            # Convert show_models from int (0/1) to bool
            result['show_models'] = bool(result.get('show_models', 0))
            
            results.append(result)
        return results


def cleanup_old_healthcheck_results(days: int = 7) -> int:
    """Delete healthcheck results older than N days"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM healthcheck_results WHERE checked_at < datetime('now', '-' || ? || ' days')",
            (days,)
        )
        return cursor.rowcount


# Alias for compatibility
def get_apps():
    """Alias for get_all_apps()"""
    return get_all_apps()


def save_app_status(app_id: int, status: str, response_time_ms: Optional[int] = None) -> int:
    """Save app status to cache"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO app_status_cache (app_id, status, response_time_ms) VALUES (?, ?, ?)",
            (app_id, status, response_time_ms)
        )
        return cursor.lastrowid


def get_apps_with_status() -> List[Dict]:
    """Get all apps with their latest status"""
    with get_db() as conn:
        cursor = conn.cursor()
        # Join apps with latest status from cache
        cursor.execute("""
            SELECT a.id, a.name, a.description, a.url, a.icon,
                   COALESCE(acs.status, 'unknown') as status,
                   acs.response_time_ms,
                   acs.checked_at
            FROM apps a
            LEFT JOIN app_status_cache acs ON a.id = acs.app_id
                AND acs.id = (SELECT MAX(id) FROM app_status_cache WHERE app_id = a.id)
            ORDER BY a.id
        """)
        return [dict(row) for row in cursor.fetchall()]


def cleanup_old_app_status(days: int = 7) -> int:
    """Delete app status older than N days"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM app_status_cache WHERE checked_at < datetime('now', '-' || ? || ' days')",
            (days,)
        )
        return cursor.rowcount


# Events functions for activity feed
def save_event(type_: str, severity: str, source: str, message: str) -> int:
    """Save an event to the activity feed.
    
    type_: 'healthcheck', 'app', 'system', 'docker'
    severity: 'error', 'warning', 'success', 'info'
    source: name of the service/app/metric that triggered the event
    message: human-readable description
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO events (type, severity, source, message) VALUES (?, ?, ?, ?)",
            (type_, severity, source, message)
        )
        return cursor.lastrowid


def get_events(limit: int = 50, type_filter: str = None) -> List[Dict]:
    """Get recent events for the activity feed"""
    with get_db() as conn:
        cursor = conn.cursor()
        if type_filter:
            cursor.execute(
                "SELECT id, timestamp, type, severity, source, message FROM events WHERE type = ? ORDER BY timestamp DESC LIMIT ?",
                (type_filter, limit)
            )
        else:
            cursor.execute(
                "SELECT id, timestamp, type, severity, source, message FROM events ORDER BY timestamp DESC LIMIT ?",
                (limit,)
            )
        return [dict(row) for row in cursor.fetchall()]


def cleanup_old_events(days: int = 30) -> int:
    """Delete events older than N days"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM events WHERE timestamp < datetime('now', '-' || ? || ' days')",
            (days,)
        )
        return cursor.rowcount
