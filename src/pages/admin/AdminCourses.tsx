import { BookOpen, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function AdminCourses() {
  return (
    <AppLayout>
      <PageHeader
        title="Courses"
        subtitle="Manage all courses"
        actions={<button className="btn-primary"><Plus size={16} /> New Course</button>}
      />
      <div className="card mt-6">
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No courses yet"
          description="Create your first course to get started. The first beta course will be AI Business Essentials, but the system is generic — no course is hard-coded."
        />
      </div>
    </AppLayout>
  );
}
