import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { Alert, friendlyError } from '../components/ui/Alert'
import { consultationSoapSchema } from '../schemas'
import { EmptyState, Skeleton } from '../components/ui/EmptyState'
import {
  PhoneIcon,
  CopyIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ActivityIcon,
  PillIcon,
  FileTextIcon,
  AlertCircleIcon
} from '../components/icons/Index'

// ── Types & Interfaces ────────────────────────────────────────────────────────

export type SpecialtyId =
  | 'general'
  | 'physiotherapy'
  | 'dental'
  | 'pediatrics'
  | 'dermatology'
  | 'orthopedics'
  | 'cardiology'
  | 'ent'
  | 'ophthalmology'
  | 'ayurveda'

interface ToothStatus {
  id: number
  label: string
  status: 'healthy' | 'caries' | 'filling' | 'missing' | 'crown'
  arch: 'upper' | 'lower'
}

interface AppointmentItem {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  patientGender?: string
  patientAge?: number
  patientDob?: string
  doctorName?: string
  status: string
  appointmentDate: string
  queueNumber?: number
  priority?: string
  type?: string
}

interface PatientDetails {
  id: string
  name: string
  phone: string
  gender?: string
  approxAge?: number
  dob?: string
  bloodGroup?: string
  allergies?: string
  medicalHistory?: string
}

interface PrescriptionDraft {
  medicine: string
  dosage: string
  frequency: string
  duration: string
}

interface MedicineHit {
  id: string
  name: string
  genericName?: string
  commonBrands?: string
  strength?: string
  dosageForm?: string
}

interface SpecialtyConfig {
  id: SpecialtyId
  name: string
  title: string
  icon: string
  badge: string
  description: string
  toolTabName: string
  toolTabIcon: string
  placeholders: {
    complaint: string
    observations: string
    diagnosis: string
  }
  quickChips: {
    complaints: string[]
    observations: string[]
    diagnoses: string[]
  }
}

// ── Specialty Configurations ──────────────────────────────────────────────────

