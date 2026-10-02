import { useState, useEffect } from 'react'
import { EmptyState, SkeletonList } from '../components/ui/EmptyState'
import { friendlyError } from '../components/ui/Alert'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface NotificationRule {
  id: string
  ruleType: string
  timingConfig: any
  templateId: string
  templateName: string
  active: boolean
}

interface MessageTemplate {
  id: string
  name: string
  channel: string
  content: string
  approvalStatus: string
}

const RULE_LABELS: Record<string, { name: string; trigger: string; timing: string }> = {
  appointmentconfirmation: { name: 'Appointment Confirmation', trigger: 'Booking Confirmed', timing: 'Instant on scheduling' },
  appointmentreminder: { name: 'Appointment Reminder', trigger: 'Upcoming Appointment', timing: '1 day before slot' },
  remindndaysbefore: { name: 'Follow-up Reminder', trigger: 'Before Follow-up Date', timing: 'N days before' },
  remindifnovisitnmonths: { name: 'Re-engagement Nudge', trigger: 'No Visit in N Months', timing: 'Monthly check' },
}

const previewText = (content: string) =>
  (content || '')
    .replace('{{clinic_name}}', 'Samstack Clinic')
    .replace('{{date}}', '12 Oct 2026')
    .replace('{{time}}', '10:30 AM')
    .replace('{{patient_name}}', 'Ravi Kumar')
    .replace('{{doctor_name}}', 'Dr. Mehta')
    .replace('{{slot_time}}', '10:30 AM')

