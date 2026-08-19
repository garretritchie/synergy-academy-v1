import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { getHomePathForRole } from "@/config/navigation";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types";

const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) => lazy(async () => ({ default: (await loader())[name] as ComponentType }));

const SignInPage = lazyNamed(() => import("@/pages/auth/SignInPage"), "SignInPage");
const SignUpPage = lazyNamed(() => import("@/pages/auth/SignUpPage"), "SignUpPage");
const loadPasswordPages = () => import("@/pages/auth/PasswordPages");
const ForgotPasswordPage = lazyNamed(loadPasswordPages, "ForgotPasswordPage");
const ResetPasswordPage = lazyNamed(loadPasswordPages, "ResetPasswordPage");

const StudentDashboard = lazyNamed(() => import("@/pages/student/StudentDashboard"), "StudentDashboard");
const StudentCourses = lazyNamed(() => import("@/pages/student/StudentCourses"), "StudentCourses");
const StudentMessages = lazyNamed(() => import("@/pages/student/StudentMessages"), "StudentMessages");
const StudentCertificates = lazyNamed(() => import("@/pages/student/StudentCertificates"), "StudentCertificates");
const StudentCertificateDetail = lazyNamed(() => import("@/pages/student/StudentCertificateDetail"), "StudentCertificateDetail");
const StudentProfile = lazyNamed(() => import("@/pages/student/StudentProfile"), "StudentProfile");

const CourseHome = lazyNamed(() => import("@/pages/student/course/CourseHome"), "CourseHome");
const CourseLearn = lazyNamed(() => import("@/pages/student/course/CourseLearn"), "CourseLearn");
const CourseLive = lazyNamed(() => import("@/pages/student/course/CourseLive"), "CourseLive");
const CourseAssignments = lazyNamed(() => import("@/pages/student/course/CourseAssignments"), "CourseAssignments");
const CoursePerformance = lazyNamed(() => import("@/pages/student/course/CoursePerformance"), "CoursePerformance");
const LessonPage = lazyNamed(() => import("@/pages/student/course/LessonPage"), "LessonPage");
const loadCourseSupportPages = () => import("@/pages/student/course/CourseSupportPages");
const CourseAnnouncements = lazyNamed(loadCourseSupportPages, "CourseAnnouncements");
const CourseDiscussions = lazyNamed(loadCourseSupportPages, "CourseDiscussions");
const CourseQA = lazyNamed(loadCourseSupportPages, "CourseQA");
const CourseResources = lazyNamed(loadCourseSupportPages, "CourseResources");
const CourseInstructor = lazyNamed(loadCourseSupportPages, "CourseInstructor");
const CourseCalendar = lazyNamed(loadCourseSupportPages, "CourseCalendar");

const InstructorDashboard = lazyNamed(() => import("@/pages/instructor/InstructorDashboard"), "InstructorDashboard");
const InstructorCourses = lazyNamed(() => import("@/pages/instructor/InstructorCourses"), "InstructorCourses");
const loadInstructorPages = () => import("@/pages/instructor/InstructorPages");
const InstructorLiveSessions = lazyNamed(loadInstructorPages, "InstructorLiveSessions");
const InstructorAssignments = lazyNamed(loadInstructorPages, "InstructorAssignments");
const InstructorAttendance = lazyNamed(loadInstructorPages, "InstructorAttendance");
const InstructorGradebook = lazyNamed(loadInstructorPages, "InstructorGradebook");
const InstructorStudents = lazyNamed(loadInstructorPages, "InstructorStudents");
const InstructorCommunications = lazyNamed(loadInstructorPages, "InstructorCommunications");

