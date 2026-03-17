"""
System monitoring routes
"""
from fastapi import APIRouter
import asyncio
import time
import psutil
import heapq
import database as db
from config import CPU_CACHE_TTL, PROCESSES_CACHE_TTL, DOCKER_CACHE_TTL

router = APIRouter()

# Import get_gpu_info from background_tasks
from services.background_tasks import get_gpu_info, _cpu_cache

# Cache variables
_network_cache = {"timestamp": 0, "bytes_sent": 0, "bytes_recv": 0}
_docker_cache = {"timestamp": 0, "data": {"available": False}}
_processes_cache = {"timestamp": 0, "data": {"top_cpu": [], "top_ram": []}}
_history_cache = {
    "1h": {"timestamp": 0, "data": []},
    "6h": {"timestamp": 0, "data": []},
    "24h": {"timestamp": 0, "data": []},
    "7d": {"timestamp": 0, "data": []},
    "14d": {"timestamp": 0, "data": []},
}


@router.get("/api/system/metrics")
async def get_system_metrics():
    """
    Get current system metrics (CPU, RAM, Disk, GPU)
    Cache: 2s for CPU, instant for RAM/Disk, from get_gpu_info for GPU
    """
    return await _build_metrics_response()


@router.get("/api/system/metrics_live")
async def get_system_metrics_live():
    """
    🚀 Combined endpoint: metrics + network in ONE request.
    Both are lightweight (<5ms) and polled at the same 5s interval.
    Processes excluded - they're heavy (50-500ms) and polled separately at 30s.
    """
    metrics = await _build_metrics_response()
    network = _build_network_response()
    
    return {
        "metrics": metrics,
        "network": network
    }


async def _build_metrics_response():
    global _cpu_cache
    
    current_time = time.time()
    
    try:
        # CPU - cache 2s
        if current_time - _cpu_cache["last_measure"] > CPU_CACHE_TTL:
            psutil.cpu_percent(interval=None)
            await asyncio.sleep(0.1)
            cpu_percent = psutil.cpu_percent(interval=None)
            _cpu_cache["value"] = cpu_percent
            _cpu_cache["last_measure"] = current_time
        else:
            cpu_percent = _cpu_cache["value"]
        
        # RAM
        memory = psutil.virtual_memory()
        
        # Disk
        disk = psutil.disk_usage('/')
        
        # GPU
        gpu_data = get_gpu_info()
        
        return {
            "cpu": {
                "percent": round(cpu_percent, 1),
                "status": "healthy" if cpu_percent < 80 else "warning" if cpu_percent < 95 else "critical"
            },
            "ram": {
                "percent": round(memory.percent, 1),
                "used_gb": round(memory.used / (1024 ** 3), 2),
                "total_gb": round(memory.total / (1024 ** 3), 2),
                "status": "healthy" if memory.percent < 80 else "warning" if memory.percent < 95 else "critical"
            },
            "disk": {
                "percent": round(disk.percent, 1),
                "used_gb": round(disk.used / (1024 ** 3), 2),
                "total_gb": round(disk.total / (1024 ** 3), 2),
                "status": "healthy" if disk.percent < 80 else "warning" if disk.percent < 95 else "critical"
            },
            "gpu": gpu_data
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/api/system/processes")
async def get_system_processes():
    """
    Get top CPU and RAM processes
    Cache: 30s (expensive operation on Windows)
    """
    return _build_processes_response()


def _build_processes_response():
    """Get top CPU and RAM processes (cached 30s)"""
    global _processes_cache
    
    current_time = time.time()
    
    try:
        if current_time - _processes_cache["timestamp"] > PROCESSES_CACHE_TTL:
            cpu_count = psutil.cpu_count()
            processes = []
            
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'memory_info']):
                try:
                    pinfo = proc.info
                    cpu_normalized = (pinfo['cpu_percent'] or 0) / cpu_count if cpu_count else 0
                    processes.append({
                        'pid': pinfo['pid'],
                        'name': pinfo['name'],
                        'cpu_percent': cpu_normalized,
                        'memory_mb': (pinfo['memory_info'].rss / (1024 * 1024)) if pinfo.get('memory_info') else 0
                    })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            # OPTIMIZED: heapq.nlargest
            top_cpu_list = heapq.nlargest(10, processes, key=lambda x: x['cpu_percent'])
            top_ram_list = heapq.nlargest(10, processes, key=lambda x: x['memory_mb'])
            
            _processes_cache["data"] = {
                "top_cpu": [{"pid": p['pid'], "name": p['name'], "cpu_percent": round(p['cpu_percent'], 1)} 
                           for p in top_cpu_list],  # Show all, even 0%
                "top_ram": [{"pid": p['pid'], "name": p['name'], "memory_mb": round(p['memory_mb'], 1)} 
                           for p in top_ram_list if p['memory_mb'] > 0]
            }
            _processes_cache["timestamp"] = current_time
        
        return _processes_cache["data"]
    except Exception as e:
        return {"error": str(e), "top_cpu": [], "top_ram": []}


