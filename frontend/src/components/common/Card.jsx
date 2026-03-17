import React, { useState } from 'react';
import { T } from '../../utils/theme';

export default function Card({ children, style, hover = false, onClick, className = '' }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={className}
      style={{
        background: hovered && hover ? T.bgCardHover : T.bgCard,
        border: `1px solid ${hovered && hover ? T.borderHover : T.border}`,
        borderRadius: 14,
        padding: '20px 24px',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: onClick ? 'pointer' : 'default',
        ...(hovered && hover
          ? { transform: 'translateY(-2px)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }
          : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
