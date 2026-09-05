export type PathLesson = { id: string; title: string; is_published?: boolean; display_order: number };
export type PathModule = { id: string; title: string; display_order: number; lessons: PathLesson[] };
export type PathActivity = { id: string; title: string; module_id: string | null; submissions: Array<{ status: string }> };
export type PathAssessment = { id: string; title: string; module_id: string | null; passing_score: number | null; assessment_attempts: Array<{ status: string; percentage: number | null }> };
export type PathStep = { id: string; moduleId: string; kind: 'learn' | 'do' | 'assess'; title: string; done: boolean; available: boolean; href: string; reason: string };

/** One ordered path for optional activities/checks and any number of lessons. */
export function buildLearningPath(cohortId: string, modules: PathModule[], activities: PathActivity[], checks: PathAssessment[], completed: Set<string>, released: Set<string>): PathStep[] {
  const steps: PathStep[] = [];
  let previousDone = true;
  for (const module of [...modules].sort((a, b) => a.display_order - b.display_order)) {
    const items = [
      ...module.lessons.filter(l => l.is_published !== false).sort((a,b) => a.display_order-b.display_order).map(l => ({ id:l.id, title:l.title, kind:'learn' as const, done:completed.has(l.id), released:released.has(l.id), href:`/student/courses/${cohortId}/learn/${l.id}` })),
      ...activities.filter(a => a.module_id === module.id).sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id)).map(a => ({ id:a.id, title:a.title, kind:'do' as const, done:a.submissions.some(s => ['submitted','graded'].includes(s.status)), released:true, href:`/student/courses/${cohortId}/learn/activity/${a.id}` })),
      ...checks.filter(a => a.module_id === module.id).sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id)).map(a => ({ id:a.id, title:a.title, kind:'assess' as const, done:a.assessment_attempts.some(s => s.status === 'completed' && s.percentage !== null && Number(s.percentage) >= Number(a.passing_score ?? 0)), released:true, href:`/student/courses/${cohortId}/learn/check/${a.id}` })),
    ];
    for (const item of items) {
      steps.push({ ...item, moduleId:module.id, available:item.released && (previousDone || item.done), reason: !item.released ? 'Not released yet' : item.kind === 'do' ? 'Finish learning first' : item.kind === 'assess' ? 'Finish the previous step first' : 'Finish the previous module first' });
      previousDone = previousDone && item.done;
    }
  }
  return steps;
}
export function pathProgress(steps: PathStep[]) {
  const completed = steps.filter(s => s.done).length;
  return { completed, total:steps.length, percentage:steps.length ? Math.round(completed / steps.length * 100) : 0, next:steps.find(s => s.available && !s.done) };
}
