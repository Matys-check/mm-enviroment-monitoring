import React, { useState, useEffect } from 'react';
import { T, mono, getMetricColor, formatTime } from '../utils/theme';
import { fetchMetricsLive, fetchHistory, fetchProcesses, fetchDocker } from '../utils/api';
import Header from '../components/common/Header';
import { Footer, LoadingScreen } from '../components/common/Shared';
import Card from '../components/common/Card';
import StatusDot from '../components/common/StatusDot';

const RANGES = ['1h', '6h', '24h', '7d', '14d'];

export default function Monitoring() {
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [selectedRange, setSelectedRange] = useState('1h');
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('metrics');
  const [processes, setProcesses] = useState({ top_cpu: [], top_ram: [] });
  const [network, setNetwork] = useState(null);
  const [docker, setDocker] = useState({ available: false, containers: [] });

  useEffect(() => {
    document.title = 'System Resources - SandboxAI';
    fetchAllSystemData();
    const metricsInterval = setInterval(fetchMetricsLiveData, 5000);
    const processesInterval = setInterval(fetchProcessesData, 30000);
    const dockerInterval = setInterval(fetchDockerData, 120000);
    return () => {
      clearInterval(metricsInterval);
      clearInterval(processesInterval);
      clearInterval(dockerInterval);
    };
  }, []);

  useEffect(() => {
    fetchHistoryData(selectedRange);
    // Refresh history at granulation intervals matching backend
    const intervalMap = { '1h': 60000, '6h': 300000, '24h': 900000, '7d': 3600000, '14d': 10800000 };
    const interval = intervalMap[selectedRange] || 60000;
    const historyInterval = setInterval(() => fetchHistoryData(selectedRange), interval);
    return () => clearInterval(historyInterval);
  }, [selectedRange]);

  const fetchMetricsLiveData = async () => {
    try {
      const data = await fetchMetricsLive();
      setCurrentMetrics(data.metrics);
      setNetwork(data.network);
    } catch (err) {
      console.debug('Metrics fetch failed:', err.message);
    }
  };

  const fetchProcessesData = async () => {
    try {
      const data = await fetchProcesses();
      setProcesses(data);
    } catch (err) {
      console.debug('Processes fetch failed:', err.message);
    }
  };

  const fetchDockerData = async () => {
    try {
      const data = await fetchDocker();
      setDocker(data);
    } catch (err) {
      console.debug('Docker fetch failed:', err.message);
    }
  };

  const fetchAllSystemData = async () => {
    try {
      await fetchMetricsLiveData();
      setLoading(false);
      fetchProcessesData();
      fetchDockerData();
    } catch (err) {
      console.debug('System data fetch failed:', err.message);
      setLoading(false);
    }
  };

  const fetchHistoryData = async (range) => {
    try {
      const data = await fetchHistory(range);
      setHistoryData(data.data || []);
    } catch (err) {
      console.debug('History fetch failed:', err.message);
    }
  };

  if (loading) return <LoadingScreen message="Ładowanie metryk systemowych..." />;

  const tabs = [
    { key: 'metrics', label: '📊 Metrics' },
    { key: 'processes', label: '💻 Processes' },
    { key: 'docker', label: '🐳 Docker' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <Header />

      {/* Sub-tabs */}
      <div style={{ position: 'sticky', top: 60, zIndex: 99, background: 'rgba(10,14,26,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '8px 32px', display: 'flex', gap: 4 }}>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 3 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === t.key ? T.accent : 'transparent',
                  color: activeTab === t.key ? '#fff' : T.textDim,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main style={{ flex: 1, maxWidth: 1440, margin: '0 auto', padding: '28px 32px', width: '100%' }}>
        <div className="animate-fade-in">
          {activeTab === 'metrics' && (
            <MetricsTab
              currentMetrics={currentMetrics}
              selectedRange={selectedRange}
              setSelectedRange={setSelectedRange}
              historyData={historyData}
            />
          )}
          {activeTab === 'processes' && <ProcessesTab processes={processes} network={network} />}
          {activeTab === 'docker' && <DockerTab docker={docker} />}
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ─── METRICS TAB ─────────────────────────────────────────────────────────

function MetricsTab({ currentMetrics, selectedRange, setSelectedRange, historyData }) {
  return (
    <>
      {/* Circular gauges */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 20 }}>
          <CircularGauge value={currentMetrics?.cpu?.percent || 0} label="CPU" unit="%" color={getMetricColor(currentMetrics?.cpu?.percent || 0)} />
          {currentMetrics?.gpu?.available ? (
            <CircularGauge value={currentMetrics.gpu.utilization} label="GPU" unit="%" color={getMetricColor(currentMetrics.gpu.utilization)} />
          ) : (
            <CircularGauge value={0} label="GPU" unit="%" color={T.textDim} disabled />
          )}
          {currentMetrics?.gpu?.available ? (
            <CircularGauge value={currentMetrics.gpu.memory_used_mb} max={currentMetrics.gpu.memory_total_mb} label="GPU Mem" unit="MB" color={getMetricColor(currentMetrics.gpu.memory_percent)} />
          ) : (
            <CircularGauge value={0} label="GPU Mem" unit="MB" color={T.textDim} disabled />
          )}
          <CircularGauge value={currentMetrics?.ram?.used_gb || 0} max={currentMetrics?.ram?.total_gb || 0} label="RAM" unit="GB" color={getMetricColor(currentMetrics?.ram?.percent || 0)} />
          <CircularGauge value={currentMetrics?.disk?.used_gb || 0} max={currentMetrics?.disk?.total_gb || 0} label="Disk" unit="GB" color={getMetricColor(currentMetrics?.disk?.percent || 0)} />
        </div>
      </Card>

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRange(r)}
            style={{
              padding: '7px 18px',
              borderRadius: 7,
              border: `1px solid ${selectedRange === r ? T.accent : T.border}`,
              background: selectedRange === r ? T.accentSurface : 'transparent',
              color: selectedRange === r ? T.accent : T.textDim,
              fontFamily: mono,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BigChart title="CPU Usage" data={historyData} dataKey="cpu" color={T.accent} unit="%" />
        <BigChart title="RAM Usage" data={historyData} dataKey="ram" color={T.cyan} unit="%" />
        <BigChart title="RAM Used" data={historyData} dataKey="ram_gb" color={T.cyan} unit="GB" />
        <BigChart title="Disk Usage" data={historyData} dataKey="disk" color={T.amber} unit="%" />
        {currentMetrics?.gpu?.available && (
          <>
            <BigChart title="GPU Usage" data={historyData} dataKey="gpu" color={T.purple} unit="%" />
            <BigChart title="GPU Memory" data={historyData} dataKey="gpu_mem_pct" color={T.red} unit="%" />
          </>
        )}
      </div>
    </>
  );
}

// ─── PROCESSES TAB ───────────────────────────────────────────────────────

function ProcessesTab({ processes, network }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Top CPU */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          🔥 Top CPU
        </div>
        {processes.top_cpu?.map((proc, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < processes.top_cpu.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{proc.name}</span>
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: proc.cpu_percent > 100 ? T.red : proc.cpu_percent > 50 ? T.amber : T.accent }}>{proc.cpu_percent}%</span>
          </div>
        ))}
      </Card>

      {/* Top RAM */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          💾 Top RAM
        </div>
        {processes.top_ram?.map((proc, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < processes.top_ram.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{proc.name}</span>
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: T.cyan }}>
              {proc.memory_mb > 1000 ? `${(proc.memory_mb / 1024).toFixed(1)} GB` : `${proc.memory_mb} MB`}
            </span>
          </div>
        ))}
      </Card>

      {/* Network */}
      <Card style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textMid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🌐 Network</div>
          <span style={{ fontSize: 11, color: T.textDim }}>Odświeżanie co 5s</span>
        </div>
        {network?.has_speed ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Upload</div>
              <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: T.accent }}>
                ↑ {network.upload_speed.toFixed(2)} <span style={{ fontSize: 14 }}>MB/s</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: T.textDim }}>{(network.upload_speed * 8).toFixed(1)} Mbps</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Download</div>
              <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: T.green }}>
                ↓ {network.download_speed.toFixed(2)} <span style={{ fontSize: 14 }}>MB/s</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: T.textDim }}>{(network.download_speed * 8).toFixed(1)} Mbps</div>
            </div>
          </div>
        ) : (
          <div style={{ color: T.textDim, fontSize: 13 }}>Czekam na drugi pomiar (5s)...</div>
        )}
      </Card>
    </div>
  );
}

