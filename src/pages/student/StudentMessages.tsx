import { Mail } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function StudentMessages() {
  return (
    <AppLayout>
      <PageHeader title="Messages" subtitle="Your course discussions and direct messages" />
      <div className="card mt-6">
        <EmptyState
          icon={<Mail size={32} />}
          title="No messages yet"
          description="Course discussions and instructor messages will appear here."
        />
      </div>
    </AppLayout>
  );
}
