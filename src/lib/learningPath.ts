export type PathLesson = { id: string; title: string; is_published?: boolean; display_order: number };
export type PathModule = { id: string; title: string; display_order: number; lessons: PathLesson[] };
export type PathActivity = { id: string; title: string; module_id: string | null; submissions: Array<{ status: string }> };
export type PathAssessment = { id: string; title: string; module_id: string | null; passing_score: number | null; assessment_attempts: Array<{ status: string; percentage: number | null }> };
export type PathStep = { id: string; moduleId: string; kind: 'learn' | 'do' | 'assess'; title: string; done: boolean; available: boolean; href: string; reason: string };

/** One ordered path for optional activities/checks and any number of lessons. */
export function buildLearningPath(cohortId: string, modules: PathModule[], activities: PathActivity[], checks: PathAssessment[], completed: Set<string>, released: Set<string>, releaseReasons: Map<string, string> = new Map()): PathStep[] {
  const steps: PathStep[] = [];
  let previousDone = true;
  for (const module of [...modules].sort((a, b) => a.display_order - b.display_order)) {
    const previousModulePrerequisite = steps.find(step => !step.done);
    const moduleLearning = module.lessons.filter(l => l.is_published !== false);
    const learningDone = moduleLearning.every(l => completed.has(l.id));
    const learningReleased = moduleLearning.every(l => released.has(l.id));
    const items = [
      ...module.lessons.filter(l => l.is_published !== false).sort((a,b) => a.display_order-b.display_order).map(l => ({ id:l.id, title:l.title, kind:'learn' as const, done:completed.has(l.id), released:released.has(l.id), href:`/student/courses/${cohortId}/learn/${l.id}` })),
      ...activities.filter(a => a.module_id === module.id).sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id)).map(a => ({ id:a.id, title:a.title, kind:'do' as const, done:a.submissions.some(s => ['submitted','graded'].includes(s.status)), released:true, href:`/student/courses/${cohortId}/learn/activity/${a.id}` })),
      ...checks.filter(a => a.module_id === module.id).sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id)).map(a => ({ id:a.id, title:a.title, kind:'assess' as const, done:a.assessment_attempts.some(s => s.status === 'completed' && s.percentage !== null && Number(s.percentage) >= Number(a.passing_score ?? 0)), released:true, href:`/student/courses/${cohortId}/learn/check/${a.id}` })),
    ];
    for (const item of items) {
      const prerequisite = item.kind === 'learn' ? steps.find(step => !step.done) : previousModulePrerequisite ?? steps.find(step => step.moduleId === module.id && step.kind === 'learn' && !step.done);
      const prerequisiteReason = prerequisite ? `Complete ${prerequisite.kind === 'do' ? 'the activity' : prerequisite.kind === 'assess' ? 'the knowledge check' : 'the learning'}: ${prerequisite.title}` : '';
      const reason = !item.released ? [releaseReasons.get(item.id) || 'Waiting for your instructor to release this content.', !item.done ? prerequisiteReason : ''].filter(Boolean).join(' Then ') : prerequisiteReason;
      const available = item.kind === 'learn' ? item.released && (previousDone || item.done) : learningReleased && (item.done || (!previousModulePrerequisite && learningDone));
      steps.push({ ...item, moduleId:module.id, available, reason:available ? '' : reason || 'Waiting for the module learning to be released.' });
      previousDone = previousDone && item.done;
    }
  }
  return steps;
}
export function pathProgress(steps: PathStep[]) {
  const completed = steps.filter(s => s.done).length;
  return { completed, total:steps.length, percentage:steps.length ? Math.round(completed / steps.length * 100) : 0, next:steps.find(s => s.available && !s.done) };
}
