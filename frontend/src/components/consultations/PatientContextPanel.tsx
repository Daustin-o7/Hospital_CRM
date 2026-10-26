import { ActivityIcon, PillIcon } from '../icons/Index'
import type { PatientClinicalContext } from './consultationTypes'

interface PatientContextPanelProps {
  context: PatientClinicalContext | null
  loading: boolean
  isOpen: boolean
  onClose: () => void
  onCopyPreviousRx: (previousItems: any[]) => void
}

export default function PatientContextPanel({
  context,
  loading,
  isOpen,
  onClose,
  onCopyPreviousRx
}: PatientContextPanelProps) {
  if (!isOpen) return null

  if (loading || !context) {
    return (
      <div className="card p-4 bg-teal-50/40 border-teal-200 animate-fadein">
        <div className="flex items-center justify-between pb-3 border-b border-teal-100">
          <div className="flex items-center gap-2">
            <span className="spinner spinner-sm" />
            <span className="text-xs font-semibold text-slate-700">Loading comprehensive clinical context…</span>
          </div>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
        </div>
      </div>
    )
  }

  const { patient, todayVitals, lastConsultation, totalCompletedVisits } = context

  return (
    <div className="card p-4 bg-gradient-to-br from-slate-50 via-teal-50/20 to-cyan-50/30 border-teal-200/90 shadow-sm animate-fadein space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-teal-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center text-xs font-bold">
            <ActivityIcon />
          </div>
          <h3 className="text-xs font-bold text-slate-900 font-heading uppercase tracking-wider">
            Patient Clinical Context &amp; Longitudinal History
          </h3>
          <span className="badge badge-brand text-[10px]">{totalCompletedVisits} prior visits</span>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded-md hover:bg-slate-200/60 transition-colors"
          aria-label="Close patient context panel"
        >
          ✕ Dismiss
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Demographics & Allergies */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Allergies &amp; Alerts</span>
            <span className="text-[10px] font-mono text-slate-400">{patient.uhid || 'NO-UHID'}</span>
          </div>

          {patient.allergies && patient.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {patient.allergies.map((allergen, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                  {allergen}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              ✓ No known drug allergies (NKDA) recorded
            </div>
          )}

          <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 flex justify-between">
            <span>Age: <strong className="text-slate-700">{patient.approxAge ? `${patient.approxAge}y` : '—'}</strong></span>
            <span>Gender: <strong className="text-slate-700 capitalize">{patient.gender || '—'}</strong></span>
            <span>DOB: <strong className="text-slate-700">{patient.dob || '—'}</strong></span>
          </div>
        </div>

        {/* 2. Today's Vitals (Triage) */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Today's Triage Vitals</span>
            {todayVitals?.recordedAt && (
              <span className="text-[10px] text-slate-400">
                {new Date(todayVitals.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {todayVitals ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-500">BP</div>
                <div className="text-xs font-bold text-slate-800">
                  {todayVitals.systolicBp && todayVitals.diastolicBp ? `${todayVitals.systolicBp}/${todayVitals.diastolicBp}` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-500">Heart Rate</div>
                <div className="text-xs font-bold text-slate-800">
                  {todayVitals.heartRate ? `${todayVitals.heartRate} bpm` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-500">Temp</div>
                <div className={`text-xs font-bold ${todayVitals.temperature && todayVitals.temperature > 99.5 ? 'text-amber-700' : 'text-slate-800'}`}>
                  {todayVitals.temperature ? `${todayVitals.temperature}°F` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-500">SpO2</div>
                <div className={`text-xs font-bold ${todayVitals.spO2 && todayVitals.spO2 < 95 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {todayVitals.spO2 ? `${todayVitals.spO2}%` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-500">Weight</div>
                <div className="text-xs font-bold text-slate-800">
                  {todayVitals.weightKg ? `${todayVitals.weightKg} kg` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-500">BMI</div>
                <div className="text-xs font-bold text-slate-800">
                  {todayVitals.bmi ? todayVitals.bmi : '—'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-800 bg-amber-50 px-2 py-1.5 rounded-md border border-amber-200">
              ⚠️ No triage vitals recorded for today yet.
            </div>
          )}
        </div>

        {/* 3. Last Consultation & Prescription */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Previous Visit</span>
            {lastConsultation?.date && (
              <span className="text-[10px] text-slate-400">
                {new Date(lastConsultation.date).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {lastConsultation ? (
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-slate-400 text-[10px]">Diagnosis: </span>
                <strong className="text-slate-800">{lastConsultation.diagnosis || 'Unspecified'}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">Doctor: </span>
                <span className="text-slate-600">{lastConsultation.doctorName || 'Dr. Practitioner'}</span>
              </div>
              {lastConsultation.prescriptions && lastConsultation.prescriptions.length > 0 && (
                <div className="pt-1.5 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                      <PillIcon /> {lastConsultation.prescriptions.length} items prescribed
                    </span>
                    <button
                      type="button"
                      onClick={() => onCopyPreviousRx(lastConsultation.prescriptions)}
                      className="text-[10px] font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded transition-colors"
                      title="Copy these medicines to today's prescription"
                    >
                      📋 Copy to Today's Rx
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate max-w-full">
                    {lastConsultation.prescriptions.map(p => p.brandName || p.genericName).filter(Boolean).join(', ')}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic py-2">
              First recorded consultation for this patient.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
