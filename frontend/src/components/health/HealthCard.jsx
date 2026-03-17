import React, { useState } from 'react';
import { T, mono } from '../../utils/theme';
import StatusDot from '../common/StatusDot';
import { getPortFromUrl } from '../../utils/theme';

export default function HealthCard({ check, status, models = [] }) {
  const [expanded, setExpanded] = useState(false);
  const shouldShowModels = check.type === 'ollama' && (check.show_models === true || check.show_models === 1);
  const hasModels = shouldShowModels && models.length > 0;
  const port = getPortFromUrl(check.check_url);

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Main row */}
      <div
        onClick={hasModels ? () => setExpanded(!expanded) : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 8,
          cursor: hasModels ? 'pointer' : 'default',
          background: expanded ? 'rgba(255,255,255,0.03)' : 'transparent',
          transition: 'background 0.15s ease',
        }}
      >
        <StatusDot status={status.status} />
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: T.text }}>{check.name}</span>

        {port && (
          <span
            style={{
              fontFamily: mono,
              fontSize: 10,
              color: T.textDim,
              background: 'rgba(255,255,255,0.04)',
              padding: '3px 7px',
              borderRadius: 4,
            }}
          >
            :{port}
          </span>
        )}

        {hasModels && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
          >
            <path d="M4 6l4 4 4-4" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Message */}
      <div style={{ fontSize: 11, color: T.textDim, paddingLeft: 34, marginTop: 2, marginBottom: hasModels ? 2 : 4, lineHeight: 1.4 }}>
        {status.message || status.status}
      </div>

      {/* Expandable models */}
      {expanded && hasModels && (
        <div
          style={{
            paddingLeft: 34,
            paddingRight: 14,
            paddingBottom: 8,
            animation: 'slideDown 0.2s ease both',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {models.map((m, i) => (
              <span
                key={i}
                style={{
                  fontFamily: mono,
                  fontSize: 10,
                  color: T.accent,
                  background: T.accentSurface,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid rgba(99,102,241,0.12)`,
                }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
