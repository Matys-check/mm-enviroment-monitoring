"""
Authentication and authorization utilities.
"""
from fastapi import HTTPException, Header
import database as db


async def verify_api_key(x_api_key: str = Header(...)):
    """Verify API key from header"""
    stored_key = db.get_api_key()
    if not stored_key or x_api_key != stored_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key
