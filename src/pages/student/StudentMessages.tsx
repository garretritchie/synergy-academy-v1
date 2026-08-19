/* The loader is scoped to the authenticated user and reused by mark-all-read. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Mail } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime } from "@/lib/format";
import type { Notification } from "@/types";
import { DirectMessagesPanel } from "@/components/communication/DirectMessagesPanel";

export function StudentMessages() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    if (!user) return;
    const { data, error: queryError } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setRows((data ?? []) as Notification[]);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [user]);
  const markAll = async () => {
    if (!user) return;
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (updateError) setError(updateError.message);
    else await load();
  };
  return (
    <AppLayout>
      <PageHeader
        title="Notifications"
        subtitle="Private course updates, reminders, and academic activity."
        actions={
          rows.some((row) => !row.is_read) ? (
            <button className="btn-secondary" onClick={() => void markAll()}>
              <CheckCheck size={16} />
              Mark all read
            </button>
          ) : undefined
        }
      />
      <div className="mt-6 space-y-5">
        <DirectMessagesPanel role="student" />
        <section>
          {error && <Alert>{error}</Alert>}
          {loading ? (
            <div className="rounded-xl bg-white shadow-soft">
              <TableSkeleton />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl bg-white shadow-soft">
              <EmptyState
                icon={<Mail size={30} />}
                title="No notifications"
                description="Course reminders and personal updates will appear here."
              />
            </div>
          ) : (
            <div className="divide-y divide-ink-100 overflow-hidden rounded-xl bg-white shadow-soft">
              {rows.map((row) => (
                <article
                  key={row.id}
                  className={`flex gap-4 px-5 py-4 ${row.is_read ? "" : "bg-brand-50/50"}`}
                >
                  <Bell
                    size={18}
                    className={row.is_read ? "text-ink-400" : "text-brand-600"}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-ink-900">{row.title}</h2>
                      {!row.is_read && (
                        <span
                          className="h-2 w-2 rounded-full bg-brand-600"
                          aria-label="Unread"
                        />
                      )}
                    </div>
                    {row.body && (
                      <p className="mt-1 text-sm text-ink-600">{row.body}</p>
                    )}
                    <p className="mt-2 text-xs text-ink-500">
                      {formatDateTime(row.created_at)}
                    </p>
                    {row.link_url && (
                      <Link
                        to={row.link_url}
                        className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800"
                      >
                        Open update
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
