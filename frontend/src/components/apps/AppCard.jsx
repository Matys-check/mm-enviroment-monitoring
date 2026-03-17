import React, { useState } from 'react';
import { T, mono, getPortFromUrl } from '../../utils/theme';
import StatusDot from '../common/StatusDot';

export default function AppCard({ app }) {
  const [h, setH] = useState(false);
  const port = getPortFromUrl(app.url);

  return (
    <a
      href={app.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        borderRadius: 10,
        textDecoration: 'none',
        color: T.text,
        background: h ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: `1px solid ${h ? T.borderHover : 'transparent'}`,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: h ? 'translateX(4px)' : 'none',
      }}
    >
      <StatusDot status={app.status} />

      <span style={{ fontSize: 24, lineHeight: 1, width: 32, textAlign: 'center', flexShrink: 0 }}>
        {app.icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{app.name}</div>
        <div
          style={{
            fontSize: 12,
            color: T.textDim,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {app.description}
        </div>
      </div>

      {/* Response time */}
      {app.response_time_ms && (
        <span
          style={{
            fontFamily: mono,
            fontSize: 11,
            color: app.response_time_ms > 500 ? T.amber : T.textDim,
          }}
        >
          {app.response_time_ms}ms
        </span>
      )}

      {/* Port badge */}
      {port && (
        <span
          style={{
            fontFamily: mono,
            fontSize: 11,
            fontWeight: 600,
            color: T.textDim,
            background: 'rgba(255,255,255,0.04)',
            padding: '4px 10px',
            borderRadius: 6,
            border: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          :{port}
        </span>
      )}

      {/* Arrow */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        style={{ opacity: h ? 0.6 : 0.2, transition: 'opacity 0.2s', flexShrink: 0 }}
      >
        <path d="M6 4l4 4-4 4" stroke={T.textMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
