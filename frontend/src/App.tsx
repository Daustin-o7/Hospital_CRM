import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import Appointments from './pages/Appointments'
import Queue from './pages/Queue'
import Consultations from './pages/Consultations'
import Billing from './pages/Billing'
import PharmacyPOS from './pages/PharmacyPOS'
import PharmacyBatches from './pages/PharmacyBatches'
import PharmacyCompliance from './pages/PharmacyCompliance'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import Messages from './pages/Messages'
import Staff from './pages/Staff'
import Settings from './pages/Settings'
import { useAuth } from './context/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-slate-300 font-sans">Loading workspace...</div>
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
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
        <Route path="/dashboard/pharmacy/pos" element={<PharmacyPOS />} />
        <Route path="/dashboard/pharmacy/batches" element={<PharmacyBatches />} />
        <Route path="/dashboard/pharmacy/compliance" element={<PharmacyCompliance />} />
        <Route path="/dashboard/inventory" element={<Inventory />} />
        <Route path="/dashboard/reports" element={<Reports />} />
        <Route path="/dashboard/messages" element={<Messages />} />
        <Route path="/dashboard/staff" element={<Staff />} />
        <Route path="/dashboard/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App