"""
Background task services for healthchecks, apps, and cleanup.
"""
import asyncio
import time
import json
import logging
import httpx
import psutil
from queue import Queue, Empty
from threading import Thread
import database as db
from services.health_checker import check_ollama_health_internal, check_http_health_internal
from utils.cache import last_healthcheck_statuses, last_app_statuses
from config import (
    HEALTHCHECK_TIMEOUT, APP_CHECK_TIMEOUT, GPU_CHECK_TIMEOUT,
    HEALTHCHECK_INTERVAL, METRICS_INTERVAL, CLEANUP_INTERVAL, DOCKER_MONITOR_INTERVAL,
    CPU_CACHE_TTL, SPIKE_THRESHOLD_PERCENT, SPIKE_HYSTERESIS,
    HEALTHCHECK_RETENTION_DAYS, APP_STATUS_RETENTION_DAYS, METRICS_RETENTION_DAYS, EVENTS_RETENTION_DAYS,
)

logger = logging.getLogger(__name__)

# CPU cache for metrics (avoid blocking calls)
_cpu_cache = {"last_measure": 0, "value": 0}

# Write queue for async database writes
_write_queue = Queue()
_writer_running = False


def start_async_writer():
    """Start background thread for async database writes"""
    global _writer_running
    _writer_running = True

    def writer_loop():
        logger.info("📝 Async writer started - handling database writes in background")
        while _writer_running:
            try:
                write_func, args, kwargs = _write_queue.get(timeout=0.5)
                write_func(*args, **kwargs)
                _write_queue.task_done()
            except Empty:
                continue
            except Exception as e:
                logger.error(f"Error in async writer: {e}")

    writer_thread = Thread(target=writer_loop, daemon=True)
    writer_thread.start()


def queue_write(func, *args, **kwargs):
    """Add write operation to async queue"""
    _write_queue.put((func, args, kwargs))


def get_gpu_info():
    """Get GPU information (nvidia-smi)"""
    try:
        import subprocess
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total', 
             '--format=csv,noheader,nounits'],
            capture_output=True,
            text=True,
            timeout=GPU_CHECK_TIMEOUT
        )
        
        if result.returncode == 0:
            values = result.stdout.strip().split(',')
            gpu_percent = float(values[0].strip())
            gpu_mem_used_mb = float(values[1].strip())
            gpu_mem_total_mb = float(values[2].strip())
            gpu_mem_percent = (gpu_mem_used_mb / gpu_mem_total_mb * 100) if gpu_mem_total_mb > 0 else 0
            
            return {
                "available": True,
                "utilization": round(gpu_percent, 1),
                "memory_used_mb": round(gpu_mem_used_mb, 1),
                "memory_total_mb": round(gpu_mem_total_mb, 1),
                "memory_percent": round(gpu_mem_percent, 1)
            }
        else:
            return {"available": False}
    except Exception:
        return {"available": False}


