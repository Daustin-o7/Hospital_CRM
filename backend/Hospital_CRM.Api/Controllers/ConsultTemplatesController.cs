using System.Text.Json;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/consult-templates")]
public class ConsultTemplatesController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public ConsultTemplatesController(HospitalCrmDbContext db) => _db = db;

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> List([FromQuery] string? specialty, CancellationToken ct)
    {
        var userId = User.GetUserId();
        var targetSpecialty = string.IsNullOrWhiteSpace(specialty) || specialty.Equals("all", StringComparison.OrdinalIgnoreCase)
            ? null
            : specialty.Trim().ToLowerInvariant();

        // 1. Fetch DB templates (built-in + doctor's custom)
        var query = _db.ConsultTemplates.AsNoTracking()
            .Where(t => t.DoctorId == null || t.DoctorId == userId);

        if (targetSpecialty != null)
        {
            query = query.Where(t => t.Specialty.ToLower() == targetSpecialty);
        }

        var dbTemplates = await query
            .OrderByDescending(t => t.IsBuiltIn)
            .ThenBy(t => t.Name)
            .ToListAsync(ct);

        // 2. Synthesize with comprehensive built-in templates if not already in DB
        var existingSpecialties = new HashSet<string>(dbTemplates.Select(t => t.Specialty.ToLowerInvariant()));
        var results = new List<object>();

        foreach (var t in dbTemplates)
        {
            try
            {
                results.Add(new
                {
                    id = t.Id,
                    specialty = t.Specialty,
                    name = t.Name,
                    isBuiltIn = t.IsBuiltIn,
                    structure = JsonSerializer.Deserialize<JsonElement>(t.StructureJson)
                });
            }
            catch
            {
                results.Add(new
                {
                    id = t.Id,
                    specialty = t.Specialty,
                    name = t.Name,
                    isBuiltIn = t.IsBuiltIn,
                    structure = new { sections = Array.Empty<object>() }
                });
            }
        }

        // Add built-ins for any specialties not yet present in the database
        foreach (var fallback in BuiltInSpecialtyTemplates.Catalog)
        {
            if (targetSpecialty != null && !fallback.Specialty.Equals(targetSpecialty, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!existingSpecialties.Contains(fallback.Specialty.ToLowerInvariant()))
            {
                results.Add(new
                {
                    id = fallback.Id,
                    specialty = fallback.Specialty,
                    name = fallback.Name,
                    isBuiltIn = true,
                    structure = JsonSerializer.Deserialize<JsonElement>(fallback.StructureJson)
                });
            }
        }

        return Ok(results);
    }

    [HttpPost]
    [AuthorizeRoles("Doctor")]
    public async Task<IActionResult> Create([FromBody] CreateConsultTemplateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Specialty) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "specialty_and_name_required" });

        if (request.Structure is null)
            return BadRequest(new { error = "structure_required" });

        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var doctor = await _db.Users.FindAsync([userId.Value], ct);
        if (doctor is null)
            return Unauthorized(new { error = "user_not_found" });

        var template = new ConsultTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = doctor.TenantId,
            DoctorId = userId.Value,
            Specialty = request.Specialty,
            Name = request.Name,
            StructureJson = request.Structure.Value.GetRawText(),
            IsBuiltIn = false,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.ConsultTemplates.Add(template);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            id = template.Id,
            specialty = template.Specialty,
            name = template.Name,
            isBuiltIn = false
        });
    }
}

public record CreateConsultTemplateRequest(string Specialty, string Name, JsonElement? Structure);

public record BuiltInTemplateItem(Guid Id, string Specialty, string Name, string StructureJson);

