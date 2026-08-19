import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ScrollText, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { formatDate, fullName } from "@/lib/format";
import type { Cohort, Course, Enrolment, Profile } from "@/types";

type EnrolmentRow = Enrolment & {
  student: Profile;
  cohort: Cohort & { course: Course };
};
type CohortRow = Cohort & { course: Course };
export function AdminEnrolments() {
  const [rows, setRows] = useState<EnrolmentRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [cohortId, setCohortId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const [enrolmentResult, cohortResult, studentResult] = await Promise.all([
      supabase
        .from("enrolments")
        .select(
          "*, student:profiles!enrolments_student_id_fkey(*), cohort:cohorts(*,course:courses(*))",
        )
        .order("enrolled_at", { ascending: false }),
      supabase
        .from("cohorts")
        .select("*,course:courses(*)")
        .eq("is_active", true)
        .order("start_date", { ascending: false }),
      supabase
        .from("profiles")
        .select("*,user_roles!inner(role:roles!inner(name))")
        .eq("user_roles.role.name", "student")
        .eq("is_active", true)
        .order("last_name"),
    ]);
    const queryError =
      enrolmentResult.error || cohortResult.error || studentResult.error;
    if (queryError) setError(queryError.message);
    else {
      setRows((enrolmentResult.data ?? []) as unknown as EnrolmentRow[]);
      setCohorts((cohortResult.data ?? []) as unknown as CohortRow[]);
      setStudents((studentResult.data ?? []) as unknown as Profile[]);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase.from("enrolments").insert({
      cohort_id: cohortId,
      student_id: studentId,
      status: "active",
      metadata: {},
    });
    if (insertError) setError(insertError.message);
    else {
      setOpen(false);
      setStudentId("");
      await load();
    }
    setSaving(false);
  };
  const setStatus = async (row: EnrolmentRow, status: string) => {
    if (status === "completed") {
      const { data: completionData, error: completionError } =
        await supabase.rpc("get_completion_status", {
          enrolment_uuid: row.id,
        });
      if (completionError) {
        setError(
          `${completionError.message}. Apply migration 012 before evaluating completion.`,
        );
        return;
      }
      const completion = completionData as {
        eligible: boolean;
        lessons: { completed: number; required: number };
        assignments: { completed: number; required: number };
        assessments: { completed: number; required: number };
        grade: number | null;
        minimum_grade: number | null;
        attendance: number | null;
        minimum_attendance: number | null;
      };
      if (!completion.eligible) {
        setError(
          `Completion requirements are not met. Lessons ${completion.lessons.completed}/${completion.lessons.required}; assignments ${completion.assignments.completed}/${completion.assignments.required}; quizzes ${completion.assessments.completed}/${completion.assessments.required}; grade ${completion.grade ?? "not recorded"}${completion.minimum_grade === null ? "" : ` (minimum ${completion.minimum_grade}%)`}; attendance ${completion.attendance ?? "not recorded"}${completion.minimum_attendance === null ? "" : ` (minimum ${completion.minimum_attendance}%)`}.`,
        );
        return;
      }
      const { error: completeError } = await supabase.rpc(
        "complete_enrolment",
        { enrolment_uuid: row.id },
      );
      if (completeError) setError(completeError.message);
      else await load();
      return;
    }
    const { error: updateError } = await supabase
      .from("enrolments")
      .update({ status, completion_date: null })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (row.status === "completed") {
      const { error: certificateError } = await supabase
        .from("certificates")
        .delete()
        .eq("enrolment_id", row.id);
      if (certificateError) {
        setError(certificateError.message);
        return;
      }
    }
    await load();
  };
  const remove = async (row: EnrolmentRow) => {
    if (
      !window.confirm(
        `Remove ${fullName(row.student)} from ${row.cohort.name}?`,
      )
    )
      return;
    const { error: deleteError } = await supabase
      .from("enrolments")
      .delete()
      .eq("id", row.id);
    if (deleteError) setError(deleteError.message);
    else await load();
  };
  return (
    <AppLayout>
      <PageHeader
        title="Enrolments"
        subtitle="Grant students access to a cohort and manage their enrolment status."
      />
      <div className="mt-6 space-y-5">
        <FormPanel
          title="Enrol a student"
          description="Students must have an active student role before they can be enrolled."
          open={open}
          onToggle={() => setOpen(!open)}
          actionLabel="New enrolment"
        >
          <form onSubmit={save} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cohort">
                <select
                  required
                  className="input"
                  value={cohortId}
                  onChange={(event) => setCohortId(event.target.value)}
                >
                  <option value="">Select a cohort</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.course.title} - {cohort.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Student">
                <select
                  required
                  className="input"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {fullName(student)} ({student.email})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex justify-end">
              <SubmitButton loading={saving}>Enrol student</SubmitButton>
            </div>
          </form>
        </FormPanel>
        {error && !open && <Alert>{error}</Alert>}
        <section className="overflow-hidden rounded-xl bg-white shadow-soft">
          {loading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ScrollText size={30} />}
              title="No enrolments yet"
              description="Assign the student role to an account, then enrol that student into a cohort."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-5 py-3">Cohort</th>
                    <th className="px-5 py-3">Enrolled</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-ink-900">
                          {fullName(row.student)}
                        </p>
                        <p className="text-xs text-ink-500">
                          {row.student.email}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-ink-900">
                          {row.cohort.course.title}
                        </p>
                        <p className="text-xs text-ink-500">
                          {row.cohort.name}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-ink-600">
                        {formatDate(row.enrolled_at)}
                      </td>
                      <td className="px-5 py-4">
                        <select
                          aria-label={`Status for ${fullName(row.student)}`}
                          className="input !w-36 !py-2"
                          value={row.status}
                          onChange={(event) =>
                            void setStatus(row, event.target.value)
                          }
                        >
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="suspended">Suspended</option>
                          <option value="withdrawn">Withdrawn</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          className="btn-ghost !p-2 text-danger-600"
                          onClick={() => void remove(row)}
                          aria-label={`Remove ${fullName(row.student)}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
