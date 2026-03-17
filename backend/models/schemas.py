"""
Pydantic models for request/response validation.
"""
from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    """Admin login request"""
    password: str


class AppCreate(BaseModel):
    """Create new application"""
    name: str
    description: str
    url: str
    icon: str


class AppUpdate(BaseModel):
    """Update existing application"""
    name: str
    description: str
    url: str
    icon: str


class HealthcheckCreate(BaseModel):
    """Create new healthcheck"""
    id: str
    name: str
    type: str
    check_url: str
    models_url: Optional[str] = None
    show_models: bool = False


class HealthcheckUpdate(BaseModel):
    """Update existing healthcheck"""
    name: str
    type: str
    check_url: str
    models_url: Optional[str] = None
    show_models: bool = False
