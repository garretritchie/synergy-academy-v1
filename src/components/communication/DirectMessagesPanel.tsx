import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatDateTime, fullName, getErrorMessage } from "@/lib/format";
import type { DirectMessage, Profile, UserRole } from "@/types";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { Field } from "@/components/ui/FormPanel";
import { UserAvatar } from "@/components/ui/UserAvatar";

type MessageRow = DirectMessage & {
  sender: Profile;
  recipient: Profile;
};

export function DirectMessagesPanel({ role }: { role: UserRole }) {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [messagingAvailable, setMessagingAvailable] = useState(true);

  const loadRecipients = useCallback(async () => {
    if (!user) return [] as Profile[];
    if (role === "administrator") {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .neq("id", user.id)
        .order("last_name");
      if (queryError) throw queryError;
      return (data ?? []) as Profile[];
    }

    if (role === "instructor") {
      const { data: assignments, error: assignmentError } = await supabase
        .from("cohort_instructors")
        .select("cohort_id")
        .eq("instructor_id", user.id);
      if (assignmentError) throw assignmentError;
      const cohortIds = (assignments ?? []).map((item) => item.cohort_id);
      if (!cohortIds.length) return [] as Profile[];
      const { data, error: enrolmentError } = await supabase
        .from("enrolments")
        .select("student:profiles!enrolments_student_id_fkey(*)")
        .in("cohort_id", cohortIds)
        .eq("status", "active");
      if (enrolmentError) throw enrolmentError;
      return (data ?? []).map((item) => item.student) as unknown as Profile[];
    }

    const { data: enrolments, error: enrolmentError } = await supabase
      .from("enrolments")
      .select("cohort_id")
      .eq("student_id", user.id)
      .eq("status", "active");
    if (enrolmentError) throw enrolmentError;
    const cohortIds = (enrolments ?? []).map((item) => item.cohort_id);
    if (!cohortIds.length) return [] as Profile[];
    const { data, error: instructorError } = await supabase
      .from("cohort_instructors")
      .select("instructor:profiles!cohort_instructors_instructor_id_fkey(*)")
      .in("cohort_id", cohortIds);
    if (instructorError) throw instructorError;
    return (data ?? []).map((item) => item.instructor) as unknown as Profile[];
  }, [role, user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setMessagingAvailable(true);
    try {
      const [availableRecipients, messageResult] = await Promise.all([
        loadRecipients(),
        supabase
          .from("direct_messages")
          .select(
            "*,sender:profiles!direct_messages_sender_id_fkey(*),recipient:profiles!direct_messages_recipient_id_fkey(*)",
          )
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: true })
          .limit(100),
      ]);
      if (messageResult.error) throw messageResult.error;
      const uniqueRecipients = Array.from(
        new Map(
          availableRecipients.map((profile) => [profile.id, profile]),
        ).values(),
      ).sort((left, right) => fullName(left).localeCompare(fullName(right)));
      setRecipients(uniqueRecipients);
      setMessages((messageResult.data ?? []) as unknown as MessageRow[]);
      await supabase
        .from("direct_messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
    } catch (caught) {
      const message = getErrorMessage(caught);
      if (isMissingDirectMessagesTable(message)) {
        setMessagingAvailable(false);
        setError("");
      } else {
        setError("Private messages could not be loaded. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [loadRecipients, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !recipientId || !body.trim()) return;
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase
      .from("direct_messages")
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        body: body.trim(),
      });
    if (insertError && isMissingDirectMessagesTable(insertError.message)) {
      setMessagingAvailable(false);
      setError("");
    } else if (insertError)
      setError("Your message could not be sent. Please try again.");
    else {
      setBody("");
      await load();
    }
    setSaving(false);
  };

  return (
    <section className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-center gap-2">
        <MessageCircle size={18} className="text-brand-600" />
        <div>
          <h2 className="font-semibold text-ink-900">Private messages</h2>
          <p className="text-sm text-ink-500">
            Direct, private conversations with your course contacts.
          </p>
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {!messagingAvailable && (
        <div className="mt-4 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900">
          Private messaging is not enabled in the connected academy database
          yet. Apply migration 012 in Bolt Supabase, then refresh this page.
        </div>
      )}
      <form
        onSubmit={send}
        className={`mt-5 grid gap-4 rounded-xl bg-ink-50 p-4 lg:grid-cols-[15rem_minmax(0,1fr)_auto] lg:items-end ${messagingAvailable ? "" : "hidden"}`}
      >
        <Field label="Recipient">
          <select
            required
            className="input"
            value={recipientId}
            onChange={(event) => setRecipientId(event.target.value)}
          >
            <option value="">Select a person</option>
            {recipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {fullName(recipient)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Message">
          <textarea
            required
            maxLength={5000}
            className="input min-h-11 resize-y py-2.5"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a private message"
          />
        </Field>
        <SubmitButton loading={saving} disabled={!recipients.length}>
          <Send size={16} /> Send
        </SubmitButton>
      </form>
      <div className="mt-5 border-t border-ink-100 pt-5">
        {!messagingAvailable ? null : loading ? (
          <TableSkeleton />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={28} />}
            title="No private messages"
            description="Messages exchanged here are visible only to the sender, recipient, and administrators."
          />
        ) : (
          <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {messages.map((message) => {
              const outgoing = message.sender_id === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex max-w-2xl items-end gap-2 ${outgoing ? "ml-auto flex-row-reverse" : ""}`}
                >
                  <UserAvatar
                    profile={message.sender}
                    size="sm"
                    decorative
                  />
                  <article
                    className={`min-w-0 flex-1 rounded-xl border px-4 py-3 ${
                      outgoing
                        ? "border-brand-100 bg-brand-50"
                        : "border-ink-200 bg-ink-50"
                    }`}
                  >
                    <p className="text-xs font-semibold text-ink-600">
                      {outgoing
                        ? `To ${fullName(message.recipient)}`
                        : fullName(message.sender)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800">
                      {message.body}
                    </p>
                    <p className="mt-2 text-xs text-ink-500">
                      {formatDateTime(message.created_at)}
                    </p>
                  </article>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function isMissingDirectMessagesTable(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("direct_messages") &&
    (normalized.includes("schema cache") ||
      normalized.includes("does not exist"))
  );
}
