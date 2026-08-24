import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarClock, ExternalLink, PlayCircle, Video } from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { formatDateTime, fullName } from "@/lib/format";
import type { LiveSession, Profile } from "@/types";

type SessionRow = LiveSession & {
  instructor: Profile | null;
  resolved_recording_url?: string;
};
export function CourseLive() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cohortId) return;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("live_sessions")
        .select("*,instructor:profiles!live_sessions_instructor_id_fkey(*)")
        .eq("cohort_id", cohortId)
        .order("scheduled_start");
      if (queryError) setError(queryError.message);
      else {
        const sessions = (data ?? []) as unknown as SessionRow[];
        const paths = sessions
          .map((session) => session.recording_storage_path)
          .filter((path): path is string => Boolean(path));
        if (paths.length) {
          const { data: signedRecordings } = await supabase.storage
            .from("course-assets")
            .createSignedUrls(paths, 60 * 60);
          const urls = new Map(
            (signedRecordings ?? [])
              .filter((recording) => recording.signedUrl)
              .map((recording) => [recording.path, recording.signedUrl]),
          );
          sessions.forEach((session) => {
            session.resolved_recording_url = session.recording_storage_path
              ? urls.get(session.recording_storage_path)
              : undefined;
          });
        }
        setRows(sessions);
      }
      setLoading(false);
    })();
  }, [cohortId]);
  return (
    <CourseLayout>
      <PageHeader
        title="Live sessions"
        subtitle="Prepare, join class, and revisit recordings."
      />
      <div className="mt-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState
              icon={<Video size={30} />}
              title="No live sessions scheduled"
              description="Your instructor’s sessions will appear here with joining details and preparation notes."
            />
          </div>
        ) : (
          rows.map((session) => {
            const ended = new Date(session.scheduled_end) < new Date();
            return (
              <article
                key={session.id}
                className="rounded-xl bg-white p-5 shadow-soft"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${session.is_cancelled ? "bg-danger-50 text-danger-600" : ended ? "bg-ink-100 text-ink-500" : "bg-brand-50 text-brand-700"}`}
                  >
                    <CalendarClock size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-ink-900">
                        {session.title}
                      </h2>
                      {session.is_cancelled && (
                        <span className="badge-danger">Cancelled</span>
                      )}
                      <span className="badge-neutral">
                        {session.session_type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {formatDateTime(session.scheduled_start)} -
                      {new Intl.DateTimeFormat("en-BS", {
                        timeStyle: "short",
                      }).format(new Date(session.scheduled_end))}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {fullName(session.instructor)}
                    </p>
                    {session.preparation_notes && (
                      <div className="mt-4 rounded-lg bg-ink-50 p-3 text-sm leading-6 text-ink-700">
                        <strong className="font-medium">Before class:</strong>{" "}
                        {session.preparation_notes}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!ended && session.meeting_url && !session.is_cancelled && (
                      <a
                        className="btn-primary"
                        href={session.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Join class <ExternalLink size={15} />
                      </a>
                    )}
                    {(session.resolved_recording_url || session.recording_url) && (
                      <a
                        className="btn-secondary"
                        href={session.resolved_recording_url || session.recording_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <PlayCircle size={16} />
                        Recording
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </CourseLayout>
  );
}
