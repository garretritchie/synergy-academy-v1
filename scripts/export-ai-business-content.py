"""Build the checked-in AI Business Essentials LMS content from the approved storyboards.

Run from the SynergyAcademy repository with the bundled Codex Python runtime:
  python scripts/export-ai-business-content.py
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path


DEFAULT_SOURCE = Path(r"D:\CODEX\AI Class\Build")
DEFAULT_OUTPUT = Path("src/content/ai-business-essentials.json")


def load_module(name: str, source: Path):
    spec = importlib.util.spec_from_file_location(name, source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def plain(value: object) -> str:
    text = re.sub(r"<[^>]+>", "", str(value))
    return re.sub(r"\s+", " ", text).strip()


def clean(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return plain(value) if isinstance(value, str) else value
    if isinstance(value, list):
        return [clean(item) for item in value]
    if isinstance(value, tuple):
        return [clean(item) for item in value]
    if isinstance(value, dict):
        return {
            str(key): clean(item)
            for key, item in value.items()
            if key not in {"accent", "fill"}
        }
    return plain(value)


MODULE_DETAILS = [
    ("introduction", "Introduction", "Welcome, course map, grading, safety, and how to use the academy."),
    ("module-01", "Module 1: AI Basics and Safe First Steps", "AI abilities, limits, risks, and safe first uses."),
    ("module-02", "Module 2: Prompting, Revision, and Checking Output", "Clear work orders, CIDI, focused revision, and quality checks."),
    ("module-03", "Module 3: Choosing AI Tools and Models", "Products, models, access, privacy, risk, and fair comparison."),
    ("module-04", "Module 4: AI for Everyday Work", "Planning, summaries, ideas, and useful first drafts."),
    ("module-05", "Module 5: Workplace Communication", "Email, reports, plain language, tone, and approval."),
    ("module-06", "Module 6: Multimodal and Digital Creation", "Images, documents, audio, rights, access, and disclosure."),
    ("module-07", "Module 7: Research and Evidence", "Questions, sources, evidence, citations, and limits."),
    ("module-08", "Module 8: Data and Decisions", "Clean tables, formulas, charts, and sound decisions."),
    ("module-09", "Module 9: Meetings and Coordination", "Agendas, notes, decisions, owners, and follow-through."),
    ("module-10", "Module 10: Business Adoption and ROI", "Processes, pilots, value, full cost, and change."),
    ("module-11", "Module 11: Automation, Agents, and Codex", "Safe automation, access, tests, logs, and recovery."),
    ("module-12", "Module 12: Course Review and Reference", "Course review, key terms, checklists, and exam preparation."),
]


ACTIVITIES = [
    ("introduction", "Set up your learning workspace", ["Open each of the four course areas.", "Create a folder named AI Business Essentials.", "Write down one safe practice task and one question for your instructor."], ["I opened Learning, Assessments, Activities, and Assignments.", "My course folder is ready.", "My practice task uses public, fictional, supplied, or approved information."]),
    ("module-01", "Sort tasks by AI capability", ["List five tasks from work or daily life.", "Label each task as rules, prediction, generation, retrieval, or agentic action.", "Choose one low-risk task and name the person who would review the result."], ["Every task has one main capability label.", "The chosen task has a clear input and output.", "A human reviewer and stop point are named."]),
    ("module-02", "Build and test a CIDI prompt", ["Choose a small writing or organizing task.", "Write Context, Instruction, Details, and Input as separate lines.", "Run the prompt, mark one weakness, and revise only the weak part."], ["All four CIDI parts are present.", "The input contains no unapproved private data.", "The revision names a specific weakness and fixes it."]),
    ("module-03", "Compare two AI options fairly", ["Choose one approved task and one test input.", "Run the same prompt and input in two available tools or models.", "Score accuracy, usefulness, privacy fit, effort, and cost on a five-point scale."], ["Both options received the same test.", "The scores use written criteria.", "The recommendation states limits and access needs."]),
    ("module-04", "Turn rough notes into a checked draft", ["Use supplied or fictional notes for a short plan or summary.", "Ask AI for a first draft with a named audience and format.", "Compare every claim with the source notes and correct the draft."], ["The purpose and audience are clear.", "All claims trace back to the notes.", "The final version shows human edits."]),
    ("module-05", "Rewrite one message for two audiences", ["Choose a safe workplace message.", "Create a version for a busy manager and a version for a customer or teammate.", "Check tone, facts, promises, privacy, and the requested action."], ["The meaning stays the same in both versions.", "Tone and detail fit each audience.", "No unsupported promise or private detail remains."]),
    ("module-06", "Create from a one-page brief", ["Write a brief with audience, purpose, format, must-have items, and limits.", "Create one image, document, audio clip, or chart from the brief.", "Inspect rights, consent, accuracy, accessibility, and disclosure needs."], ["The asset matches the brief.", "Text and facts were checked by a person.", "Rights, access, and disclosure were considered."]),
    ("module-07", "Build a source-checked evidence note", ["Write one focused research question.", "Find two original or authoritative sources.", "Record each key claim, source, date, and what the evidence does not prove."], ["The question is narrow enough to answer.", "Every important claim has a checked source.", "Facts, interpretation, advice, and limits are separated."]),
    ("module-08", "Check a small data story", ["Use a supplied or public table with at least two numeric columns.", "Clean headings, units, dates, and missing values.", "Calculate one result twice and create a chart that answers one clear question."], ["Missing values were not guessed.", "The second calculation matches the first.", "The chart title states the question and units are visible."]),
    ("module-09", "Turn a meeting into accountable follow-up", ["Use fictional or approved meeting notes.", "Separate discussion, decisions, open questions, and actions.", "Give each action one owner and a due point, then draft a short follow-up."], ["No discussion item was changed into a decision.", "Every action has an owner and due point.", "The follow-up shares only the right level of detail."]),
    ("module-10", "Design a small AI pilot", ["Name one repeated business problem and the current process.", "Choose one limited AI-assisted step and a small test group.", "Define quality, time, cost, risk, stop rules, and a review date."], ["The pilot starts with a business problem.", "Baseline and success measures are written.", "People, policy, support, and rollback are included."]),
    ("module-11", "Map a safe agent workflow", ["Draw the trigger, inputs, tools, actions, approvals, logs, and final output.", "Mark which data and permissions the agent truly needs.", "Test a normal case, an edge case, a failure, and a misuse attempt."], ["Permissions follow least access.", "High-impact actions require approval.", "Logs, stop rules, and recovery steps are clear."]),
    ("module-12", "Make a personal exam review map", ["Write one sentence that explains the main lesson from each module.", "Mark three weak areas and return to the matching screens.", "Answer three new workplace scenarios without notes, then check your reasoning."], ["All twelve modules have a plain-language summary.", "Weak areas link to specific learning screens.", "Scenario answers include evidence, risk, and human responsibility."]),
]


ASSIGNMENTS = [
    {"id": "homework-1", "title": "Homework 1: Tested Prompt Portfolio", "type": "homework", "module": "module-02", "weight": 2.5, "points": 100, "instructions": ["Choose one safe, useful workplace task.", "Submit the first prompt and output.", "Show your CIDI revision, checks, corrected output, and final decision.", "Explain in 150 to 300 words what improved and what still needs human review."], "checklist": ["Task and audience are clear.", "No unapproved private information is included.", "First and revised versions are labeled.", "Checks and human decision are visible."]},
    {"id": "homework-2", "title": "Homework 2: Workplace Communication Package", "type": "homework", "module": "module-05", "weight": 2.5, "points": 100, "instructions": ["Create one email and one short report section from approved or fictional source notes.", "State the audience, purpose, tone, and action for each.", "Submit source notes, AI-assisted drafts, your corrections, and final versions."], "checklist": ["Both items trace back to source notes.", "Tone and detail fit the audience.", "Facts, privacy, promises, and authority were checked.", "Final versions show human ownership."]},
    {"id": "homework-3", "title": "Homework 3: Data Decision Brief", "type": "homework", "module": "module-08", "weight": 2.5, "points": 100, "instructions": ["Prepare a small supplied, public, or approved dataset.", "Show one checked calculation and one suitable chart.", "Write a one-page brief that separates evidence, meaning, recommendation, and limits."], "checklist": ["Headings, units, dates, and missing values are clear.", "The calculation was checked a second way.", "The chart answers one named question.", "The recommendation does not overstate the evidence."]},
    {"id": "homework-4", "title": "Homework 4: Safe Automation Plan", "type": "homework", "module": "module-11", "weight": 2.5, "points": 100, "instructions": ["Map one repeated workflow that could use limited automation.", "Document inputs, tools, permissions, approvals, logs, failure cases, and recovery.", "Submit the workflow map and a short test report."], "checklist": ["The simplest safe automation level was chosen.", "Permissions are limited.", "High-impact actions require approval.", "Normal, edge, failure, and misuse cases are tested."]},
    {"id": "capstone-brief", "title": "Capstone: Project Brief and Proposal", "type": "project", "module": "module-03", "weight": 0, "points": 0, "instructions": ["Choose one small business problem or repeated task.", "Describe the current process, users, approved information, desired result, and why the problem matters.", "Propose one limited AI-assisted improvement and name the human owner.", "List early measures, risks, limits, and evidence you plan to collect."], "checklist": ["The problem is specific and small enough to test.", "The proposal names users, data, and human ownership.", "Success measures and stop rules are included."]},
    {"id": "capstone-working-file", "title": "Capstone: Working File and Evidence", "type": "project", "module": "module-10", "weight": 0, "points": 0, "instructions": ["Collect your approved inputs, prompts or workflow, outputs, checks, corrections, and decisions.", "Record time, cost, quality, risk, and user feedback from the test.", "Explain failures and changes instead of hiding them."], "checklist": ["Evidence is dated and organized.", "Important claims can be checked.", "Corrections and failed tests are visible.", "Private information is removed or approved."]},
    {"id": "capstone-final", "title": "Capstone: Final Submission", "type": "project", "module": "module-12", "weight": 0, "points": 100, "instructions": ["Submit a clear summary of the problem, current process, proposed improvement, test, results, risks, controls, cost, value, and next recommendation.", "Include your evidence appendix and a short guide another person could follow.", "State what AI did, what people did, and who owns the final decision."], "checklist": ["The result answers the original business problem.", "Evidence supports the claimed value.", "Risks, limits, approvals, and recovery are clear.", "The package can be understood without the full ebook."]},
    {"id": "capstone-presentation", "title": "Capstone Presentation", "type": "presentation", "module": "module-12", "weight": 20, "points": 100, "instructions": ["Prepare a 7 to 10 minute presentation.", "Explain the problem, evidence, design, test, result, risk controls, human role, and next step.", "Be ready to answer questions and show one key artifact."], "checklist": ["The story is clear and within time.", "Claims match the submitted evidence.", "The human decision and limits are explicit.", "Slides or visuals are readable and accessible."]},
]


def statement_candidates(screen: dict) -> list[str]:
    candidates: list[str] = []
    for key in ("lead", "callout", "start_body", "recap_note"):
        if screen.get(key):
            candidates.append(plain(screen[key]))
    candidates.extend(plain(item) for item in screen.get("bullets", []))
    for card in screen.get("cards", []):
        candidates.append(plain(card.get("body", "")))
    for side in screen.get("sides", []):
        candidates.extend(plain(item) for item in side.get("items", []))
    return [item for item in candidates if 12 <= len(item) <= 190]


def make_questions(module_id: str, screens: list[dict]) -> list[dict]:
    usable = [(screen, statement_candidates(screen)) for screen in screens]
    usable = [(screen, candidates) for screen, candidates in usable if candidates]
    selected = usable[1:11] if len(usable) > 10 else usable[:10]
    pool = [candidates[0] for _, candidates in usable]
    questions = []
    for index, (screen, candidates) in enumerate(selected):
        correct = candidates[0]
        distractors = []
        offset = 1
        while len(distractors) < 3 and offset <= len(pool) + 3:
            candidate = pool[(index + offset * 3) % len(pool)]
            if candidate != correct and candidate not in distractors:
                distractors.append(candidate)
            offset += 1
        options = [correct, *distractors]
        rotation = index % len(options)
        options = options[rotation:] + options[:rotation]
        questions.append({
            "id": f"{module_id}-q{index + 1:02d}",
            "question": f"Which statement best explains \"{plain(screen.get('title', 'this topic'))}\"?",
            "options": options,
            "answer": correct,
            "explanation": correct,
        })
    if len(questions) != 10:
        raise RuntimeError(f"{module_id} produced {len(questions)} questions instead of 10")
    return questions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    module1_dir = args.source / "lms_module1_sample"
    sys.path.insert(0, str(module1_dir))
    remaining = load_module(
        "remaining_modules_content",
        args.source / "lms_full_course" / "remaining_modules_content.py",
    )
    module1 = load_module(
        "module1_storyboard",
        module1_dir / "build_module1_elearning_sample_v1_1.py",
    )

    introduction = clean(remaining.INTRODUCTION["screens"])
    introduction[-1]["callout"] = "You are ready to begin. Select Go to Module 1 to open the first learning module."
    introduction[-1]["next_label"] = "Go to Module 1"
    source_screens = [introduction, clean(module1.SCREENS)] + [
        clean(item["screens"]) for item in remaining.PROGRAM[1:]
    ]
    if len(source_screens) != len(MODULE_DETAILS):
        raise RuntimeError("The source module count does not match the LMS module map")

    modules = []
    checks = []
    for order, ((module_id, title, description), screens) in enumerate(
        zip(MODULE_DETAILS, source_screens),
    ):
        modules.append({
            "id": module_id,
            "order": order,
            "title": title,
            "description": description,
            "estimatedMinutes": max(10, round(len(screens) * 1.5)),
            "screens": [dict(screen, id=f"{module_id}-screen-{index + 1:02d}") for index, screen in enumerate(screens)],
        })
        if module_id != "introduction":
            checks.append({
                "id": f"{module_id}-check",
                "title": f"{title.split(':', 1)[0]} Check",
                "kind": "module_check",
                "unlockModule": module_id,
                "passingScore": 70,
                "maxAttempts": 3,
                "questions": make_questions(module_id, screens),
            })

    check_map = {item["unlockModule"]: item["questions"] for item in checks}
    graded = [
        {"id": "graded-quiz-1", "title": "Graded Quiz 1: AI Foundations", "kind": "graded_quiz", "unlockModule": "module-03", "passingScore": 70, "maxAttempts": 2, "questions": sum((check_map[f"module-{number:02d}"][:5] for number in range(1, 4)), [])},
        {"id": "midterm-exam", "title": "Midterm Exam: Modules 1 to 6", "kind": "midterm", "unlockModule": "module-06", "passingScore": 70, "maxAttempts": 1, "questions": sum((check_map[f"module-{number:02d}"][:5] for number in range(1, 7)), [])},
        {"id": "graded-quiz-3", "title": "Graded Quiz 3: Evidence, Data, and Teamwork", "kind": "graded_quiz", "unlockModule": "module-09", "passingScore": 70, "maxAttempts": 2, "questions": sum((check_map[f"module-{number:02d}"][:5] for number in range(7, 10)), [])},
        {"id": "final-exam", "title": "Final Exam: AI Business Essentials", "kind": "final", "unlockModule": "module-12", "passingScore": 70, "maxAttempts": 1, "questions": sum((check_map[f"module-{number:02d}"][:4] for number in range(1, 13)), [])},
    ]

    payload = {
        "course": {
            "id": "B1-101",
            "title": "AI Business Essentials",
            "subtitle": "Fundamentals of Artificial Intelligence for Business Professionals",
            "description": "A beginner-friendly course for using artificial intelligence in practical workplace tasks with evidence, privacy, safety, and human judgment.",
            "grading": {"homework": 10, "quizzes": 40, "presentation": 20, "finalExam": 30},
            "scale": {"A": "90%-100%", "B": "80%-89%", "C": "70%-79%", "D": "60%-69%", "F": "Below 60%"},
            "version": "3.8-lms-1.0",
        },
        "modules": modules,
        "assessments": checks + graded,
        "activities": [
            {"id": f"{module_id}-activity", "module": module_id, "title": title, "instructions": instructions, "selfCheck": checklist}
            for module_id, title, instructions, checklist in ACTIVITIES
        ],
        "assignments": ASSIGNMENTS,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "modules": len(modules),
        "screens": sum(len(item["screens"]) for item in modules),
        "assessments": len(payload["assessments"]),
        "questions": sum(len(item["questions"]) for item in payload["assessments"]),
        "activities": len(payload["activities"]),
        "assignments": len(payload["assignments"]),
    }, indent=2))


if __name__ == "__main__":
    main()
