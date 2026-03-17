import React from 'react';
import { T, mono } from '../../utils/theme';
import Card from '../common/Card';
import HealthCard from './HealthCard';
import { EmptyState, SectionTitle } from '../common/Shared';
import { GlowDot } from '../common/StatusDot';

export default function HealthList({ healthchecks, statuses }) {
  const total = healthchecks.length;
  const healthy = healthchecks.filter((hc) => {
    const s = statuses[hc.id];
    return s && s.status === 'healthy';
  }).length;
  const allHealthy = healthy === total && total > 0;

  return (
    <div>
      <SectionTitle count={total}>System Status</SectionTitle>
      <Card style={{ padding: '12px 8px' }}>
        {/* Summary bar */}
        {total > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px 14px',
              borderBottom: `1px solid ${T.border}`,
              marginBottom: 8,
            }}
          >
            <GlowDot
              color={allHealthy ? T.green : T.amber}
              glow={allHealthy ? T.greenGlow : T.amberGlow}
              size={6}
              pulse
            />
            <span style={{ fontFamily: mono, fontSize: 11, color: T.textMid }}>
              {healthy}/{total} services operational
            </span>
          </div>
        )}

        {total === 0 ? (
          <EmptyState message="Brak healthchecków" />
        ) : (
          healthchecks.map((check, i) => {
            const status = statuses[check.id] || { status: 'checking', message: '', models: [] };
            return (
              <div key={check.id} className={`animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
                <HealthCard check={check} status={status} models={status.models || []} />
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