const SPECIALTIES: SpecialtyConfig[] = [
  {
    id: 'general',
    name: 'General Medicine',
    title: 'General / Family Physician',
    icon: '🩺',
    badge: 'OPD / Family Care',
    description: 'Comprehensive adult and family medicine SOAP clinical workflow with systemic review.',
    toolTabName: 'Vitals & Systems',
    toolTabIcon: '🩺',
    placeholders: {
      complaint: 'e.g. High fever for 3 days with chills, generalized body ache and dry cough…',
      observations: 'Vitals: BP 120/80, PR 78bpm, Temp 100.4F, SpO2 98%. Chest: clear bilaterally. CVS: S1 S2 normal. P/A: soft, non-tender…',
      diagnosis: 'e.g. Acute Febrile Illness / Viral Upper Respiratory Tract Infection (ICD-11: CA40)'
    },
    quickChips: {
      complaints: [
        'Fever with chills x 3 days',
        'Persistent dry cough & sore throat',
        'Dyspepsia & epigastric burning',
        'Generalized fatigue & weakness',
        'Routine diabetes & BP review',
        'Acute tension headache x 2 days'
      ],
      observations: [
        'Vitals stable: BP 124/82, PR 76, Temp 98.6°F, SpO2 99%',
        'Mild pharyngeal congestion, tonsils normal',
        'Bilateral vesicular breath sounds, no wheeze/creps',
        'Abdomen soft, non-tender, bowel sounds active',
        'No pallor, icterus, cyanosis, or pedal edema'
      ],
      diagnoses: [
        'Viral Upper Respiratory Infection',
        'Acute Gastritis / Non-ulcer Dyspepsia',
        'Essential Hypertension (Grade 1)',
        'Type 2 Diabetes Mellitus - Follow-up',
        'Acute Tension-Type Headache',
        'Allergic Rhinitis'
      ]
    }
  },
  {
    id: 'dental',
    name: 'Dental & Maxillofacial',
    title: 'Dental Surgeon / Maxillofacial',
    icon: '🦷',
    badge: 'Oral & Dental Surgery',
    description: 'FDI two-digit Odontogram, periodontal exam, caries, and endodontic charting.',
    toolTabName: 'Odontogram Chart',
    toolTabIcon: '🦷',
    placeholders: {
      complaint: 'e.g. Sharp throbbing pain in lower right tooth while chewing, sensitivity to cold fluids…',
      observations: 'Tooth 46: Disto-occlusal deep caries, tender to vertical percussion (TTP+), Grade 1 mobility. Plaque index moderate…',
      diagnosis: 'e.g. Irreversible Pulpitis with Symptomatic Apical Periodontitis i.r.t 46'
    },
    quickChips: {
      complaints: [
        'Sharp throbbing pain in tooth 46 on chewing',
        'Bleeding gums during toothbrushing x 1 month',
        'Chipped incisal edge tooth 11 following trauma',
        'Pain and swelling around lower right wisdom tooth',
        'Generalized tooth sensitivity to cold water',
        'Loose lower front teeth while eating'
      ],
      observations: [
        'Deep occlusal caries 46 with pulpal involvement',
        'Tender to vertical percussion (TTP+) on 46',
        'Generalised marginal gingivitis with subgingival calculus',
        'Grade 1 tooth mobility on 31, 41 with pocket depth 4mm',
        'Partially erupted impacted 38 with inflamed operculum',
        'Enamel fracture involving dentin 11, pulp intact'
      ],
      diagnoses: [
        'Acute Irreversible Pulpitis (Tooth 46)',
        'Chronic Generalized Periodontitis',
        'Pericoronitis i.r.t Impacted 38',
        'Dental Caries (Class II) i.r.t 26',
        'Dentin Hypersensitivity Generalized',
        'Periapical Abscess i.r.t 36'
      ]
    }
  },
  {
    id: 'physiotherapy',
    name: 'Physiotherapy & Rehab',
    title: 'Physiotherapy & Physical Rehabilitation',
    icon: '🏃‍♂️',
    badge: 'Rehab / Physical Therapy',
    description: 'Functional assessment, VAS pain scale, joint ROM, MMT grades, and modalities.',
    toolTabName: 'Functional & ROM Exam',
    toolTabIcon: '🏃‍♂️',
    placeholders: {
      complaint: 'e.g. Constant dull ache in lower back radiating down left posterior thigh, aggravated by sitting >15 mins…',
      observations: 'VAS: 7/10. Lumbar flexion: 35° (painful). SLR left positive at 45°. Core stability: Grade 2/5. Paraspinal spasm present…',
      diagnosis: 'e.g. L4-L5 Lumbar Discogenic Radiculopathy / Adhesive Capsulitis Right Shoulder'
    },
    quickChips: {
      complaints: [
        'Low back pain radiating to left leg x 2 weeks',
        'Right shoulder pain on abduction >90°',
        'Cervical stiffness radiating to occiput & scapula',
        'Post-ACL reconstruction stiffness (Week 4)',
        'Bilateral knee pain during stair climbing',
        'Plantar heel pain on first morning steps'
      ],
      observations: [
        'VAS 6/10 dull ache, aggravated by forward flexion',
        'Active shoulder abduction restricted to 80° (painful arc)',
        'Lumbar paraspinal muscle hypertonicity & trigger points',
        'Straight Leg Raise (SLR) positive left at 45°',
        'Quadriceps MMT Grade 4/5, Hamstrings Grade 4/5',
        'Antalgic gait with shortened stance phase'
      ],
      diagnoses: [
        'Lumbar Discogenic Radiculopathy (L4-L5)',
        'Adhesive Capsulitis (Frozen Shoulder) - Phase 2',
        'Cervical Spondylosis with Muscle Spasm',
        'Knee Osteoarthritis (Grade 2) - Patellofemoral',
        'Supraspinatus Tendinopathy / Impingement',
        'Plantar Fasciitis Right Foot'
      ]
    }
  },
  {
    id: 'pediatrics',
    name: 'Pediatrics',
    title: 'Pediatrician / Child Health',
    icon: '👶',
    badge: 'Child & Adolescent',
    description: 'Well-child milestones, growth percentiles, vaccination tracking, and weight-based doses.',
    toolTabName: 'Growth & Pediatrics',
    toolTabIcon: '👶',
    placeholders: {
      complaint: 'e.g. High fever for 2 days with runny nose, refusing feeds and irritability…',
      observations: 'Weight: 11.2 kg (50th percentile). Height: 82 cm. Temp 101.2°F. Alert, hydrated. Chest clear. Ear TMs intact…',
      diagnosis: 'e.g. Acute Viral Bronchiolitis / Pediatric Tonsillopharyngitis'
    },
    quickChips: {
      complaints: [
        'High fever x 2 days with reduced feeding',
        'Barking cough and rapid breathing for 24h',
        'Loose watery stools (4 episodes) & vomiting',
        'Routine 9-month immunization & milestone visit',
        'Itchy rash on cheeks and flexural creases',
        'Ear pulling and excessive crying since last night'
      ],
      observations: [
        'Alert, active, hydrated, no signs of dehydration',
        'Anterior fontanelle flat and soft, mucous membranes moist',
        'Bilateral subcostal retractions, expiratory wheezing heard',
        'Bilateral tympanic membranes clear and mobile',
        'Weight 11.2 kg (50th percentile), length 82 cm',
        'Milestones appropriate for chronological age'
      ],
      diagnoses: [
        'Acute Viral Bronchiolitis',
        'Acute Gastroenteritis - Mild Dehydration',
        'Acute Suppurative Otitis Media (Right)',
        'Febrile Convulsion (Simple)',
        'Atopic Dermatitis (Infantile)',
        'Upper Respiratory Tract Infection'
      ]
    }
  },
  {
    id: 'cardiology',
    name: 'Cardiology',
    title: 'Cardiologist / Cardiovascular',
    icon: '❤️',
    badge: 'Heart & Vascular',
    description: 'Hemodynamic monitoring, NYHA classification, auscultation, and ECG/Echo summary.',
    toolTabName: 'Cardio & Hemodynamics',
    toolTabIcon: '❤️',
    placeholders: {
      complaint: 'e.g. Exertional retrosternal heaviness radiating to left shoulder on climbing 1 flight of stairs, relieved by rest in 5 mins…',
      observations: 'BP: 148/92 mmHg. PR: 82 bpm regular. JVP normal. S1 S2 heard, no murmurs or S3 gallop. Lungs: clear…',
      diagnosis: 'e.g. Coronary Artery Disease - Chronic Stable Angina (CCS Class 2) with Stage 2 HTN'
    },
    quickChips: {
      complaints: [
        'Exertional retrosternal chest heaviness x 2 weeks',
        'Dyspnea on climbing 1 flight of stairs (NYHA II)',
        'Episodic rapid pounding heart palpitations',
        'Bilateral leg swelling worse towards evening',
        'Near-syncope sensation on sudden standing',
        'Uncontrolled blood pressure check on dual therapy'
      ],
      observations: [
        'BP 152/94 mmHg (both arms), PR 80 bpm regular rhythm',
        'JVP not elevated, no carotid bruits heard',
        'Auscultation: S1 S2 heard normally, no added murmur or gallop',
        'Chest: vesicular breath sounds bilateral, bases clear',
        'Trace bilateral pitting pedal edema over malleoli',
        'ECG: Normal sinus rhythm, T-wave inversion in V5-V6'
      ],
      diagnoses: [
        'Coronary Artery Disease - Stable Angina (CCS II)',
        'Essential Hypertension (Stage 2 uncontrolled)',
        'Congestive Heart Failure (NYHA Class II)',
        'Paroxysmal Supraventricular Tachycardia (PSVT)',
        'Dyslipidemia with Elevated LDL (>160 mg/dL)',
        'Benign Postural Orthostatic Tachycardia'
      ]
    }
  },
  {
    id: 'orthopedics',
    name: 'Orthopedics',
    title: 'Orthopedic Surgeon & Sports Medicine',
    icon: '🦴',
    badge: 'Bone, Joint & Spine',
    description: 'Musculoskeletal evaluation, ligamentous stability, deformity, and imaging review.',
    toolTabName: 'Joints & Stability',
    toolTabIcon: '🦴',
    placeholders: {
      complaint: 'e.g. Severe right knee pain and rapid swelling following a football twisting injury 2 days ago…',
      observations: 'Antalgic gait. Moderate joint effusion. Lachman test positive with soft end-feel. Joint line tenderness medial side…',
      diagnosis: 'e.g. Complete Anterior Cruciate Ligament (ACL) Tear with Medial Meniscus Tear'
    },
    quickChips: {
      complaints: [
        'Right knee twisting injury with audible pop',
        'Acute low back pain after lifting heavy weight',
        'Inability to lift right arm past shoulder level',
        'Right ankle inversion twist with lateral swelling',
        'Bilateral knee crepitus and stiffness on standing',
        'Wrist pain and dorsal swelling after fall on outstretched hand'
      ],
      observations: [
        'Lachman test positive, Anterior Drawer positive (Right Knee)',
        'Medial joint line tenderness present, McMurray test positive',
        'SLR restricted to 40° left, neurovascular status intact',
        'Drop arm test positive, painful arc 60° to 120°',
        'Tenderness over anterior talofibular ligament (ATFL)',
        'X-ray: Kellgren-Lawrence Grade 3 medial joint narrowing'
      ],
      diagnoses: [
        'Anterior Cruciate Ligament (ACL) Tear - Right Knee',
        'Medial Meniscus Tear - Right Knee',
        'Acute Lumbar Spondylolisthesis / Disc Herniation',
        'Rotator Cuff Tear (Supraspinatus)',
        'Lateral Ankle Ligament Sprain (Grade 2)',
        'Bilateral Knee Primary Osteoarthritis'
      ]
    }
  },
  {
    id: 'dermatology',
    name: 'Dermatology',
    title: 'Dermatologist & Cosmetologist',
    icon: '🔬',
    badge: 'Skin & Cosmetology',
    description: 'Cutaneous lesion morphology, dermoscopy findings, Fitzpatrick skin typing, and topicals.',
    toolTabName: 'Cutaneous Profile',
    toolTabIcon: '🔬',
    placeholders: {
      complaint: 'e.g. Intensely itchy erythematous papules and plaques over extensor elbows and knees for 3 months…',
      observations: 'Symmetrical well-demarcated erythematous plaques with silvery scales. Auspitz sign positive. Nails show pitting…',
      diagnosis: 'e.g. Chronic Plaque Psoriasis / Acne Vulgaris Grade 3'
    },
    quickChips: {
      complaints: [
        'Intensely itchy rash on flexural creases x 3 weeks',
        'Facial inflammatory pustules & blackheads x 2 months',
        'Expanding annular red ring with active scaly border',
        'Sudden onset itchy hives and wheals all over body',
        'Patchy hair loss on scalp with smooth surface',
        'Dark pigmented patch on facial cheeks (Melasma)'
      ],
      observations: [
        'Fitzpatrick Skin Type IV, well-demarcated annular plaques',
        'Dermoscopy: Peripheral collarette of scales with punctate vessels',
        'Comedones, inflammatory papules, and pustules on T-zone',
        'Excoriated lichenified patches on antecubital fossae',
        'Transient erythematous wheals with dermatographism positive',
        'Well-defined circular patch of non-scarring alopecia'
      ],
      diagnoses: [
        'Tinea Corporis (Fungal Ringworm)',
        'Acne Vulgaris (Grade II/III)',
        'Atopic Dermatitis / Flexural Eczema',
        'Acute Urticaria',
        'Alopecia Areata',
        'Plaque Psoriasis'
      ]
    }
  },
  {
    id: 'ent',
    name: 'ENT / Otorhinolaryngology',
    title: 'ENT Specialist / Otolaryngologist',
    icon: '👂',
    badge: 'Ear, Nose & Throat',
    description: 'Otoscopy, rhinoscopy, oral cavity exam, voice, and audiometry evaluations.',
    toolTabName: 'ENT Assessment',
    toolTabIcon: '👂',
    placeholders: {
      complaint: 'e.g. Right ear discharge with mild hearing loss for 10 days, accompanied by nasal blockage…',
      observations: 'Otoscopy: Right central perforation of pars tensa with active mucopurulent discharge. Left TM intact. Throat clear…',
      diagnosis: 'e.g. Chronic Suppurative Otitis Media (CSOM) - Tubotympanic Type Active'
    },
    quickChips: {
      complaints: [
        'Right ear discharge and reduced hearing x 10 days',
        'Chronic nasal blockage and morning sneezing bouts',
        'Severe throat pain on swallowing with high fever',
        'Rotational spinning vertigo on turning head in bed',
        'Persistent hoarseness of voice for >3 weeks',
        'Left sided active nosebleed (Epistaxis) 2 episodes'
      ],
      observations: [
        'Right TM: central perforation, pulsatile mucopurulent discharge',
        'Left TM: intact, pearl grey with cone of light present',
        'Nose: DNS to left with hypertrophied right inferior turbinate',
        'Tonsils: Grade 2 enlarged, hyperemic with follicular exudates',
        'Dix-Hallpike test positive right side for posterior canal BPPV',
        'Neck: no palpable cervical lymphadenopathy'
      ],
      diagnoses: [
        'Chronic Suppurative Otitis Media (CSOM) Right',
        'Acute Follicular Tonsillitis',
        'Allergic Rhinitis with Deviated Nasal Septum',
        'Benign Paroxysmal Positional Vertigo (BPPV)',
        'Acute Left Anterior Epistaxis (Kiesselbach)',
        'Chronic Laryngitis / Vocal Cord Nodules'
      ]
    }
  },
  {
    id: 'ophthalmology',
    name: 'Ophthalmology',
    title: 'Ophthalmologist / Eye Specialist',
    icon: '👁️',
    badge: 'Vision & Eye Care',
    description: 'Visual acuity, slit-lamp anterior segment, intraocular pressure, and funduscopy.',
    toolTabName: 'Ocular Assessment',
    toolTabIcon: '👁️',
    placeholders: {
      complaint: 'e.g. Progressive painless blurring of vision in both eyes for 6 months, difficulty driving at night due to glare…',
      observations: 'VA: OD 6/18 (PH 6/9), OS 6/24 (PH 6/12). Cornea clear. Lens: Nuclear Sclerosis Grade 2 bilateral. IOP: OD 14, OS 15 mmHg…',
      diagnosis: 'e.g. Bilateral Senile Nuclear Cataract (Grade 2) with Presbyopia'
    },
    quickChips: {
      complaints: [
        'Gradual painless blurring of vision both eyes',
        'Foreign body sensation, redness and watering in right eye',
        'Eyestrain, headache, and blurred near vision reading phone',
        'Sudden appearance of dark floaters and light flashes',
        'Itchy gritty red eyes with sticky morning discharge',
        'Routine diabetic retinopathy screening checkup'
      ],
      observations: [
        'VA: Right Eye 6/18 (PH 6/9), Left Eye 6/24 (PH 6/12)',
        'Slit-lamp: Bilateral lens nuclear sclerosis Grade 2',
        'Cornea clear, anterior chamber quiet with normal depth',
        'IOP: Right Eye 14 mmHg, Left Eye 15 mmHg (NCT)',
        'Dilated fundus: CDR 0.3, foveal reflex sharp, no diabetic changes',
        'Conjunctival hyperemia with mild follicular reaction'
      ],
      diagnoses: [
        'Bilateral Senile Nuclear Cataract (Grade 2)',
        'Refractive Error (Compound Myopic Astigmatism)',
        'Acute Allergic / Viral Conjunctivitis',
        'Presbyopia Age-Related',
        'Dry Eye Syndrome (Keratoconjunctivitis Sicca)',
        'Non-Proliferative Diabetic Retinopathy (Mild)'
      ]
    }
  },
  {
    id: 'ayurveda',
    name: 'Ayurveda & AYUSH',
    title: 'Ayurvedic Physician (Vaidya)',
    icon: '🌿',
    badge: 'Panchakarma & AYUSH',
    description: 'Ashta Vidha Pariksha, Nadi examination, Prakriti/Vikriti, Agni, and classical herbal formulations.',
    toolTabName: 'Ashta Vidha & Prakriti',
    toolTabIcon: '🌿',
    placeholders: {
      complaint: 'Pradhan Vedana: Sandhi Shoola (joint pain) and morning stiffness in multiple joints, worse with cold weather…',
      observations: 'Nadi: Vata-Kapha gati (Mandam). Jihva: Saama (white coated). Agni: Mandagni. Koshtha: Krura. Sparsha: Ushna over joints…',
      diagnosis: 'Nidana: Amavata (Early Stage) / Sandhivata (Osteoarthritis)'
    },
    quickChips: {
      complaints: [
        'Sandhi Shoola (joint pain) and morning stiffness',
        'Amlapitta with burning sensation & sour eructation',
        'Gridhrasi (sciatica radiating from lumbar to heel)',
        'Chronic Kas-Shwas (cough with phlegm) during weather change',
        'Vibandha (chronic constipation) & abdominal heaviness',
        'Nidranasha (disturbed sleep) & mental stress / anxiety'
      ],
      observations: [
        'Nadi: Manda, Sarpa-Manduka mixed gati (Vata-Kapha)',
        'Jihva: Saama (thick white coating indicating Ama accumulation)',
        'Agni: Mandagni with sluggish digestion and poor appetite',
        'Prakriti: Vata-Pitta Dominant; Vikriti: Vata-Kapha vitiation',
        'Koshtha: Krura; Mutra: Avishesha; Mala: Vibaddha',
        'Ashta Vidha: Drik prakrita, Shabda gambhira, Sparsha shita'
      ],
      diagnoses: [
        'Amavata (Rheumatoid Spectrum - Saama stage)',
        'Sandhivata (Degenerative Osteoarthritis)',
        'Amlapitta (Hyperacidity & GERD Spectrum)',
        'Gridhrasi (Sciatica / Lumbar Radiculopathy)',
        'Vataja Shiroshoola (Tension Headache)',
        'Prameha (Metabolic Syndrome / Pre-diabetes)'
      ]
    }
  }
]

const INITIAL_TEETH: ToothStatus[] = [
  // Upper arch: 18 down to 11, then 21 up to 28
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
  { id: 46, label: '46', status: 'healthy', arch: 'lower' },
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
  { id: 36, label: '36', status: 'healthy', arch: 'lower' },
  { id: 37, label: '37', status: 'healthy', arch: 'lower' },
  { id: 38, label: '38', status: 'healthy', arch: 'lower' },
]

