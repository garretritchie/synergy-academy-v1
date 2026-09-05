import fs from "node:fs";

const content = JSON.parse(fs.readFileSync("src/content/ai-business-essentials.json", "utf8"));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const checks = content.assessments.filter((item) => item.kind === "module_check");
const introduction = content.modules.find((item) => item.id === "introduction");
const midterm = content.assessments.find((item) => item.kind === "midterm");
const finalExam = content.assessments.find((item) => item.kind === "final");

expect(content.course.id === "B1-101", "Course ID must be B1-101");
expect(content.modules.length === 13, "Course must contain Introduction plus 12 numbered modules");
expect(content.modules.reduce((total, item) => total + item.screens.length, 0) === 298, "Expected 298 eLearning screens including worked examples");
expect(Boolean(introduction), "Introduction module is missing");
expect(!content.assessments.some((item) => item.unlockModule === "introduction"), "Introduction must not have an assessment");
expect(introduction?.screens.at(-1)?.next_label === "Go to Module 1", "Introduction must hand off to Module 1");
expect(checks.length === 12, "Every numbered module must have one module check");
expect(checks.every((item) => item.questions.length === 10), "Every module check must have 10 questions");
expect(midterm?.questions.length === 30, "Midterm must contain 30 questions");
expect(finalExam?.questions.length === 48, "Final exam must contain 48 questions");
expect(content.activities.length === 12, "Numbered modules have activities; Introduction continues directly to Module 1");
expect(content.activities.every((item) => item.instructions.length >= 3 && item.selfCheck.length >= 3), "Activities need detailed directions and self-checks");
expect(content.assignments.filter((item) => item.type === "homework").length === 4, "Exactly four homework assignments are required");
expect(content.assignments.some((item) => item.id === "capstone-final"), "Capstone final submission is missing");
expect(JSON.stringify(content).toLowerCase().includes("self-paced") === false, "Learner-facing content must use eLearning, not self-paced learning");
const allQuestions=content.assessments.flatMap(a=>a.questions);
expect(new Set(allQuestions.map(q=>q.question)).size===allQuestions.length,'Every practice and graded prompt must be distinct');
expect(allQuestions.every(q=>q.options.includes(q.answer)&&q.explanation!==q.answer),'Every answer must have a teaching explanation');
expect(!allQuestions.some(q=>q.question.startsWith('Which statement best explains')),'Sentence-recognition bank must not return');
expect(content.assessments.every(a=>a.kind==='module_check'||a.maxAttempts===1),'All graded assessments must allow one attempt');

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({
  course: content.course.id,
  modules: content.modules.length,
  screens: content.modules.reduce((total, item) => total + item.screens.length, 0),
  moduleChecks: checks.length,
  assessmentQuestions: content.assessments.reduce((total, item) => total + item.questions.length, 0),
  activities: content.activities.length,
  assignments: content.assignments.length,
}, null, 2));