async def check_all_healthchecks_and_save():
    """Check all healthchecks in PARALLEL and save results to database"""
    healthchecks = db.get_all_healthchecks()
    if not healthchecks:
        return
        
    logger.info(f"🔍 Checking {len(healthchecks)} healthchecks...")
    
    # Single shared client for all checks (reuses TCP connections!)
    async with httpx.AsyncClient(timeout=HEALTHCHECK_TIMEOUT) as client:
        async def check_single(check):
            start_time = time.time()
            try:
                if check["type"] == "ollama":
                    result = await check_ollama_health_internal(check, client)
                elif check["type"] == "http":
                    result = await check_http_health_internal(check, client)
                else:
                    result = {"status": "error", "message": "Unknown type", "models": []}
                
                response_time_ms = int((time.time() - start_time) * 1000)
                current_status = result.get("status", "unhealthy")
                last_status = last_healthcheck_statuses.get(check["id"])
                
                if current_status != last_status:
                    models_json = json.dumps(result.get("models", []))
                    queue_write(
                        db.save_healthcheck_result,
                        check_id=check["id"],
                        status=current_status,
                        message=result.get("message", ""),
                        models=models_json,
                        response_time_ms=response_time_ms
                    )
                    last_healthcheck_statuses[check["id"]] = current_status
                    logger.info(f"  ✅ {check['name']}: {current_status} ({response_time_ms}ms) [STATUS CHANGED]")
                    
                    # Log event for activity feed
                    if last_status is not None:  # Skip initial detection
                        if current_status == "healthy":
                            queue_write(db.save_event, type_="healthcheck", severity="success",
                                        source=check["name"], message=f"{check['name']} recovered — {result.get('message', 'OK')}")
                        elif current_status == "unhealthy":
                            queue_write(db.save_event, type_="healthcheck", severity="error",
                                        source=check["name"], message=f"{check['name']} went offline — {result.get('message', 'Failed')}")
                        else:
                            queue_write(db.save_event, type_="healthcheck", severity="warning",
                                        source=check["name"], message=f"{check['name']} status changed to {current_status}")
                else:
                    logger.debug(f"  ➡️  {check['name']}: {current_status} ({response_time_ms}ms) [no change]")
                
            except Exception as e:
                if last_healthcheck_statuses.get(check["id"]) != "unhealthy":
                    queue_write(
                        db.save_healthcheck_result,
                        check_id=check["id"],
                        status="unhealthy",
                        message=f"Error: {str(e)}",
                        models="[]",
                        response_time_ms=None
                    )
                    # Log event
                    if last_healthcheck_statuses.get(check["id"]) is not None:
                        queue_write(db.save_event, type_="healthcheck", severity="error",
                                    source=check["name"], message=f"{check['name']} went offline — {str(e)}")
                    last_healthcheck_statuses[check["id"]] = "unhealthy"
                    logger.error(f"  ❌ {check['name']}: Error - {e} [STATUS CHANGED]")
                else:
                    logger.debug(f"  ❌ {check['name']}: Still unhealthy - {e}")
        
        # Run all checks in parallel with shared client!
        await asyncio.gather(*[check_single(check) for check in healthchecks])


async def check_all_apps_and_save():
    """Check all apps status in PARALLEL and save to database"""
    apps = db.get_all_apps()
    if not apps:
        return
    
    logger.info(f"📱 Checking {len(apps)} apps...")
    
    # Single shared client for all app checks
    async with httpx.AsyncClient(timeout=APP_CHECK_TIMEOUT) as client:
        async def check_single_app(app):
            start_time = time.time()
            
            try:
                response = await client.head(app["url"])
                status = "healthy" if response.status_code < 500 else "unhealthy"
            except Exception as e:
                status = "unhealthy"
                logger.debug(f"  ❌ {app['name']}: Connection failed - {str(e)}")
            
            response_time_ms = int((time.time() - start_time) * 1000)
            last_status = last_app_statuses.get(app["id"])
            
            if status != last_status:
                queue_write(
                    db.save_app_status,
                    app_id=app["id"],
                    status=status,
                    response_time_ms=response_time_ms
                )
                last_app_statuses[app["id"]] = status
                logger.info(f"  ✅ {app['name']}: {status} ({response_time_ms}ms) [STATUS CHANGED]")
                
                # Log event for activity feed
                if last_status is not None:  # Skip initial detection
                    if status == "healthy":
                        queue_write(db.save_event, type_="app", severity="success",
                                    source=app["name"], message=f"{app['name']} is back online ({response_time_ms}ms)")
                    else:
                        queue_write(db.save_event, type_="app", severity="error",
                                    source=app["name"], message=f"{app['name']} went offline")
            else:
                logger.debug(f"  ➡️  {app['name']}: {status} ({response_time_ms}ms) [no change]")
        
        # Run all checks in parallel with shared client!
        await asyncio.gather(*[check_single_app(app) for app in apps])


async def healthcheck_background_loop():
    """Background task that checks healthchecks every 30 seconds"""
    logger.info(f"🚀 Healthcheck loop starting ({HEALTHCHECK_INTERVAL}s interval, save on change only)")
    
    # IMMEDIATE check on startup (don't wait!)
    try:
        await check_all_healthchecks_and_save()
        await check_all_apps_and_save()
    except Exception as e:
        logger.error(f"Error in initial healthcheck: {e}")
    
    while True:
        await asyncio.sleep(HEALTHCHECK_INTERVAL)
        await check_all_healthchecks_and_save()
        await check_all_apps_and_save()