const AdminDashboard = lazyNamed(() => import("@/pages/admin/AdminDashboard"), "AdminDashboard");
const AdminCourseStudio = lazyNamed(() => import("@/pages/admin/AdminCourseStudio"), "AdminCourseStudio");
const AdminCourses = lazyNamed(() => import("@/pages/admin/AdminCourses"), "AdminCourses");
const AdminCategories = lazyNamed(() => import("@/pages/admin/AdminCategories"), "AdminCategories");
const AdminCohorts = lazyNamed(() => import("@/pages/admin/AdminCohorts"), "AdminCohorts");
const AdminEnrolments = lazyNamed(() => import("@/pages/admin/AdminEnrolments"), "AdminEnrolments");
const AdminAccess = lazyNamed(() => import("@/pages/admin/AdminAccess"), "AdminAccess");
const AdminUsers = lazyNamed(() => import("@/pages/admin/AdminUsers"), "AdminUsers");
const AdminAcademic = lazyNamed(() => import("@/pages/admin/AdminAcademic"), "AdminAcademic");
const AdminReleaseRules = lazyNamed(() => import("@/pages/admin/AdminReleaseRules"), "AdminReleaseRules");
const AdminResources = lazyNamed(() => import("@/pages/admin/AdminResources"), "AdminResources");
const AdminReporting = lazyNamed(() => import("@/pages/admin/AdminReporting"), "AdminReporting");
const AdminCertificateManagement = lazyNamed(() => import("@/pages/admin/AdminCertificates"), "AdminCertificateManagement");
const loadAdminSupport = () => import("@/pages/admin/AdminSupport");
const AdminCommunications = lazyNamed(loadAdminSupport, "AdminCommunications");
const AdminSettings = lazyNamed(loadAdminSupport, "AdminSettings");

const OrganizationSeats = lazyNamed(() => import("@/pages/organization/OrganizationSeats"), "OrganizationSeats");
const loadPublicCourses = () => import("@/pages/public/PublicCourses");
const PublicCourses = lazyNamed(loadPublicCourses, "PublicCourses");
const PublicCourseDetail = lazyNamed(loadPublicCourses, "PublicCourseDetail");
const CertificateVerification = lazyNamed(() => import("@/pages/public/CertificateVerification"), "CertificateVerification");

interface AppRoute {
  path: string;
  Component: ComponentType;
  allowedRoles?: UserRole[];
}

const publicRoutes: AppRoute[] = [
  { path: "/signin", Component: SignInPage },
  { path: "/signup", Component: SignUpPage },
  { path: "/forgot-password", Component: ForgotPasswordPage },
  { path: "/reset-password", Component: ResetPasswordPage },
  { path: "/courses", Component: PublicCourses },
  { path: "/courses/:slug", Component: PublicCourseDetail },
  { path: "/categories/:categorySlug", Component: PublicCourses },
  { path: "/verify", Component: CertificateVerification },
  { path: "/verify/:certificateNumber", Component: CertificateVerification },
];

const sharedRoutes: AppRoute[] = [
  { path: "/account/profile", Component: StudentProfile },
  { path: "/organization/seats", Component: OrganizationSeats },
];

const studentRoutes: AppRoute[] = [
  { path: "/student", Component: StudentDashboard },
  { path: "/student/courses", Component: StudentCourses },
  { path: "/student/messages", Component: StudentMessages },
  { path: "/student/certificates", Component: StudentCertificates },
  { path: "/student/certificates/:certificateId", Component: StudentCertificateDetail },
  { path: "/student/profile", Component: StudentProfile },
  { path: "/student/courses/:cohortId/home", Component: CourseHome },
  { path: "/student/courses/:cohortId/learn", Component: CourseLearn },
  { path: "/student/courses/:cohortId/learn/:lessonId", Component: LessonPage },
  { path: "/student/courses/:cohortId/live", Component: CourseLive },
  { path: "/student/courses/:cohortId/assignments", Component: CourseAssignments },
  { path: "/student/courses/:cohortId/calendar", Component: CourseCalendar },
  { path: "/student/courses/:cohortId/performance", Component: CoursePerformance },
  { path: "/student/courses/:cohortId/resources", Component: CourseResources },
  { path: "/student/courses/:cohortId/discussions", Component: CourseDiscussions },
  { path: "/student/courses/:cohortId/qa", Component: CourseQA },
  { path: "/student/courses/:cohortId/announcements", Component: CourseAnnouncements },
  { path: "/student/courses/:cohortId/instructor", Component: CourseInstructor },
].map((route) => ({ ...route, allowedRoles: ["student"] }));