export default function Messages() {
  const { hasRole } = useAuth()
  const canManageRules = hasRole(['ClinicAdmin'])

  const [rules, setRules] = useState<NotificationRule[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rulesForbidden, setRulesForbidden] = useState(false)
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [testPhone, setTestPhone] = useState('+91 98765 43210')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    const [rulesRes, tplRes] = await Promise.allSettled([
      api.get('/notification-rules'),
      api.get('/message-templates'),
    ])

    if (tplRes.status === 'rejected') {
      setError(friendlyError(tplRes.reason))
      setLoading(false)
      return
    }
    setTemplates(tplRes.value.data)

    if (rulesRes.status === 'rejected') {
      const status = rulesRes.reason?.response?.status
      if (status === 403) {
        setRulesForbidden(true)
        setRules([])
      } else {
        setError(friendlyError(rulesRes.reason))
        setLoading(false)
        return
      }
    } else {
      setRulesForbidden(false)
      setRules(rulesRes.value.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const selectedRule = rules.find(r => r.id === selectedRuleId) ?? rules[0] ?? null
  const selectedTemplate =
    templates.find(t => t.id === selectedRule?.templateId) ??
    templates[0] ??
    null

  const toggleRule = async (rule: NotificationRule) => {
    // Optimistic toggle; revert on failure
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))
    try {
      await api.patch(`/notification-rules/${rule.id}`, { active: !rule.active })
    } catch (err) {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: rule.active } : r))
      showToast(friendlyError(err))
    }
  }

  const handleSendTest = (e: React.FormEvent) => {
    e.preventDefault()
    showToast('Test send requires a connected WhatsApp provider — not yet enabled.')
  }

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
              WhatsApp Templates Pending Meta Approval
            </span>
            <span className="text-xs text-slate-400 font-mono">Module 13</span>
          </div>
          <h1 className="page-title font-heading mt-1">
            Omnichannel Patient Communications
          </h1>
          <p className="page-description">
            Event-driven WhatsApp, SMS, and Email automation triggers. Delivery is enabled once a
            messaging provider is connected.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="badge badge-neutral">Meta API status — not connected</span>
        </div>
      </div>

      {toast && (
        <div className="alert alert-info">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={fetchData} className="btn btn-ghost btn-sm ml-2">Retry</button>
        </div>
      )}

      {/* ── Main Layout: Rules list on Left (7 cols), Smartphone Simulator on Right (5 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Automation Rules (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-sm font-bold tracking-tight font-heading text-[var(--color-text)]">Automated Trigger Rules</h2>
                <p className="text-[11px] text-[var(--color-text-muted)]">Click a rule to inspect its live message template</p>
              </div>
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                {loading ? '…' : `${rules.filter(r => r.active).length} Active Rules`}
              </span>
            </div>

            {loading && <SkeletonList count={3} />}

            {!loading && rulesForbidden && (
              <EmptyState
                title="Clinic Admin Only"
                description="Notification rules can only be viewed and toggled by a Clinic Admin. Message templates are still available on the right."
              />
            )}

            {!loading && !rulesForbidden && rules.length === 0 && !error && (
              <EmptyState
                title="No Notification Rules"
                description="Default confirmation and reminder rules are seeded at first start. If none appear, the rules engine has not been seeded yet."
              />
            )}

            {!loading && !rulesForbidden && (
              <div className="space-y-3">
                {rules.map(rule => {
                  const meta = RULE_LABELS[rule.ruleType] ?? { name: rule.ruleType, trigger: '—', timing: '—' }
                  const isSelected = selectedRule?.id === rule.id
                  return (
                    <div
                      key={rule.id}
                      onClick={() => setSelectedRuleId(rule.id)}
                      className={`card p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-10)]'
                          : 'hover:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-[var(--color-text)]">{meta.name}</h3>
                            <span className="badge badge-neutral">
                              {rule.templateName}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            <span className="font-semibold text-[var(--color-text-secondary)]">Trigger:</span> {meta.trigger} • <span className="font-semibold text-[var(--color-text-secondary)]">Timing:</span> {meta.timing}
                          </p>
                        </div>

                        {canManageRules && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleRule(rule) }}
                            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                              rule.active ? 'bg-[var(--brand-primary)]' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                            aria-label={`${rule.active ? 'Disable' : 'Enable'} rule: ${meta.name}`}
                          >
                            <span className={`block w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                              rule.active ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Message Templates */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-sm font-bold tracking-tight font-heading text-[var(--color-text)]">Message Templates</h2>
                <p className="text-[11px] text-[var(--color-text-muted)]">WhatsApp templates awaiting Meta business approval</p>
              </div>
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                {loading ? '…' : `${templates.length} Templates`}
              </span>
            </div>

            {loading && <SkeletonList count={2} />}

            {!loading && templates.length === 0 && !error && (
              <EmptyState
                title="No Templates Yet"
                description="Message templates are seeded on first start. None are present in this environment."
              />
            )}

            {!loading && templates.length > 0 && (
              <div className="space-y-3">
                {templates.map(t => (
                  <div key={t.id} className="card p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-[var(--color-text)]">{t.name}</h3>
                      <div className="flex items-center gap-1.5">
                        <span className="badge badge-neutral uppercase">{t.channel}</span>
                        {t.approvalStatus === 'approved' ? (
                          <span className="badge badge-success">Approved</span>
                        ) : t.approvalStatus === 'rejected' ? (
                          <span className="badge badge-danger">Rejected</span>
                        ) : (
                          <span className="badge badge-warning">Pending Meta</span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)] font-mono">
                      {t.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Smartphone WhatsApp Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card p-5 space-y-4">
            <div className="border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-sm font-bold tracking-tight font-heading text-[var(--color-text)]">WhatsApp Template Simulator</h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">Live preview of selected trigger dispatch</p>
            </div>

            {loading && <div className="skeleton-card" />}

            {!loading && selectedTemplate && (
              <>
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
                        {previewText(selectedTemplate.content)}
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono">
                        <span>10:30 AM</span>
                        <span className="text-teal-600 font-bold">✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Test Send Dispatcher Box */}
                <form onSubmit={handleSendTest} className="pt-2 space-y-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <label className="form-label">
                    Send Live Test Message
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="form-input font-mono"
                    />
                    <button
                      type="button"
                      disabled
                      title="Requires a connected WhatsApp provider (not yet enabled)"
                      className="btn btn-secondary btn-sm"
                    >
                      Send Test
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Disabled until a messaging provider is connected — no send endpoint is available yet.
                  </p>
                </form>
              </>
            )}

            {!loading && !selectedTemplate && !error && (
              <EmptyState
                title="No Template to Preview"
                description="Once a message template exists, its live WhatsApp preview appears here."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