async def cleanup_background_loop():
    """Background task that cleans up old data every hour"""
    logger.info(f"🧹 Cleanup loop starting ({CLEANUP_INTERVAL}s interval, retention: hc={HEALTHCHECK_RETENTION_DAYS}d, apps={APP_STATUS_RETENTION_DAYS}d, metrics={METRICS_RETENTION_DAYS}d, events={EVENTS_RETENTION_DAYS}d)")
    
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL)
        
        # Cleanup old healthcheck results
        try:
            deleted = db.cleanup_old_healthcheck_results(days=HEALTHCHECK_RETENTION_DAYS)
            if deleted > 0:
                logger.info(f"🧹 Cleaned up {deleted} old healthcheck results (>{HEALTHCHECK_RETENTION_DAYS}d)")
        except Exception as e:
            logger.error(f"⚠️  Error cleaning healthcheck results: {e}")
        
        # Cleanup old app status
        try:
            deleted = db.cleanup_old_app_status(days=APP_STATUS_RETENTION_DAYS)
            if deleted > 0:
                logger.info(f"🧹 Cleaned up {deleted} old app status records (>{APP_STATUS_RETENTION_DAYS}d)")
        except Exception as e:
            logger.error(f"⚠️  Error cleaning app status: {e}")
        
        # Cleanup old metrics
        try:
            deleted_metrics = db.cleanup_old_metrics(days=METRICS_RETENTION_DAYS)
            if deleted_metrics > 0:
                logger.info(f"🧹 Cleaned up {deleted_metrics} old metrics (>{METRICS_RETENTION_DAYS}d)")
        except Exception as e:
            logger.error(f"⚠️  Error cleaning metrics: {e}")
        
        # Periodic VACUUM to reclaim disk space (runs after cleanup)
        try:
            db.vacuum_database()
        except Exception as e:
            logger.error(f"⚠️  Error running VACUUM: {e}")
        
        # Cleanup old events
        try:
            deleted_events = db.cleanup_old_events(days=EVENTS_RETENTION_DAYS)
            if deleted_events > 0:
                logger.info(f"🧹 Cleaned up {deleted_events} old events (>{EVENTS_RETENTION_DAYS}d)")
        except Exception as e:
            logger.error(f"⚠️  Error cleaning events: {e}")


async def metrics_background_loop():
    """Background task to save metrics every minute"""
    # Spike tracking - only fire event when crossing threshold
    _spike_state = {"cpu_spiking": False, "ram_spiking": False, "gpu_spiking": False}
    
    while True:
        try:
            await asyncio.sleep(METRICS_INTERVAL)
            
            # Fetch current metrics with CPU cache
            global _cpu_cache
            
            current_time = time.time()
            if current_time - _cpu_cache["last_measure"] > CPU_CACHE_TTL:
                psutil.cpu_percent(interval=None)
                await asyncio.sleep(0.1)
                cpu_percent = psutil.cpu_percent(interval=None)
                _cpu_cache["value"] = cpu_percent
                _cpu_cache["last_measure"] = current_time
            else:
                cpu_percent = _cpu_cache["value"]
            
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            gpu_data = get_gpu_info()
            
            # Save to database - ASYNC (don't block API calls!)
            queue_write(
                db.save_metrics,
                cpu_percent=cpu_percent,
                ram_percent=memory.percent,
                ram_used_gb=memory.used / (1024 ** 3),
                ram_total_gb=memory.total / (1024 ** 3),
                disk_percent=disk.percent,
                disk_used_gb=disk.used / (1024 ** 3),
                disk_total_gb=disk.total / (1024 ** 3),
                gpu_available=gpu_data.get("available", False),
                gpu_utilization=gpu_data.get("utilization", 0),
                gpu_memory_used_mb=gpu_data.get("memory_used_mb", 0),
                gpu_memory_total_mb=gpu_data.get("memory_total_mb", 0),
                gpu_memory_percent=gpu_data.get("memory_percent", 0)
            )
            
            # CPU spike detection
            if cpu_percent >= SPIKE_THRESHOLD_PERCENT and not _spike_state["cpu_spiking"]:
                _spike_state["cpu_spiking"] = True
                queue_write(db.save_event, type_="system", severity="warning",
                            source="CPU", message=f"CPU usage spiked to {cpu_percent:.1f}%")
            elif cpu_percent < SPIKE_THRESHOLD_PERCENT - SPIKE_HYSTERESIS and _spike_state["cpu_spiking"]:
                _spike_state["cpu_spiking"] = False
                queue_write(db.save_event, type_="system", severity="info",
                            source="CPU", message=f"CPU usage normalized to {cpu_percent:.1f}%")
            
            # RAM spike detection
            if memory.percent >= SPIKE_THRESHOLD_PERCENT and not _spike_state["ram_spiking"]:
                _spike_state["ram_spiking"] = True
                queue_write(db.save_event, type_="system", severity="warning",
                            source="RAM", message=f"RAM usage spiked to {memory.percent:.1f}% ({memory.used / (1024**3):.1f} GB)")
            elif memory.percent < SPIKE_THRESHOLD_PERCENT - SPIKE_HYSTERESIS and _spike_state["ram_spiking"]:
                _spike_state["ram_spiking"] = False
                queue_write(db.save_event, type_="system", severity="info",
                            source="RAM", message=f"RAM usage normalized to {memory.percent:.1f}%")
            
            # GPU spike detection
            if gpu_data.get("available") and gpu_data.get("memory_percent", 0) >= SPIKE_THRESHOLD_PERCENT and not _spike_state["gpu_spiking"]:
                _spike_state["gpu_spiking"] = True
                queue_write(db.save_event, type_="system", severity="warning",
                            source="GPU", message=f"GPU memory spiked to {gpu_data['memory_percent']:.1f}% ({gpu_data['memory_used_mb']:.0f} MB)")
            elif gpu_data.get("available") and gpu_data.get("memory_percent", 0) < SPIKE_THRESHOLD_PERCENT - SPIKE_HYSTERESIS and _spike_state["gpu_spiking"]:
                _spike_state["gpu_spiking"] = False
                queue_write(db.save_event, type_="system", severity="info",
                            source="GPU", message=f"GPU memory normalized to {gpu_data['memory_percent']:.1f}%")
                
        except Exception as e:
            logger.error(f"Error in metrics loop: {e}")
            await asyncio.sleep(METRICS_INTERVAL)


