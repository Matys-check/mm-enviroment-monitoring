"""
System monitoring service for CPU, RAM, GPU, etc.
"""
import psutil
import subprocess
from typing import Dict, List, Any
from config import GPU_CHECK_TIMEOUT


def get_system_resources() -> Dict[str, Any]:
    """Get current system resources (CPU, RAM, Disk, GPU)"""
    # CPU
    cpu_percent = psutil.cpu_percent(interval=0.1)
    
    # Memory
    memory = psutil.virtual_memory()
    memory_data = {
        "percent": memory.percent,
        "used_gb": round(memory.used / (1024**3), 2),
        "total_gb": round(memory.total / (1024**3), 2)
    }
    
    # Disk
    disk = psutil.disk_usage('/')
    disk_data = {
        "percent": disk.percent,
        "used_gb": round(disk.used / (1024**3), 2),
        "total_gb": round(disk.total / (1024**3), 2)
    }
    
    # GPU (try nvidia-smi)
    gpu_data = {"percent": 0, "memory_used_mb": 0, "memory_total_mb": 0}
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total', 
             '--format=csv,noheader,nounits'],
            capture_output=True,
            text=True,
            timeout=GPU_CHECK_TIMEOUT
        )
        if result.returncode == 0:
            values = result.stdout.strip().split(',')
            gpu_data = {
                "percent": float(values[0]),
                "memory_used_mb": float(values[1]),
                "memory_total_mb": float(values[2])
            }
    except:
        pass
    
    return {
        "cpu_percent": cpu_percent,
        "memory": memory_data,
        "disk": disk_data,
        "gpu": gpu_data
    }
