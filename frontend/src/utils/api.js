import { API_URL } from './theme';

async function apiFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`);
  return response.json();
}

export async function fetchDashboard() {
  return apiFetch(`${API_URL}/api/dashboard`);
}

export async function fetchApps() {
  return apiFetch(`${API_URL}/api/apps`);
}

export async function fetchHealthchecks() {
  return apiFetch(`${API_URL}/api/healthchecks`);
}

export async function fetchMetricsLive() {
  return apiFetch(`${API_URL}/api/system/metrics_live`);
}

export async function fetchHistory(range) {
  return apiFetch(`${API_URL}/api/system/metrics/history?range=${encodeURIComponent(range)}`);
}

export async function fetchProcesses() {
  return apiFetch(`${API_URL}/api/system/processes`);
}

export async function fetchDocker() {
  return apiFetch(`${API_URL}/api/system/docker`);
}

export async function fetchNetwork() {
  return apiFetch(`${API_URL}/api/system/network`);
}

export async function fetchEvents(limit = 50, type = null) {
  const params = new URLSearchParams({ limit });
  if (type) params.append('type', type);
  return apiFetch(`${API_URL}/api/events?${params}`);
}

export async function adminLogin(password) {
  const response = await fetch(`${API_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return { ok: response.ok, data: await response.json() };
}

export async function adminSaveApp(app, apiKey) {
  const method = app.id ? 'PUT' : 'POST';
  const url = app.id ? `${API_URL}/api/admin/apps/${app.id}` : `${API_URL}/api/admin/apps`;
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ name: app.name, description: app.description, url: app.url, icon: app.icon }),
  });
  return response.ok;
}

export async function adminDeleteApp(id, apiKey) {
  const response = await fetch(`${API_URL}/api/admin/apps/${id}`, {
    method: 'DELETE',
    headers: { 'x-api-key': apiKey },
  });
  return response.ok;
}

export async function adminSaveHealthcheck(hc, apiKey) {
  const method = hc.isNew ? 'POST' : 'PUT';
  const url = hc.isNew
    ? `${API_URL}/api/admin/healthchecks`
    : `${API_URL}/api/admin/healthchecks/${hc.id}`;
  const body = hc.isNew
    ? { id: hc.id, name: hc.name, type: hc.type, check_url: hc.check_url, models_url: hc.models_url || null, show_models: hc.show_models || false }
    : { name: hc.name, type: hc.type, check_url: hc.check_url, models_url: hc.models_url || null, show_models: hc.show_models || false };
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
  });
  return response.ok;
}

export async function adminDeleteHealthcheck(id, apiKey) {
  const response = await fetch(`${API_URL}/api/admin/healthchecks/${id}`, {
    method: 'DELETE',
    headers: { 'x-api-key': apiKey },
  });
  return response.ok;
}