# Docker container tracking
_last_docker_containers = {}  # {name: status}

async def docker_monitor_loop():
    """Background task to monitor Docker container changes every 30s"""
    global _last_docker_containers

    while True:
        try:
            import docker as docker_lib
            client = docker_lib.from_env(timeout=10)
            
            current_containers = {}
            for container in client.containers.list(all=True):
                current_containers[container.name] = container.status
            
            # Detect changes (skip first run)
            if _last_docker_containers:
                # New containers
                for name, status in current_containers.items():
                    if name not in _last_docker_containers:
                        queue_write(db.save_event, type_="docker", severity="info",
                                    source=name, message=f"Container '{name}' appeared ({status})")
                    elif _last_docker_containers[name] != status:
                        if status == "running":
                            queue_write(db.save_event, type_="docker", severity="success",
                                        source=name, message=f"Container '{name}' started")
                        elif status == "exited":
                            queue_write(db.save_event, type_="docker", severity="error",
                                        source=name, message=f"Container '{name}' stopped")
                        else:
                            queue_write(db.save_event, type_="docker", severity="warning",
                                        source=name, message=f"Container '{name}' changed to {status}")
                
                # Removed containers
                for name in _last_docker_containers:
                    if name not in current_containers:
                        queue_write(db.save_event, type_="docker", severity="warning",
                                    source=name, message=f"Container '{name}' was removed")
            
            _last_docker_containers = current_containers
        except ImportError:
            pass  # Docker not installed
        except Exception as e:
            logger.debug(f"Docker monitor: {e}")

        await asyncio.sleep(DOCKER_MONITOR_INTERVAL)


def start_background_tasks(app):
    """Start all background tasks"""
    # Start async database writer (handles all writes in background)
    start_async_writer()
    
    # Log system start event
    queue_write(db.save_event, type_="system", severity="info",
                source="System", message="Dashboard started — monitoring active")
    
    # Start async loops
    asyncio.create_task(healthcheck_background_loop())
    asyncio.create_task(cleanup_background_loop())
    asyncio.create_task(metrics_background_loop())
    asyncio.create_task(docker_monitor_loop())
    logger.info("✅ Background tasks started (metrics, healthchecks, docker monitor, cleanup, async writer)")
