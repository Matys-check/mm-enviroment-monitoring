import React from 'react';
import Card from '../common/Card';
import AppCard from './AppCard';
import { EmptyState, SectionTitle } from '../common/Shared';

export default function AppsList({ apps }) {
  return (
    <div>
      <SectionTitle count={apps.length}>Applications</SectionTitle>
      <Card style={{ padding: '8px 6px' }}>
        {apps.length === 0 ? (
          <EmptyState message="Brak aplikacji. Dodaj w" actionText="panelu admin" actionHref="/admin" />
        ) : (
          apps.map((app, i) => (
            <div key={app.id} className={`animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
              <AppCard app={app} />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
