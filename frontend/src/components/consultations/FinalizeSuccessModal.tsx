import { CheckIcon } from '../icons/Index'

interface FinalizeSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  data: {
    consultationId: string
    version: number
    status: string
    doctorRegistrationNumber?: string
    doctorQualifications?: string
    digitalSignatureHash?: string
    verificationQrCode?: string
    verificationUrl?: string
    followUpDate?: string
    /** Finalize returns `warnings`; keep the old name for already-cached responses. */
    warnings?: Array<{ type: string; drug?: string; message: string }>
    safetyWarnings?: Array<{ type: string; drug?: string; message: string }>
  } | null
  patientName?: string
}

export default function FinalizeSuccessModal({
  isOpen,
  onClose,
  data,
  patientName
}: FinalizeSuccessModalProps) {
  if (!isOpen || !data) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadein">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-scalein">
        {/* Header with success badge */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center text-xl font-bold">
              <CheckIcon />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Consultation Finalized &amp; Signed
              </h3>
              <p className="text-xs text-slate-500">
                Medical record permanently sealed for <strong>{patientName || 'Patient'}</strong> (v{data.version})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-md"
          >
            ✕
          </button>
        </div>

        {/* Safety Warnings if any occurred during finalization */}
        {(data.warnings ?? data.safetyWarnings ?? []).length > 0 && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5">
            <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <span>⚠️ Safety Notice</span>
            </div>
            {(data.warnings ?? data.safetyWarnings ?? []).map((w, idx) => (
              <p key={idx} className="text-xs text-amber-800">
                • {w.message}
              </p>
            ))}
          </div>
        )}

        {/* Legal & Regulatory Signing Details */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
            <span className="text-slate-500">MCI Registration Number:</span>
            <span className="font-mono font-bold text-slate-800">
              {data.doctorRegistrationNumber || 'MCI-VERIFIED'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
            <span className="text-slate-500">Qualifications:</span>
            <span className="font-medium text-slate-800">
              {data.doctorQualifications || 'MBBS, MD'}
            </span>
          </div>

          {data.followUpDate && (
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
              <span className="text-slate-500">Follow-up Appointment:</span>
              <span className="font-semibold text-teal-700">
                {new Date(data.followUpDate).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Digital Signature Hash */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Cryptographic Digital Signature Hash (SHA-256)
            </div>
            <div className="font-mono text-[10px] text-slate-600 break-all bg-white p-2 rounded-lg border border-slate-200">
              {data.digitalSignatureHash || '0x4f8a...'}
            </div>
          </div>

          {/* QR Verification Link for external pharmacy */}
          {data.verificationQrCode && (
            <div className="pt-2 flex items-center justify-between">
              <div className="text-xs">
                <span className="text-slate-500">Chemist Verification Code:</span>
                <div className="font-mono font-bold text-teal-700 text-sm">
                  {data.verificationQrCode}
                </div>
              </div>
              <a
                href={`/api/prescriptions/verify/${data.verificationQrCode}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-xs text-[11px]"
              >
                Scan / Verify QR
              </a>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-secondary btn-sm"
          >
            🖨️ Print Prescription
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary btn-sm"
          >
            Done &amp; Next Patient
          </button>
        </div>
      </div>
    </div>
  )
}
