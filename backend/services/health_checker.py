"""
Health checking services for Ollama and HTTP endpoints.
"""
import httpx
import logging

logger = logging.getLogger(__name__)


async def check_ollama_health_internal(config, client: httpx.AsyncClient):
    """Internal function for checking Ollama health"""
    try:
        # Check if Ollama is running
        response = await client.get(config["check_url"])
        if response.status_code == 200 and "Ollama is running" in response.text:
            result = {"id": config["id"], "status": "healthy", "message": "Ollama is running"}
            
            # Fetch models if show_models is enabled (check for 1 or True)
            if config.get("show_models") == 1 or config.get("show_models") is True:
                try:
                    # Use custom models_url if provided, otherwise auto-build from check_url
                    if config.get("models_url"):
                        models_url = config["models_url"]
                    else:
                        check_url = config["check_url"].rstrip('/')
                        from urllib.parse import urlparse
                        parsed = urlparse(check_url)
                        base_url = f"{parsed.scheme}://{parsed.netloc}"
                        models_url = f"{base_url}/api/tags"
                    
                    models_response = await client.get(models_url)
                    if models_response.status_code == 200:
                        models_data = models_response.json()
                        result["models"] = [model["name"] for model in models_data.get("models", [])]
                    else:
                        result["models"] = []
                except Exception as e:
                    logger.error(f"Error fetching models: {e}")
                    result["models"] = []
            else:
                result["models"] = []
            
            return result
        else:
            return {"id": config["id"], "status": "unhealthy", "message": "Ollama not responding properly", "models": []}
    except Exception as e:
        return {"id": config["id"], "status": "unhealthy", "message": f"Connection failed: {str(e)}", "models": []}


async def check_http_health_internal(config, client: httpx.AsyncClient):
    """Internal function for checking HTTP health"""
    try:
        response = await client.get(config["check_url"])
        if response.status_code < 500:
            return {
                "id": config["id"],
                "status": "healthy",
                "message": f"HTTP {response.status_code}",
                "models": []
            }
        else:
            return {
                "id": config["id"],
                "status": "unhealthy",
                "message": f"HTTP {response.status_code}",
                "models": []
            }
    except Exception as e:
        return {
            "id": config["id"],
            "status": "unhealthy",
            "message": f"Connection failed: {str(e)}",
            "models": []
        }
