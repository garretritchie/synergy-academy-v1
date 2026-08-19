import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { getHomePathForRole } from "@/config/navigation";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";

import { SignInPage } from "@/pages/auth/SignInPage";
import { SignUpPage } from "@/pages/auth/SignUpPage";
import {
  ForgotPasswordPage,
  ResetPasswordPage,
} from "@/pages/auth/PasswordPages";

import { StudentDashboard } from "@/pages/student/StudentDashboard";
import { StudentCourses } from "@/pages/student/StudentCourses";
import { StudentMessages } from "@/pages/student/StudentMessages";
import { StudentCertificates } from "@/pages/student/StudentCertificates";
import { StudentCertificateDetail } from "@/pages/student/StudentCertificateDetail";
import { StudentProfile } from "@/pages/student/StudentProfile";

import { CourseHome } from "@/pages/student/course/CourseHome";
import { CourseLearn } from "@/pages/student/course/CourseLearn";
import { CourseLive } from "@/pages/student/course/CourseLive";
import { CourseAssignments } from "@/pages/student/course/CourseAssignments";
import { CourseCalendar } from "@/pages/student/course/CourseCalendar";
import { CoursePerformance } from "@/pages/student/course/CoursePerformance";
import { CourseResources } from "@/pages/student/course/CourseResources";
import { CourseDiscussions } from "@/pages/student/course/CourseDiscussions";
import { CourseQA } from "@/pages/student/course/CourseQA";
import { CourseAnnouncements } from "@/pages/student/course/CourseAnnouncements";
import { CourseInstructor } from "@/pages/student/course/CourseInstructor";
import { LessonPage } from "@/pages/student/course/LessonPage";
import { CertificateVerification } from "@/pages/public/CertificateVerification";

import { InstructorDashboard } from "@/pages/instructor/InstructorDashboard";
import { InstructorCourses } from "@/pages/instructor/InstructorCourses";

import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminCourses } from "@/pages/admin/AdminCourses";
import { AdminCategories } from "@/pages/admin/AdminCategories";
import { AdminReleaseRules } from "@/pages/admin/AdminReleaseRules";
import { AdminResources } from "@/pages/admin/AdminResources";

const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) => lazy(async () => ({ default: (await loader())[name] as React.ComponentType }));

const OrganizationSeats = lazyNamed(
  () => import("@/pages/organization/OrganizationSeats"),
  "OrganizationSeats",
);
const AdminAccess = lazyNamed(
  () => import("@/pages/admin/AdminAccess"),
  "AdminAccess",
);
const AdminCourseStudio = lazyNamed(
  () => import("@/pages/admin/AdminCourseStudio"),
  "AdminCourseStudio",
);
const PublicCourses = lazyNamed(
  () => import("@/pages/public/PublicCourses"),
  "PublicCourses",
);
const PublicCourseDetail = lazyNamed(
  () => import("@/pages/public/PublicCourses"),
  "PublicCourseDetail",
);

const loadInstructorPages = () => import("@/pages/instructor/InstructorPages");
const InstructorLiveSessions = lazyNamed(loadInstructorPages, "InstructorLiveSessions");
const InstructorAssignments = lazyNamed(loadInstructorPages, "InstructorAssignments");
const InstructorAttendance = lazyNamed(loadInstructorPages, "InstructorAttendance");
const InstructorGradebook = lazyNamed(loadInstructorPages, "InstructorGradebook");
const InstructorStudents = lazyNamed(loadInstructorPages, "InstructorStudents");
const InstructorCommunications = lazyNamed(loadInstructorPages, "InstructorCommunications");

const loadAdminPages = () => import("@/pages/admin/AdminPages");
const AdminCohorts = lazyNamed(loadAdminPages, "AdminCohorts");
const AdminEnrolments = lazyNamed(loadAdminPages, "AdminEnrolments");
const AdminUsers = lazyNamed(loadAdminPages, "AdminUsers");
const AdminAcademic = lazyNamed(loadAdminPages, "AdminAcademic");
const AdminCommunications = lazyNamed(loadAdminPages, "AdminCommunications");
const AdminReporting = lazyNamed(loadAdminPages, "AdminReporting");
const AdminCertificateManagement = lazyNamed(loadAdminPages, "AdminCertificateManagement");
const AdminSettings = lazyNamed(loadAdminPages, "AdminSettings");

