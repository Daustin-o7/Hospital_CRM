import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import Appointments from './pages/Appointments'
import Queue from './pages/Queue'
import LabOrders from './pages/LabOrders'
import PharmacyBatches from './pages/PharmacyBatches'
import PharmacyCompliance from './pages/PharmacyCompliance'
import Inventory from './pages/Inventory'
import Messages from './pages/Messages'
import Staff from './pages/Staff'
import NurseRoster from './pages/NurseRoster'
import Intake from './pages/Intake'
import QueueStatus from './pages/QueueStatus'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AcceptInvite from './pages/AcceptInvite'
import Wishlist from './pages/Wishlist'
import PlatformAdmin from './pages/PlatformAdmin'
import { useAuth } from './context/AuthContext'
import { SkeletonCard } from './components/ui/Skeleton'

// Heavy pages - lazy loaded
const Consultations = lazy(() => import('./pages/Consultations'))
const Billing = lazy(() => import('./pages/Billing'))
const PharmacyPOS = lazy(() => import('./pages/PharmacyPOS'))
const Settings = lazy(() => import('./pages/Settings'))
const Reports = lazy(() => import('./pages/Reports'))

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
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/intake/:token" element={<Intake />} />
      <Route path="/queue-status/:token" element={<QueueStatus />} />
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/patients" element={<Patients />} />
        <Route path="/dashboard/appointments" element={<Appointments />} />
        <Route path="/dashboard/queue" element={<Queue />} />
        <Route path="/dashboard/consultations" element={
          <Suspense fallback={<SkeletonCard />}>
            <Consultations />
          </Suspense>
        } />
        <Route path="/dashboard/lab-orders" element={<LabOrders />} />
        <Route path="/dashboard/billing" element={
          <Suspense fallback={<SkeletonCard />}>
            <Billing />
          </Suspense>
        } />
        <Route path="/dashboard/pharmacy/pos" element={
          <Suspense fallback={<SkeletonCard />}>
            <PharmacyPOS />
          </Suspense>
        } />
        <Route path="/dashboard/pharmacy/batches" element={<PharmacyBatches />} />
        <Route path="/dashboard/pharmacy/compliance" element={<PharmacyCompliance />} />
        <Route path="/dashboard/inventory" element={<Inventory />} />
        <Route path="/dashboard/wishlist" element={<Wishlist />} />
        <Route path="/dashboard/reports" element={
          <Suspense fallback={<SkeletonCard />}>
            <Reports />
          </Suspense>
        } />
        <Route path="/dashboard/messages" element={<Messages />} />
        <Route path="/dashboard/staff" element={<Staff />} />
        <Route path="/dashboard/roster" element={<NurseRoster />} />
        <Route path="/dashboard/settings" element={
          <Suspense fallback={<SkeletonCard />}>
            <Settings />
          </Suspense>
        } />
        <Route path="/dashboard/platform-admin" element={<PlatformAdmin />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App