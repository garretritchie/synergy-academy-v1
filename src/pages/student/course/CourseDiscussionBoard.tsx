import { DiscussionActions } from '@/components/communication/DiscussionActions';
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  MessageCircle,
  MessageSquare,
  Pin,
  Send,
  SmilePlus,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { CourseLayout } from "./CourseLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime, fullName } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Discussion, DiscussionPost } from "@/types";
import { UserAvatar } from "@/components/ui/UserAvatar";

const REACTIONS = ["👍", "💡", "👏", "❤️"] as const;
type FeedDiscussion = Discussion & { discussion_posts: DiscussionPost[] };

export function CourseDiscussions() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<FeedDiscussion[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("discussions")
      .select("*,author:profiles(*),discussion_posts(*,author:profiles(*))")
      .eq("cohort_id", cohortId)
      .eq("is_question", false)
      .is("parent_id", null)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setRows((data ?? []) as unknown as FeedDiscussion[]);
    setLoading(false);
  }, [cohortId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!cohortId || !user || !title.trim() || !body.trim()) return;
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase.from("discussions").insert({
      cohort_id: cohortId,
      title: title.trim(),
      body: body.trim(),
      author_id: user.id,
      is_question: false,
    });
    if (insertError) setError(insertError.message);
    else {
      setTitle("");
      setBody("");
      await load();
    }
    setSaving(false);
  };

  const addReply = async (discussionId: string) => {
    const reply = replyDrafts[discussionId]?.trim();
    if (!user || !reply) return;
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase
      .from("discussion_posts")
      .insert({
        discussion_id: discussionId,
        author_id: user.id,
        body: reply,
      });
    if (insertError) setError(insertError.message);
    else {
      setReplyDrafts((current) => ({ ...current, [discussionId]: "" }));
      await load();
    }
    setSaving(false);
  };

  const toggleReaction = async (row: FeedDiscussion, emoji: string) => {
    if (!user) return;
    const current = row.discussion_posts.find(
      (post) => post.author_id === user.id && post.body === emoji,
    );
    const result = current
      ? await supabase.from("discussion_posts").delete().eq("id", current.id)
      : await supabase.from("discussion_posts").insert({
          discussion_id: row.id,
          author_id: user.id,
          body: emoji,
        });
    if (result.error) setError(result.error.message);
    else await load();
  };

  return (
    <CourseLayout>
      <PageHeader
        title="Discussion Board"
        subtitle="Share ideas, reply to classmates, and learn together in your private course cohort."
      />
      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <form
            onSubmit={createPost}
            className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-soft"
          >
            <div className="flex gap-3">
              <UserAvatar profile={profile} />
              <div className="min-w-0 flex-1">
                <label htmlFor="discussion-title" className="sr-only">
                  Post title
                </label>
                <input
                  id="discussion-title"
                  className="w-full border-0 p-0 text-base font-semibold text-ink-950 outline-none placeholder:text-ink-400 focus:ring-0"
                  placeholder="What would you like to discuss?"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <label htmlFor="discussion-body" className="sr-only">
                  Post details
                </label>
                <textarea
                  id="discussion-body"
                  className="mt-2 min-h-20 w-full resize-none border-0 p-0 text-sm leading-6 text-ink-700 outline-none placeholder:text-ink-400 focus:ring-0"
                  placeholder="Share an idea, example, or question with your cohort."
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
              <p className="text-xs text-ink-500">
                Visible only to this course cohort
              </p>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving || !title.trim() || !body.trim()}
              >
                <Send size={15} />
                {saving ? "Posting..." : "Post"}
              </button>
            </div>
          </form>

          {loading ? (
            <div className="rounded-xl bg-white shadow-soft">
              <TableSkeleton />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl bg-white shadow-soft">
              <EmptyState
                icon={<MessageSquare size={30} />}
                title="Start the conversation"
                description="Be the first learner to share an idea or question."
              />
            </div>
          ) : (
            rows.map((row) => {
              const replies = [...(row.discussion_posts ?? [])]
                .filter(
                  (post) =>
                    !REACTIONS.includes(
                      post.body as (typeof REACTIONS)[number],
                    ),
                )
                .sort((a, b) => a.created_at.localeCompare(b.created_at));
              const isReplying = replyingTo === row.id;
              return (
                <article
                  key={row.id}
                  className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-soft"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <UserAvatar profile={row.author} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink-950">
                            {fullName(row.author)}
                          </p>
                          {row.is_pinned && (
                            <span className="badge-warning">
                              <Pin size={11} />
                              Pinned
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {formatDateTime(row.created_at)}
                        </p>
                      </div>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-ink-950">
                      {row.title}
                    </h2>
                    <DiscussionActions post={row} onChanged={()=>void load()}/>{row.body && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-700">
                        {row.body}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-y border-ink-100 bg-ink-50/60 px-5 py-2.5">
                    {REACTIONS.map((emoji) => {
                      const matching = row.discussion_posts.filter(
                        (post) => post.body === emoji,
                      );
                      const active = matching.some(
                        (post) => post.author_id === user?.id,
                      );
                      return (
                        <button
                          key={emoji}
                          type="button"
                          aria-label={`${active ? "Remove" : "Add"} ${emoji} reaction`}
                          onClick={() => void toggleReaction(row, emoji)}
                          className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${active ? "border-brand-200 bg-brand-50 text-brand-800" : "border-ink-200 bg-white text-ink-600 hover:border-brand-200"}`}
                        >
                          <span aria-hidden="true">{emoji}</span>
                          {matching.length > 0 && (
                            <span className="text-xs font-semibold tabular-nums">
                              {matching.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setReplyingTo(isReplying ? "" : row.id)}
                      className="ml-auto flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-600 hover:bg-white"
                    >
                      <MessageCircle size={15} />
                      {replies.length}{" "}
                      {replies.length === 1 ? "reply" : "replies"}
                    </button>
                  </div>
                  {(replies.length > 0 || isReplying) && (
                    <div className="space-y-3 px-5 py-4">
                      {replies.map((reply) => (
                        <div key={reply.id} className="flex gap-3">
                          <UserAvatar profile={reply.author} size="sm" />
                          <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-ink-50 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-ink-950">
                                {fullName(reply.author)}
                              </p>
                              <span className="text-[11px] text-ink-500">
                                {formatDateTime(reply.created_at)}
                              </span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-ink-700">
                              {reply.body}
                            </p>
                          </div>
                        </div>
                      ))}
                      {isReplying && (
                        <div className="flex gap-3">
                          <UserAvatar profile={profile} size="sm" />
                          <div className="min-w-0 flex-1">
                            <textarea
                              autoFocus
                              className="input min-h-20 resize-none"
                              placeholder="Write a reply..."
                              value={replyDrafts[row.id] ?? ""}
                              onChange={(event) =>
                                setReplyDrafts((current) => ({
                                  ...current,
                                  [row.id]: event.target.value,
                                }))
                              }
                            />
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center gap-1 text-sm text-ink-500">
                                <SmilePlus size={16} />
                                {REACTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="rounded-md px-1.5 py-1 hover:bg-ink-100"
                                    onClick={() =>
                                      setReplyDrafts((current) => ({
                                        ...current,
                                        [row.id]: `${current[row.id] ?? ""}${emoji}`,
                                      }))
                                    }
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="btn-primary"
                                disabled={
                                  saving || !replyDrafts[row.id]?.trim()
                                }
                                onClick={() => void addReply(row.id)}
                              >
                                <Send size={14} />
                                Reply
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
        <aside className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-soft xl:sticky xl:top-4">
          <h2 className="font-semibold text-ink-950">Community guidelines</h2>
          <ul className="mt-3 space-y-3 text-sm leading-5 text-ink-600">
            <li>Be respectful and helpful.</li>
            <li>Keep posts related to the course.</li>
            <li>
              Do not share private company, customer, or personal information.
            </li>
            <li>Disagree with ideas, not people.</li>
          </ul>
        </aside>
      </div>
    </CourseLayout>
  );
}
