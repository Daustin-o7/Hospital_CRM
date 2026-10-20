import { useEffect, useState, useCallback } from 'react'
import api, { getAccessToken } from '../services/api'
import { useAuth } from './AuthContext'
import {
  BrandingContext,
  SAMSTACK_DEFAULTS,
  type OrganizationBranding,
} from './BrandingContext'

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

function darken(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(clean.substring(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(clean.substring(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(clean.substring(4, 6), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

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

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [branding, setBranding] = useState<OrganizationBranding>(SAMSTACK_DEFAULTS)
  const [loading, setLoading] = useState(true)

  const fetchBranding = useCallback(async () => {
    const token = getAccessToken()
    const isPlatformAdmin = String(user?.role).toLowerCase() === 'platformadmin'

    // A PlatformAdmin has no clinic: /clinic/profile answers 403 by design, so don't ask.
    if (!token || isPlatformAdmin) {
      setBranding(SAMSTACK_DEFAULTS)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const res = await api.get('/clinic/profile')
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
        enabledModules:   Array.isArray(data.activatedModules) ? data.activatedModules : null,
      }
      setBranding(resolved)
      applyBrandColors(resolved.primaryColor, resolved.secondaryColor)
      applyDocumentBranding(resolved)
    } catch {
      // Silently fall back to defaults
    } finally {
      setLoading(false)
    }
  }, [user?.role])

  useEffect(() => {
    fetchBranding()
    // Refetch when the signed-in user changes: the profile (and its module entitlements) is
    // only readable with a token, so the boot call runs before login.
  }, [fetchBranding, user?.id])

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  )
}
