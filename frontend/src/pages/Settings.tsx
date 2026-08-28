import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

interface ClinicSettings {
  name: string
  workingHours: { day: string; open: string; close: string }[]
  holidays: string[]
}

export default function Settings() {
  const [settings, setSettings] = useState<ClinicSettings>({
    name: 'My Clinic',
    workingHours: [
      { day: 'Monday', open: '09:00', close: '18:00' },
      { day: 'Tuesday', open: '09:00', close: '18:00' },
      { day: 'Wednesday', open: '09:00', close: '18:00' },
      { day: 'Thursday', open: '09:00', close: '18:00' },
      { day: 'Friday', open: '09:00', close: '18:00' },
    ],
    holidays: [],
  })
  const [loading, setLoading] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/clinic/profile')
      setSettings(res.data)
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }, [])

  const onUpdate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put('/clinic/profile', settings)
      showToast('Settings updated successfully')
    } catch (err: any) {
      console.error('Failed to update settings:', err)
      showToast(err.response?.data?.error || 'Failed to update settings', true)
    } finally {
      setLoading(false)
    }
  }, [settings])

  const showToast = (msg: string, isError = false) => {
    const toast = document.createElement('div')
    toast.className = `fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl text-center ${isError ? 'bg-rose-600 text-white' : 'bg-primary-600 text-white'} animate-fade-in`
    toast.textContent = msg
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Clinic Settings</h1>
          <p className="page-subtitle">Configure clinic name and working hours</p>
        </div>
      </div>

      <div className="card-glass p-6">
        <form onSubmit={onUpdate} className="space-y-6">
          <div>
            <label htmlFor="clinicName" className="label">Clinic Name *</label>
            <input
              id="clinicName"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              className="input"
              placeholder="e.g., General Health Clinic"
            />
          </div>

          <div>
            <label className="label">Working Hours *</label>
            <p className="text-sm text-slate-500 mb-3">At least one working day must be defined.</p>
            <div className="grid gap-3">
              {workingDays.map((day) => (
                <div key={day} className="grid gap-2 sm:grid-cols-4">
                  <label className="label sm:col-span-2 font-medium text-sm">
                    {day}
                  </label>
                  <select
                    className="input w-full"
                    value={settings.workingHours.find(h => h.day === day)?.open ? `${settings.workingHours.find(h => h.day === day)!.open}-${settings.workingHours.find(h => h.day === day)!.close}` : ''}
                    onChange={(e) => {
                      const [open, close] = e.target.value.split('-')
                      setSettings({
                        ...settings,
                        workingHours: settings.workingHours.map((h) =>
                          h.day === day ? { ...h, open: open || '', close: close || '' } : h,
                        ),
                      })
                    }}
                  >
                    <option value="">Closed</option>
                    <option value="09:00-18:00">09:00 - 18:00</option>
                    <option value="10:00-17:00">10:00 - 17:00</option>
                    <option value="12:00-21:00">12:00 - 21:00</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Holidays</label>
            <p className="text-sm text-slate-500 mb-3">Dates when clinic is closed (YYYY-MM-DD format)</p>
            <div className="space-y-2">
              {settings.holidays.map((holiday, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={holiday}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        holidays: settings.holidays.map((h, i) => (i === index ? e.target.value : h)),
                      })
                    }
                    className="input w-full max-w-xs"
                    placeholder="2024-12-25"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        holidays: settings.holidays.filter((_, i) => i !== index),
                      })
                    }
                    className="btn-ghost text-xs text-rose-600 hover:bg-rose-50"
                    aria-label="Remove holiday"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    holidays: [...settings.holidays, 'YYYY-MM-DD'],
                  })
                }
                className="text-xs text-slate-500 hover:underline"
                aria-label="Add holiday"
              >
                Add date
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
            <button type="button" onClick={() => showToast('Settings reset to defaults')} className="btn-secondary">Reset</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}