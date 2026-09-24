import React, { Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Splash from './components/Brand/Splash';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppShell from '@/components/AppShell';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AdminLayout, RequireAdmin, RequirePermission, AdminProvider } from '@/lib/admin/useAdmin';
import AdminShell from '@/components/admin/AdminShell';
import { SECTIONS } from '@/lib/admin/sections';

// Auth pages — eagerly loaded (small, part of core auth flow)
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages — lazily loaded for route-level code splitting
const Landing       = React.lazy(() => import("@/pages/Landing"));
const Dashboard     = React.lazy(() => import("@/pages/Dashboard"));
const Community     = React.lazy(() => import("@/pages/Community"));
const Courses       = React.lazy(() => import("@/pages/Courses"));
const CourseDetail  = React.lazy(() => import("@/pages/CourseDetail"));
const Schedule      = React.lazy(() => import("@/pages/Schedule"));
const Attendance    = React.lazy(() => import("@/pages/Attendance"));
const AcademicTimeline = React.lazy(() => import("@/pages/AcademicTimeline"));
const Tasks         = React.lazy(() => import("@/pages/Tasks"));
const Exams         = React.lazy(() => import("@/pages/Exams"));
const Grades        = React.lazy(() => import("@/pages/Grades"));
const Notes         = React.lazy(() => import("@/pages/Notes"));
const NoteDetail    = React.lazy(() => import("@/pages/NoteDetail"));
const Resources     = React.lazy(() => import("@/pages/Resources"));
const Topics        = React.lazy(() => import("@/pages/Topics"));
const Focus         = React.lazy(() => import("@/pages/Focus"));
const Goals         = React.lazy(() => import("@/pages/Goals"));
const Habits        = React.lazy(() => import("@/pages/Habits"));
const Workload      = React.lazy(() => import("@/pages/Workload"));
const Insights      = React.lazy(() => import("@/pages/Insights"));
const AIAssistant   = React.lazy(() => import("@/pages/AIAssistant"));
const Flashcards    = React.lazy(() => import("@/pages/Flashcards"));
const StudyPlanner  = React.lazy(() => import("@/pages/StudyPlanner"));
const RescueWeek    = React.lazy(() => import("@/pages/RescueWeek"));
const Analytics     = React.lazy(() => import("@/pages/Analytics"));
const Profile       = React.lazy(() => import("@/pages/Profile"));
const Settings      = React.lazy(() => import("@/pages/Settings"));
const Plans         = React.lazy(() => import("@/pages/Plans"));
const Integrations  = React.lazy(() => import("@/pages/Integrations"));
const Onboarding    = React.lazy(() => import("@/pages/Onboarding"));
const StickyWall    = React.lazy(() => import("@/pages/StickyWall"));

// Control Center pages — lazily loaded per section
const AdminOverview     = React.lazy(() => import("@/pages/admin/Overview"));
const AdminUsers        = React.lazy(() => import("@/pages/admin/Users"));
const AdminBilling      = React.lazy(() => import("@/pages/admin/Billing"));
const AdminCommunity    = React.lazy(() => import("@/pages/admin/Community"));
const AdminAnalytics    = React.lazy(() => import("@/pages/admin/Analytics"));
const AdminAI           = React.lazy(() => import("@/pages/admin/AI"));
const AdminIntegrations = React.lazy(() => import("@/pages/admin/Integrations"));
const AdminFlags        = React.lazy(() => import("@/pages/admin/Flags"));
const AdminAnnouncements = React.lazy(() => import("@/pages/admin/Announcements"));
const AdminSystem       = React.lazy(() => import("@/pages/admin/System"));
const AdminErrors       = React.lazy(() => import("@/pages/admin/Errors"));
const AdminSecurity     = React.lazy(() => import("@/pages/admin/Security"));
const AdminDev          = React.lazy(() => import("@/pages/admin/Dev"));
const AdminSettings     = React.lazy(() => import("@/pages/admin/Settings"));
const AdminAudit        = React.lazy(() => import("@/pages/admin/Audit"));

const ADMIN_PAGES = {
  overview: AdminOverview, users: AdminUsers, billing: AdminBilling, community: AdminCommunity,
  analytics: AdminAnalytics, ai: AdminAI, integrations: AdminIntegrations, flags: AdminFlags,
  announcements: AdminAnnouncements, system: AdminSystem, errors: AdminErrors,
  security: AdminSecurity, dev: AdminDev, settings: AdminSettings, audit: AdminAudit,
};

const PageFallback = () => <Splash label="Loading" />;

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return <Splash label="Organizing your semester..." />;
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Landing />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<AdminProvider><AppShell /></AdminProvider>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/community" element={<Community />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/timeline" element={<AcademicTimeline />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/exams/:id" element={<Exams />} />
            <Route path="/grades" element={<Grades />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/notes/:id" element={<NoteDetail />} />
            <Route path="/stickies" element={<StickyWall />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/focus" element={<Focus />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/workload" element={<Workload />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/ai" element={<AIAssistant />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/study-plan" element={<StudyPlanner />} />
            <Route path="/rescue" element={<RescueWeek />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/integrations" element={<Integrations />} />
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route element={<RequireAdmin />}>
            <Route element={<AdminShell />}>
              {SECTIONS.map((s) => {
                const Page = ADMIN_PAGES[s.id];
                return (
                  <Route
                    key={s.id}
                    index={s.id === "overview"}
                    path={s.id === "overview" ? undefined : s.id}
                    element={<RequirePermission permission={s.permission}>{Page ? <Page /> : null}</RequirePermission>}
                  />
                );
              })}
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <ErrorBoundary>
              <AuthenticatedApp />
            </ErrorBoundary>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </MotionConfig>
  )
}

export default App