import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/Spinner';

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  description: string;
}

export function PlaceholderPage({ title, subtitle, icon, description }: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      <div className="card mt-6">
        <EmptyState icon={icon} title={`${title} — Coming Soon`} description={description} />
      </div>
    </div>
  );
}