function RoleRedirect() {
  const { user, profile, roles, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/signin" replace />;
  if (user.user_metadata?.must_change_password)
    return <Navigate to="/reset-password?temporary=1" replace />;
  if (profile && !profile.is_active) return <Navigate to="/pending" replace />;
  if (!roles.length) return <Navigate to="/pending" replace />;
  return (
    <Navigate
      to={getHomePathForRole(
        roles.includes("administrator")
          ? "administrator"
          : roles.includes("instructor")
            ? "instructor"
            : "student",
      )}
      replace
    />
  );
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
        <img
          src="/brand/synergy-bahamas-logo-full-color.png"
          alt="Synergy Bahamas"
          className="mx-auto h-auto w-52"
        />
        <AcademyBrandMark className="mt-4" />
        <h1 className="mt-7 text-2xl font-semibold text-ink-900">
          {inactive ? "Your account is inactive" : "Your account is ready"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-600">
          {inactive
            ? "An academy administrator has suspended access to this account. Contact Synergy Bahamas if you believe this is an error."
            : "An academy administrator still needs to assign your student or instructor access. You can sign in again after they confirm your role."}
        </p>
        <button
          className="btn-secondary mt-6 w-full"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/login" element={<Navigate to="/signin" replace />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/pending" element={<PendingAccess />} />
      <Route path="/courses" element={<PublicCourses />} />
      <Route path="/courses/:slug" element={<PublicCourseDetail />} />
      <Route path="/categories/:categorySlug" element={<PublicCourses />} />
      <Route
        path="/verify"
        element={<CertificateVerification />}
      />
      <Route
        path="/verify/:certificateNumber"
        element={<CertificateVerification />}
      />
      <Route path="/" element={<RoleRedirect />} />
      <Route
        path="/account/profile"
        element={
          <ProtectedRoute>
            <StudentProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organization/seats"
        element={
          <ProtectedRoute>
            <OrganizationSeats />
          </ProtectedRoute>
        }
      />

      {/* Student routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentCourses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/messages"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentMessages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/certificates"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentCertificates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/certificates/:certificateId"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentCertificateDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentProfile />
          </ProtectedRoute>
        }
      />

      {/* Student course interior routes */}
      <Route
        path="/student/courses/:cohortId/home"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CourseHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/learn"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CourseLearn />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/learn/:lessonId"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <LessonPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/live"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CourseLive />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/assignments"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CourseAssignments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/calendar"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CourseCalendar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/performance"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CoursePerformance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/resources"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CourseResources />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/discussions"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CourseDiscussions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/qa"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CourseQA />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/announcements"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CourseAnnouncements />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/courses/:cohortId/instructor"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <CourseInstructor />
          </ProtectedRoute>
        }
      />

      {/* Instructor routes */}
      <Route
        path="/instructor"
        element={
          <ProtectedRoute allowedRoles={["instructor"]}>
            <InstructorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/courses"
        element={
          <ProtectedRoute allowedRoles={["instructor"]}>
            <InstructorCourses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/live-sessions"
        element={
          <ProtectedRoute allowedRoles={["instructor"]}>
            <InstructorLiveSessions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/assignments"
        element={
          <ProtectedRoute allowedRoles={["instructor"]}>
            <InstructorAssignments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/attendance"
        element={
          <ProtectedRoute allowedRoles={["instructor"]}>
            <InstructorAttendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/gradebook"
        element={
          <ProtectedRoute allowedRoles={["instructor"]}>
            <InstructorGradebook />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/students"
        element={
          <ProtectedRoute allowedRoles={["instructor"]}>
            <InstructorStudents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/communications"
        element={
          <ProtectedRoute allowedRoles={["instructor"]}>
            <InstructorCommunications />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/course-studio"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminCourseStudio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/courses"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminCourses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminCategories />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/cohorts"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminCohorts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/enrolments"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminEnrolments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/live-sessions"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <InstructorLiveSessions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/attendance"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <InstructorAttendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/gradebook"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <InstructorGradebook />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <InstructorStudents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/access"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminAccess />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/academic"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminAcademic />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/release-rules"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminReleaseRules />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/resources"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminResources />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/communications"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminCommunications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/certificates"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminCertificateManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reporting"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminReporting />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminSettings />
          </ProtectedRoute>
        }
      />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
