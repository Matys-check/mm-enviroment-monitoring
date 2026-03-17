"""
Admin routes - authentication and CRUD operations.
"""
from fastapi import APIRouter, HTTPException, Depends
import database as db
from models.schemas import LoginRequest, AppCreate, AppUpdate, HealthcheckCreate, HealthcheckUpdate
from utils.auth import verify_api_key
from config import ADMIN_PASSWORD

router = APIRouter()


@router.post("/api/admin/login")
async def admin_login(request: LoginRequest):
    """Admin login"""
    if request.password == ADMIN_PASSWORD:
        api_key = db.get_api_key()
        return {"success": True, "api_key": api_key}
    else:
        raise HTTPException(status_code=401, detail="Invalid password")


# Apps management (protected)
@router.post("/api/admin/apps", dependencies=[Depends(verify_api_key)])
async def create_app_endpoint(app: AppCreate):
    """Create new application"""
    app_id = db.create_app(app.name, app.description, app.url, app.icon)
    return {"success": True, "id": app_id, "message": "Application created"}


@router.put("/api/admin/apps/{app_id}", dependencies=[Depends(verify_api_key)])
async def update_app_endpoint(app_id: int, app: AppUpdate):
    """Update existing application"""
    success = db.update_app(app_id, app.name, app.description, app.url, app.icon)
    if success:
        return {"success": True, "message": "Application updated"}
    else:
        raise HTTPException(status_code=404, detail="Application not found")


@router.delete("/api/admin/apps/{app_id}", dependencies=[Depends(verify_api_key)])
async def delete_app_endpoint(app_id: int):
    """Delete application"""
    success = db.delete_app(app_id)
    if success:
        return {"success": True, "message": "Application deleted"}
    else:
        raise HTTPException(status_code=404, detail="Application not found")


# Healthchecks management (protected)
@router.post("/api/admin/healthchecks", dependencies=[Depends(verify_api_key)])
async def create_healthcheck_endpoint(healthcheck: HealthcheckCreate):
    """Create new healthcheck"""
    check_id = db.create_healthcheck(
        healthcheck.id,
        healthcheck.name,
        healthcheck.type,
        healthcheck.check_url,
        healthcheck.models_url,
        healthcheck.show_models
    )
    return {"success": True, "id": check_id, "message": "Healthcheck created"}


@router.put("/api/admin/healthchecks/{check_id}", dependencies=[Depends(verify_api_key)])
async def update_healthcheck_endpoint(check_id: str, healthcheck: HealthcheckUpdate):
    """Update existing healthcheck"""
    success = db.update_healthcheck(
        check_id,
        healthcheck.name,
        healthcheck.type,
        healthcheck.check_url,
        healthcheck.models_url,
        healthcheck.show_models
    )
    if success:
        return {"success": True, "message": "Healthcheck updated"}
    else:
        raise HTTPException(status_code=404, detail="Healthcheck not found")


@router.delete("/api/admin/healthchecks/{check_id}", dependencies=[Depends(verify_api_key)])
async def delete_healthcheck_endpoint(check_id: str):
    """Delete healthcheck"""
    success = db.delete_healthcheck(check_id)
    if success:
        return {"success": True, "message": "Healthcheck deleted"}
    else:
        raise HTTPException(status_code=404, detail="Healthcheck not found")
