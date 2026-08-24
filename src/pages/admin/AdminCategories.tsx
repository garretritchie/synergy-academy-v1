import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FolderTree, Pencil } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { supabase } from "@/lib/supabase";
import { getErrorMessage, slugify } from "@/lib/format";
import type { CourseCategory } from "@/types";

const empty = {
  name: "",
  slug: "",
  description: "",
  display_order: 0,
  is_active: true,
};
export function AdminCategories() {
  const [items, setItems] = useState<CourseCategory[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("course_categories")
      .select("*")
      .order("display_order");
    if (queryError) setError(queryError.message);
    else setItems((data ?? []) as CourseCategory[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const reset = () => {
    setForm(empty);
    setEditingId(null);
    setOpen(false);
    setError("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, slug: form.slug || slugify(form.name) };
      const result = editingId
        ? await supabase
            .from("course_categories")
            .update(payload)
            .eq("id", editingId)
        : await supabase.from("course_categories").insert(payload);
      if (result.error) throw result.error;
      reset();
      await load();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };
  const edit = (item: CourseCategory) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description ?? "",
      display_order: item.display_order,
      is_active: item.is_active,
    });
    setOpen(true);
  };
  return (
    <AppLayout>
      <PageHeader
        title="Categories"
        subtitle="Keep the course catalog easy to browse and maintain."
      />
      <div className="mt-6 space-y-5">
        <FormPanel
          title={editingId ? "Edit category" : "Create a category"}
          open={open}
          onToggle={() => (open ? reset() : setOpen(true))}
          actionLabel="New category"
        >
          <form onSubmit={save} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  required
                  className="input"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                      slug: editingId
                        ? current.slug
                        : slugify(event.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="URL slug">
                <input
                  required
                  className="input"
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      slug: slugify(event.target.value),
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className="input min-h-20"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display order">
                <input
                  type="number"
                  className="input"
                  value={form.display_order}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      display_order: Number(event.target.value),
                    }))
                  }
                />
              </Field>
              <label className="mt-7 flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }))
                  }
                />{" "}
                Active in the catalog
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancel
              </button>
              <SubmitButton loading={saving}>
                {editingId ? "Save changes" : "Create category"}
              </SubmitButton>
            </div>
          </form>
        </FormPanel>
        <section className="overflow-hidden rounded-xl bg-white shadow-soft">
          {loading ? (
            <TableSkeleton />
          ) : (
            <div className="divide-y divide-ink-100">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <FolderTree size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink-900">{item.name}</p>
                      <span
                        className={
                          item.is_active ? "badge-success" : "badge-neutral"
                        }
                      >
                        {item.is_active ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-500">
                      {item.description || item.slug}
                    </p>
                  </div>
                  <span className="hidden text-sm tabular-nums text-ink-500 sm:block">
                    Order {item.display_order}
                  </span>
                  <button
                    className="btn-ghost !p-2"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => edit(item)}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
