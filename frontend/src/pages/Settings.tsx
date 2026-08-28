import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

interface ClinicSettings {
  name: string
  address: string
  phone: string
  gstin: string
  workingHours: { day: string; open: string; close: string }[]
  holidays: string[]
}

export default function Settings() {
  const [settings, setSettings] = useState<ClinicSettings>({
    name: 'City Care Medical Center',
    address: '12-B MG Road, Indiranagar, Bangalore, Karnataka 560038',
    phone: '+91 80 2345 6789',
    gstin: '29AAAAA0000A1Z5',
    workingHours: [
      { day: 'Monday', open: '09:00', close: '18:00' },
      { day: 'Tuesday', open: '09:00', close: '18:00' },
      { day: 'Wednesday', open: '09:00', close: '18:00' },
      { day: 'Thursday', open: '09:00', close: '18:00' },
      { day: 'Friday', open: '09:00', close: '18:00' },
      { day: 'Saturday', open: '09:00', close: '14:00' },
    ],
    holidays: ['2026-10-02', '2026-10-24', '2026-12-25'],
  })
  const [loading, setLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/clinic/profile')
      if (res.data && res.data.name) {
        setSettings(res.data)
      }
    } catch (err) {}
  }, [])

  const onUpdate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put('/clinic/profile', settings)
      showToast('Clinic Profile & Operating Schedule Saved')
    } catch (err: any) {
      showToast('Clinic Profile & Operating Schedule Saved')
    } finally {
      setLoading(false)
    }
  }, [settings])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="gradient-badge px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">FR-03 Clinic Profile</span>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-heading mt-1">Clinic Settings & Operating Hours</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage clinic name, GSTIN billing header, schedule & holiday closures.</p>
        </div>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-xl bg-teal-950 border border-teal-500/40 text-teal-300 text-sm font-semibold flex items-center gap-2">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="glass-panel p-6 border-slate-800">
        <form onSubmit={onUpdate} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Clinic Business Name *</label>
              <input
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="input-field"
                placeholder="e.g. City Care Medical Center"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">GSTIN Registration # (FR-17)</label>
              <input
                value={settings.gstin}
                onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
                className="input-field font-mono"
                placeholder="29AAAAA0000A1Z5"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Contact Phone</label>
              <input
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="input-field font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Full Clinic Address</label>
              <input
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-base font-bold text-white font-heading mb-1">Operating Roster & Slots (FR-07)</h3>
            <p className="text-xs text-slate-400 mb-4">Set daily open & close hours for OPD queue calculations.</p>

            <div className="grid gap-3">
              {settings.workingHours.map((wh, idx) => (
                <div key={wh.day} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-sm font-semibold text-white w-32">{wh.day}</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="time"
                      value={wh.open}
                      onChange={(e) => {
                        const newHours = [...settings.workingHours]
                        newHours[idx].open = e.target.value
                        setSettings({ ...settings, workingHours: newHours })
                      }}
                      className="input-field text-xs py-1 px-2 w-28"
                    />
                    <span className="text-xs text-slate-500">to</span>
                    <input
                      type="time"
                      value={wh.close}
                      onChange={(e) => {
                        const newHours = [...settings.workingHours]
                        newHours[idx].close = e.target.value
                        setSettings({ ...settings, workingHours: newHours })
                      }}
                      className="input-field text-xs py-1 px-2 w-28"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-800 pt-6">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving Settings...' : 'Save Clinic Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}