import { BrowserRouter, Routes, Route } from 'react-router'
import { Toaster } from 'sonner'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RoleGate } from '@/components/auth/RoleGate'
import Index from '@/routes/index'
import Login from '@/routes/login'
import AuthCallback from '@/routes/auth-callback'
import PanelLayout from '@/routes/panel/layout'
import Dashboard from '@/routes/panel/dashboard'
import AnimationsList from '@/routes/panel/animations/list'
import NewAnimation from '@/routes/panel/animations/new'
import AnimationDetail from '@/routes/panel/animations/detail'
import EditAnimation from '@/routes/panel/animations/edit'
import CalendarPage from '@/routes/panel/calendar'
import Reports from '@/routes/panel/reports'
import Absences from '@/routes/panel/absences'
import Validation from '@/routes/panel/validation'
import Leaderboard from '@/routes/panel/leaderboard'
import Members from '@/routes/panel/members'
import Casiers from '@/routes/panel/casiers'
import Paies from '@/routes/panel/paies'
import Villages from '@/routes/panel/villages'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/panel"
          element={
            <ProtectedRoute>
              <PanelLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="animations" element={<AnimationsList />} />
          <Route path="animations/new" element={<NewAnimation />} />
          <Route path="animations/:id" element={<AnimationDetail />} />
          <Route path="animations/:id/edit" element={<EditAnimation />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="reports" element={<Reports />} />
          <Route path="absences" element={<Absences />} />
          <Route
            path="validation"
            element={
              <RoleGate allow={['responsable', 'responsable_mj']} redirectTo="/panel/dashboard">
                <Validation />
              </RoleGate>
            }
          />
          <Route
            path="leaderboard"
            element={
              <RoleGate allow={['responsable', 'responsable_mj']} redirectTo="/panel/dashboard">
                <Leaderboard />
              </RoleGate>
            }
          />
          <Route
            path="members"
            element={
              <RoleGate allow={['responsable', 'responsable_mj']} redirectTo="/panel/dashboard">
                <Members />
              </RoleGate>
            }
          />
          <Route
            path="casiers"
            element={
              <RoleGate allow={['responsable', 'responsable_mj']} redirectTo="/panel/dashboard">
                <Casiers />
              </RoleGate>
            }
          />
          <Route
            path="paies"
            element={
              <RoleGate allow={['responsable', 'responsable_mj']} redirectTo="/panel/dashboard">
                <Paies />
              </RoleGate>
            }
          />
          <Route
            path="villages"
            element={
              <RoleGate allow={['responsable', 'responsable_mj']} redirectTo="/panel/dashboard">
                <Villages />
              </RoleGate>
            }
          />
        </Route>
      </Routes>
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#13141A',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.9)',
          },
        }}
      />
    </BrowserRouter>
  )
}
