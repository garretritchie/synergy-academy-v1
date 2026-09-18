import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Alert } from "@/components/ui/Feedback";
import type { Binding } from "./ComponentPage";
type Question = {
  id: string;
  question_type: string;
  question_text: string;
  options: Array<string | { value: string; label?: string }>;
};
type Quiz = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  passing_score: number;
  max_attempts: number;
  questions: Question[];
};
type Result = {
  percentage: number;
  passed: boolean;
  score: number;
  max_score: number;
};
export function ComponentAssessment({
  bindings,
  enrolmentId,
}: {
  bindings: Binding[];
  enrolmentId: string;
}) {
  const [list, setList] = useState<
    Array<{
      id: string;
      title: string;
      max_attempts: number;
      passing_score: number;
    }>
  >([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [review, setReview] = useState<Record<
    string,
    { correct_answer: string; explanation: string }
  > | null>(null);
  const [expiry, setExpiry] = useState<string | null>(null);
  useEffect(() => {
    const ids = bindings.flatMap((b) =>
      b.assessment_id ? [b.assessment_id] : [],
    );
    if (!ids.length) return;
    let live = true;
    void supabase
      .from("assessments")
      .select("id,title,max_attempts,passing_score")
      .in("id", ids)
      .then((r) => {
        if (live) {
          setList(r.data ?? []);
          setError(r.error?.message ?? "");
        }
      });
    return () => {
      live = false;
    };
  }, [bindings]);
  async function start(id: string) {
    setBusy(true);
    setError("");
    setReview(null);
    try {
      const s = await supabase.rpc("begin_assessment_session", {
        assessment_uuid: id,
        enrolment_uuid: enrolmentId,
      });
      if (s.error) throw s.error;
      const q = await supabase.rpc("get_assessment_for_student", {
        assessment_uuid: id,
      });
      if (q.error) throw q.error;
      setQuiz(q.data);
      setAnswers(s.data.answers ?? {});
      setExpiry(s.data.expires_at ?? null);
      setResult(null);
      setPage(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function previous(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("review_assessment_session", {
        assessment_uuid: id,
      });
      if (r.error) throw r.error;
      const q = await supabase.rpc("get_assessment_for_student", {
        assessment_uuid: id,
      });
      if (q.error) throw q.error;
      setQuiz(q.data);
      setResult(r.data.result);
      setReview(r.data.feedback ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (!quiz) return;
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("submit_assessment_attempt", {
        assessment_uuid: quiz.id,
        enrolment_uuid: enrolmentId,
        submitted_answers: answers,
      });
      if (r.error) throw r.error;
      setResult(r.data);
      const v = await supabase.rpc("review_assessment_session", {
        assessment_uuid: quiz.id,
      });
      if (!v.error) setReview(v.data.feedback ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changeAnswer(id: string, value: string | string[]) {
    if (!quiz) return;
    setAnswers((a) => ({ ...a, [id]: value }));
    setBusy(true);
    const r = await supabase.rpc("companion_save_answer", {
      assessment_uuid: quiz.id,
      question_uuid: id,
      answer_value: value,
    });
    if (r.error) setError(r.error.message);
    setBusy(false);
  }
  const question = quiz?.questions[page];
  return (
    <section className="companion-surface">
      {error && <Alert>{error}</Alert>}
      {!quiz ? (
        <>
          <h2>Check your understanding</h2>
          <p className="companion-caption">
            Your results are saved to your student record. Complete each
            question before submitting.
          </p>
          {list.map((a) => (
            <div className="companion-row" key={a.id}>
              <div>
                <strong>{a.title}</strong>
                <p className="mt-1 text-sm text-ink-500">
                  Pass: {a.passing_score}% · {a.max_attempts} configured
                  attempts
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void previous(a.id)}
                >
                  View saved result
                </button>
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void start(a.id)}
                >
                  Start or resume
                </button>
              </div>
            </div>
          ))}
          {!list.length && (
            <p className="mt-4">No assessment has been posted yet.</p>
          )}
        </>
      ) : result ? (
        <>
          <h2>Assessment complete</h2>
          <p className="mt-5 text-4xl font-semibold">{result.percentage}%</p>
          <p className="mt-3">
            {result.passed ? "Passed" : "Not passed yet"} · {result.score} /{" "}
            {result.max_score} points
          </p>
          {review &&
            quiz.questions.map((q) => (
              <div className="mt-5" key={q.id}>
                <h3 className="font-medium">{q.question_text}</h3>
                <p className="mt-2 text-sm">
                  Answer: {review[q.id]?.correct_answer}
                </p>
                <p className="mt-2 text-sm text-ink-600">
                  {review[q.id]?.explanation}
                </p>
              </div>
            ))}
          <button
            className="btn-secondary mt-6"
            onClick={() => {
              setQuiz(null);
              setResult(null);
            }}
          >
            Back to assessments
          </button>
        </>
      ) : (
        <>
          <h2>{quiz.title}</h2>
          {quiz.instructions && (
            <p className="companion-caption">{quiz.instructions}</p>
          )}
          {expiry && (
            <p className="mt-3 text-sm">
              Complete by {new Date(expiry).toLocaleTimeString()}
            </p>
          )}
          <p className="mt-6 text-sm text-ink-500">
            Question {page + 1} of {quiz.questions.length}
          </p>
          {question ? (
            <fieldset className="mt-3">
              <legend className="text-xl font-medium">
                {question.question_text}
              </legend>
              {question.question_type === "multiple_select" && (
                <p className="mt-2 text-sm text-ink-500">
                  Select all correct answers.
                </p>
              )}
              {question.options.map((o, i) => {
                const value = typeof o === "string" ? o : o.value;
                const label = typeof o === "string" ? o : (o.label ?? o.value);
                const multi = question.question_type === "multiple_select";
                const selected = answers[question.id];
                return (
                  <label className="companion-question" key={i}>
                    <input
                      type={multi ? "checkbox" : "radio"}
                      name={question.id}
                      checked={
                        multi
                          ? Array.isArray(selected) && selected.includes(value)
                          : selected === value
                      }
                      disabled={busy}
                      onChange={(e) =>
                        void changeAnswer(
                          question.id,
                          multi
                            ? e.target.checked
                              ? [
                                  ...(Array.isArray(selected) ? selected : []),
                                  value,
                                ]
                              : (Array.isArray(selected)
                                  ? selected
                                  : []
                                ).filter((v) => v !== value)
                            : value,
                        )
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <p>No questions have been configured.</p>
          )}
          <div className="companion-actions">
            <button
              className="btn-secondary"
              disabled={page === 0 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            {page < quiz.questions.length - 1 ? (
              <button
                className="btn-primary"
                onClick={() => setPage((p) => p + 1)}
              >
                Next question
              </button>
            ) : (
              <button
                className="btn-primary"
                disabled={
                  busy ||
                  !quiz.questions.length ||
                  quiz.questions.some(
                    (q) =>
                      !answers[q.id] ||
                      (Array.isArray(answers[q.id]) &&
                        answers[q.id].length === 0),
                  )
                }
                onClick={() => void finish()}
              >
                {busy ? "Submitting…" : "Submit assessment"}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
