import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { useAuth } from './context/AuthContext'
import { useBranding } from './context/BrandingContext'
import { SkeletonCard } from './components/ui/Skeleton'

// Lazy-loaded pages for mobile bundle optimization & fast cold start
const Patients = lazy(() => import('./pages/Patients'))
const Appointments = lazy(() => import('./pages/Appointments'))
const Queue = lazy(() => import('./pages/Queue'))
const LabOrders = lazy(() => import('./pages/LabOrders'))
const PharmacyBatches = lazy(() => import('./pages/PharmacyBatches'))
const PharmacyCompliance = lazy(() => import('./pages/PharmacyCompliance'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Messages = lazy(() => import('./pages/Messages'))
const Staff = lazy(() => import('./pages/Staff'))
const NurseRoster = lazy(() => import('./pages/NurseRoster'))
const Intake = lazy(() => import('./pages/Intake'))
const QueueStatus = lazy(() => import('./pages/QueueStatus'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))
const Wishlist = lazy(() => import('./pages/Wishlist'))
const ChangePassword = lazy(() => import('./pages/ChangePassword'))
const Consultations = lazy(() => import('./pages/Consultations'))
const Billing = lazy(() => import('./pages/Billing'))
const PharmacyPOS = lazy(() => import('./pages/PharmacyPOS'))
const Settings = lazy(() => import('./pages/Settings'))
const Reports = lazy(() => import('./pages/Reports'))
const PlatformAdmin = lazy(() => import('./pages/PlatformAdmin'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-slate-300 font-sans">Loading workspace...</div>
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

// The API already rejects a non-admin (403), but without this the console shell renders
// empty with "Something went wrong" for clinic staff who hit the URL directly.
function PlatformAdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return String(user?.role).toLowerCase() === 'platformadmin'
    ? <>{children}</>
    : <Navigate to="/dashboard" replace />
}

// A direct URL to a module the tenant has not bought used to render the API's 403.
// Unknown entitlements (null) render the page: the server is still the authority.
function RequireModule({ module, children }: { module: string; children: React.ReactNode }) {
  const { branding } = useBranding()
  const modules = branding.enabledModules
  return modules && !modules.includes(module)
    ? <Navigate to="/dashboard" replace />
    : <>{children}</>
}

// A1: a session holding a temporary password may not use the app shell until it is replaced.
// Second-factor enrolment is opt-in from Settings, so it is not gated here.
function AccountSetupGate({ children }: { children: React.ReactNode }) {
  const { mustChangePassword } = useAuth()
  if (mustChangePassword) return <Navigate to="/change-password" replace />
  return <>{children}</>
}

function App() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-bg,#F2EFEA)] text-teal-800 dark:text-teal-200">
        <div className="w-8 h-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin mr-3"></div>
        <span className="font-semibold text-sm">Loading workspace…</span>
      </div>
    }>
      <Routes>
        <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      <Route path="/intake/:token" element={<Intake />} />
      <Route path="/queue-status/:token" element={<QueueStatus />} />
      <Route element={<ProtectedRoute><AccountSetupGate><DashboardLayout /></AccountSetupGate></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/patients" element={<Patients />} />
        <Route path="/dashboard/appointments" element={<Appointments />} />
        <Route path="/dashboard/queue" element={<Queue />} />
        <Route path="/dashboard/consultations" element={
          <Suspense fallback={<SkeletonCard />}>
            <Consultations />
          </Suspense>
        } />
        <Route path="/dashboard/lab-orders" element={<RequireModule module="lab"><LabOrders /></RequireModule>} />
        <Route path="/dashboard/billing" element={
          <Suspense fallback={<SkeletonCard />}>
            <Billing />
          </Suspense>
        } />
        <Route path="/dashboard/pharmacy/pos" element={
          <Suspense fallback={<SkeletonCard />}>
            <RequireModule module="pharmacy"><PharmacyPOS /></RequireModule>
          </Suspense>
        } />
        <Route path="/dashboard/pharmacy/batches" element={<RequireModule module="pharmacy"><PharmacyBatches /></RequireModule>} />
        <Route path="/dashboard/pharmacy/compliance" element={<RequireModule module="pharmacy"><PharmacyCompliance /></RequireModule>} />
        <Route path="/dashboard/inventory" element={<RequireModule module="inventory"><Inventory /></RequireModule>} />
        <Route path="/dashboard/wishlist" element={<RequireModule module="wishlist"><Wishlist /></RequireModule>} />
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
        <Route path="/dashboard/platform-admin" element={
          <PlatformAdminOnly>
            <Suspense fallback={<SkeletonCard />}>
              <ErrorBoundary title="Platform Admin"><PlatformAdmin /></ErrorBoundary>
            </Suspense>
          </PlatformAdminOnly>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  )
}

export default App