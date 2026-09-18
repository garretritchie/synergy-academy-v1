import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Alert } from "@/components/ui/Feedback";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { fullName } from "@/lib/format";
import type { Profile } from "@/types";
import { safeWebUrl } from "./model";
type Details = {
  id?: string;
  title: string;
  qualifications: string;
  specialization: string;
  welcome_video_url: string;
};
const empty: Details = {
  title: "",
  qualifications: "",
  specialization: "",
  welcome_video_url: "",
};
export function InstructorIdentityEditor() {
  const { user, roles } = useAuth();
  const [form, setForm] = useState<Details>(empty);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user || !roles.includes("instructor")) return;
    void supabase
      .from("instructor_profiles")
      .select("id,title,qualifications,specialization,welcome_video_url")
      .eq("profile_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle()
      .then((r) => {
        if (r.error) setError(r.error.message);
        else if (r.data)
          setForm({
            ...empty,
            ...Object.fromEntries(
              Object.entries(r.data).map(([k, v]) => [k, v ?? ""]),
            ),
          });
      });
  }, [user, roles]);
  if (!roles.includes("instructor")) return null;
  return (
    <section className="card-elevated mt-6 p-6">
      <h2 className="text-lg font-semibold">Teaching profile</h2>
      <p className="mt-2 text-sm text-ink-600">
        Your name, photo and biography come from your profile above.
      </p>
      {error && <Alert>{error}</Alert>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {(
          [
            ["title", "Professional title"],
            ["qualifications", "Qualifications"],
            ["specialization", "Specialization"],
            ["welcome_video_url", "Welcome video URL"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm font-medium">
            {label}
            <input
              className="input mt-2"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <button
        className="btn-primary mt-5"
        disabled={busy}
        onClick={async () => {
          if (!user) return;
          setError("");
          setMessage("");
          if (form.welcome_video_url && !safeWebUrl(form.welcome_video_url)) {
            setError("Use a valid HTTP or HTTPS video URL.");
            return;
          }
          setBusy(true);
          const values = { ...form, profile_id: user.id };
          const r = form.id
            ? await supabase
                .from("instructor_profiles")
                .update(values)
                .eq("id", form.id)
                .select()
                .single()
            : await supabase
                .from("instructor_profiles")
                .insert(values)
                .select()
                .single();
          if (r.error) setError(r.error.message);
          else {
            setForm(r.data);
            setMessage("Teaching profile saved.");
          }
          setBusy(false);
        }}
      >
        Save teaching profile
      </button>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
export function TeachingTeam({ cohortId }: { cohortId: string }) {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      instructor: Profile & { instructor_profiles: Details[] };
    }>
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cohortId) return;
    let live = true;
    void supabase
      .from("cohort_instructors")
      .select(
        "id,instructor:profiles!cohort_instructors_instructor_id_fkey(*,instructor_profiles(id,title,qualifications,specialization,welcome_video_url))",
      )
      .eq("cohort_id", cohortId)
      .order("is_lead", { ascending: false })
      .then((r) => {
        if (live) {
          setError(r.error?.message ?? "");
          setRows((r.data ?? []) as unknown as typeof rows);
        }
      });
    return () => {
      live = false;
    };
  }, [cohortId]);
  return (
    <section className="companion-surface mt-6">
      <h2>Your teaching team</h2>
      {error && <Alert>{error}</Alert>}
      {rows.map((r) => {
        const d = r.instructor?.instructor_profiles?.[0];
        return (
          <article className="companion-row" key={r.id}>
            <div className="flex items-start gap-4">
              <UserAvatar profile={r.instructor} size="lg" decorative />
              <div>
                <h3 className="font-semibold">{fullName(r.instructor)}</h3>
                {d?.title && <p className="mt-1 text-sm">{d.title}</p>}
                {d?.qualifications && (
                  <p className="mt-2 text-sm text-ink-600">
                    {d.qualifications}
                  </p>
                )}
                {d?.specialization && (
                  <p className="mt-2 text-sm">{d.specialization}</p>
                )}
                {r.instructor?.bio && (
                  <p className="mt-3 text-sm leading-6">{r.instructor.bio}</p>
                )}
                {safeWebUrl(d?.welcome_video_url) && (
                  <a
                    className="btn-secondary mt-3"
                    target="_blank"
                    rel="noreferrer"
                    href={safeWebUrl(d?.welcome_video_url)}
                  >
                    Watch instructor welcome
                  </a>
                )}
              </div>
            </div>
          </article>
        );
      })}
      {!rows.length && !error && (
        <p className="companion-caption">
          Your instructor will appear here when assigned.
        </p>
      )}
    </section>
  );
}
