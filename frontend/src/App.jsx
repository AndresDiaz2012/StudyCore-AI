import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import CalendarPage from './pages/CalendarPage'
import EvaluationsPage from './pages/EvaluationsPage'
import NotebookPage from './pages/NotebookPage'
import AIPage from './pages/AIPage'
import GroupsPage from './pages/GroupsPage'
import QuizPage from './pages/QuizPage'
import SalonPage from './pages/SalonPage'
import AdminPage from './pages/AdminPage'
import DeveloperPage from './pages/DeveloperPage'
import SubjectsPage from './pages/SubjectsPage'
import SettingsPage from './pages/SettingsPage'
import AuthPage from './pages/AuthPage'
import OnboardingPage from './pages/OnboardingPage'
import PinLockPage from './pages/PinLockPage'
import LoadingSpinner from './components/common/LoadingSpinner'

function AppRoutes() {
  const { user, loading, pinLocked } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f23]">
        <LoadingSpinner />
      </div>
    )
  }

  // Not logged in → auth page
  if (!user) return <AuthPage />

  // PIN lock active
  if (pinLocked) return <PinLockPage />

  // Onboarding not done → questionnaire
  const onboardingDone = user.onboarding_done === 1 || user.onboarding_done === true
  if (!onboardingDone) return <OnboardingPage />

  // Main app
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="evaluations" element={<EvaluationsPage />} />
        <Route path="notebook" element={<NotebookPage />} />
        <Route path="ai" element={<AIPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="quiz" element={<QuizPage />} />
        <Route path="salon" element={<SalonPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="developer" element={<DeveloperPage />} />
        <Route path="subjects" element={<SubjectsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
