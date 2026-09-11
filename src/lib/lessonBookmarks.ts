export type LessonBookmark = { lesson_id: string; screen_index: number; updated_at: string };
const key = (student: string, cohort: string) => `academy-bookmarks:v1:${student}:${cohort}`;
export function readBookmarks(student: string, cohort: string): LessonBookmark[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(key(student, cohort)) || '[]');
    return Array.isArray(rows) ? rows.filter((row): row is LessonBookmark => typeof row?.lesson_id === 'string' && Number.isInteger(row.screen_index) && row.screen_index >= 0 && Number.isFinite(Date.parse(row.updated_at))) : [];
  } catch { return []; }
}
export function mergeBookmarks(...lists: LessonBookmark[][]): LessonBookmark[] {
  const result = new Map<string, LessonBookmark>();
  for (const row of lists.flat()) if (!result.has(row.lesson_id) || Date.parse(row.updated_at) > Date.parse(result.get(row.lesson_id)!.updated_at)) result.set(row.lesson_id, row);
  return [...result.values()].sort((a,b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}
export function writeBookmark(student: string, cohort: string, row: LessonBookmark): boolean {
  try { localStorage.setItem(key(student, cohort), JSON.stringify(mergeBookmarks([row],readBookmarks(student,cohort)))); return true; } catch { return false; }
}
export function legacyScreen(student: string, cohort: string, lesson: string): number {
  try { const n=Number(localStorage.getItem(`academy-position:${student}:${cohort}:${lesson}`)); return Number.isInteger(n) && n>=0 ? n : 0; } catch { return 0; }
}
export function clampScreen(index: number, count: number): number { return Number.isInteger(index) ? Math.max(0, Math.min(index, Math.max(0,count-1))) : 0; }
