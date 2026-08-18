import { FolderOpen } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CourseResources() {
  return (
    <CourseLayout>
      <PageHeader title="Resources" subtitle="Course materials and downloads" />
      <div className="card mt-6">
        <EmptyState
          icon={<FolderOpen size={32} />}
          title="No resources yet"
          description="Course resources and downloadable materials will appear here."
        />
      </div>
    </CourseLayout>
  );
}
