import type { UserRole } from "@/types";
import {
  LayoutDashboard,
  BookOpen,
  Mail,
  Award,
  User,
  Video,
  ClipboardList,
  BarChart3,
  FolderOpen,
  MessageSquare,
  Megaphone,
  Users,
  GraduationCap,
  Settings,
  FolderTree,
  ScrollText,
  Layers,
  ClipboardCheck,
  BrainCircuit,
  Clock3,
  Building2,
  WandSparkles,
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
    label: "Main",
    items: [
      { label: "Dashboard", path: "/student", icon: LayoutDashboard },
      { label: "My Courses", path: "/student/courses", icon: BookOpen },
      { label: "Messages", path: "/student/messages", icon: Mail },
      { label: "Certificates", path: "/student/certificates", icon: Award },
      { label: "Profile", path: "/student/profile", icon: User },
    ],
  },
];

export const studentCourseNav: NavItem[] = [
  { label: "Home", path: "home", icon: LayoutDashboard },
  { label: "Learning", path: "learn", icon: BookOpen },
  { label: "Assessments", path: "assessments", icon: BrainCircuit },
  { label: "Assignments", path: "assignments", icon: ClipboardList },
  { label: "Discussion Board", path: "discussions", icon: MessageSquare },
  { label: "Resources", path: "resources", icon: FolderOpen },
  { label: "Live Meetings", path: "live", icon: Video },
];

export const instructorNav: NavSection[] = [
  {
    label: "Teaching",
    items: [
      { label: "Dashboard", path: "/instructor", icon: LayoutDashboard },
      { label: "My Cohorts", path: "/instructor/courses", icon: BookOpen },
      {
        label: "Live Sessions",
        path: "/instructor/live-sessions",
        icon: Video,
      },
      {
        label: "Assignments",
        path: "/instructor/assignments",
        icon: ClipboardList,
      },
      { label: "Course Resources", path: "/instructor/resources", icon: FolderOpen },
      {
        label: "Attendance",
        path: "/instructor/attendance",
        icon: ClipboardCheck,
      },
      { label: "Gradebook", path: "/instructor/gradebook", icon: BarChart3 },
      { label: "Students", path: "/instructor/students", icon: Users },
      {
        label: "Communications",
        path: "/instructor/communications",
        icon: Megaphone,
      },
    ],
  },
];

export const adminNav: NavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", path: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Courses & delivery",
    items: [
      {
        label: "Course Studio",
        path: "/admin/course-studio",
        icon: WandSparkles,
      },
      { label: "Course Catalog", path: "/admin/courses", icon: BookOpen },
      { label: "Categories", path: "/admin/categories", icon: FolderTree },
      { label: "Cohorts", path: "/admin/cohorts", icon: Layers },
      { label: "Enrolments", path: "/admin/enrolments", icon: ScrollText },
      { label: "Organizations", path: "/admin/access", icon: Building2 },
    ],
  },
  {
    label: "Live delivery",
    items: [
      { label: "Live Classes", path: "/admin/live-sessions", icon: Video },
      { label: "Attendance", path: "/admin/attendance", icon: ClipboardCheck },
      { label: "Gradebook", path: "/admin/gradebook", icon: BarChart3 },
      { label: "Student Records", path: "/admin/students", icon: Users },
    ],
  },
  {
    label: "Advanced course tools",
    items: [
      {
        label: "Curriculum Builder",
        path: "/admin/academic",
        icon: GraduationCap,
      },
      { label: "Content Release", path: "/admin/release-rules", icon: Clock3 },
      { label: "Course Resources", path: "/admin/resources", icon: FolderOpen },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", path: "/admin/users", icon: Users },
      {
        label: "Communications",
        path: "/admin/communications",
        icon: Megaphone,
      },
      { label: "Reporting", path: "/admin/reporting", icon: BarChart3 },
      { label: "Certificates", path: "/admin/certificates", icon: Award },
      { label: "Settings", path: "/admin/settings", icon: Settings },
    ],
  },
];

export function getNavForRole(role: UserRole): NavSection[] {
  switch (role) {
    case "administrator":
      return adminNav;
    case "instructor":
      return instructorNav;
    case "student":
      return studentNav;
    default:
      return studentNav;
  }
}

export function getHomePathForRole(role: UserRole): string {
  switch (role) {
    case "administrator":
      return "/admin";
    case "instructor":
      return "/instructor";
    case "student":
      return "/student";
    default:
      return "/student";
  }
}
