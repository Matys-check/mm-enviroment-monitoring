import React from 'react';
import { T } from '../../utils/theme';

export default function Logo({ size = 28, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: onClick ? 'pointer' : 'default' }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.25,
          background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width={size * 0.57} height={size * 0.57} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="8" height="2" rx="1" fill="white" opacity="0.9" />
          <rect x="2" y="7" width="5" height="2" rx="1" fill="white" opacity="0.9" />
          <rect x="2" y="11" width="8" height="2" rx="1" fill="white" opacity="0.9" />
          <circle cx="12" cy="8" r="2" fill="#22c55e" />
        </svg>
      </div>
      <span
        style={{
          fontSize: size * 0.57,
          fontWeight: 700,
          background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.02em',
        }}
      >
        SandboxAI
      </span>
    </div>
  );
}
