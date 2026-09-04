import { useState } from 'react'

interface NotificationRule {
  id: string
  name: string
  trigger: string
  role: string
  timing: string
  channels: { whatsapp: boolean; sms: boolean; email: boolean }
  active: boolean
}

export default function Messages() {
  const [rules, setRules] = useState<NotificationRule[]>([
    { id: '1', name: 'Appointment Reminder', trigger: 'Upcoming Booking', role: 'Patient', timing: '1 day before at 09:00 AM', channels: { whatsapp: true, sms: true, email: false }, active: true },
    { id: '2', name: 'Pre-check Form Nudge', trigger: 'Appointment Confirmed', role: 'Patient', timing: '2 hours before slot', channels: { whatsapp: true, sms: false, email: false }, active: true },
    { id: '3', name: 'Lab Report Ready Alert', trigger: 'Lab Result Entered', role: 'Patient', timing: 'Immediately on upload', channels: { whatsapp: true, sms: true, email: true }, active: true },
    { id: '4', name: 'Follow-up Rebooking Nudge', trigger: 'Consultation Complete', role: 'Patient', timing: '7 days post-visit', channels: { whatsapp: true, sms: false, email: false }, active: false },
    { id: '5', name: 'Emergency Queue Alert', trigger: 'Emergency Priority Escalation', role: 'Doctor & Reception', timing: 'Real-time Push', channels: { whatsapp: false, sms: true, email: false }, active: true },
  ])

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r))
  }

  const toggleChannel = (ruleId: string, channel: 'whatsapp' | 'sms' | 'email') => {
    setRules(prev => prev.map(r => {
      if (r.id === ruleId) {
        return {
          ...r,
          channels: { ...r.channels, [channel]: !r.channels[channel] }
        }
      }
      return r
    }))
  }

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Notification Rules & Messages
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Module 13 — Automate WhatsApp, SMS, and Email reminders based on clinic lifecycle events.
          </p>
        </div>

        <button className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-700/20">
          + New Rule
        </button>
      </div>

      {/* ── Notification Rules List (Module 13 from design board) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Active Automation Rules</h2>

        <div className="divide-y divide-slate-100">
          {rules.map(rule => (
            <div key={rule.id} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-slate-900">{rule.name}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                    {rule.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Trigger:</span> {rule.trigger} • <span className="font-semibold text-slate-700">Timing:</span> {rule.timing}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Channel Badges / Toggles */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleChannel(rule.id, 'whatsapp')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                      rule.channels.whatsapp ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-400'
                    }`}
                    title="Toggle WhatsApp"
                  >
                    💬 WhatsApp
                  </button>

                  <button
                    onClick={() => toggleChannel(rule.id, 'sms')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                      rule.channels.sms ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-slate-100 text-slate-400'
                    }`}
                    title="Toggle SMS"
                  >
                    📱 SMS
                  </button>

                  <button
                    onClick={() => toggleChannel(rule.id, 'email')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                      rule.channels.email ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-slate-100 text-slate-400'
                    }`}
                    title="Toggle Email"
                  >
                    ✉️ Email
                  </button>
                </div>

                {/* Active Switch */}
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    rule.active ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                  aria-label="Toggle rule status"
                >
                  <span className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    rule.active ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
