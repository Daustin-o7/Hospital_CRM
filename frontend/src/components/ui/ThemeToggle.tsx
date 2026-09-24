import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'

interface ThemeToggleProps {
  variant?: 'compact' | 'segmented' | 'dropdown'
  className?: string
}

export function ThemeToggle({ variant = 'compact', className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/60 text-xs font-medium ${className}`}
        role="group"
        aria-label="Theme selection"
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            theme === 'light'
              ? 'bg-white text-teal-800 font-bold shadow-xs dark:bg-slate-700 dark:text-teal-300'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Light Theme"
        >
          <SunIcon className="w-3.5 h-3.5 text-amber-500" />
          <span>Light</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            theme === 'dark'
              ? 'bg-white text-teal-800 font-bold shadow-xs dark:bg-slate-700 dark:text-teal-300'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Dark Theme"
        >
          <MoonIcon className="w-3.5 h-3.5 text-teal-400" />
          <span>Dark</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            theme === 'system'
              ? 'bg-white text-teal-800 font-bold shadow-xs dark:bg-slate-700 dark:text-teal-300'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Auto: Follows Mobile / System Theme"
        >
          <DeviceIcon className="w-3.5 h-3.5 text-sky-400" />
          <span>Auto</span>
        </button>
      </div>
    )
  }

  // Compact one-click dropdown or cycle
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-1.5 p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-700/70 transition-colors shadow-2xs"
        aria-label="Toggle theme mode"
        aria-expanded={dropdownOpen}
        title={`Theme: ${theme === 'system' ? `Auto (${resolvedTheme})` : theme}`}
      >
        {resolvedTheme === 'dark' ? (
          <MoonIcon className="w-4 h-4 text-teal-400 animate-fadein" />
        ) : (
          <SunIcon className="w-4 h-4 text-amber-500 animate-fadein" />
        )}
        {theme === 'system' && (
          <span className="text-[10px] font-bold font-mono tracking-tight text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 px-1 py-0.2 rounded border border-teal-200/60 dark:border-teal-800/60">
            AUTO
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-[#111e2e] rounded-2xl shadow-xl border border-slate-200 dark:border-[#22364f] p-1.5 z-50 text-xs animate-fadein">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
            Appearance
          </div>

          <button
            type="button"
            onClick={() => {
              setTheme('light')
              setDropdownOpen(false)
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors text-left ${
              theme === 'light'
                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <SunIcon className="w-4 h-4 text-amber-500" />
              <span>Light Mode</span>
            </div>
            {theme === 'light' && <span className="text-teal-600 dark:text-teal-400">✓</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('dark')
              setDropdownOpen(false)
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors text-left ${
              theme === 'dark'
                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <MoonIcon className="w-4 h-4 text-teal-400" />
              <span>Dark Mode</span>
            </div>
            {theme === 'dark' && <span className="text-teal-600 dark:text-teal-400">✓</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('system')
              setDropdownOpen(false)
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors text-left ${
              theme === 'system'
                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <DeviceIcon className="w-4 h-4 text-sky-400" />
              <div>
                <span>Auto / Mobile OS</span>
                <p className="text-[9px] text-slate-400 font-normal">Matches device theme</p>
              </div>
            </div>
            {theme === 'system' && <span className="text-teal-600 dark:text-teal-400">✓</span>}
          </button>
        </div>
      )}
    </div>
  )
}

function SunIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  )
}

function MoonIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  )
}

function DeviceIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  )
}
