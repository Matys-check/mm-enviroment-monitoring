// API configuration
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// Design tokens (mirror CSS variables for JS usage)
export const T = {
  bg: '#0a0e1a',
  bgElevated: '#0f1424',
  bgCard: 'rgba(255,255,255,0.025)',
  bgCardHover: 'rgba(255,255,255,0.05)',
  bgInput: 'rgba(255,255,255,0.04)',

  border: 'rgba(255,255,255,0.06)',
  borderHover: 'rgba(255,255,255,0.12)',
  borderFocus: 'rgba(99,102,241,0.5)',

  text: '#e8edf5',
  textDim: '#5b6480',
  textMid: '#8892ab',

  accent: '#6366f1',
  accentGlow: 'rgba(99,102,241,0.25)',
  accentSurface: 'rgba(99,102,241,0.08)',

  green: '#22c55e',
  greenGlow: 'rgba(34,197,94,0.3)',
  greenSurface: 'rgba(34,197,94,0.1)',

  red: '#ef4444',
  redGlow: 'rgba(239,68,68,0.3)',
  redSurface: 'rgba(239,68,68,0.1)',

  amber: '#f59e0b',
  amberGlow: 'rgba(245,158,11,0.3)',
  amberSurface: 'rgba(245,158,11,0.1)',

  cyan: '#06b6d4',
  purple: '#a78bfa',
  white: '#ffffff',
};

export const font = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
export const mono = "'JetBrains Mono', 'Fira Code', monospace";

// Status helpers
export const getStatusColor = (status) => {
  switch (status) {
    case 'healthy': return T.green;
    case 'unhealthy': return T.red;
    case 'degraded': return T.amber;
    default: return T.textDim;
  }
};

export const getStatusGlow = (status) => {
  switch (status) {
    case 'healthy': return T.greenGlow;
    case 'unhealthy': return T.redGlow;
    case 'degraded': return T.amberGlow;
    default: return 'transparent';
  }
};

export const getStatusSurface = (status) => {
  switch (status) {
    case 'healthy': return T.greenSurface;
    case 'unhealthy': return T.redSurface;
    case 'degraded': return T.amberSurface;
    default: return T.bgCard;
  }
};

export const getStatusLabel = (status) => {
  switch (status) {
    case 'healthy': return 'Healthy';
    case 'unhealthy': return 'Unhealthy';
    case 'degraded': return 'Degraded';
    default: return 'Checking...';
  }
};

export const getMetricColor = (percent) => {
  if (percent < 60) return T.green;
  if (percent < 80) return T.amber;
  return T.red;
};

// Extract port from URL
export const getPortFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    if (urlObj.port) return urlObj.port;
    return urlObj.protocol === 'https:' ? '443' : '80';
  } catch {
    return null;
  }
};

// Format timestamp for charts
export const formatTime = (timestamp) => {
  // Backend returns UTC timestamps — append 'Z' to ensure JS parses as UTC
  // then getHours/getMinutes will auto-convert to local timezone
  const date = new Date(timestamp.endsWith('Z') ? timestamp : timestamp + 'Z');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return { time: `${hours}:${minutes}`, date: `${day}.${month}` };
};
