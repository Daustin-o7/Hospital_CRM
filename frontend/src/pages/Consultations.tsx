import { useState } from 'react'

interface ToothStatus {
  id: number
  label: string
  status: 'healthy' | 'caries' | 'filling' | 'missing' | 'crown'
  arch: 'upper' | 'lower'
}

const INITIAL_TEETH: ToothStatus[] = [
  // Upper arch: 18 down to 11, then 21 up to 28 (represented 1-8 right, 1-8 left)
  { id: 18, label: '18', status: 'healthy', arch: 'upper' },
  { id: 17, label: '17', status: 'healthy', arch: 'upper' },
  { id: 16, label: '16', status: 'healthy', arch: 'upper' },
  { id: 15, label: '15', status: 'healthy', arch: 'upper' },
  { id: 14, label: '14', status: 'healthy', arch: 'upper' },
  { id: 13, label: '13', status: 'healthy', arch: 'upper' },
  { id: 12, label: '12', status: 'healthy', arch: 'upper' },
  { id: 11, label: '11', status: 'healthy', arch: 'upper' },
  { id: 21, label: '21', status: 'healthy', arch: 'upper' },
  { id: 22, label: '22', status: 'healthy', arch: 'upper' },
  { id: 23, label: '23', status: 'healthy', arch: 'upper' },
  { id: 24, label: '24', status: 'healthy', arch: 'upper' },
  { id: 25, label: '25', status: 'healthy', arch: 'upper' },
  { id: 26, label: '26', status: 'healthy', arch: 'upper' },
  { id: 27, label: '27', status: 'healthy', arch: 'upper' },
  { id: 28, label: '28', status: 'healthy', arch: 'upper' },

  // Lower arch: 48 down to 41, then 31 up to 38
  { id: 48, label: '48', status: 'healthy', arch: 'lower' },
  { id: 47, label: '47', status: 'healthy', arch: 'lower' },
  { id: 46, label: '46', status: 'caries',  arch: 'lower' },
  { id: 45, label: '45', status: 'healthy', arch: 'lower' },
  { id: 44, label: '44', status: 'healthy', arch: 'lower' },
  { id: 43, label: '43', status: 'healthy', arch: 'lower' },
  { id: 42, label: '42', status: 'healthy', arch: 'lower' },
  { id: 41, label: '41', status: 'healthy', arch: 'lower' },
  { id: 31, label: '31', status: 'healthy', arch: 'lower' },
  { id: 32, label: '32', status: 'healthy', arch: 'lower' },
  { id: 33, label: '33', status: 'healthy', arch: 'lower' },
  { id: 34, label: '34', status: 'healthy', arch: 'lower' },
  { id: 35, label: '35', status: 'healthy', arch: 'lower' },
  { id: 36, label: '36', status: 'filling',  arch: 'lower' },
  { id: 37, label: '37', status: 'healthy', arch: 'lower' },
  { id: 38, label: '38', status: 'healthy', arch: 'lower' },
]