// ─── DOCKER TAB ──────────────────────────────────────────────────────────

function DockerTab({ docker }) {
  if (!docker.available) {
    return (
      <Card style={{ textAlign: 'center', padding: '48px 40px' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🐳</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: T.text }}>Docker Not Available</h3>
        <p style={{ color: T.textDim, fontSize: 13 }}>{docker.error || 'Docker is not installed or not accessible'}</p>
        <p style={{ color: T.textDim, fontSize: 12, marginTop: 12 }}>
          Install: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 4, fontFamily: mono, fontSize: 11 }}>pip install docker</code>
        </p>
      </Card>
    );
  }

  if (docker.containers?.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: '48px 40px' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🐳</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: T.text }}>No Containers</h3>
        <p style={{ color: T.textDim, fontSize: 13 }}>No Docker containers found</p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {docker.containers?.map((c) => (
        <Card key={c.id} hover>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <StatusDot status={c.status === 'running' ? 'healthy' : 'unhealthy'} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{c.name}</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: T.textDim, marginTop: 2 }}>{c.image}</div>
            </div>
            {c.stats && (
              <>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: T.textDim }}>CPU</div>
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: T.accent }}>{c.stats.cpu_percent}%</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: T.textDim }}>MEM</div>
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: T.cyan }}>{c.stats.memory_mb} MB</div>
                </div>
              </>
            )}
            <span
              style={{
                fontFamily: mono,
                fontSize: 10,
                fontWeight: 700,
                color: c.status === 'running' ? T.green : T.red,
                background: c.status === 'running' ? T.greenSurface : T.redSurface,
                padding: '4px 10px',
                borderRadius: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {c.status}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── CIRCULAR GAUGE ──────────────────────────────────────────────────────

function CircularGauge({ value, max, label, unit, color, disabled, size = 100 }) {
  const pct = max ? (value / max) * 100 : value;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: disabled ? 0.25 : 1, transition: 'opacity 0.3s' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 6px ${color}44)` }}
        />
      </svg>
      <div style={{ marginTop: -size + 6, height: size - 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <span style={{ fontFamily: mono, fontSize: size * 0.22, fontWeight: 700, color: T.text, lineHeight: 1 }}>
          {max ? value.toFixed(1) : Math.round(value)}
        </span>
        <span style={{ fontFamily: mono, fontSize: size * 0.12, color: T.textDim, lineHeight: 1, marginTop: 2 }}>{unit}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.textMid, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: size * 0.06 }}>{label}</span>
      {max > 0 && <span style={{ fontFamily: mono, fontSize: 10, color: T.textDim }}>{max.toFixed ? max.toFixed(1) : max} {unit}</span>}
      <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color, marginTop: -2 }}>{Math.round(pct)}%</span>
    </div>
  );
}

// ─── LINE CHART ──────────────────────────────────────────────────────────

function BigChart({ title, data, dataKey, color, unit }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textMid, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', gap: 12 }}>
          <svg width="200" height="50" viewBox="0 0 200 50" fill="none">
            <line x1="0" y1="12" x2="200" y2="12" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <line x1="0" y1="25" x2="200" y2="25" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <line x1="0" y1="38" x2="200" y2="38" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <polyline
              points="0,35 30,30 60,33 90,22 120,26 150,18 180,24 200,19"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              style={{ animation: 'chartPulse 2s ease-in-out infinite' }}
            />
          </svg>
          <div style={{ color: T.textDim, fontSize: 12, fontWeight: 500 }}>Zbieranie danych — wykres pojawi się za kilka minut</div>
        </div>
      </Card>
    );
  }

  const isPercentage = unit === '%';
  const rawMax = Math.max(...data.map((d) => d[dataKey] || 0));
  const maxValue = isPercentage ? 100 : (rawMax > 0 ? rawMax * 1.15 : 100); // 15% headroom for non-%
  const w = 900;
  const h = 280;
  const pad = { t: 16, r: 16, b: 48, l: 50 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const isSingle = data.length === 1;

  const pts = data.map((d, i) => ({
    x: isSingle ? w / 2 : pad.l + (i / (data.length - 1)) * plotW,
    y: pad.t + plotH - ((d[dataKey] || 0) / maxValue) * plotH,
    v: d[dataKey] || 0,
    ts: d.timestamp,
  }));

  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pad.l},${pad.t + plotH} ${line} ${pad.l + plotW},${pad.t + plotH}`;

  const currentVal = data[data.length - 1]?.[dataKey]?.toFixed(1) || '0';

  // Smart label selection: max 8 labels, evenly spaced, always include first and last
  const maxLabels = 8;
  const labelIndices = new Set();
  if (pts.length <= maxLabels) {
    pts.forEach((_, i) => labelIndices.add(i));
  } else {
    labelIndices.add(0);
    labelIndices.add(pts.length - 1);
    const step = (pts.length - 1) / (maxLabels - 1);
    for (let i = 1; i < maxLabels - 1; i++) {
      labelIndices.add(Math.round(step * i));
    }
  }

  return (
    <Card style={{ padding: '20px 24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.textMid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
        <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color }}>
          {hoveredIdx !== null ? pts[hoveredIdx].v.toFixed(1) : currentVal}
          <span style={{ fontSize: 13, color: T.textDim, marginLeft: 4 }}>{unit}</span>
        </span>
      </div>
      <div style={{ width: '100%', overflowX: 'hidden' }}>
        <svg
          width="100%"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoveredIdx(null)}
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id={`fill-${dataKey}-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {(isPercentage ? [0, 25, 50, 75, 100] : [0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue]).map((v) => {
            const y = pad.t + plotH - (v / maxValue) * plotH;
            return (
              <g key={v}>
                <line x1={pad.l} y1={y} x2={pad.l + plotW} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                <text x={pad.l - 10} y={y + 4} textAnchor="end" fill={T.textDim} fontSize={10} fontFamily={mono}>
                  {isPercentage ? `${Math.round(v)}%` : Math.round(v)}
                </text>
              </g>
            );
          })}

          {/* Time labels - only at selected indices */}
          {pts.map((p, i) => {
            if (!labelIndices.has(i)) return null;
            const ft = formatTime(p.ts);
            return (
              <g key={`label-${i}`}>
                <line x1={p.x} y1={pad.t + plotH} x2={p.x} y2={pad.t + plotH + 5} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                <text x={p.x} y={pad.t + plotH + 20} textAnchor="middle" fill={T.textMid} fontSize={10} fontFamily={mono}>
                  {ft.time}
                </text>
                <text x={p.x} y={pad.t + plotH + 33} textAnchor="middle" fill={T.textDim} fontSize={9} fontFamily={mono}>
                  {ft.date}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line x1={pad.l} y1={pad.t + plotH} x2={pad.l + plotW} y2={pad.t + plotH} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

          {/* Area fill */}
          {!isSingle && <polygon points={area} fill={`url(#fill-${dataKey}-${color.replace('#', '')})`} />}

          {/* Line */}
          {!isSingle && (
            <polyline
              points={line}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Single point - show a visible dot */}
          {isSingle && pts[0] && <circle cx={pts[0].x} cy={pts[0].y} r={5} fill={color} />}

          {/* Interactive hover zones */}
          {pts.map((p, i) => (
            <g key={i}>
              <rect
                x={isSingle ? p.x - 30 : p.x - plotW / pts.length / 2}
                y={pad.t}
                width={isSingle ? 60 : plotW / pts.length}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
                style={{ cursor: 'crosshair' }}
              />
              {hoveredIdx === i && (
                <>
                  <line x1={p.x} y1={pad.t} x2={p.x} y2={pad.t + plotH} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="3,3" />
                  <circle cx={p.x} cy={p.y} r={6} fill={T.bg} stroke={color} strokeWidth={2.5} />
                  <circle cx={p.x} cy={p.y} r={3} fill={color} />
                </>
              )}
            </g>
          ))}
        </svg>
      </div>
      {hoveredIdx !== null && pts[hoveredIdx]?.ts && (
        <div style={{ fontFamily: mono, fontSize: 10, color: T.textDim, textAlign: 'right', marginTop: 2 }}>
          {formatTime(pts[hoveredIdx].ts).time} · {formatTime(pts[hoveredIdx].ts).date}
        </div>
      )}
    </Card>
  );
}
