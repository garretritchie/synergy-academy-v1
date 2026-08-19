import { Award } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function StudentCertificates() {
  return (
    <AppLayout>
      <PageHeader title="Certificates" subtitle="Your earned certificates" />
      <div className="card mt-6">
        <EmptyState
          icon={<Award size={32} />}
          title="No certificates yet"
          description="Certificates are issued when you complete a course. Your earned certificates will appear here."
        />
      </div>
    </AppLayout>
  );
}
