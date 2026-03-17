import React from 'react';
import { T, mono } from '../../utils/theme';

export function Footer() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${T.border}`,
        padding: '20px 32px',
        textAlign: 'center',
        fontSize: 12,
        color: T.textDim,
      }}
    >
      © 2026 ZRAI Team
    </footer>
  );
}

export function LoadingScreen({ message = 'Ładowanie...' }) {
  const colors = [T.green, T.accent, T.amber, T.red, T.purple];
  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            height: 48,
            justifyContent: 'center',
            marginBottom: '1.5rem',
          }}
        >
          {colors.map((color, i) => (
            <div
              key={i}
              style={{
                width: 8,
                borderRadius: 4,
                background: color,
                animation: 'barPulse 1s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
        <div style={{ color: T.textDim, fontSize: '0.875rem', fontWeight: 500 }}>{message}</div>
      </div>
    </div>
  );
}

export function LoadingCard() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '14px 18px',
        borderRadius: 10,
        marginBottom: 4,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            width: '60%',
            height: 14,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 4,
            marginBottom: 6,
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
        <div
          style={{
            width: '80%',
            height: 12,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 4,
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite 0.2s',
          }}
        />
      </div>
    </div>
  );
}

export function EmptyState({ message, actionText, actionHref }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: T.textDim, fontSize: 13 }}>
      {message}
      {actionText && actionHref && (
        <>
          {' '}
          <a href={actionHref} style={{ color: T.accent, textDecoration: 'none', fontWeight: 600 }}>
            {actionText}
          </a>
        </>
      )}
    </div>
  );
}

export function SectionTitle({ children, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: T.textDim,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        {children}
      </h2>
      {count !== undefined && (
        <span
          style={{
            fontFamily: mono,
            fontSize: 11,
            color: T.accent,
            background: T.accentSurface,
            padding: '2px 8px',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}
