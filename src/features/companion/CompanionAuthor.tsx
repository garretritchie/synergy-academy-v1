import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Alert } from "@/components/ui/Feedback";
type Question = {
  question_type: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};
export function CompanionAuthor({
  cohortId,
  moduleId,
  onSaved,
}: {
  cohortId: string;
  moduleId: string;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState<"activity" | "assessment" | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [evidence, setEvidence] = useState("");
  const [due, setDue] = useState("");
  const [points, setPoints] = useState(100);
  const [passing, setPassing] = useState(70);
  const [attempts, setAttempts] = useState(2);
  const [graded, setGraded] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const empty = (): Question => ({
    question_type: "multiple_choice",
    question_text: "",
    options: ["", ""],
    correct_answer: "",
    explanation: "",
  });
  const [questions, setQuestions] = useState<Question[]>([empty()]);
  const update = (i: number, value: Partial<Question>) =>
    setQuestions((v) => v.map((q, j) => (j === i ? { ...q, ...value } : q)));
  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("companion_author_item", {
        cohort_uuid: cohortId,
        module_uuid: moduleId,
        item_kind: kind,
        item_data: {
          title,
          instructions,
          evidence,
          due_date: due ? new Date(due).toISOString() : null,
          max_points: points,
          passing_score: passing,
          max_attempts: attempts,
          graded,
          shuffle,
          reveal,
          questions,
        },
      });
      if (r.error) throw r.error;
      setKind(null);
      setTitle("");
      setQuestions([empty()]);
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="companion-surface mt-6">
      <h2>Create module coursework</h2>
      {!kind ? (
        <div className="mt-4 flex gap-3">
          <button className="btn-secondary" onClick={() => setKind("activity")}>
            New activity
          </button>
          <button
            className="btn-secondary"
            onClick={() => setKind("assessment")}
          >
            New assessment
          </button>
        </div>
      ) : (
        <>
          {error && <Alert>{error}</Alert>}
          <div className="companion-staff-grid mt-4">
            <label>
              Title
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              {kind === "activity" ? "Points" : "Passing score (%)"}
              <input
                className="input"
                type="number"
                min="1"
                max={kind === "assessment" ? 100 : 999}
                value={kind === "activity" ? points : passing}
                onChange={(e) =>
                  kind === "activity"
                    ? setPoints(Number(e.target.value))
                    : setPassing(Number(e.target.value))
                }
              />
            </label>
            <label className="sm:col-span-2">
              {kind === "activity"
                ? "Objective and step-by-step instructions"
                : "Assessment instructions"}
              <textarea
                className="input"
                rows={6}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </label>
            {kind === "activity" ? (
              <>
                <label>
                  Required file evidence (leave empty for written response only)
                  <textarea
                    className="input"
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                  />
                </label>
                <label>
                  Due date (optional)
                  <input
                    className="input"
                    type="datetime-local"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <label>
                Maximum attempts
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="20"
                  value={attempts}
                  onChange={(e) => setAttempts(Number(e.target.value))}
                />
              </label>
            )}
          </div>
          {kind === "assessment" && (
            <>
              <div className="mt-4 flex flex-wrap gap-5">
                <label>
                  <input
                    type="checkbox"
                    checked={graded}
                    onChange={(e) => setGraded(e.target.checked)}
                  />{" "}
                  Include in gradebook
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={shuffle}
                    onChange={(e) => setShuffle(e.target.checked)}
                  />{" "}
                  Shuffle question order
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={reveal}
                    onChange={(e) => setReveal(e.target.checked)}
                  />{" "}
                  Reveal answers after submission
                </label>
              </div>
              {questions.map((q, i) => (
                <fieldset key={i} className="mt-6 border-t border-ink-200 pt-5">
                  <legend className="font-semibold">Question {i + 1}</legend>
                  <label className="mt-3 block text-sm">
                    Question type
                    <select
                      className="input mt-2"
                      value={q.question_type}
                      onChange={(e) =>
                        update(i, {
                          question_type: e.target.value,
                          options:
                            e.target.value === "true_false"
                              ? ["True", "False"]
                              : ["", ""],
                          correct_answer: "",
                        })
                      }
                    >
                      <option value="multiple_choice">Multiple choice</option>
                      <option value="multiple_select">Multiple select</option>
                      <option value="true_false">True / False</option>
                    </select>
                  </label>
                  <label className="mt-3 block text-sm">
                    Question
                    <textarea
                      className="input mt-2"
                      value={q.question_text}
                      onChange={(e) =>
                        update(i, { question_text: e.target.value })
                      }
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    Options (one per line)
                    <textarea
                      className="input mt-2"
                      disabled={q.question_type === "true_false"}
                      value={q.options.join("\n")}
                      onChange={(e) =>
                        update(i, { options: e.target.value.split("\n") })
                      }
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    {q.question_type === "multiple_select"
                      ? "Correct options (one exact option per line)"
                      : "Correct option (exact text)"}
                    <textarea
                      className="input mt-2"
                      value={q.correct_answer}
                      onChange={(e) =>
                        update(i, { correct_answer: e.target.value })
                      }
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    Answer explanation
                    <textarea
                      className="input mt-2"
                      value={q.explanation}
                      onChange={(e) =>
                        update(i, { explanation: e.target.value })
                      }
                    />
                  </label>
                  {questions.length > 1 && (
                    <button
                      className="btn-ghost mt-2"
                      onClick={() =>
                        setQuestions((v) => v.filter((_, n) => n !== i))
                      }
                    >
                      Remove question
                    </button>
                  )}
                </fieldset>
              ))}
              <button
                className="btn-secondary mt-5"
                onClick={() => setQuestions((v) => [...v, empty()])}
              >
                Add question
              </button>
            </>
          )}
          <div className="companion-actions">
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => setKind(null)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={busy || !title.trim()}
              onClick={() => void save()}
            >
              Create {kind}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
