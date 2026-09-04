import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  LockKeyhole,
  MessageSquare,
  Video,
} from "lucide-react";
import courseContent from "@/content/ai-business-essentials.json";
import { StoryboardScreen, type StoryboardContent } from "@/pages/student/course/StoryboardScreen";

type Section = "learning" | "assessments" | "assignments" | "discussions" | "resources" | "live";

const courseTabs = [
  ["learning", "Learning", BookOpen],
  ["assessments", "Assessments", BrainCircuit],
  ["assignments", "Assignments", ClipboardList],
  ["discussions", "Discussion Board", MessageSquare],
  ["resources", "Resources", FileText],
  ["live", "Live Meetings", Video],
] as const;

export function DevCoursePreview() {
  const [started, setStarted] = useState(false);
  const [section, setSection] = useState<Section>("learning");
  const [moduleIndex, setModuleIndex] = useState(0);
  const [screenIndex, setScreenIndex] = useState(0);
  const [completedModules, setCompletedModules] = useState<string[]>([]);

  if (!started) return <CourseStart onStart={() => setStarted(true)} />;

  const module = courseContent.modules[moduleIndex];
  const screen = module.screens[screenIndex] as StoryboardContent;
  const lastScreen = screenIndex === module.screens.length - 1;
  const screenProgress = Math.round(((screenIndex + 1) / module.screens.length) * 100);
  const courseProgress = Math.round((completedModules.length / courseContent.modules.length) * 100);
  const finishModule = () => {
    setCompletedModules((current) => current.includes(module.id) ? current : [...current, module.id]);
    if (module.id === "introduction") {
      setModuleIndex(1);
      setScreenIndex(0);
    } else {
      setSection("assessments");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink-900">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => setStarted(false)} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100" aria-label="Back to course selection">
            <ArrowLeft size={18} />
          </button>
          <img src="/brand/synergy-bahamas-logo-full-color.png" alt="Synergy Bahamas" className="h-auto w-32" />
          <span className="h-7 w-px bg-ink-200" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-950">AI Business Essentials</p>
            <p className="text-xs text-ink-500">B1-101 · Student preview</p>
          </div>
        </div>
      </header>

      <nav className="scrollbar-thin border-b border-ink-200 bg-white" aria-label="Course areas">
        <div className="mx-auto flex max-w-7xl min-w-max overflow-x-auto px-4 sm:px-6">
          {courseTabs.map(([value, label, Icon]) => (
            <button key={value} type="button" className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${section === value ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-900"}`} onClick={() => setSection(value)}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>
      </nav>

      {section === "learning" && (
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="grid min-h-[40rem] overflow-hidden rounded-2xl bg-white shadow-elevated lg:h-[42rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
            <aside className="hidden min-h-0 flex-col bg-navy text-white lg:flex">
              <div className="border-b border-white/10 px-5 py-5">
                <p className="text-sm font-semibold">Course progress</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-brand-300" style={{ width: `${courseProgress}%` }} /></div>
                  <span className="text-xs font-semibold tabular-nums text-brand-200">{courseProgress}%</span>
                </div>
              </div>
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {courseContent.modules.map((item, index) => {
                  const active = index === moduleIndex;
                  const unlocked = index === 0 || completedModules.includes(courseContent.modules[index - 1].id);
                  const completed = completedModules.includes(item.id);
                  return (
                    <button key={item.id} type="button" disabled={!unlocked} onClick={() => { setModuleIndex(index); setScreenIndex(0); }} className={`mb-1 flex min-h-14 w-full gap-3 rounded-lg px-3 py-2.5 text-left ${active ? "bg-white/12" : unlocked ? "hover:bg-white/[0.07]" : "cursor-not-allowed opacity-50"}`}>
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${completed ? "bg-success-600" : active ? "bg-brand-500" : "bg-white/10"}`}>
                        {completed ? <CheckCircle2 size={15} /> : unlocked ? (item.order || "I") : <LockKeyhole size={13} />}
                      </span>
                      <span className="min-w-0"><span className="block text-xs font-semibold">{item.order === 0 ? "Introduction" : `Module ${item.order}`}</span><span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-slate-300">{item.title.replace(/^Module \d+: /, "")}</span></span>
                    </button>
                  );
                })}
              </div>
              <p className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-slate-300">Complete each module check to unlock the next module.</p>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-col">
              <header className="border-b border-ink-200 px-5 py-4 sm:px-7">
                <p className="text-xs font-semibold text-brand-700">{module.order === 0 ? "Introduction" : `Module ${module.order}`}</p>
                <div className="mt-1 flex items-start justify-between gap-4">
                  <h1 className="text-xl font-semibold tracking-[-0.025em] text-ink-950 sm:text-2xl">{module.title}</h1>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">{screenProgress}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-label="Module progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={screenProgress}>
                  <div className="h-full rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${screenProgress}%` }} />
                </div>
              </header>
              <section className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"><StoryboardScreen content={screen} /></section>
              <footer className="grid grid-cols-2 items-center gap-2 border-t border-white/10 bg-navy px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:px-5">
                <button type="button" className="btn-secondary w-full sm:w-auto" disabled={screenIndex === 0} onClick={() => setScreenIndex((current) => Math.max(0, current - 1))}><ArrowLeft size={16} /> Back</button>
                <p className="order-first col-span-2 text-center text-xs font-semibold tabular-nums text-brand-200 sm:order-none sm:col-span-1">{screenProgress}% complete</p>
                <div className="flex justify-end">
                  {lastScreen ? (
                    <button type="button" className="btn-primary w-full sm:w-auto" onClick={finishModule}>{module.id === "introduction" ? "Go to Module 1" : "Go to assessment"} <ArrowRight size={16} /></button>
                  ) : (
                    <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setScreenIndex((current) => current + 1)}>Next <ArrowRight size={16} /></button>
                  )}
                </div>
              </footer>
            </div>
          </div>
        </main>
      )}
      {section === "assessments" && <CardGrid title="Assessments" subtitle="Module checks and major exams unlock at the right time.">{courseContent.assessments.slice(0, 8).map((item) => <PreviewCard key={item.id} icon={LockKeyhole} title={item.title} body={`${item.questions.length} questions · ${item.passingScore}% pass mark`} />)}</CardGrid>}
      {section === "assignments" && <CardGrid title="Assignments" subtitle="Homework and every capstone stage stay together.">{courseContent.assignments.map((item) => <PreviewCard key={item.id} icon={ClipboardList} title={item.title} body={`${item.instructions.length} instructions · ${item.checklist.length}-point submission check`} />)}</CardGrid>}
      {section === "discussions" && <CardGrid title="Discussion Board" subtitle="Ask questions, share examples, and learn with your cohort."><PreviewCard icon={MessageSquare} title="Welcome to AI Business Essentials" body="Introduce yourself and share one work task you hope AI can help improve." /><PreviewCard icon={MessageSquare} title="Module conversations" body="Each discussion keeps ideas, replies, and instructor guidance together." /></CardGrid>}
      {section === "resources" && <CardGrid title="Resources" subtitle="Open course slides, eBooks, templates, and supporting references."><PreviewCard icon={FileText} title="AI Business Essentials student eBook" body="Complete course reference · PDF" /><PreviewCard icon={FileText} title="Module slides and downloads" body="Instructor-posted files appear here as they are released." /></CardGrid>}
      {section === "live" && <CardGrid title="Live meetings" subtitle="Find Zoom links, preparation notes, and recordings."><PreviewCard icon={Video} title="Upcoming Zoom meeting" body="The instructor’s meeting link and scheduled time will appear here." action="Open Zoom link" /></CardGrid>}
    </div>
  );
}

function CourseStart({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="border-b border-ink-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><img src="/brand/synergy-bahamas-logo-full-color.png" alt="Synergy Bahamas" className="h-auto w-36" /><span className="text-sm font-semibold text-ink-600">Demo Student</span></div></header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-navy sm:text-4xl">Welcome, Demo.</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-600">Choose a course to begin learning or continue where you stopped.</p>
        <div className="mt-9 flex items-center justify-between"><h2 className="font-display text-xl font-semibold text-ink-950">Choose a course</h2><span className="text-sm text-ink-500">1 active course</span></div>
        <article className="group mt-5 flex max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-elevated">
          <div className="relative aspect-[16/8] overflow-hidden bg-navy"><img src="/demo/fundamentals-ai-business-cover.png" alt="" className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-[1.03]" /><span className="absolute left-4 top-4 rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy">B1-101</span></div>
          <div className="flex min-h-56 flex-col p-6"><h2 className="font-display text-lg font-semibold leading-6 text-ink-950">AI Business Essentials</h2><p className="mt-2 text-sm text-ink-500">AI Business Essentials Academy Cohort</p><div className="mt-auto pt-6"><div className="mb-2 flex justify-between text-xs font-semibold"><span>Course progress</span><span className="tabular-nums text-brand-700">0% complete</span></div><div className="h-2 rounded-full bg-ink-100" /><button type="button" onClick={onStart} className="btn-primary mt-5 w-full">Start course <ArrowRight size={16} /></button></div></div>
        </article>
      </main>
    </div>
  );
}

function CardGrid({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><h1 className="text-2xl font-semibold text-ink-950">{title}</h1><p className="mt-2 text-sm text-ink-500">{subtitle}</p><div className="mt-6 grid gap-4 md:grid-cols-2">{children}</div></main>;
}

function PreviewCard({ icon: Icon, title, body, action = "Open" }: { icon: typeof BookOpen; title: string; body: string; action?: string }) {
  return <article className="rounded-xl bg-white p-5 shadow-soft"><div className="flex items-start gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon size={19} /></span><div><h2 className="font-semibold text-ink-950">{title}</h2><p className="mt-2 text-sm leading-6 text-ink-600">{body}</p></div></div><button type="button" className="btn-secondary mt-5 w-full">{action} <ExternalLink size={15} /></button></article>;
}
