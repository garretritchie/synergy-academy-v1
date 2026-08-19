import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ClipboardCheck, Download, FileSpreadsheet, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { Field } from "@/components/ui/FormPanel";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { fullName } from "@/lib/format";
import type { AttendanceRecord, Grade, GradeCategory, GradeItem, Profile } from "@/types";

type CohortOption = {
  id: string;
  name: string;
  course: { title: string };
};

type EnrolmentRow = {
  id: string;
  student_id: string;
  status: string;
  final_grade: number | null;
  student: Profile;
};

type LearnerReport = {
  enrolmentId: string;
  student: Profile;
  status: string;
  currentGrade: number | null;
  finalGrade: number | null;
  attendanceRate: number | null;
  present: number;
  late: number;
  absent: number;
  excused: number;
  notMarked: number;
};

export function AdminReporting() {
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [cohortId, setCohortId] = useState("");
  const [rows, setRows] = useState<LearnerReport[]>([]);
  const [heldSessions, setHeldSessions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase
      .from("cohorts")
      .select("id,name,course:courses(title)")
      .order("start_date", { ascending: false })
      .then(({ data, error: cohortError }) => {
        if (cohortError) setError(cohortError.message);
        else {
          const options = (data ?? []) as unknown as CohortOption[];
          setCohorts(options);
          setCohortId(options[0]?.id || "");
        }
        setInitialLoading(false);
      });
  }, []);

  const generateReport = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    setError("");
    const [enrolmentResult, sessionResult, categoryResult] =
      await Promise.all([
        supabase
          .from("enrolments")
          .select("id,student_id,status,final_grade,student:profiles!enrolments_student_id_fkey(*)")
          .eq("cohort_id", cohortId)
          .in("status", ["active", "completed", "withdrawn", "suspended"]),
        supabase
          .from("live_sessions")
          .select("id")
          .eq("cohort_id", cohortId)
          .eq("is_cancelled", false)
          .lte("scheduled_start", new Date().toISOString()),
        supabase
          .from("grade_categories")
          .select("*")
          .eq("cohort_id", cohortId)
          .order("display_order"),
      ]);
    const firstError =
      enrolmentResult.error ||
      sessionResult.error ||
      categoryResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const enrolments = (enrolmentResult.data ?? []) as unknown as EnrolmentRow[];
    const categories = (categoryResult.data ?? []) as GradeCategory[];
    const sessionIds = (sessionResult.data ?? []).map((session) => session.id);
    const attendanceResult = sessionIds.length
      ? await supabase
          .from("attendance_records")
          .select("*")
          .in("live_session_id", sessionIds)
      : { data: [], error: null };
    if (attendanceResult.error) {
      setError(attendanceResult.error.message);
      setLoading(false);
      return;
    }
    const categoryIds = categories.map((category) => category.id);
    let items: GradeItem[] = [];
    let grades: Grade[] = [];
    if (categoryIds.length && enrolments.length) {
      const itemResult = await supabase
        .from("grade_items")
        .select("*")
        .in("grade_category_id", categoryIds);
      if (itemResult.error) {
        setError(itemResult.error.message);
        setLoading(false);
        return;
      }
      items = (itemResult.data ?? []) as GradeItem[];
      if (items.length) {
        const gradeResult = await supabase
          .from("grades")
          .select("*")
          .in("enrolment_id", enrolments.map((row) => row.id))
          .in("grade_item_id", items.map((item) => item.id));
        if (gradeResult.error) {
          setError(gradeResult.error.message);
          setLoading(false);
          return;
        }
        grades = (gradeResult.data ?? []) as Grade[];
      }
    }

    const attendance = (attendanceResult.data ?? []) as AttendanceRecord[];
    const itemCategory = new Map(items.map((item) => [item.id, item.grade_category_id]));
    const completedSessionCount = sessionResult.data?.length ?? 0;
    setHeldSessions(completedSessionCount);
    setRows(
      enrolments
        .map((enrolment) => {
          const learnerAttendance = attendance.filter(
            (record) => record.enrolment_id === enrolment.id,
          );
          const countedAttendance = learnerAttendance.filter(
            (record) => record.status !== "excused",
          );
          const attended = countedAttendance.filter((record) =>
            ["present", "late", "left_early"].includes(record.status),
          ).length;
          const learnerGrades = grades.filter(
            (grade) =>
              grade.enrolment_id === enrolment.id &&
              !grade.is_excused &&
              grade.percentage !== null,
          );
          const categoryScores = categories
            .map((category) => {
              const categoryGrades = learnerGrades.filter(
                (grade) => itemCategory.get(grade.grade_item_id) === category.id,
              );
              return categoryGrades.length
                ? {
                    score:
                      categoryGrades.reduce(
                        (sum, grade) => sum + Number(grade.percentage),
                        0,
                      ) / categoryGrades.length,
                    weight: Number(category.weight),
                  }
                : null;
            })
            .filter((value): value is { score: number; weight: number } => Boolean(value));
          const representedWeight = categoryScores.reduce(
            (sum, category) => sum + category.weight,
            0,
          );
          const currentGrade = categoryScores.length
            ? representedWeight > 0
              ? categoryScores.reduce(
                  (sum, category) => sum + category.score * category.weight,
                  0,
                ) / representedWeight
              : learnerGrades.reduce(
                  (sum, grade) => sum + Number(grade.percentage),
                  0,
                ) / learnerGrades.length
            : null;
          return {
            enrolmentId: enrolment.id,
            student: enrolment.student,
            status: enrolment.status,
            currentGrade:
              currentGrade === null ? null : Math.round(currentGrade * 10) / 10,
            finalGrade: enrolment.final_grade,
            attendanceRate: countedAttendance.length
              ? Math.round((attended / countedAttendance.length) * 1000) / 10
              : null,
            present: learnerAttendance.filter((record) => record.status === "present").length,
            late: learnerAttendance.filter((record) => record.status === "late").length,
            absent: learnerAttendance.filter((record) => record.status === "absent").length,
            excused: learnerAttendance.filter((record) => record.status === "excused").length,
            notMarked: Math.max(0, completedSessionCount - learnerAttendance.length),
          };
        })
        .sort((left, right) => fullName(left.student).localeCompare(fullName(right.student))),
    );
    setLoading(false);
  }, [cohortId]);

  useEffect(() => {
    if (cohortId) void generateReport();
  }, [cohortId, generateReport]);

  const selectedCohort = cohorts.find((cohort) => cohort.id === cohortId);
  const summary = useMemo(() => {
    const grades = rows.flatMap((row) =>
      row.currentGrade === null ? [] : [row.currentGrade],
    );
    const attendance = rows.flatMap((row) =>
      row.attendanceRate === null ? [] : [row.attendanceRate],
    );
    return {
      learners: rows.length,
      grade: grades.length
        ? Math.round((grades.reduce((sum, value) => sum + value, 0) / grades.length) * 10) / 10
        : null,
      attendance: attendance.length
        ? Math.round((attendance.reduce((sum, value) => sum + value, 0) / attendance.length) * 10) / 10
        : null,
    };
  }, [rows]);

  const download = (kind: "gradebook" | "attendance") => {
    const header =
      kind === "gradebook"
        ? ["Student", "Email", "Status", "Current grade (%)", "Final grade (%)"]
        : [
            "Student",
            "Email",
            "Attendance rate (%)",
            "Present",
            "Late",
            "Absent",
            "Excused",
            "Not marked",
          ];
    const body = rows.map((row) =>
      kind === "gradebook"
        ? [
            fullName(row.student),
            row.student.email,
            row.status,
            row.currentGrade ?? "",
            row.finalGrade ?? "",
          ]
        : [
            fullName(row.student),
            row.student.email,
            row.attendanceRate ?? "",
            row.present,
            row.late,
            row.absent,
            row.excused,
            row.notMarked,
          ],
    );
    const csv = [header, ...body]
      .map((line) => line.map(csvValue).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(selectedCohort?.course.title || "course")}-${slugify(selectedCohort?.name || "cohort")}-${kind}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Academic reporting"
        subtitle="Generate live cohort gradebooks and attendance registers from the academy database."
      />
      <div className="mt-6 space-y-5">
        {error && <Alert>{error}</Alert>}
        <section className="page-section p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-end">
            <Field label="Cohort" hint="Reports include active, completed, suspended, and withdrawn enrolments.">
              <select
                className="input"
                value={cohortId}
                onChange={(event) => setCohortId(event.target.value)}
                disabled={initialLoading}
              >
                <option value="">Select a cohort</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.course.title} / {cohort.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" disabled={!rows.length} onClick={() => download("gradebook")}>
                <FileSpreadsheet size={16} /> Export gradebook
              </button>
              <button className="btn-primary" disabled={!rows.length} onClick={() => download("attendance")}>
                <Download size={16} /> Export attendance
              </button>
            </div>
          </div>
          <p className="mt-4 border-t border-ink-100 pt-4 text-xs leading-5 text-ink-500">
            Current grade uses configured category weights represented by graded work. Attendance rate counts present, late, and left early as attended; excused and unmarked sessions are shown separately.
          </p>
        </section>

        {loading || initialLoading ? (
          <div className="page-section"><TableSkeleton /></div>
        ) : !cohortId ? (
          <div className="page-section">
            <EmptyState icon={<BarChart3 size={30} />} title="Choose a cohort" description="Select a cohort to generate its academic records." />
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ReportMetric icon={Users} label="Learners" value={String(summary.learners)} />
              <ReportMetric icon={BarChart3} label="Current grade" value={summary.grade === null ? "Not graded" : `${summary.grade}%`} />
              <ReportMetric icon={ClipboardCheck} label="Attendance" value={summary.attendance === null ? "Not recorded" : `${summary.attendance}%`} />
              <ReportMetric icon={ClipboardCheck} label="Live classes held" value={String(heldSessions)} />
            </section>
            <section className="page-section overflow-hidden">
              <div className="border-b border-ink-100 px-5 py-4">
                <h2 className="font-display text-sm font-semibold text-ink-950">Learner record preview</h2>
                <p className="mt-1 text-xs text-ink-500">{selectedCohort?.course.title} · {selectedCohort?.name}</p>
              </div>
              {rows.length === 0 ? (
                <EmptyState icon={<Users size={30} />} title="No enrolled learners" description="Enrol students before generating this report." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-50 uppercase tracking-wide text-ink-500">
                      <tr>
                        <th className="px-5 py-3">Learner</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Current grade</th>
                        <th className="px-5 py-3">Attendance</th>
                        <th className="px-5 py-3">P / L / A / E</th>
                        <th className="px-5 py-3">Unmarked</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {rows.map((row) => (
                        <tr key={row.enrolmentId}>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-ink-900">{fullName(row.student)}</p>
                            <p className="mt-0.5 text-ink-500">{row.student.email}</p>
                          </td>
                          <td className="px-5 py-4 capitalize text-ink-600">{row.status}</td>
                          <td className="px-5 py-4 font-semibold text-ink-900">{row.currentGrade === null ? "Not available" : `${row.currentGrade}%`}</td>
                          <td className="px-5 py-4 font-semibold text-ink-900">{row.attendanceRate === null ? "Not available" : `${row.attendanceRate}%`}</td>
                          <td className="px-5 py-4 tabular-nums text-ink-600">{row.present} / {row.late} / {row.absent} / {row.excused}</td>
                          <td className="px-5 py-4 tabular-nums text-ink-600">{row.notMarked}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function ReportMetric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="page-section p-5">
      <div className="flex items-center justify-between text-ink-500">
        <span className="text-xs font-medium">{label}</span>
        <Icon size={17} className="text-brand-600" />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-ink-950">{value}</p>
    </div>
  );
}

function csvValue(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
