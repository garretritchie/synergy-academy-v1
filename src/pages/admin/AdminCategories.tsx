import { FolderTree, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function AdminCategories() {
  return (
    <AppLayout>
      <PageHeader
        title="Categories"
        subtitle="Organize courses into categories"
        actions={<button className="btn-primary"><Plus size={16} /> New Category</button>}
      />
      <div className="card mt-6">
        <EmptyState
          icon={<FolderTree size={32} />}
          title="No categories yet"
          description="Create categories to organize your courses. Five initial categories are pre-seeded in the database: Business Applications, Business Studies, Culinary Arts, Design & Media, and Technology."
        />
      </div>
    </AppLayout>
  );
}
