import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api from '../services/api'

// ── Types ────────────────────────────────────────────────────────────────────
export interface OrganizationBranding {
  organizationName: string
  organizationType?: 'practitioner' | 'clinic' | 'hospital'
  logoUrl?: string
  logoDarkUrl?: string
  logoLightUrl?: string
  faviconUrl?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  tagline?: string
  doctorName?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  timezone?: string
  currency?: string
  dateFormat?: string
  timeFormat?: string
}

const SAMSTACK_DEFAULTS: OrganizationBranding = {
  organizationName: 'SAMSTACK AI',
  organizationType: 'clinic',
  tagline: 'Doctor & Clinic CRM',
  primaryColor: '#0d9488',
  secondaryColor: '#0891b2',
}

// ── Context ──────────────────────────────────────────────────────────────────
interface BrandingContextValue {
  branding: OrganizationBranding
  loading: boolean
  refresh: () => void
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: SAMSTACK_DEFAULTS,
  loading: false,
  refresh: () => {},
})

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Map a hex color to its CSS custom property variants and inject into :root */
function applyBrandColors(primary?: string, secondary?: string) {
  if (!primary && !secondary) return
  const root = document.documentElement.style
  if (primary) {
    root.setProperty('--brand-primary', primary)
    root.setProperty('--brand-primary-hover', darken(primary, 0.08))
    root.setProperty('--brand-primary-10', hexToRgba(primary, 0.10))
    root.setProperty('--brand-primary-20', hexToRgba(primary, 0.20))
  }
  if (secondary) {
    root.setProperty('--brand-secondary', secondary)
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Darken a hex color by a fraction (0–1) */
function darken(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(clean.substring(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(clean.substring(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(clean.substring(4, 6), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

/** Apply branding to document favicon and title */
function applyDocumentBranding(branding: OrganizationBranding) {
  if (branding.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = branding.faviconUrl
  }
  document.title = branding.organizationName
    ? `${branding.organizationName} — SAMSTACK AI`
    : 'SAMSTACK AI'
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<OrganizationBranding>(SAMSTACK_DEFAULTS)
  const [loading, setLoading] = useState(true)

  const fetchBranding = useCallback(async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await api.get('/v1/clinic/profile')
      const data = res.data
      const resolved: OrganizationBranding = {
        organizationName: data.name || data.organizationName || SAMSTACK_DEFAULTS.organizationName,
        organizationType: data.organizationType || 'clinic',
        logoUrl:          data.logoUrl,
        logoDarkUrl:      data.darkLogoUrl,
        logoLightUrl:     data.lightLogoUrl,
        faviconUrl:       data.faviconUrl,
        primaryColor:     data.primaryColor || SAMSTACK_DEFAULTS.primaryColor,
        secondaryColor:   data.secondaryColor || SAMSTACK_DEFAULTS.secondaryColor,
        tagline:          data.tagline || SAMSTACK_DEFAULTS.tagline,
        doctorName:       data.doctorName,
        address:          data.address,
        phone:            data.phone,
        email:            data.email,
        website:          data.website,
        timezone:         data.timezone,
        currency:         data.currency,
        dateFormat:       data.dateFormat,
        timeFormat:       data.timeFormat,
      }
      setBranding(resolved)
      applyBrandColors(resolved.primaryColor, resolved.secondaryColor)
      applyDocumentBranding(resolved)
    } catch {
      // Silently fall back to defaults — non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBranding()
  }, [fetchBranding])

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useBranding() {
  return useContext(BrandingContext)
}
