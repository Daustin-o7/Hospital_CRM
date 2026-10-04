
export interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'mark-only' | 'icon'
  theme?: 'dark' | 'light' | 'auto'
  className?: string
  organizationName?: string
  tagline?: string
  useImage?: boolean
}

/**
 * Modern Clinical Insignia:
 * Balanced precision healthcare cross with dual-tone depth and vital telemetry core.
 */
export function HealthEmblem({
  size = 34,
  className = '',
  theme = 'auto',
  useImage = false,
}: {
  size?: number
  className?: string
  theme?: 'dark' | 'light' | 'auto'
  useImage?: boolean
}) {
  if (useImage) {
    return (
      <img
        src="/images/healthcare-logo.png"
        alt="Healthcare Logo"
        width={size}
        height={size}
        className={`rounded-xl object-cover shadow-sm ring-1 ring-teal-500/30 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  const isLight = theme === 'light'

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 group ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full transition-transform duration-200 group-hover:scale-105"
      >
        <defs>
          {/* Dark Container Gradient */}
          <linearGradient id="emblemBgDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d2330" />
            <stop offset="50%" stopColor="#081e28" />
            <stop offset="100%" stopColor="#041117" />
          </linearGradient>

          {/* Light Container Gradient */}
          <linearGradient id="emblemBgLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0fdfa" />
            <stop offset="100%" stopColor="#ccfbf1" />
          </linearGradient>

          {/* Hairline Border Gradient */}
          <linearGradient id="emblemBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.25" />
          </linearGradient>

          {/* Vertical Arm Gradient: Emerald -> Teal */}
          <linearGradient id="crossVertical" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>

          {/* Horizontal Arm Gradient: Sky -> Cyan */}
          <linearGradient id="crossHorizontal" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>

        {/* 1. Sleek Squircle Container Badge */}
        <rect
          x="5"
          y="5"
          width="90"
          height="90"
          rx="24"
          fill={isLight ? 'url(#emblemBgLight)' : 'url(#emblemBgDark)'}
          stroke={isLight ? '#0d9488' : 'url(#emblemBorder)'}
          strokeWidth="1.8"
          strokeOpacity={isLight ? 0.3 : 1}
        />

        {/* 2. Geometric Medical Cross (Precision Rounded Arms) */}
        {/* Vertical Axis */}
        <rect
          x="40"
          y="20"
          width="20"
          height="60"
          rx="10"
          fill="url(#crossVertical)"
        />
        {/* Horizontal Axis */}
        <rect
          x="20"
          y="40"
          width="60"
          height="20"
          rx="10"
          fill="url(#crossHorizontal)"
          opacity="0.92"
        />

        {/* 3. Center Vitality Aperture Core */}
        <circle
          cx="50"
          cy="50"
          r="13"
          fill={isLight ? '#ffffff' : '#081e28'}
          stroke={isLight ? '#0d9488' : '#2dd4bf'}
          strokeWidth="2"
        />

        {/* 4. Telemetry Vital Pulse Contour */}
        <path
          d="M 43 50 H 46 L 48.5 45.5 L 51.5 54.5 L 53.5 48 L 55 50 H 57"
          fill="none"
          stroke={isLight ? '#0d9488' : '#2dd4bf'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function BrandLogo({
  size = 'md',
  variant = 'full',
  theme = 'auto',
  className = '',
  organizationName,
  tagline,
  useImage = false,
}: BrandLogoProps) {
  const pixelSize = {
    xs: 24,
    sm: 28,
    md: 34,
    lg: 42,
    xl: 52,
  }[size]

  const titleSizeClass = {
    xs: 'text-xs',
    sm: 'text-sm font-semibold',
    md: 'text-sm font-bold tracking-tight',
    lg: 'text-base font-bold tracking-tight',
    xl: 'text-xl font-bold tracking-tight',
  }[size]

  const subSizeClass = {
    xs: 'text-[8px]',
    sm: 'text-[9px]',
    md: 'text-[10px] tracking-wider',
    lg: 'text-[11px] tracking-wider',
    xl: 'text-xs tracking-wider',
  }[size]

  const isDark = theme === 'dark'
  const isLight = theme === 'light'

  const titleColor = isDark
    ? 'text-white'
    : isLight
    ? 'text-slate-900'
    : 'text-[var(--color-text)]'

  const subColor = isDark
    ? 'text-teal-400/90'
    : isLight
    ? 'text-teal-700'
    : 'text-teal-600 dark:text-teal-400'

  const finalName = organizationName || 'SAMSTACK AI'
  const finalTagline = tagline || 'Clinical Operating System'

  if (variant === 'icon' || variant === 'mark-only') {
    return (
      <HealthEmblem size={pixelSize} className={className} theme={theme} useImage={useImage} />
    )
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <HealthEmblem size={pixelSize} theme={theme} useImage={useImage} />
      <div className="flex flex-col min-w-0">
        <span className={`font-heading ${titleSizeClass} ${titleColor} truncate leading-tight`}>
          {finalName}
        </span>
        <span className={`font-mono uppercase font-semibold ${subSizeClass} ${subColor} truncate leading-none mt-0.5`}>
          {finalTagline}
        </span>
      </div>
    </div>
  )
}
