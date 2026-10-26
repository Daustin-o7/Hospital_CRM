import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import TwoFactorSettings from '../components/TwoFactorSettings'
import { BrandLogo } from '../components/ui/BrandLogo'

export default function SetupMfa() {
  const { mfaEnrolmentRequired, logout, user } = useAuth()

  // Enabling the second factor refreshes the session, so this flips to false and lets the shell in.
  if (!mfaEnrolmentRequired) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" theme="auto" organizationName="SAMSTACK AI" tagline="Clinical Operating System" />
        </div>
        <div className="card p-7">
          <h1 className="text-lg font-bold text-[var(--color-text)] font-heading">Secure your account</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">
            {user?.email ? `Signed in as ${user.email}. ` : ''}
            Your role can move money, write clinical notes, or administer the platform, so a second
            factor is mandatory before you can continue.
          </p>
          <TwoFactorSettings />
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-4 w-full text-center text-xs font-semibold text-[var(--color-text-muted)] hover:underline"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  )
}
