import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { getHomePathForRole } from '@/config/navigation';

import { SignInPage } from '@/pages/auth/SignInPage';
import { SignUpPage } from '@/pages/auth/SignUpPage';

import { StudentDashboard } from '@/pages/student/StudentDashboard';
import { StudentCourses } from '@/pages/student/StudentCourses';
import { StudentMessages } from '@/pages/student/StudentMessages';
import { StudentCertificates } from '@/pages/student/StudentCertificates';
import { StudentProfile } from '@/pages/student/StudentProfile';

import { CourseHome } from '@/pages/student/course/CourseHome';
import { CourseLearn } from '@/pages/student/course/CourseLearn';
import { CourseLive } from '@/pages/student/course/CourseLive';
import { CourseAssignments } from '@/pages/student/course/CourseAssignments';
import { CourseCalendar } from '@/pages/student/course/CourseCalendar';
import { CoursePerformance } from '@/pages/student/course/CoursePerformance';
import { CourseResources } from '@/pages/student/course/CourseResources';
import { CourseDiscussions } from '@/pages/student/course/CourseDiscussions';
import { CourseQA } from '@/pages/student/course/CourseQA';
import { CourseAnnouncements } from '@/pages/student/course/CourseAnnouncements';
import { CourseInstructor } from '@/pages/student/course/CourseInstructor';

import { InstructorDashboard } from '@/pages/instructor/InstructorDashboard';
import { InstructorCourses } from '@/pages/instructor/InstructorCourses';
import {
  InstructorLiveSessions,
  InstructorAssignments,
  InstructorAttendance,
  InstructorGradebook,
  InstructorStudents,
  InstructorCommunications,
} from '@/pages/instructor/InstructorPages';

import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminCourses } from '@/pages/admin/AdminCourses';
import { AdminCategories } from '@/pages/admin/AdminCategories';
import {
  AdminCohorts,
  AdminEnrolments,
  AdminUsers,
  AdminAcademic,
  AdminCommunications,
  AdminReporting,
  AdminSettings,
} from '@/pages/admin/AdminPages';

function RoleRedirect() {
  const { roles, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!roles.length) return <Navigate to="/signin" replace />;
  return <Navigate to={getHomePathForRole(roles.includes('administrator') ? 'administrator' : roles.includes('instructor') ? 'instructor' : 'student')} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/" element={<RoleRedirect />} />

      {/* Student routes */}
      <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/courses" element={<ProtectedRoute allowedRoles={['student']}><StudentCourses /></ProtectedRoute>} />
      <Route path="/student/messages" element={<ProtectedRoute allowedRoles={['student']}><StudentMessages /></ProtectedRoute>} />
      <Route path="/student/certificates" element={<ProtectedRoute allowedRoles={['student']}><StudentCertificates /></ProtectedRoute>} />
      <Route path="/student/profile" element={<ProtectedRoute allowedRoles={['student']}><StudentProfile /></ProtectedRoute>} />

      {/* Student course interior routes */}
      <Route path="/student/courses/:cohortId/home" element={<ProtectedRoute allowedRoles={['student']}><CourseHome /></ProtectedRoute>} />
      <Route path="/student/courses/:cohortId/learn" element={<ProtectedRoute allowedRoles={['student']}><CourseLearn /></ProtectedRoute>} />
      <Route path="/student/courses/:cohortId/live" element={<ProtectedRoute allowedRoles={['student']}><CourseLive /></ProtectedRoute>} />
      <Route path="/student/courses/:cohortId/assignments" element={<ProtectedRoute allowedRoles={['student']}><CourseAssignments /></ProtectedRoute>} />
      <Route path="/student/courses/:cohortId/calendar" element={<ProtectedRoute allowedRoles={['student']}><CourseCalendar /></ProtectedRoute>} />
      <Route path="/student/courses/:cohortId/performance" element={<ProtectedRoute allowedRoles={['student']}><CoursePerformance /></ProtectedRoute>} />
      <Route path="/student/courses/:cohortId/resources" element={<ProtectedRoute allowedRoles={['student']}><CourseResources /></ProtectedRoute>} />
      <Route path="/student/courses/:cohortId/discussions" element={<ProtectedRoute allowedRoles={['student']}><CourseDiscussions /></ProtectedRoute>} />
      <Route path="/student/courses/:cohortId/qa" element={<ProtectedRoute allowedRoles={['student']}><CourseQA /></ProtectedRoute>} />
      <Route path="/student/courses/:cohortId/announcements" element={<ProtectedRoute allowedRoles={['student']}><CourseAnnouncements /></ProtectedRoute>} />
      <Route path="/student/courses/:cohortId/instructor" element={<ProtectedRoute allowedRoles={['student']}><CourseInstructor /></ProtectedRoute>} />

      {/* Instructor routes */}
      <Route path="/instructor" element={<ProtectedRoute allowedRoles={['instructor']}><InstructorDashboard /></ProtectedRoute>} />
      <Route path="/instructor/courses" element={<ProtectedRoute allowedRoles={['instructor']}><InstructorCourses /></ProtectedRoute>} />
      <Route path="/instructor/live-sessions" element={<ProtectedRoute allowedRoles={['instructor']}><InstructorLiveSessions /></ProtectedRoute>} />
      <Route path="/instructor/assignments" element={<ProtectedRoute allowedRoles={['instructor']}><InstructorAssignments /></ProtectedRoute>} />
      <Route path="/instructor/attendance" element={<ProtectedRoute allowedRoles={['instructor']}><InstructorAttendance /></ProtectedRoute>} />
      <Route path="/instructor/gradebook" element={<ProtectedRoute allowedRoles={['instructor']}><InstructorGradebook /></ProtectedRoute>} />
      <Route path="/instructor/students" element={<ProtectedRoute allowedRoles={['instructor']}><InstructorStudents /></ProtectedRoute>} />
      <Route path="/instructor/communications" element={<ProtectedRoute allowedRoles={['instructor']}><InstructorCommunications /></ProtectedRoute>} />

      {/* Admin routes */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['administrator']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/courses" element={<ProtectedRoute allowedRoles={['administrator']}><AdminCourses /></ProtectedRoute>} />
      <Route path="/admin/categories" element={<ProtectedRoute allowedRoles={['administrator']}><AdminCategories /></ProtectedRoute>} />
      <Route path="/admin/cohorts" element={<ProtectedRoute allowedRoles={['administrator']}><AdminCohorts /></ProtectedRoute>} />
      <Route path="/admin/enrolments" element={<ProtectedRoute allowedRoles={['administrator']}><AdminEnrolments /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['administrator']}><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/academic" element={<ProtectedRoute allowedRoles={['administrator']}><AdminAcademic /></ProtectedRoute>} />
      <Route path="/admin/communications" element={<ProtectedRoute allowedRoles={['administrator']}><AdminCommunications /></ProtectedRoute>} />
      <Route path="/admin/reporting" element={<ProtectedRoute allowedRoles={['administrator']}><AdminReporting /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['administrator']}><AdminSettings /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
