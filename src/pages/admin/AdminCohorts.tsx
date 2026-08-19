import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { CalendarDays, Layers, Pencil, UserPlus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { formatDate, fullName, getErrorMessage, slugify } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import type { Cohort, Course, Profile } from "@/types";

type CohortRow = Cohort & {
  course: Course;
  cohort_instructors: Array<{
    id: string;
    instructor_id: string;
    is_lead: boolean;
    instructor: Profile;
  }>;
};
const empty = {
  course_id: "",
  name: "",
  slug: "",
  description: "",
  start_date: "",
  end_date: "",
  max_students: 20,
  enrolment_open: false,
  is_active: true,
};

export function AdminCohorts() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedCourseId = searchParams.get("course") ?? "";
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Profile[]>([]);
  const [form, setForm] = useState(() => ({
    ...empty,
    course_id: requestedCourseId,
  }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(Boolean(requestedCourseId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [instructorId, setInstructorId] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const [cohortsResult, coursesResult, instructorsResult] = await Promise.all(
      [
        supabase
          .from("cohorts")
          .select(
            "*, course:courses(*), cohort_instructors(id,instructor_id,is_lead,instructor:profiles!cohort_instructors_instructor_id_fkey(*))",
          )
          .order("start_date", { ascending: false, nullsFirst: false }),
        supabase.from("courses").select("*").order("title"),
        supabase
          .from("profiles")
          .select("*, user_roles!inner(role:roles!inner(name))")
          .eq("user_roles.role.name", "instructor")
          .eq("is_active", true)
          .order("last_name"),
      ],
    );
    const queryError =
      cohortsResult.error || coursesResult.error || instructorsResult.error;
    if (queryError) setError(queryError.message);
    else {
      setRows((cohortsResult.data ?? []) as unknown as CohortRow[]);
      setCourses((coursesResult.data ?? []) as Course[]);
      setInstructors((instructorsResult.data ?? []) as unknown as Profile[]);
    }
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
      const payload = {
        ...form,
        slug: form.slug || slugify(form.name),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        max_students: form.max_students || null,
        created_by: user?.id,
        metadata: {},
      };
      const result = editingId
        ? await supabase.from("cohorts").update(payload).eq("id", editingId)
        : await supabase.from("cohorts").insert(payload);
      if (result.error) throw result.error;
      reset();
      await load();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };
  const edit = (row: CohortRow) => {
    setEditingId(row.id);
    setForm({
      course_id: row.course_id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
      start_date: row.start_date ?? "",
      end_date: row.end_date ?? "",
      max_students: row.max_students ?? 20,
      enrolment_open: row.enrolment_open,
      is_active: row.is_active,
    });
    setOpen(true);
  };
  const assign = async (cohortId: string) => {
    if (!instructorId) return;
    setSaving(true);
    const { error: assignError } = await supabase
      .from("cohort_instructors")
      .upsert(
        { cohort_id: cohortId, instructor_id: instructorId, is_lead: true },
        { onConflict: "cohort_id,instructor_id" },
      );
    if (assignError) setError(assignError.message);
    else {
      setAssigning(null);
      setInstructorId("");
      await load();
    }
    setSaving(false);
  };
  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === form.course_id),
    [courses, form.course_id],
  );
  return (
    <AppLayout>
      <PageHeader
        title="Cohorts"
        subtitle="Schedule each delivery, assign instructors, and control enrolment."
      />
      <div className="mt-6 space-y-5">
        <FormPanel
          title={editingId ? "Edit cohort" : "Create a cohort"}
          description={
            selectedCourse
              ? `Delivery of ${selectedCourse.title}`
              : "Choose the reusable course this cohort will deliver."
          }
          open={open}
          onToggle={() => (open ? reset() : setOpen(true))}
          actionLabel="New cohort"
        >
          <form onSubmit={save} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Course">
                <select
                  required
                  className="input"
                  value={form.course_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      course_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cohort name">
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
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start date">
                <input
                  type="date"
                  className="input"
                  value={form.start_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      start_date: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  className="input"
                  value={form.end_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      end_date: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Maximum students">
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={form.max_students}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      max_students: Number(event.target.value),
                    }))
                  }
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-5 text-sm text-ink-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.enrolment_open}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      enrolment_open: event.target.checked,
                    }))
                  }
                />{" "}
                Enrolment open
              </label>
              <label className="flex items-center gap-2">
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
                Active cohort
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancel
              </button>
              <SubmitButton loading={saving}>
                {editingId ? "Save changes" : "Create cohort"}
              </SubmitButton>
            </div>
          </form>
        </FormPanel>
        <section className="overflow-hidden rounded-xl bg-white shadow-soft">
          {error && !open && (
            <div className="p-4">
              <Alert>{error}</Alert>
            </div>
          )}
          {loading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Layers size={30} />}
              title="No cohorts yet"
              description="Create a scheduled delivery for a course, then assign its instructor."
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {rows.map((row) => (
                <div key={row.id} className="px-5 py-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <CalendarDays size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-ink-900">{row.name}</p>
                        <span
                          className={
                            row.is_active ? "badge-success" : "badge-neutral"
                          }
                        >
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-600">
                        {row.course?.title} · {formatDate(row.start_date)} to{" "}
                        {formatDate(row.end_date)}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        Instructor:{" "}
                        {row.cohort_instructors?.length
                          ? row.cohort_instructors
                              .map((item) => fullName(item.instructor))
                              .join(", ")
                          : "Not assigned"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="btn-ghost !p-2"
                        aria-label={`Assign instructor to ${row.name}`}
                        onClick={() =>
                          setAssigning(assigning === row.id ? null : row.id)
                        }
                      >
                        <UserPlus size={16} />
                      </button>
                      <button
                        className="btn-ghost !p-2"
                        aria-label={`Edit ${row.name}`}
                        onClick={() => edit(row)}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </div>
                  {assigning === row.id && (
                    <div className="mt-4 flex flex-col gap-2 rounded-lg bg-ink-50 p-3 sm:flex-row">
                      <select
                        className="input flex-1"
                        value={instructorId}
                        onChange={(event) =>
                          setInstructorId(event.target.value)
                        }
                      >
                        <option value="">Select an instructor</option>
                        {instructors.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {fullName(profile)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn-primary"
                        disabled={!instructorId || saving}
                        onClick={() => void assign(row.id)}
                      >
                        Assign lead
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
