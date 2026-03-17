"""
Caching utilities for IP address and status tracking.
"""
import socket
import time
import logging
from typing import Dict
from config import IP_CACHE_TTL

logger = logging.getLogger(__name__)

# Global cache for IP address
ip_cache: Dict[str, any] = {"ip": None, "expires": 0}

# Status tracking for change detection (save only on change)
last_healthcheck_statuses: Dict[str, str] = {}  # {check_id: status}
last_app_statuses: Dict[int, str] = {}  # {app_id: status}


async def get_cached_ip() -> str:
    """Get local IP with cache"""
    global ip_cache
    if time.time() > ip_cache["expires"]:
        try:
            # Get local IP address from system
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            ip_cache["ip"] = local_ip
            ip_cache["expires"] = time.time() + IP_CACHE_TTL
        except Exception as e:
            logger.error(f"⚠️  Error fetching IP: {e}")
            ip_cache["ip"] = "127.0.0.1"
            ip_cache["expires"] = time.time() + IP_CACHE_TTL
    return ip_cache["ip"]