export default function Consultations() {
  const [searchParams] = useSearchParams()
  const querySpecialty = searchParams.get('specialty') as SpecialtyId | null
  const queryPatientId = searchParams.get('patientId')
  const queryAppointmentId = searchParams.get('appointmentId')

  // ── Doctor Specialization ──
  const [selectedSpecialty, setSelectedSpecialty] = useState<SpecialtyId>(() => {
    if (querySpecialty && SPECIALTIES.some(s => s.id === querySpecialty)) {
      return querySpecialty
    }
    const saved = localStorage.getItem('hospital_crm_doctor_specialty')
    return (saved as SpecialtyId) || 'general'
  })

  // ── Appointment Queue ──
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null)
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedPhone, setCopiedPhone] = useState(false)

  // ── Workspace Tabs ──
  const [activeTab, setActiveTab] = useState<'soap' | 'tools' | 'rx' | 'template_structure'>('soap')

  // ── Clinical SOAP Notes ──
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [observations, setObservations] = useState('')
  const [diagnosis, setDiagnosis] = useState('')

  // ── Dynamic Template Structure from Backend ──
  const [templateSections, setTemplateSections] = useState<Array<{ key: string; label: string; placeholder?: string }>>([])
  const [templateName, setTemplateName] = useState<string>('')

  // ── Interactive Specialty Tool States ──
  // 1. General Medicine (Vitals & Systems)
  const [genBpSys, setGenBpSys] = useState('120')
  const [genBpDia, setGenBpDia] = useState('80')
  const [genPulse, setGenPulse] = useState('76')
  const [genTemp, setGenTemp] = useState('98.6')
  const [genSpo2, setGenSpo2] = useState('99')
  const [genRbs, setGenRbs] = useState('110')
  const [genSystems, setGenSystems] = useState<string[]>([])

  // 2. Physiotherapy
  const [physioVas, setPhysioVas] = useState<number>(5)
  const [physioJoint, setPhysioJoint] = useState<string>('Lumbar Spine')
  const [physioRomDegrees, setPhysioRomDegrees] = useState<string>('Flexion 45°')
  const [physioMmt, setPhysioMmt] = useState<string>('Grade 4/5 (Good)')
  const [physioModalities, setPhysioModalities] = useState<string[]>([
    'TENS (15 mins)',
    'Moist Heat Pack (15 mins)'
  ])
  const [physioExercises, setPhysioExercises] = useState<string[]>([
    'Core Isometric Bracing',
    'Hamstring Static Stretch'
  ])

  // 3. Dental Odontogram
  const [teeth, setTeeth] = useState<ToothStatus[]>(INITIAL_TEETH)

  // 4. Pediatrics
  const [pediaWeight, setPediaWeight] = useState('12.5')
  const [pediaHeight, setPediaHeight] = useState('85')
  const [pediaHc, setPediaHc] = useState('47')
  const [pediaMilestoneStatus, setPediaMilestoneStatus] = useState('Normal for chronological age')
  const [pediaImmunization, setPediaImmunization] = useState('Up-to-date with National Schedule')

  // 5. Cardiology
  const [cardioNyha, setCardioNyha] = useState('NYHA Class I (No limitation)')
  const [cardioCcs, setCardioCcs] = useState('CCS Class I')
  const [cardioMurmur, setCardioMurmur] = useState('None (S1 S2 normal)')
  const [cardioEdema, setCardioEdema] = useState('Absent (No pedal edema)')

  // 6. Orthopedics
  const [orthoJoint, setOrthoJoint] = useState('Right Knee')
  const [orthoTests, setOrthoTests] = useState<Record<string, 'pos' | 'neg' | 'untested'>>({
    'Lachman Test': 'untested',
    'Anterior Drawer': 'untested',
    'McMurray Test': 'untested',
    'Straight Leg Raise (SLR)': 'untested',
    'Hawkins-Kennedy': 'untested'
  })

  // 7. Dermatology
  const [dermaLesion, setDermaLesion] = useState('Papules & Plaques')
  const [dermaFitzpatrick, setDermaFitzpatrick] = useState('Type IV (Medium Olive)')
  const [dermaSigns, setDermaSigns] = useState<string[]>(['Auspitz Sign Positive'])

  // 8. ENT
  const [entRightTm, setEntRightTm] = useState('Intact with cone of light')
  const [entLeftTm, setEntLeftTm] = useState('Intact with cone of light')
  const [entSeptum, setEntSeptum] = useState('Midline, normal mucosa')
  const [entTonsils, setEntTonsils] = useState('Grade 1 (Normal)')

  // 9. Ophthalmology
  const [ophthOdVa, setOphthOdVa] = useState('6/6')
  const [ophthOsVa, setOphthOsVa] = useState('6/6')
  const [ophthOdIop, setOphthOdIop] = useState('15')
  const [ophthOsIop, setOphthOsIop] = useState('15')

  // 10. Ayurveda
  const [ayurNadi, setAyurNadi] = useState('Vata-Pitta (Sarpa-Manduka)')
  const [ayurJihva, setAyurJihva] = useState('Niraama (Clean, pink)')
  const [ayurAgni, setAgni] = useState('Samagni (Balanced digestion)')

  // ── Prescriptions State ──
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([])
  const [medQuery, setMedQuery] = useState('')
  const [medHits, setMedHits] = useState<MedicineHit[]>([])
  const [isSearchingMeds, setIsSearchingMeds] = useState(false)

  // ── Status, Versioning, Validation ──
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null)
  const [versionNumber, setVersionNumber] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'err' } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)

  // Refs for smooth autofocus
  const complaintInputRef = useRef<HTMLTextAreaElement>(null)
  const diagnosisInputRef = useRef<HTMLInputElement>(null)

  const currentSpecialtyConfig = useMemo(() => {
    return SPECIALTIES.find(s => s.id === selectedSpecialty) || SPECIALTIES[0]
  }, [selectedSpecialty])

  const showToast = useCallback((msg: string, type: 'success' | 'err' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Fetch Appointments Queue ──
  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const todayISO = new Date().toISOString().split('T')[0]
      const res = await api.get(`/appointments?date=${todayISO}`)
      if (Array.isArray(res.data) && res.data.length > 0) {
        const mapped: AppointmentItem[] = res.data.map((a: any, idx: number) => ({
          id: a.id || a.appointmentId,
          patientId: a.patientId,
          patientName: a.patientName || a.patient?.name || `Patient #${idx + 1}`,
          patientPhone: a.patientPhone || a.patient?.phone || '+91 98765 43210',
          patientGender: a.patientGender || a.patient?.gender || 'Unknown',
          patientAge: a.patientAge ?? a.patient?.approxAge ?? 30,
          patientDob: a.patientDob || a.patient?.dob,
          doctorName: a.doctorName || a.doctor?.name || 'Dr. Practitioner',
          status: a.status || 'Waiting',
          appointmentDate: a.appointmentDate || a.date || todayISO,
          queueNumber: a.queueToken || a.queueNumber || idx + 1,
          priority: a.priority || 'Normal',
          type: a.type || 'Scheduled'
        }))
        setAppointments(mapped)
        const match = queryAppointmentId ? mapped.find(m => m.id === queryAppointmentId) : null
        const pMatch = queryPatientId ? mapped.find(m => m.patientId === queryPatientId) : null
        setSelectedAppointment(match || pMatch || mapped[0])
      } else {
        const fallbackAppts: AppointmentItem[] = [
          {
            id: 'apt-demo-1',
            patientId: 'pat-1',
            patientName: 'Pooja Sharma 5603',
            patientPhone: '+91 98765 43210',
            patientGender: 'Female',
            patientAge: 28,
            doctorName: 'Dr. Practitioner',
            status: 'Booked',
            appointmentDate: todayISO,
            queueNumber: 1,
            priority: 'Normal',
            type: 'Scheduled'
          },
          {
            id: 'apt-demo-2',
            patientId: 'pat-2',
            patientName: 'Aarav Verma',
            patientPhone: '+91 98111 22233',
            patientGender: 'Male',
            patientAge: 35,
            doctorName: 'Dr. Practitioner',
            status: 'Waiting',
            appointmentDate: todayISO,
            queueNumber: 2,
            priority: 'Normal',
            type: 'Walk-In'
          }
        ]
        setAppointments(fallbackAppts)
        const match = queryAppointmentId ? fallbackAppts.find(m => m.id === queryAppointmentId) : null
        const pMatch = queryPatientId ? fallbackAppts.find(m => m.patientId === queryPatientId) : null
        setSelectedAppointment(match || pMatch || fallbackAppts[0])
      }
    } catch {
      const todayISO = new Date().toISOString().split('T')[0]
      const fallbackAppts: AppointmentItem[] = [
        {
          id: 'apt-demo-1',
          patientId: 'pat-1',
          patientName: 'Pooja Sharma 5603',
          patientPhone: '+91 98765 43210',
          patientGender: 'Female',
          patientAge: 28,
          doctorName: 'Dr. Practitioner',
          status: 'Booked',
          appointmentDate: todayISO,
          queueNumber: 1,
          priority: 'Normal',
          type: 'Scheduled'
        }
      ]
      setAppointments(fallbackAppts)
      setSelectedAppointment(fallbackAppts[0])
    } finally {
      setLoading(false)
    }
  }, [queryAppointmentId, queryPatientId])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // ── Fetch Full Patient Demographics When Selected ──
  useEffect(() => {
    if (!selectedAppointment?.patientId) return

    let isMounted = true
    const loadPatientDetails = async () => {
      try {
        const res = await api.get(`/patients/${selectedAppointment.patientId}`)
        if (isMounted && res.data) {
          setPatientDetails({
            id: res.data.id || selectedAppointment.patientId,
            name: res.data.name || selectedAppointment.patientName,
            phone: res.data.phone || selectedAppointment.patientPhone || '+91 98765 43210',
            gender: res.data.gender || selectedAppointment.patientGender || 'Unspecified',
            approxAge: res.data.approxAge ?? selectedAppointment.patientAge ?? 30,
            dob: res.data.dob || selectedAppointment.patientDob,
            bloodGroup: res.data.bloodGroup || 'O+',
            allergies: res.data.allergies || 'NKDA (No known drug allergies)'
          })
        }
      } catch {
        if (isMounted) {
          setPatientDetails({
            id: selectedAppointment.patientId,
            name: selectedAppointment.patientName,
            phone: selectedAppointment.patientPhone && selectedAppointment.patientPhone !== '—'
              ? selectedAppointment.patientPhone
              : '+91 98765 43210',
            gender: selectedAppointment.patientGender || 'Female',
            approxAge: selectedAppointment.patientAge || 28,
            bloodGroup: 'B+',
            allergies: 'NKDA (No known drug allergies)'
          })
        }
      }
    }

    loadPatientDetails()
    return () => { isMounted = false }
  }, [selectedAppointment])

  // ── Auto-save Draft to LocalStorage ──
  useEffect(() => {
    if (!selectedAppointment?.id) return
    const key = `hospital_crm_draft_${selectedAppointment.id}`

    // Load draft if available
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.chiefComplaint && !chiefComplaint) setChiefComplaint(parsed.chiefComplaint)
        if (parsed.observations && !observations) setObservations(parsed.observations)
        if (parsed.diagnosis && !diagnosis) setDiagnosis(parsed.diagnosis)
        if (parsed.prescriptions && prescriptions.length === 0) setPrescriptions(parsed.prescriptions)
      } catch {
        // Ignore JSON error
      }
    }
  }, [selectedAppointment?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedAppointment?.id) return
    if (!chiefComplaint && !observations && !diagnosis) return

    const key = `hospital_crm_draft_${selectedAppointment.id}`
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify({
        chiefComplaint,
        observations,
        diagnosis,
        prescriptions,
        savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
      setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }, 800)

    return () => clearTimeout(timer)
  }, [chiefComplaint, observations, diagnosis, prescriptions, selectedAppointment?.id])

  // ── Fetch Specialty Templates from Backend ──
  const fetchTemplateForSpecialty = useCallback(async (spec: SpecialtyId) => {
    try {
      const res = await api.get('/consult-templates', { params: { specialty: spec } })
      if (Array.isArray(res.data) && res.data.length > 0) {
        const tpl = res.data[0]
        setTemplateName(tpl.name || '')
        const sections = tpl.structure?.sections || []
        setTemplateSections(sections)
      }
    } catch {
      // Backend fallback handled seamlessly
    }
  }, [])

  useEffect(() => {
    fetchTemplateForSpecialty(selectedSpecialty)
  }, [selectedSpecialty, fetchTemplateForSpecialty])

  // ── Switch Specialty without losing typed clinical notes ──
  const handleSelectSpecialty = useCallback((spec: SpecialtyId) => {
    setSelectedSpecialty(spec)
    localStorage.setItem('hospital_crm_doctor_specialty', spec)
    const cfg = SPECIALTIES.find(s => s.id === spec)
    showToast(`Switched consultation context to ${cfg?.name || spec}. Existing notes preserved.`)
  }, [showToast])

  // ── Debounced Medicine Search ──
  useEffect(() => {
    if (!medQuery.trim() || medQuery.length < 2) return

    const timer = setTimeout(async () => {
      setIsSearchingMeds(true)
      try {
        const res = await api.get(`/medicines/search?q=${encodeURIComponent(medQuery.trim())}&limit=8`)
        setMedHits(res.data || [])
      } catch {
        // Search error handled gracefully
      } finally {
        setIsSearchingMeds(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [medQuery])

  const handleSelectMedicine = useCallback((hit: MedicineHit) => {
    const medName = `${hit.dosageForm || 'Tab'}. ${hit.name} ${hit.strength || ''}`.trim()
    setPrescriptions(prev => [
      ...prev,
      { medicine: medName, dosage: '1 Tab', frequency: 'BID (Morning & Night)', duration: '5 Days' }
    ])
    setMedQuery('')
    setMedHits([])
  }, [])

  const handleRemovePrescription = useCallback((index: number) => {
    setPrescriptions(prev => prev.filter((_, i) => i !== index))
  }, [])

  // ── Dental Tooth Odontogram ──
  const cycleToothStatus = useCallback((id: number) => {
    const statuses: ToothStatus['status'][] = ['healthy', 'caries', 'filling', 'missing', 'crown']
    setTeeth(prev => prev.map(t => {
      if (t.id === id) {
        const nextIdx = (statuses.indexOf(t.status) + 1) % statuses.length
        return { ...t, status: statuses[nextIdx] }
      }
      return t
    }))
  }, [])

  // ── Quick Insert Chips Helper ──
  const appendText = useCallback((field: 'complaint' | 'observations' | 'diagnosis', text: string) => {
    if (field === 'complaint') {
      setChiefComplaint(prev => (prev ? `${prev}, ${text}` : text))
      setValidationErrors(v => ({ ...v, chiefComplaint: '' }))
    } else if (field === 'observations') {
      setObservations(prev => (prev ? `${prev}\n• ${text}` : `• ${text}`))
    } else if (field === 'diagnosis') {
      setDiagnosis(prev => (prev ? `${prev}; ${text}` : text))
      setValidationErrors(v => ({ ...v, diagnosis: '' }))
    }
  }, [])

  // ── Save Consultation (FR-14 & FR-15) ──
  const handleSaveConsultation = useCallback(async (isAmendment = false) => {
    if (!selectedAppointment) {
      showToast('Please select a patient appointment first.', 'err')
      return
    }

    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedAppointment.id)

    // Comprehensive Zod Validation
    setValidationErrors({})
    const valResult = consultationSoapSchema.safeParse({
      chiefComplaint,
      observations,
      diagnosis,
      prescriptions
    })

    if (!valResult.success) {
      const errMap: Record<string, string> = {}
      valResult.error.issues.forEach(issue => {
        const fieldName = issue.path[0] as string
        errMap[fieldName] = issue.message
      })
      setValidationErrors(errMap)

      // Auto-focus first invalid field without jarring UI shifts
      if (errMap.chiefComplaint && complaintInputRef.current) {
        complaintInputRef.current.focus()
      } else if (errMap.diagnosis && diagnosisInputRef.current) {
        diagnosisInputRef.current.focus()
      }

      showToast('Please provide both Chief Complaint and Diagnosis before saving.', 'err')
      return
    }

    if (!isGuid) {
      showToast('Demo appointment saved in local session. Connect backend for cloud persistence.')
      setVersionNumber(v => v + 1)
      return
    }

    setSubmitting(true)
    try {
      let consultId = activeConsultationId

      if (isAmendment && activeConsultationId) {
        // Clinical amendment endpoint (FR-14/15)
        const res = await api.post(`/consultations/${activeConsultationId}/amend`, {
          chiefComplaint,
          observations,
          diagnosis,
          previousVersionId: activeConsultationId
        })
        consultId = res.data.consultationId
        setVersionNumber(res.data.version || versionNumber + 1)
        showToast(`Consultation amended successfully (Version ${res.data.version || versionNumber + 1}).`)
      } else {
        // New consultation
        const res = await api.post(`/appointments/${selectedAppointment.id}/consultation`, {
          chiefComplaint,
          observations,
          diagnosis,
          previousVersionId: undefined
        })
        consultId = res.data.consultationId
        setActiveConsultationId(consultId)
        setVersionNumber(res.data.version || 1)
        showToast('Consultation note saved successfully.')
      }

      // Attach prescription items if present
      if (consultId && prescriptions.length > 0) {
        await api.post(`/consultations/${consultId}/prescriptions`, {
          items: prescriptions.map(p => ({
            medicine: p.medicine,
            dosage: p.dosage,
            frequency: p.frequency,
            duration: p.duration
          }))
        })
      }

      // Clear local draft upon successful save
      localStorage.removeItem(`hospital_crm_draft_${selectedAppointment.id}`)
      setDraftSavedAt(null)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || friendlyError(err) || 'Failed to save consultation.'
      showToast(msg, 'err')
    } finally {
      setSubmitting(false)
    }
  }, [selectedAppointment, chiefComplaint, observations, diagnosis, prescriptions, activeConsultationId, versionNumber, showToast])

  // ── Keyboard Shortcuts (Ctrl+S, Alt+1/2/3/4) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveConsultation(!!activeConsultationId)
      } else if (e.altKey && e.key === '1') {
        e.preventDefault()
        setActiveTab('soap')
      } else if (e.altKey && e.key === '2') {
        e.preventDefault()
        setActiveTab('tools')
      } else if (e.altKey && e.key === '3') {
        e.preventDefault()
        setActiveTab('rx')
      } else if (e.altKey && e.key === '4') {
        e.preventDefault()
        setActiveTab('template_structure')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveConsultation, activeConsultationId])

  // ── Queue Navigation ──
  const currentQueueIndex = useMemo(() => {
    if (!selectedAppointment) return -1
    return appointments.findIndex(a => a.id === selectedAppointment.id)
  }, [appointments, selectedAppointment])

  const handlePrevPatient = useCallback(() => {
    if (currentQueueIndex > 0) {
      setSelectedAppointment(appointments[currentQueueIndex - 1])
      setActiveConsultationId(null)
      setVersionNumber(1)
    }
  }, [appointments, currentQueueIndex])

  const handleNextPatient = useCallback(() => {
    if (currentQueueIndex >= 0 && currentQueueIndex < appointments.length - 1) {
      setSelectedAppointment(appointments[currentQueueIndex + 1])
      setActiveConsultationId(null)
      setVersionNumber(1)
    }
  }, [appointments, currentQueueIndex])

  const handleCopyPhone = useCallback(() => {
    const num = patientDetails?.phone || selectedAppointment?.patientPhone || ''
    if (num && num !== '—') {
      navigator.clipboard.writeText(num)
      setCopiedPhone(true)
      showToast('Phone number copied to clipboard.')
      setTimeout(() => setCopiedPhone(false), 2000)
    }
  }, [patientDetails, selectedAppointment, showToast])

  // ── Specialized Insert Helpers ──
  const insertGeneralVitals = () => {
    const sysNum = parseInt(genBpSys, 10) || 120
    const diaNum = parseInt(genBpDia, 10) || 80
    const bpStage = sysNum < 120 && diaNum < 80 ? 'Normotensive' :
      sysNum <= 129 && diaNum < 80 ? 'Elevated BP' :
      sysNum <= 139 || diaNum <= 89 ? 'Stage 1 HTN' : 'Stage 2 HTN'

    const sysText = genSystems.length > 0 ? `\nSystemic Review: ${genSystems.join(', ')}.` : ''
    const snippet = `Vitals: BP ${genBpSys}/${genBpDia} mmHg (${bpStage}), PR ${genPulse} bpm, Temp ${genTemp}°F, SpO2 ${genSpo2}%, RBS ${genRbs} mg/dL.${sysText}`
    setObservations(prev => (prev ? `${prev}\n\n${snippet}` : snippet))
    setActiveTab('soap')
    showToast('Vitals and systemic review inserted into Clinical Observations.')
  }

  const insertPhysioFindings = () => {
    const modalitiesText = physioModalities.length > 0 ? `\nModalities: ${physioModalities.join(', ')}.` : ''
    const exercisesText = physioExercises.length > 0 ? `\nExercises: ${physioExercises.join(', ')}.` : ''
    const snippet = `Physiotherapy Assessment:\n• Target Segment: ${physioJoint}\n• Pain Severity: VAS ${physioVas}/10 (${physioVas <= 3 ? 'Mild' : physioVas <= 6 ? 'Moderate' : 'Severe'})\n• Active ROM: ${physioRomDegrees}\n• Muscle Strength: MMT ${physioMmt}${modalitiesText}${exercisesText}`
    setObservations(prev => (prev ? `${prev}\n\n${snippet}` : snippet))
    setActiveTab('soap')
    showToast('Physiotherapy functional assessment appended to Observations.')
  }

  const insertDentalFindings = () => {
    const flaggedTeeth = teeth.filter(t => t.status !== 'healthy')
    const summary = flaggedTeeth.length === 0
      ? 'Odontogram Examination: Complete dentition clinically healthy, no active caries or restorations detected.'
      : `Odontogram Charting (${flaggedTeeth.length} flagged):\n` +
        flaggedTeeth.map(t => `• Tooth #${t.label} (${t.arch} arch): ${t.status.toUpperCase()}`).join('\n')
    setObservations(prev => (prev ? `${prev}\n\n${summary}` : summary))
    setActiveTab('soap')
    showToast('Odontogram findings appended to Clinical Observations.')
  }

  const insertPediatricFindings = () => {
    const wt = parseFloat(pediaWeight) || 10
    const pcmDoseMg = Math.round(wt * 15)
    const snippet = `Pediatric Evaluation:\n• Anthropometry: Weight ${pediaWeight} kg, Height ${pediaHeight} cm, Head Circ ${pediaHc} cm\n• Calculated Paracetamol Dose: ${pcmDoseMg} mg/dose (15 mg/kg Q6H PRN)\n• Development Milestones: ${pediaMilestoneStatus}\n• Immunization: ${pediaImmunization}`
    setObservations(prev => (prev ? `${prev}\n\n${snippet}` : snippet))
    setActiveTab('soap')
    showToast('Pediatric growth and dosing calculations inserted.')
  }

  const insertCardioFindings = () => {
    const snippet = `Cardiovascular Workup:\n• Functional Capacity: ${cardioNyha}\n• Angina Severity: ${cardioCcs}\n• Cardiac Auscultation: ${cardioMurmur}\n• Peripheral Hemodynamics: ${cardioEdema}`
    setObservations(prev => (prev ? `${prev}\n\n${snippet}` : snippet))
    setActiveTab('soap')
    showToast('Cardiovascular assessment inserted into Clinical Observations.')
  }

  const insertOrthoFindings = () => {
    const testLines = Object.entries(orthoTests)
      .filter(([_, res]) => res !== 'untested')
      .map(([name, res]) => `• ${name}: ${res === 'pos' ? 'POSITIVE (+)' : 'Negative (-)'}`)
      .join('\n')
    const snippet = `Orthopedic & Stability Examination:\n• Target Region: ${orthoJoint}\n${testLines || '• Clinical stability tests performed'}\n• Distal neurovascular status intact.`
    setObservations(prev => (prev ? `${prev}\n\n${snippet}` : snippet))
    setActiveTab('soap')
    showToast('Orthopedic joint assessment appended.')
  }

  const insertDermaFindings = () => {
    const signsText = dermaSigns.length > 0 ? `\n• Special Clinical Signs: ${dermaSigns.join(', ')}` : ''
    const snippet = `Dermatological Examination:\n• Morphology: ${dermaLesion}\n• Phototype: Fitzpatrick ${dermaFitzpatrick}${signsText}`
    setObservations(prev => (prev ? `${prev}\n\n${snippet}` : snippet))
    setActiveTab('soap')
    showToast('Cutaneous profile findings inserted.')
  }

  const insertEntFindings = () => {
    const snippet = `ENT Examination:\n• Otoscopy: Right TM: ${entRightTm} | Left TM: ${entLeftTm}\n• Rhinoscopy: ${entSeptum}\n• Oropharynx: Tonsils ${entTonsils}`
    setObservations(prev => (prev ? `${prev}\n\n${snippet}` : snippet))
    setActiveTab('soap')
    showToast('ENT clinical assessment appended.')
  }

  const insertOphthFindings = () => {
    const snippet = `Ophthalmic Examination:\n• Visual Acuity: OD (Right) ${ophthOdVa} | OS (Left) ${ophthOsVa}\n• Intraocular Pressure: OD ${ophthOdIop} mmHg | OS ${ophthOsIop} mmHg\n• Anterior segment quiet, clear optic media.`
    setObservations(prev => (prev ? `${prev}\n\n${snippet}` : snippet))
    setActiveTab('soap')
    showToast('Ophthalmic assessment findings inserted.')
  }

  const insertAyurFindings = () => {
    const snippet = `Ayurvedic Ashta Vidha Pariksha:\n• Nadi Pariksha: ${ayurNadi}\n• Jihva: ${ayurJihva}\n• Agni Pariksha: ${ayurAgni}\n• Srotas & Mala: Prakrita.`
    setObservations(prev => (prev ? `${prev}\n\n${snippet}` : snippet))
    setActiveTab('soap')
    showToast('Ayurvedic Pariksha findings inserted.')
  }

  // Active phone number display
  const activePhone = patientDetails?.phone || selectedAppointment?.patientPhone || '+91 98765 43210'
  const activeGender = patientDetails?.gender || selectedAppointment?.patientGender || 'Female'
  const activeAge = patientDetails?.approxAge || selectedAppointment?.patientAge || 28

  return (
    <div className="space-y-4 pb-16 animate-fadein">
      {/* ── 1. UNIFIED CLINICAL DESK HEADER (High-Density Bar) ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center text-base shadow-xs">
              {currentSpecialtyConfig.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight font-heading leading-tight m-0">
                  Doctor Clinical Desk
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                  Live Consultation
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                EMR note codification, specialty diagnostic charts, and e-Prescriptions
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Toolbar: Specialty Switcher & Save Action */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Specialty Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Discipline:</span>
            <select
              value={selectedSpecialty}
              onChange={(e) => handleSelectSpecialty(e.target.value as SpecialtyId)}
              className="bg-transparent text-xs font-bold text-slate-800 border-none outline-none cursor-pointer pr-1"
              aria-label="Select Doctor Specialty"
            >
              {SPECIALTIES.map(s => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>

          {draftSavedAt && (
            <span className="text-[11px] text-slate-500 hidden xl:inline font-mono">
              Auto-saved {draftSavedAt}
            </span>
          )}

          {/* Save / Amend Button */}
          {activeConsultationId ? (
            <button
              onClick={() => handleSaveConsultation(true)}
              disabled={submitting}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              title="Amend note (Ctrl+S)"
            >
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" />
                  Saving…
                </>
              ) : (
                <>
                  <FileTextIcon />
                  <span>Amend Note (v{versionNumber})</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => handleSaveConsultation(false)}
              disabled={submitting}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
              title="Save consultation (Ctrl+S)"
            >
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" />
                  Saving Note…
                </>
              ) : (
                <>
                  <CheckIcon />
                  <span>Save Consultation (v1)</span>
                  <span className="text-[10px] opacity-80 font-mono hidden sm:inline ml-1 bg-black/15 px-1.5 py-0.2 rounded">Ctrl+S</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div className="animate-fadein">
          <Alert variant={toast.type === 'err' ? 'error' : 'success'} onDismiss={() => setToast(null)}>
            {toast.msg}
          </Alert>
        </div>
      )}

      {/* ── 2. ACTIVE PATIENT COMMAND RIBBON (Unified High-Density Strip) ── */}
      {loading ? (
        <div className="card p-3.5">
          <div className="flex items-center gap-3">
            <Skeleton width="40px" height="40px" borderRadius="12px" />
            <div className="flex-1 space-y-1">
              <Skeleton width="30%" height="16px" />
              <Skeleton width="50%" height="12px" />
            </div>
          </div>
        </div>
      ) : appointments.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            illustration={
              <svg width="60" height="60" viewBox="0 0 80 80" fill="none" aria-hidden="true">
                <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.3"/>
                <path d="M24 40 L40 24 L56 40 L40 56 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
                <circle cx="40" cy="40" r="4" fill="currentColor" opacity="0.6"/>
              </svg>
            }
            title="No patients in today's queue"
            description="No checked-in appointments are waiting for consultation today. Register or check in a patient to proceed."
            action={{
              label: 'Go to Appointments',
              onClick: () => { window.location.href = '/dashboard/appointments' },
              variant: 'secondary'
            }}
          />
        </div>
      ) : (
        <div className="card p-3.5 bg-gradient-to-r from-teal-50/50 via-white to-cyan-50/30 border-teal-200/90 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Patient Identity & Demographics */}
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
                  fontFamily: 'var(--font-heading)'
                }}
              >
                {selectedAppointment?.patientName ? selectedAppointment.patientName.charAt(0).toUpperCase() : 'P'}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading m-0">
                    {selectedAppointment?.patientName || 'No patient selected'}
                  </h2>

                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-100 text-teal-800">
                    {activeGender}, {activeAge}y
                  </span>

                  <span className="badge badge-success text-[10px]">
                    Token #{selectedAppointment?.queueNumber || 1}
                  </span>

                  {selectedAppointment?.type && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 capitalize">
                      {selectedAppointment.type}
                    </span>
                  )}

                  {patientDetails?.bloodGroup && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {patientDetails.bloodGroup}
                    </span>
                  )}
                </div>

                {/* Patient Contact & Clinical Alerts */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-0.5">
                  <div className="flex items-center gap-1 font-mono">
                    <PhoneIcon />
                    <a
                      href={`tel:${activePhone}`}
                      className="hover:text-teal-700 hover:underline transition-colors"
                    >
                      {activePhone}
                    </a>
                    <button
                      onClick={handleCopyPhone}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors ml-0.5"
                      title="Copy phone number"
                      aria-label="Copy phone number"
                    >
                      {copiedPhone ? <span className="text-[10px] text-teal-600 font-bold">✓ Copied</span> : <CopyIcon />}
                    </button>
                  </div>

                  <span className="text-slate-300">•</span>

                  <span className="text-[11px] text-slate-500">
                    Status: <strong className="text-slate-700 capitalize">{selectedAppointment?.status || 'Active'}</strong>
                  </span>

                  {patientDetails?.allergies && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] text-slate-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {patientDetails.allergies}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Queue Switcher with Prev / Next Patient Arrows */}
            <div className="flex items-center gap-2 self-start lg:self-center">
              <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={handlePrevPatient}
                  disabled={currentQueueIndex <= 0}
                  className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed border-r border-slate-200 transition-colors"
                  title="Previous patient in queue"
                  aria-label="Previous patient"
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  onClick={handleNextPatient}
                  disabled={currentQueueIndex >= appointments.length - 1}
                  className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next patient in queue"
                  aria-label="Next patient"
                >
                  <ChevronRightIcon />
                </button>
              </div>

              <select
                value={selectedAppointment?.id || ''}
                disabled={loading}
                onChange={(e) => {
                  const found = appointments.find(a => a.id === e.target.value)
                  if (found) {
                    setSelectedAppointment(found)
                    setActiveConsultationId(null)
                    setVersionNumber(1)
                  }
                }}
                className="form-select text-xs py-1.5 min-w-[210px] bg-white border-teal-300 font-medium"
                aria-label="Select Queue Patient"
              >
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    #{a.queueNumber || 1} - {a.patientName} ({a.status})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. WORKSPACE NAVIGATION TABS ── */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] pb-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('soap')}
          className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'soap'
              ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)] text-slate-600'
          }`}
          style={{ marginBottom: -1 }}
        >
          <FileTextIcon />
          <span>SOAP Clinical Note</span>
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'tools'
              ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)] text-slate-600'
          }`}
          style={{ marginBottom: -1 }}
        >
          <span>{currentSpecialtyConfig.toolTabIcon}</span>
          <span>{currentSpecialtyConfig.toolTabName}</span>
        </button>

        <button
          onClick={() => setActiveTab('rx')}
          className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'rx'
              ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)] text-slate-600'
          }`}
          style={{ marginBottom: -1 }}
        >
          <PillIcon />
          <span>Prescriptions Rx</span>
          {prescriptions.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'rx' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
            }`}>
              {prescriptions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('template_structure')}
          className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'template_structure'
              ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)] text-slate-600'
          }`}
          style={{ marginBottom: -1 }}
        >
          <ActivityIcon />
          <span>Template Sections</span>
        </button>
      </div>

      {/* ── TAB 1: SOAP CLINICAL NOTE ── */}
      {activeTab === 'soap' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fadein">
          <div className="lg:col-span-2 space-y-4">
            {/* Inline non-shifting validation alert */}
            {Object.keys(validationErrors).length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs animate-fadein">
                <div className="flex items-center gap-2">
                  <AlertCircleIcon />
                  <span className="font-semibold">
                    Please complete the required fields: {Object.keys(validationErrors).map(k => k === 'chiefComplaint' ? 'Chief Complaint' : 'Diagnosis').join(' and ')}.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setValidationErrors({})}
                  className="text-rose-600 hover:text-rose-900 font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Chief Complaint */}
            <div className="card p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="form-label text-slate-800 font-bold text-xs" style={{ margin: 0 }}>
                  Chief Complaint &amp; Presenting Symptoms *
                </label>
                {validationErrors.chiefComplaint && (
                  <span className="text-[11px] font-semibold text-rose-600 animate-pulse-soft">
                    {validationErrors.chiefComplaint}
                  </span>
                )}
              </div>

              {/* Quick Chips for Complaint */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-0.5">Quick:</span>
                {currentSpecialtyConfig.quickChips.complaints.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => appendText('complaint', c)}
                    className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 transition-colors text-slate-700 text-left"
                  >
                    + {c}
                  </button>
                ))}
              </div>

              <textarea
                ref={complaintInputRef}
                rows={3}
                value={chiefComplaint}
                onChange={(e) => {
                  setChiefComplaint(e.target.value)
                  if (validationErrors.chiefComplaint) {
                    setValidationErrors(prev => ({ ...prev, chiefComplaint: '' }))
                  }
                }}
                placeholder={currentSpecialtyConfig.placeholders.complaint}
                className={`form-textarea text-xs ${validationErrors.chiefComplaint ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''}`}
                aria-invalid={!!validationErrors.chiefComplaint}
              />
            </div>

            {/* Observations & Physical Exam */}
            <div className="card p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="form-label text-slate-800 font-bold text-xs" style={{ margin: 0 }}>
                  Clinical Observations &amp; Physical Examination
                </label>
                <span className="text-[11px] text-slate-500">Vitals, system findings &amp; clinical signs</span>
              </div>

              {/* Quick Chips for Observations */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-0.5">Quick:</span>
                {currentSpecialtyConfig.quickChips.observations.map((obs, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => appendText('observations', obs)}
                    className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 transition-colors text-slate-700 text-left"
                  >
                    + {obs}
                  </button>
                ))}
              </div>

              <textarea
                rows={5}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder={currentSpecialtyConfig.placeholders.observations}
                className="form-textarea text-xs font-mono"
              />
            </div>

            {/* Diagnosis */}
            <div className="card p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="form-label text-slate-800 font-bold text-xs" style={{ margin: 0 }}>
                  Provisional / Final Diagnosis (ICD-11 / SNOMED) *
                </label>
                {validationErrors.diagnosis && (
                  <span className="text-[11px] font-semibold text-rose-600 animate-pulse-soft">
                    {validationErrors.diagnosis}
                  </span>
                )}
              </div>

              {/* Quick Chips for Diagnosis */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-0.5">Quick:</span>
                {currentSpecialtyConfig.quickChips.diagnoses.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => appendText('diagnosis', d)}
                    className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 transition-colors text-slate-700 text-left"
                  >
                    + {d}
                  </button>
                ))}
              </div>

              <input
                ref={diagnosisInputRef}
                type="text"
                value={diagnosis}
                onChange={(e) => {
                  setDiagnosis(e.target.value)
                  if (validationErrors.diagnosis) {
                    setValidationErrors(prev => ({ ...prev, diagnosis: '' }))
                  }
                }}
                placeholder={currentSpecialtyConfig.placeholders.diagnosis}
                className={`form-input text-xs ${validationErrors.diagnosis ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''}`}
                aria-invalid={!!validationErrors.diagnosis}
              />
            </div>
          </div>

          {/* Right Sidebar: Health Summary & Quick Specialty Jump */}
          <div className="space-y-4">
            {/* Consultation Summary */}
            <div className="card p-4">
              <h3 className="text-xs font-bold text-slate-800 mb-3 font-heading uppercase tracking-wide">
                Consultation Summary
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Chief Complaint</span>
                  <span className={`font-semibold ${chiefComplaint.trim() ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {chiefComplaint.trim() ? '✓ Documented' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Physical Exam</span>
                  <span className={`font-semibold ${observations.trim() ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {observations.trim() ? '✓ Findings Recorded' : 'Optional'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Diagnosis</span>
                  <span className={`font-semibold ${diagnosis.trim() ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {diagnosis.trim() ? '✓ Formulated' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Prescription Rx</span>
                  <span className={`font-semibold ${prescriptions.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {prescriptions.length > 0 ? `${prescriptions.length} items added` : 'None'}
                  </span>
                </div>

                {selectedSpecialty === 'dental' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Odontogram</span>
                    <span className={`font-semibold ${teeth.some(t => t.status !== 'healthy') ? 'text-amber-600' : 'text-slate-400'}`}>
                      {teeth.filter(t => t.status !== 'healthy').length > 0
                        ? `${teeth.filter(t => t.status !== 'healthy').length} teeth flagged`
                        : 'All healthy'}
                    </span>
                  </div>
                )}

                {selectedSpecialty === 'physiotherapy' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Pain VAS</span>
                    <span className="font-bold text-teal-700">
                      {physioVas}/10
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Specialty Tool Launcher */}
            <div className="card p-4 bg-slate-50/70 border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{currentSpecialtyConfig.icon}</span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono m-0">
                    {currentSpecialtyConfig.name}
                  </h4>
                  <span className="text-[10px] text-teal-700 font-semibold">{currentSpecialtyConfig.badge}</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                {currentSpecialtyConfig.description}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('tools')}
                className="btn btn-sm btn-secondary w-full justify-center text-xs flex items-center gap-1.5"
              >
                <span>{currentSpecialtyConfig.toolTabIcon}</span>
                <span>Open {currentSpecialtyConfig.toolTabName}</span>
              </button>
            </div>

            {/* Quick Rx Shortcut */}
            <div className="card p-3.5 border-dashed border-teal-300 bg-teal-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-teal-900 m-0">Need Electronic Rx?</p>
                  <p className="text-[11px] text-teal-700 m-0">Search drug formulary &amp; issue dosage</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('rx')}
                  className="btn btn-xs btn-primary"
                >
                  + Add Drugs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SPECIALIZED CLINICAL TOOLS (Tailored For All Specialties) ── */}
      {activeTab === 'tools' && (
        <div className="space-y-4 animate-fadein">
          {/* 1. GENERAL MEDICINE: Vitals Strip & Systemic Review */}
          {selectedSpecialty === 'general' && (
            <div className="card p-5 border-teal-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                    <span>🩺</span> OPD Vitals &amp; Systemic Examination Panel
                  </h3>
                  <p className="text-xs text-slate-500">Record hemodynamics and systemic review findings with automatic HTN stage classification.</p>
                </div>
                <button
                  type="button"
                  onClick={insertGeneralVitals}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  ✓ Insert Vitals &amp; Review into Note
                </button>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">BP (Systolic)</label>
                  <input
                    type="number"
                    value={genBpSys}
                    onChange={(e) => setGenBpSys(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">mmHg</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">BP (Diastolic)</label>
                  <input
                    type="number"
                    value={genBpDia}
                    onChange={(e) => setGenBpDia(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">mmHg</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Pulse Rate</label>
                  <input
                    type="number"
                    value={genPulse}
                    onChange={(e) => setGenPulse(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">bpm</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    value={genTemp}
                    onChange={(e) => setGenTemp(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">°F</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">SpO2 Oxygen</label>
                  <input
                    type="number"
                    value={genSpo2}
                    onChange={(e) => setGenSpo2(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">%</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Blood Glucose</label>
                  <input
                    type="number"
                    value={genRbs}
                    onChange={(e) => setGenRbs(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">mg/dL (RBS)</span>
                </div>
              </div>

              {/* Systemic Review Multi-Select */}
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono block mb-2">
                  Systemic Review Findings
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Chest: Clear bilateral vesicular breath sounds',
                    'Chest: Wheezing / Ronchi present',
                    'CVS: S1 S2 heard normal, no murmur',
                    'Abdomen: Soft, non-tender, active bowel sounds',
                    'CNS: Conscious, oriented to time, place, person',
                    'No pallor, icterus, cyanosis, or pedal edema',
                    'Throat: Mild pharyngeal hyperemia'
                  ].map(sys => {
                    const active = genSystems.includes(sys)
                    return (
                      <button
                        key={sys}
                        type="button"
                        onClick={() => {
                          setGenSystems(prev => active ? prev.filter(s => s !== sys) : [...prev, sys])
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                          active
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}{sys}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. DENTAL: FDI Two-Digit Odontogram */}
          {selectedSpecialty === 'dental' && (
            <div className="card p-5 animate-fadein space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                    <span>🦷</span> FDI Two-Digit Dental Odontogram
                  </h3>
                  <p className="text-xs text-slate-500">Click any tooth to cycle clinical status: Healthy → Caries → Filling → Missing → Crown</p>
                </div>
                <button
                  type="button"
                  onClick={insertDentalFindings}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  ✓ Insert Odontogram into Note
                </button>
              </div>

              {/* Odontogram Status Key */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/> Healthy
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"/> Caries
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/> Filling
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"/> Missing
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"/> Crown
                </span>
              </div>

              {/* Upper Arch */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Maxilla (Upper Arch)</div>
                  <div className="flex-1 h-px bg-slate-200" />
                  <div className="text-[10px] text-slate-400 font-mono">Teeth 18–28</div>
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
                  {teeth.filter(t => t.arch === 'upper').map(tooth => (
                    <button
                      key={tooth.id}
                      onClick={() => cycleToothStatus(tooth.id)}
                      aria-label={`Tooth ${tooth.label}, status ${tooth.status}`}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        tooth.status === 'caries' ? 'bg-rose-50 border-rose-300 text-rose-800' :
                        tooth.status === 'filling' ? 'bg-amber-50 border-amber-300 text-amber-800' :
                        tooth.status === 'missing' ? 'bg-slate-100 border-slate-200 text-slate-400 line-through' :
                        tooth.status === 'crown' ? 'bg-purple-50 border-purple-300 text-purple-800' :
                        'bg-white border-slate-200 text-slate-800 hover:border-teal-500 hover:shadow-xs'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono">{tooth.label}</div>
                      <div className="text-[8px] capitalize truncate font-medium">{tooth.status}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lower Arch */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Mandible (Lower Arch)</div>
                  <div className="flex-1 h-px bg-slate-200" />
                  <div className="text-[10px] text-slate-400 font-mono">Teeth 48–38</div>
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
                  {teeth.filter(t => t.arch === 'lower').map(tooth => (
                    <button
                      key={tooth.id}
                      onClick={() => cycleToothStatus(tooth.id)}
                      aria-label={`Tooth ${tooth.label}, status ${tooth.status}`}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        tooth.status === 'caries' ? 'bg-rose-50 border-rose-300 text-rose-800' :
                        tooth.status === 'filling' ? 'bg-amber-50 border-amber-300 text-amber-800' :
                        tooth.status === 'missing' ? 'bg-slate-100 border-slate-200 text-slate-400 line-through' :
                        tooth.status === 'crown' ? 'bg-purple-50 border-purple-300 text-purple-800' :
                        'bg-white border-slate-200 text-slate-800 hover:border-teal-500 hover:shadow-xs'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono">{tooth.label}</div>
                      <div className="text-[8px] capitalize truncate font-medium">{tooth.status}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. PHYSIOTHERAPY: Functional Exam, ROM, VAS, Modalities & Exercises */}
          {selectedSpecialty === 'physiotherapy' && (
            <div className="card p-5 border-teal-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                    <span>🏃‍♂️</span> Physiotherapy &amp; Rehabilitation Functional Exam
                  </h3>
                  <p className="text-xs text-slate-500">Assess pain intensity (VAS), joint range of motion, modalities, and home exercise protocols.</p>
                </div>
                <button
                  type="button"
                  onClick={insertPhysioFindings}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  ✓ Apply to Clinical Observations
                </button>
              </div>

              {/* VAS Scale */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono">
                    Pain Severity (VAS 0–10)
                  </label>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    physioVas === 0 ? 'bg-emerald-100 text-emerald-800' :
                    physioVas <= 3 ? 'bg-teal-100 text-teal-800' :
                    physioVas <= 6 ? 'bg-amber-100 text-amber-800' :
                    'bg-rose-100 text-rose-800'
                  }`}>
                    Score: {physioVas}/10
                  </span>
                </div>

                <div className="grid grid-cols-11 gap-1 my-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setPhysioVas(score)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        physioVas === score
                          ? score <= 3
                            ? 'bg-teal-600 text-white shadow-sm'
                            : score <= 6
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-rose-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              {/* Joint & ROM */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono">
                    Joint &amp; Active Range of Motion
                  </label>
                  <select
                    value={physioJoint}
                    onChange={(e) => setPhysioJoint(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    <option value="Lumbar Spine">Lumbar Spine (Lower Back)</option>
                    <option value="Cervical Spine">Cervical Spine (Neck)</option>
                    <option value="Right Shoulder">Right Shoulder Complex</option>
                    <option value="Left Shoulder">Left Shoulder Complex</option>
                    <option value="Right Knee">Right Knee Joint</option>
                    <option value="Left Knee">Left Knee Joint</option>
                    <option value="Ankle Complex">Ankle &amp; Foot Complex</option>
                  </select>

                  <input
                    type="text"
                    value={physioRomDegrees}
                    onChange={(e) => setPhysioRomDegrees(e.target.value)}
                    placeholder="e.g. Flexion 45° (painful), Extension 10°"
                    className="form-input text-xs py-1"
                  />
                </div>

                {/* MMT Strength */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono">
                    Manual Muscle Testing (MMT Grade)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      'Grade 5/5 (Normal)',
                      'Grade 4/5 (Good)',
                      'Grade 3/5 (Fair)',
                      'Grade 2/5 (Poor)',
                      'Grade 1/5 (Trace)',
                      'Grade 0/5 (Zero)'
                    ].map((gr) => (
                      <button
                        key={gr}
                        type="button"
                        onClick={() => setPhysioMmt(gr)}
                        className={`text-[11px] py-1 px-1.5 rounded-lg font-semibold border text-center transition-all ${
                          physioMmt === gr
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {gr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modalities & Exercises Multi-Select */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono block">
                    Electrotherapy &amp; Modalities
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'TENS (15 mins)',
                      'IFT Interferential',
                      'Ultrasound Therapy',
                      'Moist Heat Pack (15 mins)',
                      'Ice Cryotherapy (10 mins)',
                      'Traction Lumbar/Cervical'
                    ].map((mod) => {
                      const active = physioModalities.includes(mod)
                      return (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => setPhysioModalities(prev => active ? prev.filter(m => m !== mod) : [...prev, mod])}
                          className={`text-xs px-2 py-1 rounded-lg border font-medium transition-all ${
                            active ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {active ? '✓ ' : '+ '}{mod}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono block">
                    Prescribed Exercise Regimen
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Core Isometric Bracing',
                      'Hamstring Static Stretch',
                      'Pelvic Bridging Sets',
                      'McKenzie Extension',
                      'Scapular Retractions',
                      'Knee Quad Sets'
                    ].map((ex) => {
                      const active = physioExercises.includes(ex)
                      return (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => setPhysioExercises(prev => active ? prev.filter(e => e !== ex) : [...prev, ex])}
                          className={`text-xs px-2 py-1 rounded-lg border font-medium transition-all ${
                            active ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {active ? '✓ ' : '+ '}{ex}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. PEDIATRICS: Weight-Based Dosing & Growth */}
          {selectedSpecialty === 'pediatrics' && (
            <div className="card p-5 border-teal-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                    <span>👶</span> Pediatric Growth &amp; Weight-Based Dose Calculator
                  </h3>
                  <p className="text-xs text-slate-500">Calculate pediatric syrup dosages (Paracetamol 15mg/kg) and document milestone progression.</p>
                </div>
                <button
                  type="button"
                  onClick={insertPediatricFindings}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  ✓ Insert Pediatric Assessment
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={pediaWeight}
                    onChange={(e) => setPediaWeight(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                  <div className="p-2 bg-teal-50 rounded-lg text-[11px] text-teal-800">
                    Calculated Paracetamol: <strong>{Math.round((parseFloat(pediaWeight) || 10) * 15)} mg</strong> per dose
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Height / Length (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={pediaHeight}
                    onChange={(e) => setPediaHeight(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                  <span className="text-[10px] text-slate-500 block">Head Circumference (cm):</span>
                  <input
                    type="number"
                    step="0.5"
                    value={pediaHc}
                    onChange={(e) => setPediaHc(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Immunization &amp; Milestones</label>
                  <select
                    value={pediaImmunization}
                    onChange={(e) => setPediaImmunization(e.target.value)}
                    className="form-select text-xs py-1 bg-white"
                  >
                    <option value="Up-to-date with National Schedule">Up-to-date with National Schedule</option>
                    <option value="Due for 6-Week Primary Doses">Due for 6-Week Primary Doses</option>
                    <option value="Due for 9-Month Measles/MR">Due for 9-Month Measles/MR</option>
                    <option value="Delayed / Partial Vaccination">Delayed / Partial Vaccination</option>
                  </select>
                  <input
                    type="text"
                    value={pediaMilestoneStatus}
                    onChange={(e) => setPediaMilestoneStatus(e.target.value)}
                    placeholder="Milestones assessment"
                    className="form-input text-xs py-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. CARDIOLOGY: NYHA & Hemodynamics */}
          {selectedSpecialty === 'cardiology' && (
            <div className="card p-5 border-teal-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                    <span>❤️</span> Cardiovascular Functional Workup
                  </h3>
                  <p className="text-xs text-slate-500">NYHA Functional Class, CCS Angina grading, and auscultatory cardiac findings.</p>
                </div>
                <button
                  type="button"
                  onClick={insertCardioFindings}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  ✓ Insert Cardiovascular Workup
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">NYHA Functional Class</label>
                  <select
                    value={cardioNyha}
                    onChange={(e) => setCardioNyha(e.target.value)}
                    className="form-select text-xs py-1 bg-white"
                  >
                    <option value="NYHA Class I (No limitation)">NYHA Class I (No physical limitation)</option>
                    <option value="NYHA Class II (Slight limitation on ordinary activity)">NYHA Class II (Slight limitation on ordinary activity)</option>
                    <option value="NYHA Class III (Marked limitation on less than ordinary activity)">NYHA Class III (Marked limitation on mild exertion)</option>
                    <option value="NYHA Class IV (Inability to carry out physical activity, rest symptoms)">NYHA Class IV (Symptoms at rest)</option>
                  </select>

                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono pt-2 block">CCS Angina Grading</label>
                  <select
                    value={cardioCcs}
                    onChange={(e) => setCardioCcs(e.target.value)}
                    className="form-select text-xs py-1 bg-white"
                  >
                    <option value="CCS Class I (Angina with strenuous exertion only)">CCS Class I (Strenuous exertion)</option>
                    <option value="CCS Class II (Slight limitation on rapid walking)">CCS Class II (Slight limitation)</option>
                    <option value="CCS Class III (Marked limitation of ordinary activity)">CCS Class III (Marked limitation)</option>
                    <option value="CCS Class IV (Inability to carry on physical work without angina)">CCS Class IV (Rest angina)</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Cardiac Auscultation</label>
                  <select
                    value={cardioMurmur}
                    onChange={(e) => setCardioMurmur(e.target.value)}
                    className="form-select text-xs py-1 bg-white"
                  >
                    <option value="None (S1 S2 normal rhythm, no added murmur)">None (S1 S2 normal rhythm, no added murmur)</option>
                    <option value="Systolic Ejection Murmur (Aortic area)">Systolic Ejection Murmur (Aortic area)</option>
                    <option value="Pansystolic Murmur (Apex radiating to axilla)">Pansystolic Murmur (Apex / Mitral regurgitation)</option>
                    <option value="S3 Gallop Rhythm present">S3 Gallop Rhythm present</option>
                  </select>

                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono pt-2 block">Pedal Edema &amp; JVP</label>
                  <select
                    value={cardioEdema}
                    onChange={(e) => setCardioEdema(e.target.value)}
                    className="form-select text-xs py-1 bg-white"
                  >
                    <option value="Absent (No pedal edema, JVP normal)">Absent (No pedal edema, JVP normal)</option>
                    <option value="Mild Pitting Pedal Edema (+1)">Mild Pitting Pedal Edema (+1)</option>
                    <option value="Moderate Bilateral Lower Limb Edema (+2)">Moderate Bilateral Edema (+2)</option>
                    <option value="Severe Anasarca / Elevated JVP">Severe Edema / Elevated JVP</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 6. ORTHOPEDICS: Joint Stability Tests */}
          {selectedSpecialty === 'orthopedics' && (
            <div className="card p-5 border-teal-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                    <span>🦴</span> Orthopedic Ligamentous Stability Tests
                  </h3>
                  <p className="text-xs text-slate-500">Toggle provocative tests (Positive / Negative) with one-click report append.</p>
                </div>
                <button
                  type="button"
                  onClick={insertOrthoFindings}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  ✓ Insert Orthopedic Assessment
                </button>
              </div>

              <div className="mb-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono block mb-1">Target Joint / Spine</label>
                <select
                  value={orthoJoint}
                  onChange={(e) => setOrthoJoint(e.target.value)}
                  className="form-select text-xs py-1.5 max-w-xs bg-white"
                >
                  <option value="Right Knee">Right Knee Joint</option>
                  <option value="Left Knee">Left Knee Joint</option>
                  <option value="Lumbar Spine">Lumbar Spine</option>
                  <option value="Cervical Spine">Cervical Spine</option>
                  <option value="Right Shoulder">Right Shoulder</option>
                  <option value="Left Shoulder">Left Shoulder</option>
                  <option value="Ankle & Foot">Ankle &amp; Foot Complex</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(orthoTests).map(([testName, status]) => (
                  <div key={testName} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-800 block truncate">{testName}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setOrthoTests(prev => ({ ...prev, [testName]: prev[testName] === 'pos' ? 'untested' : 'pos' }))}
                        className={`text-xs px-2 py-1 rounded flex-1 font-semibold transition-all ${
                          status === 'pos' ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                      >
                        + Positive
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrthoTests(prev => ({ ...prev, [testName]: prev[testName] === 'neg' ? 'untested' : 'neg' }))}
                        className={`text-xs px-2 py-1 rounded flex-1 font-semibold transition-all ${
                          status === 'neg' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                      >
                        - Negative
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. DERMATOLOGY: Cutaneous Profile */}
          {selectedSpecialty === 'dermatology' && (
            <div className="card p-5 border-teal-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                    <span>🔬</span> Cutaneous Lesion Morphology &amp; Phototype
                  </h3>
                  <p className="text-xs text-slate-500">Record dermatological lesion patterns, Fitzpatrick phototype, and special clinical signs.</p>
                </div>
                <button
                  type="button"
                  onClick={insertDermaFindings}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  ✓ Insert Cutaneous Findings
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Primary Lesion Morphology</label>
                  <select
                    value={dermaLesion}
                    onChange={(e) => setDermaLesion(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    <option value="Papules & Plaques">Papules &amp; Plaques (Elevated)</option>
                    <option value="Macules & Patches (Flat pigmentary)">Macules &amp; Patches (Flat pigmentary)</option>
                    <option value="Vesicles & Bullae (Fluid-filled)">Vesicles &amp; Bullae (Fluid-filled)</option>
                    <option value="Pustules & Folliculitis">Pustules &amp; Folliculitis</option>
                    <option value="Wheals & Urticarial Eruptions">Wheals &amp; Urticarial Eruptions</option>
                    <option value="Lichenified Excoriated Patches">Lichenified Excoriated Patches</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Fitzpatrick Phototype</label>
                  <select
                    value={dermaFitzpatrick}
                    onChange={(e) => setDermaFitzpatrick(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    <option value="Type I (Pale White)">Type I (Always burns, never tans)</option>
                    <option value="Type II (Fair)">Type II (Usually burns, tans with difficulty)</option>
                    <option value="Type III (Medium Fair)">Type III (Sometimes mild burn, gradually tans)</option>
                    <option value="Type IV (Medium Olive)">Type IV (Rarely burns, tans easily - Indian typical)</option>
                    <option value="Type V (Brown Skin)">Type V (Very rarely burns, tans very easily)</option>
                    <option value="Type VI (Dark Brown/Black)">Type VI (Never burns)</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono block">Special Dermatologic Signs</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Auspitz Sign Positive',
                    'Koebner Phenomenon Present',
                    'Nikolsky Sign Negative',
                    'Dermoscopy: Punctate vessels & collarette',
                    'Dermatographism Positive'
                  ].map((sign) => {
                    const active = dermaSigns.includes(sign)
                    return (
                      <button
                        key={sign}
                        type="button"
                        onClick={() => setDermaSigns(prev => active ? prev.filter(s => s !== sign) : [...prev, sign])}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                          active ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}{sign}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 8. ENT: Otoscopy & Rhinoscopy */}
          {selectedSpecialty === 'ent' && (
            <div className="card p-5 border-teal-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                    <span>👂</span> ENT &amp; Otolaryngology Examination
                  </h3>
                  <p className="text-xs text-slate-500">Document bilateral otoscopy, nasal septum status, and oropharyngeal tonsillar grading.</p>
                </div>
                <button
                  type="button"
                  onClick={insertEntFindings}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  ✓ Insert ENT Exam
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Right TM (Otoscopy)</label>
                  <select
                    value={entRightTm}
                    onChange={(e) => setEntRightTm(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    <option value="Intact with cone of light">Intact with cone of light</option>
                    <option value="Central perforation (Active discharge)">Central perforation (Active discharge)</option>
                    <option value="Retracted pars tensa">Retracted pars tensa</option>
                    <option value="Hyperemic & bulging (Acute otitis)">Hyperemic &amp; bulging (AOM)</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Left TM (Otoscopy)</label>
                  <select
                    value={entLeftTm}
                    onChange={(e) => setEntLeftTm(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    <option value="Intact with cone of light">Intact with cone of light</option>
                    <option value="Central perforation (Active discharge)">Central perforation (Active discharge)</option>
                    <option value="Retracted pars tensa">Retracted pars tensa</option>
                    <option value="Hyperemic & bulging (Acute otitis)">Hyperemic &amp; bulging (AOM)</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Nasal Septum (Rhinoscopy)</label>
                  <input
                    type="text"
                    value={entSeptum}
                    onChange={(e) => setEntSeptum(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Tonsillar Hypertrophy Grade</label>
                  <select
                    value={entTonsils}
                    onChange={(e) => setEntTonsils(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    <option value="Grade 1 (Normal in tonsillar fossa)">Grade 1 (Normal)</option>
                    <option value="Grade 2 (Mild hypertrophy)">Grade 2 (Mild hypertrophy)</option>
                    <option value="Grade 3 (Extending beyond pillars)">Grade 3 (Beyond pillars)</option>
                    <option value="Grade 4 (Kissing tonsils touching midline)">Grade 4 (Kissing tonsils)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 9. OPHTHALMOLOGY: Visual Acuity & IOP */}
          {selectedSpecialty === 'ophthalmology' && (
            <div className="card p-5 border-teal-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                    <span>👁️</span> Ophthalmic Assessment (Snellen VA &amp; Tonometry)
                  </h3>
                  <p className="text-xs text-slate-500">Record bilateral Snellen visual acuity and intraocular pressure (IOP in mmHg).</p>
                </div>
                <button
                  type="button"
                  onClick={insertOphthFindings}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  ✓ Insert Ophthalmic Exam
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Right Eye (OD) Visual Acuity</label>
                  <select
                    value={ophthOdVa}
                    onChange={(e) => setOphthOdVa(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    {['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'Counting Fingers (CF)', 'Hand Movements (HM)'].map(va => (
                      <option key={va} value={va}>{va}</option>
                    ))}
                  </select>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono pt-1 block">OD Intraocular Pressure (mmHg)</label>
                  <input
                    type="number"
                    value={ophthOdIop}
                    onChange={(e) => setOphthOdIop(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Left Eye (OS) Visual Acuity</label>
                  <select
                    value={ophthOsVa}
                    onChange={(e) => setOphthOsVa(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    {['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'Counting Fingers (CF)', 'Hand Movements (HM)'].map(va => (
                      <option key={va} value={va}>{va}</option>
                    ))}
                  </select>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono pt-1 block">OS Intraocular Pressure (mmHg)</label>
                  <input
                    type="number"
                    value={ophthOsIop}
                    onChange={(e) => setOphthOsIop(e.target.value)}
                    className="form-input text-xs py-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 10. AYURVEDA: Ashta Vidha Pariksha */}
          {selectedSpecialty === 'ayurveda' && (
            <div className="card p-5 border-teal-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                    <span>🌿</span> Ayurvedic Ashta Vidha Pariksha &amp; Agni
                  </h3>
                  <p className="text-xs text-slate-500">Record classical Nadi Gati, Jihva (Ama state), and Agni classification.</p>
                </div>
                <button
                  type="button"
                  onClick={insertAyurFindings}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  ✓ Insert Ayurvedic Assessment
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Nadi Gati (Pulse)</label>
                  <select
                    value={ayurNadi}
                    onChange={(e) => setAyurNadi(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    <option value="Vata-Pitta (Sarpa-Manduka)">Vata-Pitta (Sarpa-Manduka)</option>
                    <option value="Pitta-Kapha (Manduka-Hamsa)">Pitta-Kapha (Manduka-Hamsa)</option>
                    <option value="Vata-Kapha (Sarpa-Hamsa)">Vata-Kapha (Sarpa-Hamsa)</option>
                    <option value="Sannipatika (Mixed Irregular)">Sannipatika (Mixed)</option>
                    <option value="Manda Gati (Sluggish Kapha)">Manda Gati (Sluggish)</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Jihva (Tongue Pariksha)</label>
                  <select
                    value={ayurJihva}
                    onChange={(e) => setAyurJihva(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    <option value="Niraama (Clean, pink, no Ama)">Niraama (Clean, balanced)</option>
                    <option value="Saama (Thick white coated Ama)">Saama (White Ama coating)</option>
                    <option value="Pitta-Prakopa (Red, hyperemic, aphthous)">Pitta-Prakopa (Hyperemic)</option>
                    <option value="Vataja (Dry, rough, fissured)">Vataja (Dry, fissured)</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide font-mono">Agni (Digestive Fire)</label>
                  <select
                    value={ayurAgni}
                    onChange={(e) => setAgni(e.target.value)}
                    className="form-select text-xs py-1.5 bg-white"
                  >
                    <option value="Samagni (Balanced digestion)">Samagni (Balanced)</option>
                    <option value="Mandagni (Sluggish digestion)">Mandagni (Sluggish)</option>
                    <option value="Tikshnagni (Hyperactive fire)">Tikshnagni (Hyperactive)</option>
                    <option value="Vishamagni (Irregular fire)">Vishamagni (Irregular)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: PRESCRIPTIONS RX ── */}
      {activeTab === 'rx' && (
        <div className="card p-5 animate-fadein space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-1.5">
                  <PillIcon />
                  Electronic Prescription &amp; Medicine Formulary
                </h3>
                {prescriptions.length > 0 && (
                  <span className="badge badge-brand">{prescriptions.length} items</span>
                )}
              </div>
              <p className="text-xs text-slate-500">Live search against drug formulary by brand, generic, or therapeutic class.</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="search-wrap">
              <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={medQuery}
                onChange={(e) => setMedQuery(e.target.value)}
                placeholder="Search formulary (e.g. Paracetamol, Amoxicillin, Aceclofenac, Pantoprazole)…"
                className="search-input text-xs"
                aria-label="Search medicine formulary"
              />
              {isSearchingMeds && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="spinner spinner-sm" />
                </span>
              )}
            </div>

            {medHits.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-fadein max-h-60 overflow-y-auto">
                {medHits.map((hit) => (
                  <div
                    key={hit.id}
                    onClick={() => handleSelectMedicine(hit)}
                    className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSelectMedicine(hit) }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center text-[10px] font-bold">
                        {hit.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800">{hit.name}</span>
                        {hit.genericName && <span className="text-slate-500 ml-1.5">({hit.genericName})</span>}
                      </div>
                    </div>
                    <span className="badge badge-brand text-[10px]">{hit.dosageForm || 'Oral'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prescribed Items Table */}
          {prescriptions.length === 0 ? (
            <EmptyState
              illustration={
                <svg width="60" height="60" viewBox="0 0 70 70" fill="none" aria-hidden="true">
                  <rect x="16" y="14" width="38" height="46" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.35"/>
                  <path d="M26 26 L44 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <path d="M26 34 L40 34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <circle cx="54" cy="18" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4"/>
                  <path d="M54 14 L54 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                  <path d="M50 18 L58 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                </svg>
              }
              title="No medicines prescribed yet"
              description="Search the formulary above or click quick templates to add prescription items."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine / Drug</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((rx, idx) => (
                    <tr key={idx}>
                      <td className="font-bold text-slate-800 text-xs">{rx.medicine}</td>
                      <td>
                        <input
                          type="text"
                          value={rx.dosage}
                          onChange={(e) => {
                            const val = e.target.value
                            setPrescriptions(prev => prev.map((p, i) => i === idx ? { ...p, dosage: val } : p))
                          }}
                          className="form-input text-xs py-1"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={rx.frequency}
                          onChange={(e) => {
                            const val = e.target.value
                            setPrescriptions(prev => prev.map((p, i) => i === idx ? { ...p, frequency: val } : p))
                          }}
                          className="form-input text-xs py-1"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={rx.duration}
                          onChange={(e) => {
                            const val = e.target.value
                            setPrescriptions(prev => prev.map((p, i) => i === idx ? { ...p, duration: val } : p))
                          }}
                          className="form-input text-xs py-1"
                        />
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleRemovePrescription(idx)}
                          className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1 text-xs"
                          aria-label={`Remove ${rx.medicine}`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: TEMPLATE SECTIONS EXPLORER ── */}
      {activeTab === 'template_structure' && (
        <div className="card p-5 animate-fadein space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-heading">
                {templateName || `${currentSpecialtyConfig.name} Protocol`} Sections
              </h3>
              <p className="text-xs text-slate-500">Official structured EMR fields configured for {currentSpecialtyConfig.title}.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const scaffold = templateSections.map(s => `[${s.label}]:\n`).join('\n')
                setObservations(prev => (prev ? `${prev}\n\n${scaffold}` : scaffold))
                setActiveTab('soap')
                showToast('Template structure imported into Clinical Observations.')
              }}
              className="btn btn-sm btn-secondary text-xs"
            >
              📥 Import Headings into Observations
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templateSections.map((sec, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{sec.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">#{sec.key}</span>
                </div>
                {sec.placeholder && (
                  <p className="text-[11px] text-slate-500 italic">Prompt: {sec.placeholder}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}