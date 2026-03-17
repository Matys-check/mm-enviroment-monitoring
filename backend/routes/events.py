"""
Events routes - activity feed endpoint.
"""
from fastapi import APIRouter
from typing import Optional
import database as db

router = APIRouter()


@router.get("/api/events")
async def get_events(limit: int = 50, type: Optional[str] = None):
    """
    Get recent events for activity feed.
    
    Query params:
    - limit: max events to return (default 50)
    - type: filter by type (healthcheck, app, system, docker)
    """
    events = db.get_events(limit=limit, type_filter=type)
    return {
        "events": events,
        "total": len(events)
    }
