import type { UserRole } from "@/types";
import {
  LayoutDashboard,
  BookOpen,
  Mail,
  Award,
  User,
  CalendarDays,
  Video,
  ClipboardList,
  BarChart3,
  FolderOpen,
  MessageSquare,
  HelpCircle,
  Megaphone,
  Users,
  GraduationCap,
  Settings,
  FolderTree,
  ScrollText,
  Layers,
  ClipboardCheck,
  Clock3,
  Building2,
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
      { label: "Notifications", path: "/student/messages", icon: Mail },
      { label: "Certificates", path: "/student/certificates", icon: Award },
      { label: "Profile", path: "/student/profile", icon: User },
    ],
  },
];

export const studentCourseNav: NavItem[] = [
  { label: "Home", path: "home", icon: LayoutDashboard },
  { label: "Learn", path: "learn", icon: BookOpen },
  { label: "Live Sessions", path: "live", icon: Video },
  { label: "Assignments", path: "assignments", icon: ClipboardList },
  { label: "Calendar", path: "calendar", icon: CalendarDays },
  { label: "Performance", path: "performance", icon: BarChart3 },
  { label: "Resources", path: "resources", icon: FolderOpen },
  { label: "Discussions", path: "discussions", icon: MessageSquare },
  { label: "Q&A", path: "qa", icon: HelpCircle },
  { label: "Announcements", path: "announcements", icon: Megaphone },
  { label: "Instructor", path: "instructor", icon: GraduationCap },
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
    label: "Academic",
    items: [
      { label: "Courses", path: "/admin/courses", icon: BookOpen },
      { label: "Categories", path: "/admin/categories", icon: FolderTree },
      { label: "Cohorts", path: "/admin/cohorts", icon: Layers },
      { label: "Enrolments", path: "/admin/enrolments", icon: ScrollText },
      { label: "Organizations", path: "/admin/access", icon: Building2 },
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