const instructorRoutes: AppRoute[] = [
  { path: "/instructor", Component: InstructorDashboard },
  { path: "/instructor/courses", Component: InstructorCourses },
  { path: "/instructor/live-sessions", Component: InstructorLiveSessions },
  { path: "/instructor/assignments", Component: InstructorAssignments },
  { path: "/instructor/attendance", Component: InstructorAttendance },
  { path: "/instructor/gradebook", Component: InstructorGradebook },
  { path: "/instructor/students", Component: InstructorStudents },
  { path: "/instructor/communications", Component: InstructorCommunications },
].map((route) => ({ ...route, allowedRoles: ["instructor"] }));

const adminRoutes: AppRoute[] = [
  { path: "/admin", Component: AdminDashboard },
  { path: "/admin/course-studio", Component: AdminCourseStudio },
  { path: "/admin/courses", Component: AdminCourses },
  { path: "/admin/categories", Component: AdminCategories },
  { path: "/admin/cohorts", Component: AdminCohorts },
  { path: "/admin/enrolments", Component: AdminEnrolments },
  { path: "/admin/live-sessions", Component: InstructorLiveSessions },
  { path: "/admin/attendance", Component: InstructorAttendance },
  { path: "/admin/gradebook", Component: InstructorGradebook },
  { path: "/admin/students", Component: InstructorStudents },
  { path: "/admin/access", Component: AdminAccess },
  { path: "/admin/users", Component: AdminUsers },
  { path: "/admin/academic", Component: AdminAcademic },
  { path: "/admin/release-rules", Component: AdminReleaseRules },
  { path: "/admin/resources", Component: AdminResources },
  { path: "/admin/communications", Component: AdminCommunications },
  { path: "/admin/certificates", Component: AdminCertificateManagement },
  { path: "/admin/reporting", Component: AdminReporting },
  { path: "/admin/settings", Component: AdminSettings },
].map((route) => ({ ...route, allowedRoles: ["administrator"] }));

const protectedRoutes = [...sharedRoutes, ...studentRoutes, ...instructorRoutes, ...adminRoutes];

function RoleRedirect() {
  const { user, profile, roles, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/signin" replace />;
  if (user.user_metadata?.must_change_password)
    return <Navigate to="/reset-password?temporary=1" replace />;
  if (profile && !profile.is_active) return <Navigate to="/pending" replace />;
  if (!roles.length) return <Navigate to="/pending" replace />;
  const role = roles.includes("administrator")
    ? "administrator"
    : roles.includes("instructor")
      ? "instructor"
      : "student";
  return <Navigate to={getHomePathForRole(role)} replace />;
}

function PendingAccess() {
  const { user, profile, roles, loading, signOut } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/signin" replace />;
  if (roles.length && profile?.is_active) return <Navigate to="/" replace />;
  const inactive = profile && !profile.is_active;
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-ink-50 p-6">
      <section className="w-full max-w-md rounded-xl bg-white p-7 text-center shadow-elevated">
        <img src="/brand/synergy-bahamas-logo-full-color.png" alt="Synergy Bahamas" width="2810" height="964" className="mx-auto h-auto w-52" />
        <AcademyBrandMark className="mt-4" />
        <h1 className="mt-7 text-2xl font-semibold text-ink-900">
          {inactive ? "Your account is inactive" : "Your account is ready"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-600">
          {inactive
            ? "An academy administrator has suspended access to this account. Contact Synergy Bahamas if you believe this is an error."
            : "An academy administrator still needs to assign your student or instructor access. You can sign in again after they confirm your role."}
        </p>
        <button type="button" className="btn-secondary mt-6 w-full" onClick={() => void signOut()}>
          Sign out
        </button>
      </section>
    </main>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner message="Loading Synergy Academy" />}>
      <Routes>
        {publicRoutes.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
        <Route path="/login" element={<Navigate to="/signin" replace />} />
        <Route path="/pending" element={<PendingAccess />} />
        <Route path="/" element={<RoleRedirect />} />
        {protectedRoutes.map(({ path, Component, allowedRoles }) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute allowedRoles={allowedRoles}>
                <Component />
              </ProtectedRoute>
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
