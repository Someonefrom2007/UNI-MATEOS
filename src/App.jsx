import React, { Suspense } from "react";
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
const Tasks         = React.lazy(() => import("@/pages/Tasks"));
const Exams         = React.lazy(() => import("@/pages/Exams"));
const Grades        = React.lazy(() => import("@/pages/Grades"));
const Notes         = React.lazy(() => import("@/pages/Notes"));
const NoteDetail    = React.lazy(() => import("@/pages/NoteDetail"));
const Resources     = React.lazy(() => import("@/pages/Resources"));
const Focus         = React.lazy(() => import("@/pages/Focus"));
const Goals         = React.lazy(() => import("@/pages/Goals"));
const Habits        = React.lazy(() => import("@/pages/Habits"));
const Workload      = React.lazy(() => import("@/pages/Workload"));
const Insights      = React.lazy(() => import("@/pages/Insights"));
const AIAssistant   = React.lazy(() => import("@/pages/AIAssistant"));
const Profile       = React.lazy(() => import("@/pages/Profile"));
const Settings      = React.lazy(() => import("@/pages/Settings"));
const Plans         = React.lazy(() => import("@/pages/Plans"));
const Onboarding    = React.lazy(() => import("@/pages/Onboarding"));
const StickyWall    = React.lazy(() => import("@/pages/StickyWall"));

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
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/community" element={<Community />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/exams/:id" element={<Exams />} />
            <Route path="/grades" element={<Grades />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/notes/:id" element={<NoteDetail />} />
            <Route path="/stickies" element={<StickyWall />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/focus" element={<Focus />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/workload" element={<Workload />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/ai" element={<AIAssistant />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/plans" element={<Plans />} />
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
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
  )
}

export default App