import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { Alert, friendlyError } from '../components/ui/Alert'
import { consultationSoapSchema } from '../schemas'
import { EmptyState, Skeleton } from '../components/ui/EmptyState'

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
  doctorName?: string
  status: string
  appointmentDate: string
  queueNumber?: number
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
    description: 'Comprehensive adult and family medicine SOAP clinical workflow.',
    toolTabName: 'Systemic Review',
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
    id: 'pediatrics',
    name: 'Pediatrics',
    title: 'Pediatrician / Child Health',
    icon: '👶',
    badge: 'Child & Adolescent',
    description: 'Well-child milestones, growth percentiles, vaccination tracking, and weight-based doses.',
    toolTabName: 'Pediatric Growth & Milestones',
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
    id: 'orthopedics',
    name: 'Orthopedics',
    title: 'Orthopedic Surgeon & Sports Medicine',
    icon: '🦴',
    badge: 'Bone, Joint & Spine',
    description: 'Musculoskeletal evaluation, ligamentous stability, deformity, and imaging review.',
    toolTabName: 'Joint Stability & Spine',
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
    id: 'cardiology',
    name: 'Cardiology',
    title: 'Cardiologist / Cardiovascular',
    icon: '❤️',
    badge: 'Heart & Vascular',
    description: 'Hemodynamic monitoring, NYHA classification, auscultation, and ECG/Echo summary.',
    toolTabName: 'Hemodynamics & Vitals',
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
    id: 'ent',
    name: 'ENT / Otorhinolaryngology',
    title: 'ENT Specialist / Otolaryngologist',
    icon: '👂',
    badge: 'Ear, Nose & Throat',
    description: 'Otoscopy, rhinoscopy, oral cavity exam, voice, and audiometry evaluations.',
    toolTabName: 'ENT Examination',
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
  const [loading, setLoading] = useState(true)

  // ── Workspace Tabs ──
  const [activeTab, setActiveTab] = useState<'soap' | 'tools' | 'rx' | 'template_structure'>('soap')

  // ── Clinical SOAP Notes ──
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [observations, setObservations] = useState('')
  const [diagnosis, setDiagnosis] = useState('')

  // ── Dynamic Template Structure from Backend ──
  const [templateSections, setTemplateSections] = useState<Array<{ key: string; label: string; placeholder?: string }>>([])
  const [templateName, setTemplateName] = useState<string>('')

  // ── Physiotherapy Specialized State ──
  const [physioVas, setPhysioVas] = useState<number>(5)
  const [physioJoint, setPhysioJoint] = useState<string>('Lumbar Spine')
  const [physioRomDegrees, setPhysioRomDegrees] = useState<string>('Flexion 45°')
  const [physioMmt, setPhysioMmt] = useState<string>('Grade 4/5 (Good)')
  const [physioModalities, setPhysioModalities] = useState<string[]>([])
  const [physioExercises, setPhysioExercises] = useState<string[]>([])

  // ── Dental Odontogram State ──
  const [teeth, setTeeth] = useState<ToothStatus[]>(INITIAL_TEETH)

  // ── Prescriptions State ──
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([])
  const [medQuery, setMedQuery] = useState('')
  const [medHits, setMedHits] = useState<MedicineHit[]>([])
  const [isSearchingMeds, setIsSearchingMeds] = useState(false)

  // ── Status & Versioning ──
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null)
  const [versionNumber, setVersionNumber] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'err' } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

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
          patientPhone: a.patientPhone || a.patient?.phone || '—',
          doctorName: a.doctorName || a.doctor?.name || 'Dr. Practitioner',
          status: a.status || 'Waiting',
          appointmentDate: a.appointmentDate || a.date || todayISO,
          queueNumber: a.queueToken || a.queueNumber || idx + 1
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
            patientName: 'Aarav Sharma',
            patientPhone: '+91 98765 43210',
            doctorName: 'Dr. Practitioner',
            status: 'Waiting',
            appointmentDate: todayISO,
            queueNumber: 1
          },
          {
            id: 'apt-demo-2',
            patientId: 'pat-2',
            patientName: 'Sunita Patel',
            patientPhone: '+91 98111 22233',
            doctorName: 'Dr. Practitioner',
            status: 'Waiting',
            appointmentDate: todayISO,
            queueNumber: 2
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
          patientName: 'Aarav Sharma',
          patientPhone: '+91 98765 43210',
          doctorName: 'Dr. Practitioner',
          status: 'Waiting',
          appointmentDate: todayISO,
          queueNumber: 1
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
  const handleSelectSpecialty = (spec: SpecialtyId) => {
    setSelectedSpecialty(spec)
    localStorage.setItem('hospital_crm_doctor_specialty', spec)
    const cfg = SPECIALTIES.find(s => s.id === spec)
    showToast(`Switched consultation context to ${cfg?.name || spec}. Existing notes preserved.`)
  }

  // ── Debounced Medicine Search ──
  useEffect(() => {
    if (!medQuery.trim() || medQuery.length < 2) {
      return
    }

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

  const handleSelectMedicine = (hit: MedicineHit) => {
    const medName = `${hit.dosageForm || 'Tab'}. ${hit.name} ${hit.strength || ''}`.trim()
    setPrescriptions(prev => [
      ...prev,
      { medicine: medName, dosage: '1 Tab', frequency: 'BID (Morning & Night)', duration: '5 Days' }
    ])
    setMedQuery('')
    setMedHits([])
  }

  const handleRemovePrescription = (index: number) => {
    setPrescriptions(prev => prev.filter((_, i) => i !== index))
  }

  // ── Dental Tooth Odontogram ──
  const cycleToothStatus = (id: number) => {
    const statuses: ToothStatus['status'][] = ['healthy', 'caries', 'filling', 'missing', 'crown']
    setTeeth(prev => prev.map(t => {
      if (t.id === id) {
        const nextIdx = (statuses.indexOf(t.status) + 1) % statuses.length
        return { ...t, status: statuses[nextIdx] }
      }
      return t
    }))
  }

  // ── Physiotherapy Helper: Apply to Clinical Note ──
  const applyPhysioAssessmentToNotes = () => {
    const modalitiesText = physioModalities.length > 0 ? `Modalities: ${physioModalities.join(', ')}.` : ''
    const exercisesText = physioExercises.length > 0 ? `Exercises: ${physioExercises.join(', ')}.` : ''
    const summary = `Physio Exam: Pain VAS ${physioVas}/10. ${physioJoint} ROM: ${physioRomDegrees}. MMT: ${physioMmt}. ${modalitiesText} ${exercisesText}`.trim()

    setObservations(prev => (prev ? `${prev}\n\n${summary}` : summary))
    showToast('Rehabilitation assessment findings appended to Clinical Observations.')
  }

  // ── Quick Insert Chips Helper ──
  const appendText = (field: 'complaint' | 'observations' | 'diagnosis', text: string) => {
    if (field === 'complaint') {
      setChiefComplaint(prev => (prev ? `${prev}, ${text}` : text))
      setValidationErrors(v => ({ ...v, chiefComplaint: '' }))
    } else if (field === 'observations') {
      setObservations(prev => (prev ? `${prev}\n• ${text}` : `• ${text}`))
    } else if (field === 'diagnosis') {
      setDiagnosis(prev => (prev ? `${prev}; ${text}` : text))
      setValidationErrors(v => ({ ...v, diagnosis: '' }))
    }
  }

  // ── Save Consultation (FR-14 & FR-15) ──
  const handleSaveConsultation = async (isAmendment = false) => {
    if (!selectedAppointment) {
      showToast('Please select a patient appointment first.', 'err')
      return
    }

    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedAppointment.id)
    if (!isGuid) {
      showToast('Please book or select a real appointment from the Appointments page. Demo entries cannot be saved to the database.', 'err')
      return
    }

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
      showToast('Please fill in the required chief complaint and diagnosis.', 'err')
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
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || friendlyError(err) || 'Failed to save consultation.'
      showToast(msg, 'err')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-16 animate-fadein">
      {/* ── Top Header ── */}
      <div className="page-header">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <h1 className="page-title" style={{ margin: 0 }}>Doctor Clinical Desk</h1>
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse-soft" />
              Live Consultation
            </span>
            <span className="badge badge-secondary flex items-center gap-1">
              <span>{currentSpecialtyConfig.icon}</span>
              <span>{currentSpecialtyConfig.name}</span>
            </span>
          </div>
          <p className="page-description">Multi-specialty EMR with tailor-made clinical examinations, diagnosis codification, and digital Rx.</p>
        </div>

        <div className="flex items-center gap-2">
          {activeConsultationId ? (
            <button
              onClick={() => handleSaveConsultation(true)}
              disabled={submitting}
              className="btn btn-secondary"
            >
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" />
                  Saving…
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Amend Clinical Note (v{versionNumber})
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => handleSaveConsultation(false)}
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" />
                  Saving Note…
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Save Consultation (v1)
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="animate-fadein">
          <Alert variant={toast.type === 'err' ? 'error' : 'success'} onDismiss={() => setToast(null)}>
            {toast.msg}
          </Alert>
        </div>
      )}

      {/* ── Doctor Specialization Selector Bar ── */}
      <div className="card p-4 bg-gradient-to-r from-teal-50/70 via-white to-cyan-50/50 border-teal-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center text-xl shadow-sm">
              {currentSpecialtyConfig.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-800 font-mono">Specialist Discipline</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold">{currentSpecialtyConfig.badge}</span>
              </div>
              <p className="text-sm font-bold text-slate-800 font-heading">{currentSpecialtyConfig.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-600">Switch Specialty:</span>
            <select
              value={selectedSpecialty}
              onChange={(e) => handleSelectSpecialty(e.target.value as SpecialtyId)}
              className="form-select text-xs py-1.5 px-3 min-w-[220px] bg-white border-teal-300 font-medium"
            >
              {SPECIALTIES.map(s => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name} ({s.badge})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Active Patient Banner & Queue Switcher ── */}
      {loading ? (
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <Skeleton width="48px" height="48px" borderRadius="16px" />
            <div className="flex-1">
              <Skeleton width="40%" height="20px" className="mb-2" />
              <Skeleton width="60%" height="14px" />
            </div>
          </div>
        </div>
      ) : appointments.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            illustration={
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
                <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.3"/>
                <path d="M24 40 L40 24 L56 40 L40 56 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
                <circle cx="40" cy="40" r="4" fill="currentColor" opacity="0.6"/>
              </svg>
            }
            title="No patients in today's queue"
            description="No checked-in appointments are waiting for consultation today. Check in a patient from the Appointments page to start."
            action={{
              label: 'Go to Appointments',
              onClick: () => { window.location.href = '/dashboard/appointments' },
              variant: 'secondary'
            }}
          />
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
                  fontFamily: 'var(--font-heading)'
                }}
              >
                {selectedAppointment?.patientName ? selectedAppointment.patientName.charAt(0).toUpperCase() : 'P'}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-[var(--color-text)] tracking-tight font-heading">
                    {selectedAppointment?.patientName || 'No patient selected'}
                  </h2>
                  <span className="badge badge-success">
                    Active Patient
                  </span>
                  {activeConsultationId && (
                    <span className="badge badge-brand">
                      v{versionNumber} Note
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">
                  Phone: {selectedAppointment?.patientPhone || '—'} • Token #{selectedAppointment?.queueNumber || 1} • Status: {selectedAppointment?.status || 'Active'}
                </p>
              </div>
            </div>

            {/* Queue Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Select Patient:</label>
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
                className="form-select text-xs py-1.5 min-w-[200px]"
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

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] pb-0 -mb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('soap')}
          className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'soap'
              ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)]'
          }`}
          style={{ marginBottom: -1 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span>SOAP Clinical Note</span>
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'tools'
              ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)]'
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
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)]'
          }`}
          style={{ marginBottom: -1 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          <span>Prescriptions Rx</span>
          {prescriptions.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'rx' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
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
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)]'
          }`}
          style={{ marginBottom: -1 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          <span>Template Sections</span>
        </button>
      </div>

      {/* ── TAB 1: SOAP Clinical Note ── */}
      {activeTab === 'soap' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadein">
          <div className="lg:col-span-2 space-y-4">
            {Object.keys(validationErrors).length > 0 && (
              <Alert variant="error" title="Clinical note incomplete" onDismiss={() => setValidationErrors({})}>
                Please fill in the required fields before saving this consultation note.
              </Alert>
            )}

            {/* Chief Complaint */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="form-label text-slate-800 font-bold" style={{ margin: 0 }}>
                  Chief Complaint &amp; Presenting Symptoms *
                </label>
                {validationErrors.chiefComplaint && (
                  <span className="text-[11px] font-semibold text-rose-500 animate-pulse-soft">Required (min 3 chars)</span>
                )}
              </div>

              {/* Quick Chips for Complaint */}
              <div className="flex flex-wrap gap-1.5 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-1">Quick:</span>
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
                rows={3}
                value={chiefComplaint}
                onChange={(e) => {
                  setChiefComplaint(e.target.value)
                  if (validationErrors.chiefComplaint) {
                    setValidationErrors(prev => ({ ...prev, chiefComplaint: '' }))
                  }
                }}
                placeholder={currentSpecialtyConfig.placeholders.complaint}
                className={`form-textarea text-sm ${validationErrors.chiefComplaint ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''}`}
                aria-invalid={!!validationErrors.chiefComplaint}
              />
            </div>

            {/* Observations & Physical Exam */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="form-label text-slate-800 font-bold" style={{ margin: 0 }}>
                  Clinical Observations &amp; Physical Examination
                </label>
                <span className="text-[11px] text-slate-500">Vitals, system-wise exam &amp; findings</span>
              </div>

              {/* Quick Chips for Observations */}
              <div className="flex flex-wrap gap-1.5 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-1">Quick:</span>
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
                className="form-textarea text-sm"
              />
            </div>

            {/* Diagnosis */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="form-label text-slate-800 font-bold" style={{ margin: 0 }}>
                  Provisional / Final Diagnosis (ICD-11 / SNOMED) *
                </label>
                {validationErrors.diagnosis && (
                  <span className="text-[11px] font-semibold text-rose-500 animate-pulse-soft">Required (min 2 chars)</span>
                )}
              </div>

              {/* Quick Chips for Diagnosis */}
              <div className="flex flex-wrap gap-1.5 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-1">Quick:</span>
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
                type="text"
                value={diagnosis}
                onChange={(e) => {
                  setDiagnosis(e.target.value)
                  if (validationErrors.diagnosis) {
                    setValidationErrors(prev => ({ ...prev, diagnosis: '' }))
                  }
                }}
                placeholder={currentSpecialtyConfig.placeholders.diagnosis}
                className={`form-input text-sm ${validationErrors.diagnosis ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''}`}
                aria-invalid={!!validationErrors.diagnosis}
              />
            </div>
          </div>

          {/* Right Sidebar: Quick Summary & Specialty Guide */}
          <div className="space-y-5">
            {/* Session Stats */}
            <div className="card p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3 font-heading">Consultation Health Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Chief Complaint</span>
                  <span className={`font-semibold ${chiefComplaint.trim() ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {chiefComplaint.trim() ? '✓ Documented' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Physical Exam</span>
                  <span className={`font-semibold ${observations.trim() ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {observations.trim() ? '✓ Findings Recorded' : 'Optional'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Diagnosis</span>
                  <span className={`font-semibold ${diagnosis.trim() ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {diagnosis.trim() ? '✓ Formulated' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Prescription Rx</span>
                  <span className={`font-semibold ${prescriptions.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {prescriptions.length > 0 ? `${prescriptions.length} items added` : 'None'}
                  </span>
                </div>
                {selectedSpecialty === 'dental' && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Odontogram Chart</span>
                    <span className={`font-semibold ${teeth.some(t => t.status !== 'healthy') ? 'text-amber-600' : 'text-slate-400'}`}>
                      {teeth.filter(t => t.status !== 'healthy').length > 0
                        ? `${teeth.filter(t => t.status !== 'healthy').length} teeth flagged`
                        : 'All healthy'}
                    </span>
                  </div>
                )}
                {selectedSpecialty === 'physiotherapy' && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Pain VAS Score</span>
                    <span className="font-bold text-teal-700">
                      {physioVas}/10 ({physioVas <= 3 ? 'Mild' : physioVas <= 6 ? 'Moderate' : 'Severe'})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Specialty Clinical Guide */}
            <div className="card p-5 bg-slate-50/60 border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{currentSpecialtyConfig.icon}</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                  {currentSpecialtyConfig.name} Guide
                </h4>
              </div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                {currentSpecialtyConfig.description}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('tools')}
                className="btn btn-sm btn-secondary w-full justify-center text-xs"
              >
                Open {currentSpecialtyConfig.toolTabName}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Specialized Clinical Tools (Physiotherapy, Dental, Pediatrics, etc.) ── */}
      {activeTab === 'tools' && (
        <div className="space-y-6 animate-fadein">
          {/* Physiotherapy Tool */}
          {selectedSpecialty === 'physiotherapy' && (
            <div className="space-y-6">
              <div className="card p-6 border-teal-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 font-heading flex items-center gap-2">
                      <span>🏃‍♂️</span> Physiotherapy &amp; Rehabilitation Functional Exam
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">Assess pain intensity, joint mobility (ROM), manual muscle strength (MMT), and modalities.</p>
                  </div>
                  <button
                    type="button"
                    onClick={applyPhysioAssessmentToNotes}
                    className="btn btn-sm btn-primary shrink-0"
                  >
                    ✓ Apply to Clinical Observations
                  </button>
                </div>

                {/* 1. Visual Analogue Scale (VAS) */}
                <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono">
                      1. Pain Severity (VAS 0–10)
                    </label>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      physioVas === 0 ? 'bg-emerald-100 text-emerald-800' :
                      physioVas <= 3 ? 'bg-teal-100 text-teal-800' :
                      physioVas <= 6 ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      Score: {physioVas}/10 ({physioVas === 0 ? 'No Pain' : physioVas <= 3 ? 'Mild' : physioVas <= 6 ? 'Moderate' : 'Severe'})
                    </span>
                  </div>

                  <div className="grid grid-cols-11 gap-1.5 my-3">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setPhysioVas(score)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${
                          physioVas === score
                            ? score <= 3
                              ? 'bg-teal-600 text-white shadow-sm scale-105'
                              : score <= 6
                              ? 'bg-amber-500 text-white shadow-sm scale-105'
                              : 'bg-rose-600 text-white shadow-sm scale-105'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium px-1">
                    <span>0: Pain Free</span>
                    <span>5: Moderate Ache</span>
                    <span>10: Worst Possible</span>
                  </div>
                </div>

                {/* 2. Joint & Range of Motion */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono">
                      2. Target Joint &amp; Spine Segment
                    </label>
                    <select
                      value={physioJoint}
                      onChange={(e) => setPhysioJoint(e.target.value)}
                      className="form-select text-xs py-2 bg-white"
                    >
                      <option value="Cervical Spine">Cervical Spine (Neck)</option>
                      <option value="Lumbar Spine">Lumbar Spine (Lower Back)</option>
                      <option value="Shoulder Complex">Shoulder Complex (Glenohumeral)</option>
                      <option value="Knee Joint">Knee Joint (Patellofemoral &amp; Tibiofemoral)</option>
                      <option value="Hip Joint">Hip Joint</option>
                      <option value="Ankle &amp; Foot">Ankle &amp; Foot Complex</option>
                      <option value="Elbow Joint">Elbow Joint</option>
                      <option value="Wrist &amp; Hand">Wrist &amp; Hand</option>
                    </select>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Active Range of Motion (ROM):</label>
                      <input
                        type="text"
                        value={physioRomDegrees}
                        onChange={(e) => setPhysioRomDegrees(e.target.value)}
                        placeholder="e.g. Flexion 45° (painful), Extension 10°"
                        className="form-input text-xs py-1.5"
                      />
                    </div>
                  </div>

                  {/* 3. Manual Muscle Testing (MMT) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono">
                      3. Manual Muscle Testing (MMT Grade)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
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
                          className={`text-xs py-1.5 px-2 rounded-lg font-semibold border text-center transition-all ${
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

                {/* 4. Physical Therapy Modalities & Protocols */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono block mb-2">
                      4. Electrotherapy &amp; Physical Modalities
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'TENS (15 mins)',
                        'Interferential Therapy (IFT)',
                        'Therapeutic Ultrasound (1 MHz)',
                        'Lumbar Mechanical Traction',
                        'Cervical Traction',
                        'Moist Heat Pack (15 mins)',
                        'Cryotherapy / Ice (10 mins)',
                        'Dry Needling',
                        'Laser Therapy (Class IV)'
                      ].map(mod => {
                        const active = physioModalities.includes(mod)
                        return (
                          <button
                            key={mod}
                            type="button"
                            onClick={() => {
                              setPhysioModalities(prev =>
                                active ? prev.filter(m => m !== mod) : [...prev, mod]
                              )
                            }}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                              active
                                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {active ? '✓ ' : '+ '}{mod}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono block mb-2">
                      5. Exercise Prescription &amp; Home Protocol
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'McKenzie Extension',
                        'Pelvic Bridging (3x10)',
                        'Core Isometric Bracing',
                        'Hamstring Static Stretch',
                        'Quadriceps Isometric Sets',
                        'Scapular Retractions',
                        'Lumbar Rotation Stretch',
                        'Ergonomic Posture Correction'
                      ].map(ex => {
                        const active = physioExercises.includes(ex)
                        return (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => {
                              setPhysioExercises(prev =>
                                active ? prev.filter(e => e !== ex) : [...prev, ex]
                              )
                            }}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                              active
                                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
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
            </div>
          )}

          {/* Dental Odontogram Tool */}
          {selectedSpecialty === 'dental' && (
            <div className="card p-5 animate-fadein">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-heading">
                    FDI Two-Digit Dental Odontogram
                  </h3>
                  <p className="text-xs text-slate-500">Click any tooth to cycle clinical status: Healthy → Caries → Filling → Missing → Crown</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/> Healthy
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"/> Caries
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/> Filling
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"/> Missing
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"/> Crown
                  </span>
                </div>
              </div>

              {/* Upper Arch */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Maxilla (Upper Arch)</div>
                  <div className="flex-1 h-px bg-slate-200" />
                  <div className="text-[10px] text-slate-400 font-mono">Teeth 18–28</div>
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-16 gap-2">
                  {teeth.filter(t => t.arch === 'upper').map(tooth => (
                    <button
                      key={tooth.id}
                      onClick={() => cycleToothStatus(tooth.id)}
                      aria-label={`Tooth ${tooth.label}, status ${tooth.status}. Click to change.`}
                      className={`p-2 rounded-xl border text-center transition-all duration-150 hover:scale-105 active:scale-95 ${
                        tooth.status === 'caries' ? 'bg-rose-50 border-rose-300 text-rose-800' :
                        tooth.status === 'filling' ? 'bg-amber-50 border-amber-300 text-amber-800' :
                        tooth.status === 'missing' ? 'bg-slate-100 border-slate-200 text-slate-400 line-through' :
                        tooth.status === 'crown' ? 'bg-purple-50 border-purple-300 text-purple-800' :
                        'bg-white border-slate-200 text-slate-800 hover:border-teal-500 hover:shadow-xs'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono">{tooth.label}</div>
                      <div className="text-[9px] capitalize truncate mt-0.5 font-medium">{tooth.status}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lower Arch */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Mandible (Lower Arch)</div>
                  <div className="flex-1 h-px bg-slate-200" />
                  <div className="text-[10px] text-slate-400 font-mono">Teeth 48–38</div>
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-16 gap-2">
                  {teeth.filter(t => t.arch === 'lower').map(tooth => (
                    <button
                      key={tooth.id}
                      onClick={() => cycleToothStatus(tooth.id)}
                      aria-label={`Tooth ${tooth.label}, status ${tooth.status}. Click to change.`}
                      className={`p-2 rounded-xl border text-center transition-all duration-150 hover:scale-105 active:scale-95 ${
                        tooth.status === 'caries' ? 'bg-rose-50 border-rose-300 text-rose-800' :
                        tooth.status === 'filling' ? 'bg-amber-50 border-amber-300 text-amber-800' :
                        tooth.status === 'missing' ? 'bg-slate-100 border-slate-200 text-slate-400 line-through' :
                        tooth.status === 'crown' ? 'bg-purple-50 border-purple-300 text-purple-800' :
                        'bg-white border-slate-200 text-slate-800 hover:border-teal-500 hover:shadow-xs'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono">{tooth.label}</div>
                      <div className="text-[9px] capitalize truncate mt-0.5 font-medium">{tooth.status}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fallback Clinical Tools for Other Specialties */}
          {selectedSpecialty !== 'physiotherapy' && selectedSpecialty !== 'dental' && (
            <div className="card p-6 border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{currentSpecialtyConfig.icon}</span>
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-heading">
                    {currentSpecialtyConfig.title} — Quick Clinical Prompts
                  </h3>
                  <p className="text-xs text-slate-500">Tap any finding below to seamlessly append into your current note.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono mb-2">Common Complaints</h4>
                  <div className="space-y-1.5">
                    {currentSpecialtyConfig.quickChips.complaints.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => appendText('complaint', c)}
                        className="w-full text-left text-xs p-2 rounded-lg bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-700 transition-colors"
                      >
                        + {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono mb-2">Key Examination Findings</h4>
                  <div className="space-y-1.5">
                    {currentSpecialtyConfig.quickChips.observations.map((obs, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => appendText('observations', obs)}
                        className="w-full text-left text-xs p-2 rounded-lg bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-700 transition-colors"
                      >
                        + {obs}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono mb-2">Diagnostic Formulations</h4>
                  <div className="space-y-1.5">
                    {currentSpecialtyConfig.quickChips.diagnoses.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => appendText('diagnosis', d)}
                        className="w-full text-left text-xs p-2 rounded-lg bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-700 transition-colors"
                      >
                        + {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Prescriptions Rx ── */}
      {activeTab === 'rx' && (
        <div className="card p-5 animate-fadein">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800 font-heading">
                  Electronic Prescription &amp; Medicine Formulary
                </h3>
                {prescriptions.length > 0 && (
                  <span className="badge badge-brand">{prescriptions.length} item{prescriptions.length > 1 ? 's' : ''}</span>
                )}
              </div>
              <p className="text-xs text-slate-500">Live search against drug formulary by brand, generic, or therapeutic class.</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <div className="search-wrap">
              <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={medQuery}
                onChange={(e) => setMedQuery(e.target.value)}
                placeholder="Search formulary (e.g. Paracetamol, Amoxicillin, Aceclofenac, Pantoprazole)…"
                className="search-input"
                aria-label="Search medicine formulary"
              />
              {isSearchingMeds && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="spinner spinner-sm" />
                </span>
              )}
            </div>

            {medHits.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-fadein">
                {medHits.map((hit) => (
                  <div
                    key={hit.id}
                    onClick={() => handleSelectMedicine(hit)}
                    className="p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSelectMedicine(hit) }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center text-[10px] font-bold">
                        {hit.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800">{hit.name}</span>
                        {hit.genericName && <span className="text-slate-500 ml-1.5">({hit.genericName})</span>}
                      </div>
                    </div>
                    <span className="badge badge-brand">{hit.dosageForm || 'Oral'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prescribed Items Table */}
          {prescriptions.length === 0 ? (
            <EmptyState
              illustration={
                <svg width="70" height="70" viewBox="0 0 70 70" fill="none" aria-hidden="true">
                  <rect x="16" y="14" width="38" height="46" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.35"/>
                  <path d="M26 26 L44 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <path d="M26 34 L40 34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <path d="M26 42 L36 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <circle cx="54" cy="18" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4"/>
                  <path d="M54 14 L54 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                  <path d="M50 18 L58 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                </svg>
              }
              title="No medicines prescribed yet"
              description="Search the drug formulary above by brand or generic name to add prescription items."
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
                      <td className="font-bold text-slate-800">{rx.medicine}</td>
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
                          className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1"
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

      {/* ── TAB 4: Template Structure & Sections Explorer ── */}
      {activeTab === 'template_structure' && (
        <div className="card p-6 animate-fadein space-y-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templateSections.map((sec, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
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