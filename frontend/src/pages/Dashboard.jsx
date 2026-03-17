import React, { useState, useEffect } from 'react';
import { T, mono, getMetricColor } from '../utils/theme';
import { fetchDashboard, fetchHealthchecks as fetchHCConfig, fetchMetricsLive } from '../utils/api';
import Header from '../components/common/Header';
import { Footer, LoadingScreen, SectionTitle } from '../components/common/Shared';
import Card from '../components/common/Card';
import AppsList from '../components/apps/AppsList';
import HealthList from '../components/health/HealthList';

export default function Dashboard() {
  const [ipAddress, setIpAddress] = useState('');
  const [apps, setApps] = useState([]);
  const [healthchecks, setHealthchecks] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const data = await fetchDashboard();
      setIpAddress(data.ip);
      setApps(data.apps || []);

      const healthchecksData = data.healthchecks || [];
      const statusMap = {};
      healthchecksData.forEach((hc) => {
        statusMap[hc.check_id] = {
          status: hc.status,
          message: hc.message || '',
          models: hc.models || [],
        };
      });

      const healthcheckConfigs = healthchecksData.map((hc) => ({
        id: hc.check_id,
        name: hc.name,
        type: hc.type,
        check_url: hc.check_url,
        show_models: hc.show_models,
      }));

      if (healthcheckConfigs.length === 0) {
        try {
          const hcData = await fetchHCConfig();
          const configs = hcData.healthchecks || [];
          setHealthchecks(configs);
          const initialStatus = {};
          configs.forEach((hc) => {
            initialStatus[hc.id] = { status: 'checking', message: 'Initial check...', models: [] };
          });
          setStatuses(initialStatus);
        } catch (err) {
          console.error('Error fetching healthchecks config:', err);
        }
      } else {
        setHealthchecks(healthcheckConfigs);
        setStatuses(statusMap);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setIpAddress('Error');
      setIsLoading(false);
    }
  };

  const fetchQuickMetrics = async () => {
    try {
      const data = await fetchMetricsLive();
      setMetrics(data.metrics);
    } catch (err) {
      console.debug('Metrics fetch failed:', err.message);
    }
  };

  useEffect(() => {
    document.title = 'SandboxAI Dashboard';
    fetchDashboardData();
    fetchQuickMetrics();
  }, []);

  useEffect(() => {
    const dashInterval = setInterval(fetchDashboardData, 30000);
    const metricsInterval = setInterval(fetchQuickMetrics, 5000);
    return () => {
      clearInterval(dashInterval);
      clearInterval(metricsInterval);
    };
  }, []);

  if (isLoading) return <LoadingScreen message="Ładowanie dashboardu..." />;

  const healthyApps = apps.filter((a) => a.status === 'healthy').length;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <Header ipAddress={ipAddress} />

      <main
        style={{
          maxWidth: 1440,
          margin: '0 auto',
          padding: '28px 32px',
          width: '100%',
          flex: 1,
        }}
      >
        <div
          className="animate-fade-in"
          style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}
        >
          {/* Left column */}
          <div>
            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              <QuickStat label="Applications" value={healthyApps} suffix={`/ ${apps.length}`} detail="online" detailColor={T.green} />
              <QuickStat
                label="CPU"
                value={`${metrics?.cpu?.percent || 0}%`}
                valueColor={getMetricColor(metrics?.cpu?.percent || 0)}
              />
              <QuickStat
                label="RAM"
                value={`${metrics?.ram?.percent || 0}%`}
                valueColor={getMetricColor(metrics?.ram?.percent || 0)}
                detail={metrics?.ram ? `${metrics.ram.used_gb.toFixed(1)} / ${metrics.ram.total_gb.toFixed(1)} GB` : ''}
              />
            </div>

            {/* Apps */}
            <AppsList apps={apps} />
          </div>

          {/* Right sidebar */}
          <div>
            <HealthList healthchecks={healthchecks} statuses={statuses} />

            {/* Quick Resources */}
            {metrics && (
              <div style={{ marginTop: 20 }} className="animate-fade-in stagger-3">
                <SectionTitle>Resources</SectionTitle>
                <Card>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <ResourceBar
                      label="RAM"
                      value={metrics.ram?.used_gb?.toFixed(1)}
                      total={`${metrics.ram?.total_gb?.toFixed(1)} GB`}
                      pct={metrics.ram?.percent || 0}
                      color={T.cyan}
                      unit="GB"
                    />
                    <ResourceBar
                      label="Disk"
                      value={metrics.disk?.used_gb?.toFixed(0)}
                      total={`${metrics.disk?.total_gb?.toFixed(0)} GB`}
                      pct={metrics.disk?.percent || 0}
                      color={T.amber}
                      unit="GB"
                    />
                  </div>
                  {metrics.gpu?.available && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                      <ResourceBar
                        label="GPU"
                        value={metrics.gpu.utilization}
                        total={`${metrics.gpu.memory_total_mb} MB VRAM`}
                        pct={metrics.gpu.utilization}
                        color={T.purple}
                        unit="%"
                      />
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function QuickStat({ label, value, suffix, detail, detailColor, valueColor }) {
  return (
    <Card>
      <div style={{ fontSize: 11, color: T.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: valueColor || T.text, lineHeight: 1 }}>
          {value}
        </span>
        {suffix && <span style={{ fontFamily: mono, fontSize: 14, color: T.textDim }}>{suffix}</span>}
        {detail && (
          <span style={{ fontSize: 11, color: detailColor || T.textDim, marginLeft: 'auto' }}>{detail}</span>
        )}
      </div>
    </Card>
  );
}

function ResourceBar({ label, value, total, pct, color, unit }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <span style={{ fontFamily: mono, fontSize: 11, color: T.textDim }}>{total}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
      </div>
      <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color }}>
        {value} <span style={{ fontSize: 10, color: T.textDim }}>{unit}</span>
        <span style={{ float: 'right', fontSize: 11 }}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}