public static class BuiltInSpecialtyTemplates
{
    public static readonly IReadOnlyList<BuiltInTemplateItem> Catalog = new List<BuiltInTemplateItem>
    {
        new(
            Guid.Parse("11111111-1111-1111-1111-111111111101"),
            "general",
            "General Medicine — Comprehensive SOAP",
            """
            {
              "sections": [
                {"key": "chief_complaint", "label": "Chief Complaint & Duration", "type": "text", "placeholder": "e.g. High fever x 3 days with body aches and dry cough"},
                {"key": "hpi", "label": "History of Present Illness (HPI)", "type": "textarea", "placeholder": "Onset, duration, severity, progression, aggravating/relieving factors"},
                {"key": "pmh", "label": "Past Medical & Surgical History", "type": "textarea", "placeholder": "Hypertension, Diabetes, Asthma, drug allergies, past surgeries"},
                {"key": "examination", "label": "General & Systemic Examination", "type": "textarea", "placeholder": "Vitals: BP, PR, SpO2, Temp, RR. Systemic: CVS (S1 S2), RS (air entry), P/A (soft, non-tender), CNS"},
                {"key": "investigation", "label": "Diagnostic Investigations", "type": "text", "placeholder": "CBC, ESR, Widal, Chest X-ray, Urine Routine"},
                {"key": "diagnosis", "label": "Provisional / Final Diagnosis", "type": "text", "placeholder": "e.g. Acute Febrile Illness / Viral Upper Respiratory Tract Infection"},
                {"key": "treatment_plan", "label": "Clinical Plan & Instructions", "type": "textarea", "placeholder": "Hydration, rest, red flag warning signs (dyspnea, altered sensorium), review in 3 days"}
              ]
            }
            """
        ),
        new(
            Guid.Parse("11111111-1111-1111-1111-111111111102"),
            "physiotherapy",
            "Physiotherapy & Rehabilitation — Functional Assessment",
            """
            {
              "sections": [
                {"key": "chief_complaint", "label": "Primary Complaint & Functional Limitation", "type": "text", "placeholder": "e.g. Low back pain radiating to left calf, inability to sit >20 mins"},
                {"key": "pain_profile", "label": "Pain Characteristics & VAS Score (0-10)", "type": "textarea", "placeholder": "VAS: 7/10 constant dull ache, aggravated by forward flexion, relieved by supine rest"},
                {"key": "posture_gait", "label": "Posture, Spine & Gait Assessment", "type": "textarea", "placeholder": "Pelvic tilt, loss of lumbar lordosis, antalgic gait, scapular winging"},
                {"key": "rom", "label": "Range of Motion (ROM) & Flexibility", "type": "textarea", "placeholder": "Lumbar flexion restricted (30 deg), extension painful (10 deg), Hamstring tight (SLR 50 deg Left)"},
                {"key": "mmt", "label": "Manual Muscle Testing (MMT Grade 0–5)", "type": "textarea", "placeholder": "Core stability poor (Grade 2/5), Quadriceps 5/5, Ankle dorsiflexors 4/5"},
                {"key": "special_tests", "label": "Special Orthopedic / Neuro Tests", "type": "textarea", "placeholder": "SLR positive left 45 deg, Slump positive, Faber negative, Spurling negative"},
                {"key": "diagnosis", "label": "Physical Therapy Diagnosis", "type": "text", "placeholder": "e.g. L4-L5 Lumbar Discogenic Radiculopathy with Paraspinal Spasm"},
                {"key": "modalities", "label": "Electrotherapy & Physical Modalities", "type": "textarea", "placeholder": "TENS (lumbar paraspinal) 15 mins, Moist Heat Pack, Lumbar Traction (18 kg intermittent)"},
                {"key": "exercises", "label": "Exercise Prescription & Home Program", "type": "textarea", "placeholder": "McKenzie extension protocol, pelvic bridging, core isometric bracing, ergonomic chair adjustment"}
              ]
            }
            """
        ),
        new(
            Guid.Parse("11111111-1111-1111-1111-111111111103"),
            "dental",
            "Dental & Maxillofacial — Odontogram & Clinical Exam",
            """
            {
              "sections": [
                {"key": "chief_complaint", "label": "Chief Dental Complaint", "type": "text", "placeholder": "e.g. Severe throbbing pain in lower right tooth on chewing and hot foods"},
                {"key": "dental_history", "label": "Dental & TMJ History", "type": "textarea", "placeholder": "Prior root canal, tooth extraction, bruxism/clenching, TMJ clicking, dental anxiety"},
                {"key": "examination", "label": "Intraoral & Periodontal Examination", "type": "textarea", "placeholder": "Tooth 46: Deep disto-occlusal caries, tender to vertical percussion (TTP+), Grade 1 mobility. Plaque index moderate."},
                {"key": "radiology", "label": "Radiographic Findings (IOPAR / OPG)", "type": "text", "placeholder": "IOPAR 46 shows radiolucency involving enamel, dentin, and pulp with periapical widening"},
                {"key": "diagnosis", "label": "Dental Diagnosis", "type": "text", "placeholder": "e.g. Irreversible Pulpitis with Symptomatic Apical Periodontitis i.r.t 46"},
                {"key": "treatment_plan", "label": "Dental Treatment Plan", "type": "textarea", "placeholder": "1. Root Canal Treatment 46. 2. Post-endodontic crown. 3. Ultrasonic scaling & polishing."},
                {"key": "advice", "label": "Post-Op & Oral Hygiene Instructions", "type": "textarea", "placeholder": "Avoid chewing hard food on right side, warm salt water rinses, soft bristle brushing"}
              ]
            }
            """
        ),
        new(
            Guid.Parse("11111111-1111-1111-1111-111111111104"),
            "pediatrics",
            "Pediatrics & Child Health — Growth & Acute Consult",
            """
            {
              "sections": [
                {"key": "chief_complaint", "label": "Chief Complaint & Duration", "type": "text", "placeholder": "e.g. Cough and rapid breathing for 2 days, poor feeding"},
                {"key": "birth_immunization", "label": "Birth, Nutrition & Immunization History", "type": "textarea", "placeholder": "Term baby (3.1 kg), breastfed, fully immunized as per IAP schedule up to 9 months"},
                {"key": "growth_vitals", "label": "Anthropometry & Pediatric Vitals", "type": "textarea", "placeholder": "Weight: 8.4 kg (50th percentile), Length: 71 cm, Head Circ: 44 cm, Temp: 101F, RR: 38/min, SpO2: 97%"},
                {"key": "examination", "label": "Physical & Systemic Examination", "type": "textarea", "placeholder": "Alert, hydrated, anterior fontanelle flat. Chest: bilateral subcostal retractions, expiratory wheeze. Heart: S1 S2 normal"},
                {"key": "diagnosis", "label": "Pediatric Diagnosis", "type": "text", "placeholder": "e.g. Acute Viral Bronchiolitis (RSV likely)"},
                {"key": "treatment_plan", "label": "Pediatric Prescription & Saline Nebulization", "type": "textarea", "placeholder": "Weight-based dosing (Paracetamol 15mg/kg SOS, Saline nasal drops, 3% Saline nebulization). Frequent small feeds."}
              ]
            }
            """
        ),
        new(
            Guid.Parse("11111111-1111-1111-1111-111111111105"),
            "dermatology",
            "Dermatology — Cutaneous & Dermoscopy Exam",
            """
            {
              "sections": [
                {"key": "chief_complaint", "label": "Dermatological Complaint", "type": "text", "placeholder": "e.g. Itchy red rash on flexor aspects of arms and neck for 3 weeks"},
                {"key": "lesion_profile", "label": "Morphology, Arrangement & Distribution", "type": "textarea", "placeholder": "Erythematous lichenified plaques with excoriation marks, symmetrical distribution on antecubital fossae"},
                {"key": "dermoscopy", "label": "Dermoscopy & Wood's Lamp Findings", "type": "text", "placeholder": "Dermoscopy: Red dots/globules in patchy distribution, white scales. Wood's lamp: No coral red / green fluorescence"},
                {"key": "triggers", "label": "Aggravating Triggers & Past Topicals", "type": "textarea", "placeholder": "Sweating, synthetic clothing, history of OTC steroid abuse (Betamethasone cream)"},
                {"key": "diagnosis", "label": "Dermatological Diagnosis", "type": "text", "placeholder": "e.g. Atopic Dermatitis flare / Tinea Incognito"},
                {"key": "topical_plan", "label": "Topical & Systemic Regimen", "type": "textarea", "placeholder": "Barrier repair moisturizer liberal application, Mometasone furoate 0.1% cream OD x 5 days, Levocetirizine 5mg HS"}
              ]
            }
            """
        ),
        new(
            Guid.Parse("11111111-1111-1111-1111-111111111106"),
            "orthopedics",
            "Orthopedics & Sports Medicine — Musculoskeletal Exam",
            """
            {
              "sections": [
                {"key": "chief_complaint", "label": "Injury / Joint Pain & Duration", "type": "text", "placeholder": "e.g. Right knee pain and swelling following a twist during sports 4 days ago"},
                {"key": "trauma_gait", "label": "Trauma History, Deformity & Gait", "type": "textarea", "placeholder": "Audible 'pop' heard at injury, immediate joint effusion within 2 hours. Antalgic non-weight-bearing gait."},
                {"key": "examination", "label": "Physical & Ligamentous Stability Tests", "type": "textarea", "placeholder": "Joint line tenderness medial side (+), Lachman (+), Anterior Drawer (+), McMurray (+) for medial meniscus. Distal pulses intact."},
                {"key": "imaging", "label": "X-ray / MRI Review", "type": "text", "placeholder": "X-ray: No avulsion fracture. MRI Right Knee: Complete ACL mid-substance tear with posterior horn medial meniscus tear"},
                {"key": "diagnosis", "label": "Orthopedic Diagnosis", "type": "text", "placeholder": "e.g. Complete ACL Tear with Medial Meniscus Tear (Right Knee)"},
                {"key": "treatment_plan", "label": "Management & Surgical / Rehab Plan", "type": "textarea", "placeholder": "RICE protocol, hinged knee brace, pre-habilitation quad sets. Arthroscopic ACL Reconstruction scheduled."}
              ]
            }
            """
        ),
        new(
            Guid.Parse("11111111-1111-1111-1111-111111111107"),
            "cardiology",
            "Cardiology & Vascular Medicine — Clinical Evaluation",
            """
            {
              "sections": [
                {"key": "chief_complaint", "label": "Cardiovascular Symptoms", "type": "text", "placeholder": "e.g. Retrosternal chest heaviness on climbing 1 flight of stairs, relieved by rest"},
                {"key": "nyha_risk", "label": "NYHA Functional Class & Risk Factors", "type": "textarea", "placeholder": "NYHA Class II, CCS Angina Class II. Risk factors: Smoker 15 pack-years, Type 2 DM (HbA1c 8.2), HTN 6 yrs"},
                {"key": "vitals_exam", "label": "Hemodynamics & Cardiovascular Auscultation", "type": "textarea", "placeholder": "BP: 154/92 mmHg right arm, PR: 82 bpm regular. JVP not elevated, no pedal edema. Heart: S1 S2 heard, no murmurs/gallop"},
                {"key": "ecg_echo", "label": "ECG & 2D-Echocardiography Summary", "type": "textarea", "placeholder": "ECG: T-wave inversions V4-V6. 2D Echo: LVEF 55%, mild anterior wall hypokinesia, grade 1 diastolic dysfunction"},
                {"key": "diagnosis", "label": "Cardiovascular Diagnosis", "type": "text", "placeholder": "e.g. Coronary Artery Disease — Stable Angina Pectoris with Stage 2 Hypertension"},
                {"key": "treatment_plan", "label": "Cardio Pharmacotherapy & Emergency Advice", "type": "textarea", "placeholder": "Aspirin 75mg OD, Atorvastatin 40mg HS, Metoprolol XL 25mg OD, Telmisartan 40mg OD, Sorbitrate 5mg SL SOS for acute chest pain"}
              ]
            }
            """
        ),
        new(
            Guid.Parse("11111111-1111-1111-1111-111111111108"),
            "ent",
            "ENT / Otorhinolaryngology — Clinical Exam",
            """
            {
              "sections": [
                {"key": "chief_complaint", "label": "ENT Complaint & Duration", "type": "text", "placeholder": "e.g. Right ear discharge, pain, and reduced hearing for 5 days"},
                {"key": "otoscopy", "label": "Otoscopy Examination (Bilateral)", "type": "textarea", "placeholder": "Right: Mucopurulent discharge in external auditory canal, central perforation of pars tensa. Left: Intact TM with cone of light present."},
                {"key": "rhinoscopy", "label": "Anterior Rhinoscopy & Oral Cavity", "type": "textarea", "placeholder": "Nose: Deviated nasal septum (DNS) to left, hypertrophied right inferior turbinate. Throat: Tonsils Grade 1, non-hyperemic."},
                {"key": "diagnosis", "label": "ENT Diagnosis", "type": "text", "placeholder": "e.g. Chronic Suppurative Otitis Media (CSOM) Tubotympanic Type Active Right Ear"},
                {"key": "treatment_plan", "label": "ENT Medical & Surgical Advice", "type": "textarea", "placeholder": "Aural dry mopping, Ciprofloxacin ear drops 3 drops TID x 7 days, keep ear strictly dry. Plan Tympanoplasty once ear is dry for 6 weeks."}
              ]
            }
            """
        ),
        new(
            Guid.Parse("11111111-1111-1111-1111-111111111109"),
            "ophthalmology",
            "Ophthalmology — Ocular Examination & Refraction",
            """
            {
              "sections": [
                {"key": "chief_complaint", "label": "Ocular Complaint & Duration", "type": "text", "placeholder": "e.g. Gradual blurring of distance vision bilateral, glare while night driving"},
                {"key": "visual_acuity", "label": "Visual Acuity (Unaided & Pinhole)", "type": "textarea", "placeholder": "Right Eye (OD): 6/24 (PH: 6/12). Left Eye (OS): 6/18 (PH: 6/9). Near Vision: N6 with +2.00 D"},
                {"key": "slit_lamp_iop", "label": "Slit Lamp Examination & IOP", "type": "textarea", "placeholder": "Cornea clear bilaterally, anterior chamber deep and quiet. Lens: Nuclear sclerosis Grade 2 bilateral. IOP (NCT): OD 14 mmHg, OS 15 mmHg."},
                {"key": "fundus", "label": "Dilated Fundoscopy", "type": "textarea", "placeholder": "Media clear, Optic disc 0.3 CDR, neuroretinal rim healthy, macula normal foveal reflex, no microaneurysms."},
                {"key": "diagnosis", "label": "Ophthalmic Diagnosis", "type": "text", "placeholder": "e.g. Bilateral Senile Nuclear Cataract (Grade 2) with Presbyopia"},
                {"key": "treatment_plan", "label": "Prescription & Surgical Counseling", "type": "textarea", "placeholder": "Refraction glasses prescribed for interim, counselled for Phacoemulsification with Foldable IOL (Right Eye first)."}
              ]
            }
            """
        ),
        new(
            Guid.Parse("11111111-1111-1111-1111-111111111110"),
            "ayurveda",
            "Ayurveda & AYUSH — Ashta Vidha Pariksha & Chikitsa",
            """
            {
              "sections": [
                {"key": "chief_complaint", "label": "Pradhan Vedana (Chief Complaint)", "type": "text", "placeholder": "e.g. Sandhi Shoola (joint pain) and Sandhi Graha (stiffness) especially in early morning"},
                {"key": "hetu", "label": "Hetu Sevana (Causative Dietary & Lifestyle Factors)", "type": "textarea", "placeholder": "Guru, Sheeta, Viruddha Ahara (fast foods, curd at night), Diwaswapna (daytime sleep), lack of exercise"},
                {"key": "prakriti_vikriti", "label": "Prakriti & Vikriti Assessment", "type": "textarea", "placeholder": "Deha Prakriti: Vata-Kapha. Vikriti: Vata and Ama dosha vitiation localized in Asthi-Sandhi srotas."},
                {"key": "ashta_vidha", "label": "Ashta Vidha Pariksha (Eight-Fold Examination)", "type": "textarea", "placeholder": "Nadi: Manda & Sarpa gati. Jihva: Saama (white coated). Mutra: Avishesha. Mala: Vibandha. Shabda: Prakrita. Sparsha: Ushna over joints. Drik: Prakrita. Akriti: Madhyama."},
                {"key": "diagnosis", "label": "Nidana / Samprapti (Ayurvedic Diagnosis)", "type": "text", "placeholder": "e.g. Amavata (Early Stage) / Sandhivata (Osteoarthritis)"},
                {"key": "chikitsa", "label": "Chikitsa Sutra (Panchakarma & Shamana)", "type": "textarea", "placeholder": "Langhana, Deepana-Pachana with Shunthi churna, Valuka Sweda for joints. Avoid Sneha in Saama stage."},
                {"key": "aushadha", "label": "Aushadha Yoga (Classical Formulations)", "type": "textarea", "placeholder": "1. Simhanada Guggulu 2 tabs BD with warm water. 2. Rasnasaptaka Kwatha 20ml BD with Shunthi. 3. Hingwashtaka churna 3g before meals."},
                {"key": "pathya", "label": "Pathya-Apathya (Diet & Lifestyle Restrictions)", "type": "textarea", "placeholder": "Pathya: Ushnodaka (warm water), barley, horsegram, garlic. Apathya: Masha (urad dal), curd, cold drinks, suppressed natural urges."}
              ]
            }
            """
        )
    };
}
