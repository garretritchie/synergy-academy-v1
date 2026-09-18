export type ComponentType =
  | "ebook_recap"
  | "video"
  | "audio"
  | "activity"
  | "assessment"
  | "resources"
  | "live_session";
export type ComponentStatus = "not_started" | "in_progress" | "completed";
export interface ComponentSummary {
  id: string;
  type: ComponentType;
  title: string;
  required: boolean;
  status: ComponentStatus;
}
export interface ModuleSummary {
  id: string;
  title: string;
  description: string | null;
  display_order: number;
  available: boolean;
  release_at: string | null;
  components: ComponentSummary[];
}
export interface Outline {
  enabled: boolean;
  enrolment_id: string;
  modules: ModuleSummary[];
}
export const componentLabels: Record<ComponentType, string> = {
  ebook_recap: "eBook Recap",
  video: "Video Explainer",
  audio: "Audio Recap",
  activity: "Activities",
  assessment: "Assessment",
  resources: "Resources",
  live_session: "Live Class",
};
export const statusLabels: Record<ComponentStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};
export function progressOf(components: ComponentSummary[]) {
  const required = components.filter((c) => c.required);
  const completed = required.filter((c) => c.status === "completed").length;
  return {
    completed,
    total: required.length,
    percent: required.length
      ? Math.round((completed / required.length) * 100)
      : 0,
  };
}
export function nextModule(modules: ModuleSummary[]) {
  return modules.find(
    (m) =>
      m.available &&
      m.components.some(
        (c) =>
          c.required && c.type !== "live_session" && c.status !== "completed",
      ),
  );
}
export function componentPath(
  cohort: string,
  module: string,
  component: string,
) {
  return `/student/courses/${cohort}/modules/${module}/components/${component}`;
}
export function safeWebUrl(value: string | null | undefined) {
  try {
    const u = new URL(value ?? "");
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
export function youtubeEmbed(value: string) {
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, "");
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1)
        : ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(
              host,
            )
          ? (u.searchParams.get("v") ??
            u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1])
          : null;
    return id && /^[\w-]{11}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : "";
  } catch {
    return "";
  }
}
