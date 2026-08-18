import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';
import { Video } from 'lucide-react';

export function InstructorLiveSessions() {
  return (
    <AppLayout>
      <PageHeader title="Live Sessions" subtitle="Manage your scheduled live classes" />
      <div className="card mt-6">
        <EmptyState icon={<Video size={32} />} title="No live sessions" description="Schedule and manage live sessions for your cohorts here." />
      </div>
    </AppLayout>
  );
}

export function InstructorAssignments() {
  return (
    <AppLayout>
      <PageHeader title="Assignments" subtitle="Create and grade assignments" />
      <div className="card mt-6">
        <EmptyState icon={<Video size={32} />} title="No assignments" description="Create assignments for your cohorts here." />
      </div>
    </AppLayout>
  );
}

export function InstructorAttendance() {
  return (
    <AppLayout>
      <PageHeader title="Attendance" subtitle="Track student attendance for live sessions" />
      <div className="card mt-6">
        <EmptyState icon={<Video size={32} />} title="No attendance records" description="Take attendance for your live sessions here." />
      </div>
    </AppLayout>
  );
}

export function InstructorGradebook() {
  return (
    <AppLayout>
      <PageHeader title="Gradebook" subtitle="Manage grades for your cohorts" />
      <div className="card mt-6">
        <EmptyState icon={<Video size={32} />} title="No grades" description="Configure grade categories and enter grades here." />
      </div>
    </AppLayout>
  );
}

export function InstructorStudents() {
  return (
    <AppLayout>
      <PageHeader title="Students" subtitle="Students enrolled in your cohorts" />
      <div className="card mt-6">
        <EmptyState icon={<Video size={32} />} title="No students" description="Students enrolled in your cohorts will appear here." />
      </div>
    </AppLayout>
  );
}

export function InstructorCommunications() {
  return (
    <AppLayout>
      <PageHeader title="Communications" subtitle="Announcements and messages to your students" />
      <div className="card mt-6">
        <EmptyState icon={<Video size={32} />} title="No communications" description="Post announcements and send messages to your students here." />
      </div>
    </AppLayout>
  );
}
