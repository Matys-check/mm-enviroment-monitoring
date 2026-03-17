"""
Dashboard routes - main endpoint and supporting endpoints.
"""
from fastapi import APIRouter
import time
import database as db
from utils.cache import get_cached_ip
from config import DASHBOARD_CACHE_TTL

router = APIRouter()

# In-memory cache for dashboard data (refreshed by background tasks)
_dashboard_cache = {"timestamp": 0, "data": None}


@router.get("/api/dashboard")
async def get_dashboard():
    """
    🚀 Single endpoint for dashboard - everything in ONE request!
    
    Returns cached data to avoid hitting DB on every poll.
    Background tasks refresh actual data every 30s.
    """
    global _dashboard_cache
    
    current_time = time.time()
    
    # Return cached response if fresh enough
    if _dashboard_cache["data"] and (current_time - _dashboard_cache["timestamp"]) < DASHBOARD_CACHE_TTL:
        return _dashboard_cache["data"]
    
    # Build fresh response
    apps_with_status = db.get_apps_with_status()
    healthcheck_results = db.get_latest_healthcheck_results()
    
    response = {
        "ip": await get_cached_ip(),
        "apps": apps_with_status,
        "healthchecks": healthcheck_results
    }
    
    # Cache it
    _dashboard_cache = {"timestamp": current_time, "data": response}
    
    return response


@router.get("/api/apps")
async def get_apps():
    """Get all apps (for Admin Panel)"""
    apps = db.get_all_apps()
    return {"apps": apps}


@router.get("/api/healthchecks")
async def get_healthchecks():
    """Get all healthchecks (for Admin Panel)"""
    healthchecks = db.get_all_healthchecks()
    # Convert show_models from int to bool for frontend
    for hc in healthchecks:
        hc['show_models'] = bool(hc['show_models'])
    return {"healthchecks": healthchecks}
