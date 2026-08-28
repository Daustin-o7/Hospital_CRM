import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import Appointments from './pages/Appointments'
import Queue from './pages/Queue'
import Consultations from './pages/Consultations'
import Billing from './pages/Billing'
import Staff from './pages/Staff'
import Settings from './pages/Settings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('accessToken')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/patients" element={<Patients />} />
        <Route path="/dashboard/appointments" element={<Appointments />} />
        <Route path="/dashboard/queue" element={<Queue />} />
        <Route path="/dashboard/consultations" element={<Consultations />} />
        <Route path="/dashboard/billing" element={<Billing />} />
        <Route path="/dashboard/staff" element={<Staff />} />
        <Route path="/dashboard/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App