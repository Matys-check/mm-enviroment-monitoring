import React, { useState, useEffect, useRef } from 'react';
import { T, mono } from '../utils/theme';
import { fetchEvents } from '../utils/api';
import Header from '../components/common/Header';
import { Footer, LoadingScreen } from '../components/common/Shared';
import Card from '../components/common/Card';

const EVENT_TYPES = [
  { key: null, label: 'All', icon: '📋' },
  { key: 'healthcheck', label: 'Healthchecks', icon: '🔍' },
  { key: 'app', label: 'Applications', icon: '📱' },
  { key: 'system', label: 'System', icon: '💻' },
  { key: 'docker', label: 'Docker', icon: '🐳' },
];

const SEVERITY_CONFIG = {
  error: { color: T.red, surface: T.redSurface, icon: '🔴', label: 'Error' },
  warning: { color: T.amber, surface: T.amberSurface, icon: '⚠️', label: 'Warning' },
  success: { color: T.green, surface: T.greenSurface, icon: '✅', label: 'Success' },
  info: { color: T.accent, surface: T.accentSurface, icon: 'ℹ️', label: 'Info' },
};

function relativeTime(timestamp) {
  // timestamp is UTC from SQLite — parse as UTC
  const utcDate = new Date(timestamp + 'Z');
  const now = new Date();
  const diff = Math.floor((now - utcDate) / 1000);

  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTimestamp(timestamp) {
  const utcDate = new Date(timestamp + 'Z');
  return utcDate.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [now, setNow] = useState(Date.now()); // For relative time updates

  const loadEvents = async () => {
    try {
      const data = await fetchEvents(100, activeFilter);
      setEvents(data.events || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching events:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Events - SandboxAI';
    loadEvents();
  }, [activeFilter]);

  // Auto refresh every 15s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadEvents, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeFilter]);

  // Update relative times every 10s
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <LoadingScreen message="Ładowanie eventów..." />;

  // Group events by date
  const grouped = {};
  events.forEach((event) => {
    const utcDate = new Date(event.timestamp + 'Z');
    const dateKey = utcDate.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(event);
  });

  // Stats
  const stats = {
    total: events.length,
    errors: events.filter((e) => e.severity === 'error').length,
    warnings: events.filter((e) => e.severity === 'warning').length,
    today: events.filter((e) => {
      const d = new Date(e.timestamp + 'Z');
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, maxWidth: 1440, margin: '0 auto', padding: '28px 32px', width: '100%' }}>
        <div className="animate-fade-in">
          {/* Page header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>Activity Feed</h1>
              <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>
                Status changes, alerts, and system events
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Auto refresh toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: `1px solid ${autoRefresh ? T.green + '40' : T.border}`,
                  background: autoRefresh ? T.greenSurface : 'transparent',
                  color: autoRefresh ? T.green : T.textDim,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: autoRefresh ? T.green : T.textDim,
                  boxShadow: autoRefresh ? `0 0 6px ${T.greenGlow}` : 'none',
                }} />
                {autoRefresh ? 'Live' : 'Paused'}
              </button>
              {/* Refresh button */}
              <button
                onClick={loadEvents}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: 'transparent',
                  color: T.textMid,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <MiniStat label="Total Events" value={stats.total} color={T.accent} />
            <MiniStat label="Today" value={stats.today} color={T.text} />
            <MiniStat label="Errors" value={stats.errors} color={T.red} />
            <MiniStat label="Warnings" value={stats.warnings} color={T.amber} />
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 3 }}>
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.key || 'all'}
                  onClick={() => setActiveFilter(t.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: activeFilter === t.key ? T.accent : 'transparent',
                    color: activeFilter === t.key ? '#fff' : T.textDim,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Events timeline */}
          {events.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '48px 40px' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>No Events Yet</h3>
              <p style={{ fontSize: 13, color: T.textDim }}>
                Events will appear here when service statuses change, CPU/RAM spikes occur, or Docker containers start/stop.
              </p>
            </Card>
          ) : (
            Object.entries(grouped).map(([date, dayEvents]) => (
              <div key={date} style={{ marginBottom: 32 }}>
                {/* Date header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.textMid, textTransform: 'capitalize' }}>{date}</span>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <span style={{ fontFamily: mono, fontSize: 11, color: T.textDim }}>{dayEvents.length} events</span>
                </div>

                {/* Events list */}
                <Card style={{ padding: '4px 0' }}>
                  {dayEvents.map((event, i) => {
                    const sev = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.info;
                    return (
                      <div
                        key={event.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 14,
                          padding: '14px 20px',
                          borderBottom: i < dayEvents.length - 1 ? `1px solid ${T.border}` : 'none',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Time */}
                        <span style={{ fontFamily: mono, fontSize: 11, color: T.textDim, minWidth: 50, paddingTop: 2, flexShrink: 0 }}>
                          {new Date(event.timestamp + 'Z').toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {/* Severity dot */}
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                          background: sev.color, boxShadow: `0 0 6px ${sev.color}40`,
                        }} />

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{event.message}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            {/* Type badge */}
                            <span style={{
                              fontFamily: mono, fontSize: 10, color: T.textDim,
                              background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 4,
                            }}>
                              {event.type}
                            </span>
                            {/* Source badge */}
                            <span style={{
                              fontFamily: mono, fontSize: 10, color: T.accent,
                              background: T.accentSurface, padding: '2px 8px', borderRadius: 4,
                            }}>
                              {event.source}
                            </span>
                          </div>
                        </div>

                        {/* Relative time */}
                        <span style={{ fontFamily: mono, fontSize: 10, color: T.textDim, flexShrink: 0, paddingTop: 2 }}>
                          {relativeTime(event.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <Card>
      <div style={{ fontSize: 11, color: T.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </Card>
  );
}