export default function Consultations() {
  const [activeTab, setActiveTab] = useState<'visit' | 'vitals' | 'history' | 'exam' | 'diag' | 'rx' | 'advice' | 'docs'>('exam')
  const [templateType, setTemplateType] = useState<'dental' | 'general' | 'ayurveda'>('dental')
  const [teeth, setTeeth] = useState<ToothStatus[]>(INITIAL_TEETH)
  const [selectedTooth, setSelectedTooth] = useState<number | null>(46)
  const [findings, setFindings] = useState('+ Caries in 46\n+ Occlusal pit staining in 36')
  const [treatment, setTreatment] = useState('+ Composite Filling in 46\n+ Pit & Fissure sealant')
  const [notes, setNotes] = useState('Patient advised regular oral hygiene and warm saline rinses.')
  const [saveToast, setSaveToast] = useState(false)
  const [vitals] = useState({
    bp: '120/80',
    pulse: 74,
    temp: 98.4,
    spo2: 99,
    weight: 68,
  })

  const addFindingChip = (text: string) => {
    setFindings(prev => prev ? `${prev}\n+ ${text}` : `+ ${text}`)
  }

  const addTreatmentChip = (text: string) => {
    setTreatment(prev => prev ? `${prev}\n+ ${text}` : `+ ${text}`)
  }

  const cycleToothStatus = (id: number) => {
    const statuses: ToothStatus['status'][] = ['healthy', 'caries', 'filling', 'missing', 'crown']
    setTeeth(prev => prev.map(t => {
      if (t.id === id) {
        const nextIdx = (statuses.indexOf(t.status) + 1) % statuses.length
        return { ...t, status: statuses[nextIdx] }
      }
      return t
    }))
    setSelectedTooth(id)
  }

  const handleSaveDraft = () => {
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 3000)
  }

  const handleComplete = () => {
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 3000)
  }

  return (
    <div className="space-y-5 pb-12 animate-fadein">
      {/* ── Patient Header Card & Live Vitals Strip ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold text-lg shadow-md"
            style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
              fontFamily: 'var(--font-heading)'
            }}
          >
            RK
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                Ravi Kumar
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                In Examination
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              32 Y • Male • UHID-12345 • Consulting: <strong className="text-slate-700">Dr. Rajesh Sharma (BDS, MDS)</strong>
            </p>
          </div>
        </div>

        {/* Live Vitals Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">BP</span>
            <span className="font-mono text-xs font-bold text-slate-800">{vitals.bp}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Norm</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pulse</span>
            <span className="font-mono text-xs font-bold text-slate-800">{vitals.pulse} bpm</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SpO2</span>
            <span className="font-mono text-xs font-bold text-teal-700">{vitals.spo2}%</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temp</span>
            <span className="font-mono text-xs font-bold text-slate-800">{vitals.temp}°F</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-colors border border-slate-200"
          >
            Save Draft
          </button>
          <button
            onClick={handleComplete}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Finalize & Sign</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>Clinical notes signed and securely appended to patient record.</span>
        </div>
      )}

      {/* ── 3-Column Clinical Pad ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Vertical Navigation Tabs (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-2 shadow-xs space-y-1">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            EMR Sections
          </div>
          {[
            { id: 'visit', label: 'Visit Info', icon: '📋' },
            { id: 'vitals', label: 'Vitals', icon: '❤️' },
            { id: 'history', label: 'History', icon: '⏱️' },
            { id: 'exam', label: 'Examination', icon: '🔍' },
            { id: 'diag', label: 'Diagnosis', icon: '🩺' },
            { id: 'rx', label: 'Prescription', icon: '💊' },
            { id: 'advice', label: 'Advice', icon: '📝' },
            { id: 'docs', label: 'Documents', icon: '📂' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Center Main Pad (Speciality Template) (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          {/* Template Header & Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {templateType === 'dental' ? 'Dental Checkup Template' : templateType === 'ayurveda' ? 'Ayurveda Consultation' : 'General Physician'}
              </span>
              <span className="text-slate-400 text-xs">›</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTemplateType('dental')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  templateType === 'dental' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Dental
              </button>
              <button
                onClick={() => setTemplateType('general')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  templateType === 'general' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setTemplateType('ayurveda')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  templateType === 'ayurveda' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ayurveda
              </button>
            </div>
          </div>

          {/* Interactive Dental Chart */}
          {templateType === 'dental' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tooth Condition Interactive Chart
                </h3>
                <span className="text-[11px] text-slate-400">Click any tooth to cycle status</span>
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span> Healthy
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Caries
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> Filling
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Crown
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span> Missing
                </span>
              </div>

              {/* Tooth diagram container */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-4">
                {/* Upper Arch */}
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                    Upper Arch (Maxillary)
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
                    {teeth.filter(t => t.arch === 'upper').map(tooth => {
                      const isCaries = tooth.status === 'caries'
                      const isFilling = tooth.status === 'filling'
                      const isCrown = tooth.status === 'crown'
                      const isMissing = tooth.status === 'missing'

                      let colorClass = 'bg-white border-slate-300 text-slate-700'
                      if (isCaries) colorClass = 'bg-rose-100 border-rose-400 text-rose-800'
                      if (isFilling) colorClass = 'bg-blue-100 border-blue-400 text-blue-800'
                      if (isCrown) colorClass = 'bg-amber-100 border-amber-400 text-amber-800'
                      if (isMissing) colorClass = 'bg-purple-100 border-purple-400 text-purple-800 opacity-40'

                      return (
                        <button
                          key={tooth.id}
                          onClick={() => cycleToothStatus(tooth.id)}
                          className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-xs font-bold transition-all hover:scale-105 ${colorClass} ${
                            selectedTooth === tooth.id ? 'ring-2 ring-emerald-500' : ''
                          }`}
                          title={`Tooth ${tooth.label}: ${tooth.status}`}
                        >
                          <svg className="w-4 h-4 mb-0.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C9 2 7 4 7 7c0 4 2 8 5 15 3-7 5-11 5-15 0-3-2-5-5-5z" />
                          </svg>
                          <span className="text-[10px] font-mono">{tooth.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Lower Arch */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                    Lower Arch (Mandibular)
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
                    {teeth.filter(t => t.arch === 'lower').map(tooth => {
                      const isCaries = tooth.status === 'caries'
                      const isFilling = tooth.status === 'filling'
                      const isCrown = tooth.status === 'crown'
                      const isMissing = tooth.status === 'missing'

                      let colorClass = 'bg-white border-slate-300 text-slate-700'
                      if (isCaries) colorClass = 'bg-rose-100 border-rose-400 text-rose-800'
                      if (isFilling) colorClass = 'bg-blue-100 border-blue-400 text-blue-800'
                      if (isCrown) colorClass = 'bg-amber-100 border-amber-400 text-amber-800'
                      if (isMissing) colorClass = 'bg-purple-100 border-purple-400 text-purple-800 opacity-40'

                      return (
                        <button
                          key={tooth.id}
                          onClick={() => cycleToothStatus(tooth.id)}
                          className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-xs font-bold transition-all hover:scale-105 ${colorClass} ${
                            selectedTooth === tooth.id ? 'ring-2 ring-emerald-500' : ''
                          }`}
                          title={`Tooth ${tooth.label}: ${tooth.status}`}
                        >
                          <svg className="w-4 h-4 mb-0.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 22C9 22 7 20 7 17c0-4 2-8 5-15 3 7 5 11 5 15 0 3-2 5-5 5z" />
                          </svg>
                          <span className="text-[10px] font-mono">{tooth.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Clinical Text Fields */}
          <div className="space-y-5 pt-2">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Clinical Examination & Findings
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Quick Add:</span>
                  <button
                    type="button"
                    onClick={() => addFindingChip('Enamel demineralization detected')}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    + Demineralization
                  </button>
                  <button
                    type="button"
                    onClick={() => addFindingChip('Gingival inflammation (Grade 1)')}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    + Gingivitis
                  </button>
                  <button
                    type="button"
                    onClick={() => addFindingChip('No periapical radiolucency')}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    + Normal X-ray
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                placeholder="Enter objective clinical findings..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Treatment Procedures & Interventions
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Quick Add:</span>
                  <button
                    type="button"
                    onClick={() => addTreatmentChip('Ultrasonic Scaling & Polishing')}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    + Scaling
                  </button>
                  <button
                    type="button"
                    onClick={() => addTreatmentChip('Light-cure Composite Restoration')}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    + Restoration
                  </button>
                  <button
                    type="button"
                    onClick={() => addTreatmentChip('Follow-up review in 7 days')}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    + 7d Review
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                placeholder="Enter planned dental or medical procedures..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Patient Advice & Home Care Instructions
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions for patient..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Patient Clinical Summary Sidebar (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Patient History */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
              <span>Patient History</span>
              <span className="text-[10px] text-emerald-600">Verified</span>
            </h3>
            <div className="text-xs text-slate-600 space-y-1">
              <p className="flex items-center gap-1.5 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> No known allergies
              </p>
              <p className="flex items-center gap-1.5 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Non-smoker
              </p>
            </div>
          </div>

          {/* Current Medications */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Medications
            </h3>
            <div className="text-xs space-y-1.5">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="font-semibold text-slate-800">Paracetamol 500mg</span>
                <span className="text-[10px] text-slate-400">Oral</span>
              </div>
            </div>
          </div>

          {/* Lab Orders */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Lab Orders
            </h3>
            <div className="text-xs space-y-1.5">
              <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
                <span className="font-semibold text-emerald-900">CBC Complete</span>
                <span className="text-[10px] font-bold text-emerald-700">Completed</span>
              </div>
            </div>
          </div>

          {/* Prescription Summary */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Prescription
            </h3>
            <div className="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800">Paracetamol 500mg</div>
              <div className="text-[11px] text-slate-500 font-mono">1-0-1 • 5 days (After Food)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}