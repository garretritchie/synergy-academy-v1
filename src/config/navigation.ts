import type { UserRole } from "@/types";
import {
  LayoutDashboard,
  BookOpen,
  User,
  Video,
  ClipboardList,
  BarChart3,
  FolderOpen,
  Users,
  Settings,
  ScrollText,
  ClipboardCheck,
} from "lucide-react";
export interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}
export interface NavSection {
  label: string;
  items: NavItem[];
}
export const studentNav: NavSection[] = [
  {
    label: "Learning",
    items: [
      { label: "Dashboard", path: "/student", icon: LayoutDashboard },
      { label: "My Course", path: "/student/my-course", icon: BookOpen },
      { label: "Grades", path: "/student/grades", icon: BarChart3 },
      {
        label: "Attendance",
        path: "/student/attendance",
        icon: ClipboardCheck,
      },
      { label: "Resources", path: "/student/resources", icon: FolderOpen },
      { label: "Profile", path: "/student/profile", icon: User },
    ],
  },
];
export const studentCourseNav: NavItem[] = [
  { label: "Overview", path: "home", icon: LayoutDashboard },
  { label: "Modules", path: "modules", icon: BookOpen },
  { label: "Live Classes", path: "live", icon: Video },
  { label: "Resources", path: "resources", icon: FolderOpen },
];
export const legacyStudentCourseNav: NavItem[] = [
  { label: "Home", path: "legacy-home", icon: LayoutDashboard },
  { label: "Learn", path: "learn", icon: BookOpen },
  { label: "Coursework", path: "coursework", icon: ClipboardList },
  { label: "Live Classes", path: "legacy-live", icon: Video },
  { label: "Performance", path: "performance", icon: BarChart3 },
  { label: "Resources", path: "legacy-resources", icon: FolderOpen },
];
export const instructorNav: NavSection[] = [
  {
    label: "Teaching",
    items: [
      { label: "Dashboard", path: "/instructor", icon: LayoutDashboard },
      { label: "Courses", path: "/instructor/courses", icon: BookOpen },
      { label: "Modules", path: "/instructor/modules", icon: BookOpen },
      { label: "Live Classes", path: "/instructor/live-sessions", icon: Video },
      {
        label: "Submissions",
        path: "/instructor/submissions",
        icon: ClipboardList,
      },
      { label: "Gradebook", path: "/instructor/gradebook", icon: BarChart3 },
      {
        label: "Attendance",
        path: "/instructor/attendance",
        icon: ClipboardCheck,
      },
      { label: "Students", path: "/instructor/students", icon: Users },
      { label: "Profile", path: "/account/profile", icon: User },
    ],
  },
];
export const adminNav: NavSection[] = [
  {
    label: "Academy",
    items: [
      { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
      { label: "Courses", path: "/admin/courses", icon: BookOpen },
      { label: "Cohorts", path: "/admin/cohorts", icon: Users },
      { label: "Live Classes", path: "/admin/live-sessions", icon: Video },
      { label: "Modules", path: "/admin/modules", icon: BookOpen },
      { label: "Students & instructors", path: "/admin/users", icon: Users },
      { label: "Enrolments", path: "/admin/enrolments", icon: ScrollText },
      { label: "Submissions", path: "/admin/submissions", icon: ClipboardList },
      { label: "Grades", path: "/admin/gradebook", icon: BarChart3 },
      { label: "Attendance", path: "/admin/attendance", icon: ClipboardCheck },
      { label: "Settings", path: "/admin/settings", icon: Settings },
    ],
  },
];
export function getNavForRole(role: UserRole): NavSection[] {
  return role === "administrator"
    ? adminNav
    : role === "instructor"
      ? instructorNav
      : studentNav;
}
export function getHomePathForRole(role: UserRole) {
  return role === "administrator"
    ? "/admin"
    : role === "instructor"
      ? "/instructor"
      : "/student";
}
