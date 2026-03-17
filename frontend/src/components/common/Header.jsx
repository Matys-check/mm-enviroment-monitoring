import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { T, mono } from '../../utils/theme';
import Logo from './Logo';
import { GlowDot } from './StatusDot';

const Clock = React.memo(function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      fontFamily: mono, fontSize: 11, color: T.textDim,
      background: 'rgba(255,255,255,0.03)', padding: '5px 12px',
      borderRadius: 6, border: `1px solid ${T.border}`,
    }}>
      {time.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
});

export default function Header({ ipAddress }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '◉' },
    { path: '/resources', label: 'Monitoring', icon: '◈' },
    { path: '/events', label: 'Events', icon: '◆' },
    { path: '/admin', label: 'Admin', icon: '⚙' },
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(10, 14, 26, 0.82)',
        backdropFilter: 'blur(20px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
        borderBottom: `1px solid ${T.border}`,
        padding: '0 32px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Logo */}
      <Logo size={28} onClick={() => navigate('/')} />

      {/* Navigation pills */}
      <nav
        style={{
          display: 'flex',
          gap: 2,
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 10,
          padding: 3,
        }}
      >
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              padding: '7px 20px',
              borderRadius: 8,
              border: 'none',
              background: isActive(item.path) ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: isActive(item.path) ? T.text : T.textDim,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => {
              if (!isActive(item.path)) e.currentTarget.style.color = T.textMid;
            }}
            onMouseLeave={(e) => {
              if (!isActive(item.path)) e.currentTarget.style.color = T.textDim;
            }}
          >
            <span style={{ fontSize: 11, opacity: isActive(item.path) ? 1 : 0.5 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* IP */}
        {ipAddress && ipAddress !== 'Loading...' && ipAddress !== 'Error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <GlowDot color={T.green} glow={T.greenGlow} size={6} pulse />
            <span style={{ fontFamily: mono, fontSize: 11, color: T.textDim }}>{ipAddress}</span>
          </div>
        )}

        {/* Clock - isolated component to prevent full Header re-render */}
        <Clock />
      </div>
    </header>
  );
}
