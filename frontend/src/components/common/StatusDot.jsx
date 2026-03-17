import React from 'react';
import { getStatusColor, getStatusGlow } from '../../utils/theme';

export function GlowDot({ color, glow, size = 8, pulse = false }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0 }}>
      {pulse && (
        <span
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: '50%',
            background: glow,
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}
      <span
        style={{
          position: 'relative',
          display: 'block',
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 8px ${glow}`,
        }}
      />
    </span>
  );
}

export default function StatusDot({ status, size = 8 }) {
  const color = getStatusColor(status);
  const glow = getStatusGlow(status);
  return <GlowDot color={color} glow={glow} size={size} pulse={status === 'healthy'} />;
}
