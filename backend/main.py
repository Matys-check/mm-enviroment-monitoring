"""
SandboxAI Dashboard - Main FastAPI application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging
import asyncio
import database as db
from config import CORS_ORIGINS, API_TITLE, API_VERSION, ADMIN_PASSWORD, SERVER_HOST, SERVER_PORT
from routes import dashboard, system, admin, events
from services.background_tasks import start_background_tasks

# Configure logging with timestamps
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    # Startup
    logger.info("🚀 Starting SandboxAI Dashboard...")
    db.init_database()
    api_key = db.get_api_key()
    if api_key:
        logger.info(f"🔑 API Key: {api_key[:8]}...{api_key[-4:]}")
        logger.info(f"🔐 Admin Password: {'*' * len(ADMIN_PASSWORD)}")
    
    # Start background tasks
    start_background_tasks(app)
    
    # Prefetch processes cache so it's ready immediately
    logger.info("🔄 Pre-filling processes cache...")
    await asyncio.sleep(2)  # Give psutil time to measure CPU
    try:
        from routes.system import _build_processes_response
        _build_processes_response()
        logger.info("✅ Processes cache ready!")
    except Exception as e:
        logger.warning(f"⚠️  Could not prefill processes cache: {e}")
    
    logger.info("✅ Dashboard ready!")
    
    yield  # Application runs here
    
    # Shutdown (optional cleanup)
    logger.info("👋 Shutting down...")


# Create FastAPI app with lifespan
app = FastAPI(title=API_TITLE, version=API_VERSION, lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=("*" not in CORS_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include routers
app.include_router(dashboard.router)
app.include_router(system.router)
app.include_router(admin.router)
app.include_router(events.router)


@app.get("/")
async def root():
    """Root endpoint - API info"""
    return {
        "name": API_TITLE,
        "version": API_VERSION,
        "status": "running",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT)
