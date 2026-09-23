import { useState } from 'react'

interface NotificationRule {
  id: string
  name: string
  trigger: string
  role: string
  timing: string
  templateText: string
  channels: { whatsapp: boolean; sms: boolean; email: boolean }
  active: boolean
  sentToday: number
  readRate: number
}

export default function Messages() {
  const [rules, setRules] = useState<NotificationRule[]>([
    {
      id: '1',
      name: 'Appointment Confirmation & Directions',
      trigger: 'Booking Confirmed',
      role: 'Patient',
      timing: 'Instant on scheduling',
      templateText: 'Namaste {{patient_name}}, your appointment with {{doctor_name}} is confirmed for {{slot_time}} at Samstack Clinic. Please arrive 10 mins prior.',
      channels: { whatsapp: true, sms: true, email: false },
      active: true,
      sentToday: 18,
      readRate: 94
    },
    {
      id: '2',
      name: 'Pre-Consultation Clinical Intake Form',
      trigger: '2 Hours Before Slot',
      role: 'Patient',
      timing: '2 hours prior',
      templateText: 'Dear {{patient_name}}, please fill your rapid digital intake form (allergies & history) before your slot: https://crm.samstack.health/intake/{{token}}',
      channels: { whatsapp: true, sms: false, email: false },
      active: true,
      sentToday: 14,
      readRate: 88
    },
    {
      id: '3',
      name: 'E-Prescription & Pharmacy Bill Receipt',
      trigger: 'Consultation Complete',
      role: 'Patient',
      timing: 'Instant on doctor sign-off',
      templateText: 'Hello {{patient_name}}, your signed digital prescription and invoice #{{invoice_no}} are ready to view & download: https://crm.samstack.health/rx/{{rx_id}}',
      channels: { whatsapp: true, sms: true, email: true },
      active: true,
      sentToday: 12,
      readRate: 98
    },
    {
      id: '4',
      name: 'Follow-up & Chronic Care Checkup Nudge',
      trigger: '7 Days Post-Visit',
      role: 'Patient',
      timing: '7 days at 10:00 AM',
      templateText: 'Namaste {{patient_name}}, Dr. {{doctor_name}} recommends scheduling your 7-day follow-up review. Click to select a slot: https://crm.samstack.health/book',
      channels: { whatsapp: true, sms: false, email: false },
      active: false,
      sentToday: 0,
      readRate: 0
    },
  ])

  const [selectedRule, setSelectedRule] = useState<NotificationRule>(rules[0])
  const [testPhone, setTestPhone] = useState('+91 98765 43210')
  const [sendingTest, setSendingTest] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

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

  const handleSendTest = (e: React.FormEvent) => {
    e.preventDefault()
    setSendingTest(true)
    setTimeout(() => {
      setSendingTest(false)
      showToast(`Test WhatsApp message sent successfully to ${testPhone}`)
    }, 800)
  }

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
              Meta Cloud WhatsApp BSP Engine Active
            </span>
            <span className="text-xs text-slate-400 font-mono">Module 13</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading mt-1">
            Omnichannel Patient Communications
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Event-driven WhatsApp, SMS, and Email automation triggers with verified delivery telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Meta API Rate: Healthy</span>
          </div>
        </div>
      </div>

      {toast && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs">
          <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* ── Main Layout: Rules list on Left (7 cols), Smartphone Simulator on Right (5 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Automation Rules (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading">Automated Trigger Rules</h2>
                <p className="text-[11px] text-slate-400">Click a rule to inspect live message template</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {rules.filter(r => r.active).length} Active Rules
              </span>
            </div>

            <div className="space-y-3">
              {rules.map(rule => {
                const isSelected = selectedRule.id === rule.id
                return (
                  <div
                    key={rule.id}
                    onClick={() => setSelectedRule(rule)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/30 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-900">{rule.name}</h3>
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            {rule.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">Trigger:</span> {rule.trigger} • <span className="font-semibold text-slate-700">Timing:</span> {rule.timing}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Channel Toggles */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleChannel(rule.id, 'whatsapp') }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              rule.channels.whatsapp ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-400'
                            }`}
                            title="Toggle WhatsApp"
                          >
                            💬 WA
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleChannel(rule.id, 'sms') }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              rule.channels.sms ? 'bg-blue-50 text-blue-800 border border-blue-300' : 'bg-slate-100 text-slate-400'
                            }`}
                            title="Toggle SMS"
                          >
                            📱 SMS
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleChannel(rule.id, 'email') }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              rule.channels.email ? 'bg-purple-50 text-purple-800 border border-purple-300' : 'bg-slate-100 text-slate-400'
                            }`}
                            title="Toggle Email"
                          >
                            ✉️ Mail
                          </button>
                        </div>

                        {/* Active Switch */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleRule(rule.id) }}
                          className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                            rule.active ? 'bg-teal-600' : 'bg-slate-300'
                          }`}
                          aria-label="Toggle rule status"
                        >
                          <span className={`block w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                            rule.active ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {rule.active && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span className="font-mono">Dispatched today: <strong className="text-slate-800">{rule.sentToday} msgs</strong></span>
                        <span className="font-semibold text-teal-700">Read rate: {rule.readRate}%</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Smartphone WhatsApp Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading">WhatsApp Template Simulator</h2>
              <p className="text-[11px] text-slate-400">Live preview of selected trigger dispatch</p>
            </div>

            {/* Smartphone Graphic Mockup */}
            <div className="bg-slate-900 rounded-3xl p-3 border-4 border-slate-800 shadow-lg max-w-sm mx-auto">
              <div className="w-16 h-3.5 bg-slate-800 rounded-full mx-auto mb-2"></div>
              
              {/* WhatsApp App Header */}
              <div className="bg-teal-800 text-white p-3 rounded-t-2xl flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center font-bold text-xs">
                  SC
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">Samstack Health Clinic</div>
                  <div className="text-[10px] text-teal-200">Official Verified Business ✓</div>
                </div>
              </div>

              {/* Chat Bubble Area */}
              <div className="bg-[#EFEAE2] p-3.5 min-h-56 rounded-b-2xl space-y-3">
                <div className="text-[10px] text-center text-slate-500 font-semibold bg-white/70 py-0.5 px-2 rounded-full w-fit mx-auto shadow-2xs">
                  TODAY
                </div>

                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-xs text-xs text-slate-800 space-y-2 border border-slate-100">
                  <p className="leading-relaxed">
                    {selectedRule.templateText
                      .replace('{{patient_name}}', 'Ravi Kumar')
                      .replace('{{doctor_name}}', 'Dr. Mehta')
                      .replace('{{slot_time}}', '10:30 AM')
                      .replace('{{token}}', 'TKN-8421')
                      .replace('{{invoice_no}}', 'INV-2026-042')
                      .replace('{{rx_id}}', 'RX-9912')}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono">
                    <span>10:30 AM</span>
                    <span className="text-teal-600 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Send Dispatcher Box */}
            <form onSubmit={handleSendTest} className="pt-2 space-y-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Send Live Test Message
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs transition whitespace-nowrap cursor-pointer"
                >
                  {sendingTest ? 'Sending…' : 'Send Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