@router.get("/api/system/network")
async def get_system_network():
    """
    Get network speed (upload/download)
    No cache - calculates speed from deltas
    """
    return _build_network_response()


def _build_network_response():
    global _network_cache
    
    current_time = time.time()
    
    try:
        net_io = psutil.net_io_counters()
        
        upload_speed = 0.0
        download_speed = 0.0
        
        if _network_cache["timestamp"] > 0:
            time_diff = current_time - _network_cache["timestamp"]
            if time_diff > 0:
                bytes_sent_diff = net_io.bytes_sent - _network_cache["bytes_sent"]
                bytes_recv_diff = net_io.bytes_recv - _network_cache["bytes_recv"]
                
                upload_speed = (bytes_sent_diff / time_diff) / (1024 * 1024)
                download_speed = (bytes_recv_diff / time_diff) / (1024 * 1024)
        
        _network_cache = {
            "timestamp": current_time,
            "bytes_sent": net_io.bytes_sent,
            "bytes_recv": net_io.bytes_recv
        }
        
        return {
            "upload_speed": round(upload_speed, 2),
            "download_speed": round(download_speed, 2),
            "has_speed": _network_cache["timestamp"] > 0
        }
    except Exception as e:
        return {"error": str(e), "has_speed": False}


@router.get("/api/system/docker")
async def get_system_docker():
    """
    Get Docker containers info
    Cache: 120s (very slow on some systems)
    """
    global _docker_cache
    
    current_time = time.time()
    
    try:
        if current_time - _docker_cache["timestamp"] > DOCKER_CACHE_TTL:
            try:
                import docker
                client = docker.from_env()
                
                containers = []
                for container in client.containers.list(all=True):
                    containers.append({
                        "id": container.short_id,
                        "name": container.name,
                        "status": container.status,
                        "image": container.image.tags[0] if container.image.tags else "unknown"
                    })
                
                _docker_cache["data"] = {
                    "available": True,
                    "containers": containers
                }
            except Exception as e:
                _docker_cache["data"] = {
                    "available": False,
                    "error": str(e)
                }
            _docker_cache["timestamp"] = current_time
        
        return _docker_cache["data"]
    except Exception as e:
        return {"available": False, "error": str(e)}


@router.get("/api/system/metrics/history")
async def get_metrics_history(range: str = "1h"):
    """
    Get historical metrics for charts
    Cache TTL = granulation time (when next data point appears)
    - 1h: cache 5min (granulation 5min)
    - 6h: cache 30min (granulation 30min)
    - 24h: cache 2h (granulation 2h)
    - 7d: cache 12h (granulation 12h)
    """
    global _history_cache
    
    current_time = time.time()
    
    # Validate range
    if range not in _history_cache:
        range = "1h"
    
    # Cache TTL = granulation time (in seconds)
    cache_ttl_map = {
        "1h": 300,     # 5 minutes
        "6h": 1800,    # 30 minutes
        "24h": 7200,   # 2 hours
        "7d": 43200,   # 12 hours
        "14d": 86400,  # 24 hours
    }
    cache_ttl = cache_ttl_map.get(range, 300)
    
    # Return cached data if still fresh
    if current_time - _history_cache[range]["timestamp"] < cache_ttl:
        return {
            "range": range,
            "points": len(_history_cache[range]["data"]),
            "data": _history_cache[range]["data"]
        }
    
    # Fetch from database
    metrics = db.get_metrics_history(range_key=range)
    
    # Only cache non-empty results (don't lock in empty data for 5 min after cold start)
    if metrics:
        _history_cache[range] = {
            "timestamp": current_time,
            "data": metrics
        }
    
    return {
        "range": range,
        "points": len(metrics),
        "data": metrics
    }
