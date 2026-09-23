# SAMSTACK AI — Doctor CRM: Foundational Strategy (v0.5)

**Status:** Core decisions locked, 1 item open (§12) · **Date:** 10 Aug 2026 · **Precedes:** PRD → FRD → TRD

**Confirmed with cofounder (10 Aug 2026):**
1. Launch market: **India + UAE, both from day 1** — via one engine with region-specific adapters, not two parallel products (§3.3). UAE picked as the pragmatic first international market: time-zone/relationship proximity, large Indian-run private-clinic base, more tractable compliance bar than US HIPAA.
2. Team = **2 founders** initially, no hires yet. This drives the MVP scope in §11 more than anything else in this document — read that section carefully.
3. Product = **one shared codebase**, deployed in **three tenancy tiers** depending on the buyer (§3.1), packaged as **four sellable tracks** — CRM+Billing, Pharmacy, Regulated AI, and IPD as an explicit later phase (§3.2) — not a fork per buyer or per region.
4. "Wishlist" = an internal tracker for anything a doctor/hospital wants to flag for later: tasks, goals, equipment, expansion plans. "ITR monthly" = a lightweight accounting/audit layer that makes the clinic's monthly tax filing easier — not a direct government e-filing integration. Both now scoped properly in §7.

---

## 1. Competitive Landscape

| Player | Model | Angle / weakness we can exploit |
|---|---|---|
| **Practo Ray** | Subscription + patient-marketplace | Market leader, but doctors report cost becomes unpredictable once marketplace commissions/paid listings stack on top of the subscription, and data export on exit is not self-serve. |
| **Healthplix** | Free/low-cost EMR, prescription-first | Strong at the clinical pad, weaker on multi-branch ops, stock, and pharmacy. |
| **Medisray / TatvaCare** | Flat rupee subscription, **zero commission** | Newer entrants positioning explicitly *against* Practo's commission model — validates that "predictable flat pricing, no marketplace tax" is a real pain point doctors will switch for. |
| **Eka Care** | ABDM-forward | Leans on India's digital-health rails early. |
| **Healthray** *(your reference)* | Cloud HMS, 1,000+ hospitals | Genuinely strong, direct competitor — full breakdown below. |
| **Marg ERP/Compusoft** *(your reference)* | Standalone pharmacy ERP, 32 yrs, 50%+ of India's pharmacy billing | Pharmacy benchmark, not a clinic CRM — full breakdown below. |

**The gap:** nobody in this set fully owns *appointments + EMR + labs + three-tier stock (dead/consumable/usable) + pharmacy + WhatsApp automation + AI* in one flat-priced, white-label-able, dual-region package. Most are either marketplace-heavy, narrow clinical-pad tools, or (below) strong in one department but not integrated end-to-end. That combination — plus zero-commission, predictable pricing — is our wedge.

### 1.1 Deep-dive on your two references

**Healthray — the real bar to clear.** 1,000+ hospitals, 5M+ patient records, ABHA verification built into registration, GST + TPA claims billing, FHIR/SNOMED/ICD-10/11 structured records, DPDP + HIPAA-aligned, full RBAC and audit trails, 30+ speciality EMR templates, pharmacy with batch/expiry/GST, a LIMS module, and a "start small, activate modules as you grow" model that validates our own Track approach (§3.2). Support in English, Hindi and Gujarati.
- **What's missing, that we can win on:** WhatsApp isn't a named headline feature; pricing is opaque ("book a demo for a quote," no published tiers — our flat pricing per §3.2 is a direct contrast); no visible dedicated-instance/on-prem option for hospitals that won't accept cloud-only (§3.1 Tier 3 answers this directly); no granular dead/consumable/usable stock split, just generic "stock tracking"; no wishlist/goals tracker; and — the big one — **no international presence**. If we execute §3.3 well, we're ahead of the market leader on that front specifically.

**Marg ERP — the pharmacy benchmark, but a different category.** Standalone retail-pharmacy ERP (chemist shops), not a clinic system: GST 2.0 billing, batch/expiry auto-alerts, Schedule H/H1/Narcotics registers, ERP-to-ERP ordering directly to distributors (compare prices/schemes before ordering), a 4.5-lakh medicine database with substitute lookup, WhatsApp refill reminders and invoice sharing, multi-branch inventory. 32 years of legacy-installed-software roots (download-and-install heritage), not cloud-native.
- **The real gap:** Marg has no appointment/EMR/CRM layer — a hospital pharmacy running Marg is a second system someone bridges manually to whatever runs the clinical side, so prescriptions get re-typed at the counter instead of flowing from the doctor's e-prescription. Our Pharmacy track (§3.2) reads and writes the *same* patient record as Track 1 — appointment → consult → e-prescription → pharmacy counter → billing, zero re-entry. That continuity is what neither reference does end-to-end.
- **Worth stealing as ideas:** ERP-to-ERP distributor ordering (feeds Bucket A demand-forecasting, §8) and a substitute-medicine database (useful for the OCR/prescription-digitisation feature).

**One real gap in our own plan, surfaced by Healthray:** TPA/insurance claims workflow. Our original requirement list said "payment related, all" but didn't call out insurance/TPA reimbursement specifically — hospitals will expect it. Added to §7 and Phase 2 below.

**A second, bigger gap: IPD — resolved as an explicit later track, not built alongside the core.** Healthray runs OPD *and* IPD — bed allocation, ward transfers, admission/discharge summaries, nursing charting. Everything in Track 1 today is OPD-only, matching the original "CRM for doctors" brief and the 2-founder MVP logic in §11. Cofounder call: add it as **Track 4** (§3.2) — real scope, sequenced deliberately late rather than half-built alongside everything else.

---

## 2. Regulatory Floor (design these in from day 1, not bolted on later)

- **DPDP Act 2023 + Rules 2025** — every clinic/pharmacy/lab is a "data fiduciary." Health data is treated as high-risk even though DPDP doesn't have a separate "sensitive data" category. Requires: purpose-specific consent (not fine-print forms), data minimisation, breach notification to the Data Protection Board, retention limits, and — for larger ("significant") fiduciaries — a DPO and DPIAs. Penalties run up to ₹250 crore for serious violations. **This means our data model needs consent-tracking and audit-log as first-class objects, not an afterthought.**
- **ABDM (ABHA / HFR / HPR / FHIR R4)** — India's national health-data rails. Compliance is heading toward mandatory by 2027 for hospitals, and the government pays a **Digital Health Incentive (DHIS) of up to ₹4 lakh per facility** for ABDM-compliant software. Building ABHA-linked records, HFR/HPR registration, and FHIR R4 export **as a native feature, not an add-on**, is both a compliance hedge and a genuine sales pitch ("we get you the ₹4L incentive").
- **CDSCO SaMD Guidance (finalised late 2025)** — this is the one to design around carefully. Any software that performs **diagnosis, screening, or clinical decision-support** is now classified as a medical device (Class A–D, risk-based) and needs CDSCO licensing before it can be sold — including AI tools. There's a saving grace (the Algorithm Change Protocol) that lets a licensed model update without re-approval each time, but getting licensed at all is a real cost/timeline. **Design principle: keep v1 AI features administrative/operational, not diagnostic** (see §8) so we don't need a medical-device licence to ship.
- **Pharmacy (Drugs & Cosmetics Act)** — Schedule H drugs need a prescription-linked register; Schedule H1 needs a separate register with 3-year retention; NDPS (narcotics) needs dual-signature dispensing and monthly reconciliation to the state drug controller. GST-compliant billing (5/12/18% slabs, HSN codes) is table stakes, not optional.

**International — UAE regulatory floor (first non-India market):**
- **UAE PDPL (Federal Decree-Law No. 45/2021) + Health ICT Law (Federal Law No. 2/2019)** — health data isn't just covered by the GDPR-like PDPL; it's separately governed by sector law, layered with Dubai Health Authority (DHA) or Department of Health Abu Dhabi (DOH) rules depending on which emirate a clinic sits in. Same practical shape as DPDP: purpose-specific consent, breach notification, and — for large-scale health-data processing — a mandatory Data Protection Officer.
- **Data residency is stricter than India's:** UAE law requires patient health records to be hosted *inside* the UAE — not a best practice, a legal requirement. Good news: Azure and AWS both run UAE regions, so this is a routing config (UAE tenants' database + backups → Azure UAE North/Abu Dhabi), not new infrastructure.
- **NABIDH** — Dubai's national health information exchange, the UAE's rough equivalent of India's ABDM/ABHA. Same playbook as the ABDM point above: building NABIDH-readiness in from the start is both a compliance hedge and a sales pitch.
- **SaMD/AI licensing body: Emirates Drug Establishment (EDE)**, not MOHAP — authority transferred in a 2024–25 regulatory reform. Same 4-tier risk-classification idea as CDSCO (Class I–IV; Class IV = high-risk AI-driven critical-care decision support). Same design principle applies: keep Tracks 1–2 administrative, defer diagnostic AI to Track 3 once EDE licensing is pursued.

---

## 3. Product Model: Tenancy, Packaging & Regions

### 3.1 Deployment Tenancy Tiers

Your objection is valid and common — a hospital's IT/compliance team will often reject "shared database" outright, even when row-level isolation is technically sound. It's as much a trust/optics problem as a technical one. Here's a model that answers it **without** us maintaining multiple codebases, which two founders genuinely cannot sustain.

**Same application, three ways to deploy it — controlled by configuration and infrastructure target, not by forking code:**

| Tier | Who it's for | What's different | Isolation |
|---|---|---|---|
| **Shared SaaS** | Solo doctors, small clinics | Nothing — standard self-serve onboarding | Shared DB, `tenant_id` + Postgres Row-Level Security |
| **Dedicated Database** | Mid-size clinics/small hospitals who reject "shared DB" but don't need their own servers | Same shared application tier (our compute), but a physically separate database per tenant | Own DB, shared app layer |
| **Dedicated Instance** | Hospitals demanding full control — data sovereignty, internal IT policy, or non-negotiable procurement rules | Entire stack (app + DB + cache) deployed as a private instance — identical Docker images, different deployment target (our infra in their own resource group, their own cloud subscription, or their own servers) | Fully isolated, potentially outside our infrastructure entirely |

**Why this is affordable for a 2-person team:** everything gets containerised (Docker) from day 1 regardless of tier. Tiers 1 and 2 differ only by a connection-string/tenant-resolver config — trivial to run. Tier 3 uses the *exact same images*, just pointed at a different target — an infrastructure exercise at sale time, not a rewrite or a second codebase.

**Sequencing advice:** build and sell Tiers 1 and 2 for now. Tier 3 is real recurring ops work per customer (provisioning, patching, on-call) that two founders can't absorb across many accounts simultaneously. Treat it as a premium sell you say yes to once the first hospital insists on it. Because everything's containerised from the start, saying yes to that first one is an infra lift, not an architecture change.

- **Branding layer (all tiers):** logo, colour theme, clinic name, subdomain (`clinicname.samstack.ai`, custom domain optional) as tenant config, loaded dynamically by the React frontend.
- This tiering is also your natural pricing ladder (see §10) — Shared SaaS priced per-seat/flat, Dedicated DB and Dedicated Instance priced as premium tiers reflecting the extra isolation and ops cost.

### 3.2 Product Packaging: Three Sellable Tracks

Confirmed with cofounder: package and build in this order.

| Track | Contains | Depends on |
|---|---|---|
| **1. CRM + Billing** | Patients/Registration, Appointments, Treatment/EMR, Billing/Payments, WhatsApp reminders, Wishlist tracker | Nothing — the core, sellable standalone |
| **2. Pharmacy (+ Billing)** | Pharmacy stock, POS billing, Schedule H/H1/NDPS registers | Track 1's Billing module (see below) |
| **3. Regulated AI (CDSCO-licensed)** | Bucket B AI — diagnosis suggestions, risk scoring, image screening (§8) | **Gated by CDSCO SaMD licensing** (or the equivalent body in the international market — see §3.3) |
| **4. IPD / Inpatient Management** *(explicit later phase, §11)* | Bed/ward management, admission & discharge workflows, ward transfers, nursing charting, discharge summaries | Track 1 — an admission is a new encounter type on the *same* patient record, not a separate system |

**Track 4 is opt-in, hospital-tier only.** Solo doctors and OPD-only clinics never see it — it activates the same way Pharmacy does, per-tenant, and pairs naturally with the Dedicated Database/Instance tenancy tiers (§3.1) since IPD-needing customers are almost always the hospital-scale accounts anyway. It's real net-new scope (live bed state, nursing workflows are a genuinely different surface from an OPD CRM), which is exactly why it's sequenced late, after Track 1 has paying customers in both regions — see §11.

**One Billing module, not two.** "Pharmacy includes billing" doesn't mean a second billing system — extend Track 1's Billing module with a pharmacy/POS invoice type (drug SKUs, batch/expiry-linked line items, offline-tolerant counter sync). Same GST logic, same payment-gateway integration, same ledger, one schema extension.

**Track 2's real differentiator vs. standalone pharmacy ERPs (Marg-style, §1.1):** it reads and writes the *same* patient record as Track 1 — a doctor's e-prescription flows straight to the pharmacy counter, no re-typing, no bridging two separate vendor systems.

**Track 3 isn't a normal engineering sprint.** CDSCO licensing is a regulatory process with its own timeline, running in parallel to (not after) Track 1–2 engineering — start it now so it isn't the bottleneck later. Build the Bucket B AI code behind a feature flag inside the AI/ML service so engineering isn't blocked, but keep it **dormant/unsellable** until the licence (Class per §2) is actually granted.

### 3.3 Building for India + International from Day 1

Architecturally cheap to do well, expensive to do badly. The move: **one engine, region-specific adapters**, not two parallel products.

| Concern | Interface | India adapter | UAE adapter |
|---|---|---|---|
| Payments | `IPaymentProvider` | Razorpay (UPI, GST/TDS handling) | **Stripe** for subscription billing (Track 1) — operates in UAE for tech-licensed businesses, strong recurring-billing tooling; **Telr or PayTabs** for Pharmacy POS (Track 2), where local settlement and Mada card support matter more than subscription tooling |
| Data protection/consent | `IComplianceProvider` | DPDP Act 2023 | UAE PDPL + Health ICT Law + DHA/DOH (§2) |
| Tax/invoicing | `ITaxInvoiceProvider` | GST, HSN codes | UAE VAT (5%) |
| Data residency | Tenant → region routing | India-hosted (Azure Central India / AWS Mumbai) | **UAE-hosted, non-negotiable** (Azure UAE North / Abu Dhabi) — a hard legal mandate for health data, not a preference |

Every track (1, 2, and eventually 3) is written against these interfaces, never directly against Razorpay or DPDP. That's what makes "two regions from day 1" tractable for two people — you're writing one core + two thin adapters, not two products. Track 3's CDSCO gate has a direct UAE counterpart in EDE licensing (§2) — same design principle, different regulator.

**Honest scope note, consistent with §11:** designing the interfaces for two regions now is cheap and worth doing immediately — retrofitting it later is the expensive path. *Fully* localising every track for both regions simultaneously is not cheap. I'd still sequence the actual build: Track 1's India adapter to a real paying customer first (concrete, already researched), Track 1's UAE adapter stood up in parallel at MVP depth, and Tracks 2–3 held to India-only until Track 1 has proven out in both markets.

**Resolved:** first international market is UAE. Because everything sits behind these interfaces, a second international market later (Saudi Arabia is a natural next step given the shared GCC regulatory framework) is one more adapter, not a re-architecture.

---

## 4. Architecture: Modular Monolith + a Few Strategic Services

You floated pure microservices. My pushback, as your cofounder: **pure microservices on day 1, before product-market fit, is the classic overengineering trap** — every module split means another deployment pipeline, another set of logs to correlate, another network hop that can fail. For a founding team of a handful of people, that's ops tax you pay before you've sold a single seat.

**Better fit: a modular monolith for the core, with 3 things peeled out as real services from day 1** because they genuinely have different scaling/failure/tech profiles:

**Core CRM monolith (.NET 10, one deployable, internally organised as clean bounded-context modules — Identity, Patients, Appointments, Clinical/EMR, Billing, Lab, Inventory, Pharmacy, Reporting):**
- Each "module" is its own project/namespace with a defined internal contract, so any one of them can be cut out into a real microservice later *if and when* it needs independent scaling — the boundaries are ready, you just haven't paid for the ops overhead yet.

**Peeled out as separate services from day 1:**
| Service | Why it's separate now |
|---|---|
| **Notification/Automation** (WhatsApp, SMS, email, reminder rules) | Bursty traffic, depends on flaky third-party APIs (Meta/BSP), needs its own retry/queue logic — shouldn't be able to slow down or crash appointment booking. |
| **AI/ML service** (Python/FastAPI) | Different runtime, different scaling curve (some calls are cheap, some hit an LLM/model and are slow), keeps Python out of your .NET core. |
| **Integration Gateway** (ABDM/ABHA/FHIR, payment webhooks) | Security-sensitive, externally-facing — isolating it limits blast radius if a third-party integration misbehaves or a webhook is abused. |

This gives you ~80% of microservices' benefit (independent scaling/deploy for the parts that need it) at maybe 20% of the ops cost. You can keep splitting the monolith later as specific modules prove they need to scale independently (e.g., Billing during month-end, or Appointments during a big client's launch).

---

## 5. Service Communication: not just "WebAPI everywhere"

You asked for a better option than pure WebAPI-to-WebAPI — here it is:

- **Synchronous (React ↔ backend):** REST over HTTPS, behind a single **API Gateway** (YARP — .NET's own reverse proxy, no separate product to license). React only ever talks to one endpoint; the gateway handles auth, rate-limiting, and routing to the right module/service internally.
- **Asynchronous (backend ↔ backend):** an **event/message bus** (RabbitMQ self-hosted, or Azure Service Bus if you want it managed) for anything that shouldn't block the user's request or that other modules need to *react* to:
 - `AppointmentConfirmed` → Notification service sends WhatsApp confirmation
 - `StockBelowThreshold` → Inventory triggers a reorder alert
 - `LabResultReady` → Notification service pings the patient
 - **Why this matters:** if the WhatsApp/Notification service is down, appointment booking must still succeed — pure synchronous WebAPI chains would let a downstream failure cascade backward. An event bus decouples that.
- Internal service-to-service calls that are latency-critical can move to gRPC later; not needed for MVP.

---

## 6. Tech Stack — mapped to what you already know

| Layer | Choice | Why |
|---|---|---|
| Backend core | **.NET 10** (ASP.NET Core, C# 14) | LTS supported to **Nov 2028**. EF Core 10 ships GA vector search + native JSON — useful later for AI features (semantic search over patient records) without standing up a separate vector DB. Matches your new .NET 10 hands-on. |
| AI/ML service | **Python + FastAPI** | Plays to your strongest skill set directly; best ecosystem for ML/LLM tooling. |
| Frontend (web) | **React 19** (pin to ≥19.2.1) | Current stable major (no React 20 yet as of mid-2026), React Compiler now stable so manual `useMemo`/`useCallback` mostly goes away. **Note:** early React 19 Server-Component releases had a disclosed vulnerability ("React2Shell"), patched in 19.2.1+ — pin above that. |
| "Any device" access | **Responsive PWA first**, not 3 native codebases | Gets you installable-on-phone behaviour without building/maintaining iOS+Android+Web separately on day 1. Revisit React Native only once you specifically need app-store presence/push notifications at OS level. |
| Primary database | **PostgreSQL** | Open-source (no per-core licensing at scale like SQL Server), excellent native Row-Level Security — a natural fit for the multi-tenant isolation model in §3. |
| Cache/session | Redis | |
| Message broker | RabbitMQ (self-host) or Azure Service Bus (managed) | See §5 |
| API Gateway | YARP | Native to .NET, avoids a third-party gateway product |
| Auth/Identity | OpenID Connect via Duende IdentityServer or Azure Entra External ID | RBAC roles: doctor, receptionist, pharmacist, clinic-admin, platform-admin |
| File storage (scans, lab images) | S3-compatible object storage (Azure Blob / AWS S3 / self-hosted MinIO) | |
| Containers | Docker + Azure Container Apps to start (lighter ops than raw Kubernetes); migrate to AKS/K8s only once scale demands it | |
| CI/CD | GitHub Actions | |
| Payments | **Razorpay** (India) + **Stripe** (international) | Both built behind one `IPaymentProvider` interface from day 1 — see §3.3. Razorpay: native UPI Autopay (up to ₹1,00,000/transaction), handles GST/TDS certificates. |
| WhatsApp | Meta Cloud API direct, or a BSP (Gupshup/Interakt/AiSensy) | See cost note in §10 |

---

## 7. Requirement → Module Map

| Your requirement | Module | Notes |
|---|---|---|
| WhatsApp automation | Notification & Automation service | Confirmations, reminders, rebooking nudges |
| CRM appointment (any device) | Appointments module + responsive PWA | |
| Registration | Patient Management module | |
| History | Patient Management module | Demographics + visit history |
| Treatment history + record | Clinical/EMR module | |
| Payment related, all | Billing & Payments module | Razorpay/Stripe integration |
| *Insurance/TPA claims (gap surfaced by Healthray, §1.1 — not in original list)* | Billing & Payments module | Claim submission/tracking workflow — expected by hospitals even though not originally requested |
| Lab records | Lab module | Optional ABDM/FHIR exchange with external labs |
| Follow-up reminder | Notification module | Rules engine, e.g. "14 days post-visit, no rebooking → remind" |
| Stock — dead / consumable / usable | Inventory module | Three explicit stock states + ageing reports |
| Wishlist (equipment/goals/expansion ideas the doctor wants to flag) | Ops/Admin module | Lightweight internal tracker — item, category (task/goal/equipment/expansion), status, notes. Can reuse the same underlying "tasks" data shape as follow-up reminders. |
| ITR monthly (auditing to ease tax filing) | Finance/Accounting module | Bigger than a report — needs a real categorised income/expense ledger with monthly closing, sitting alongside Billing, that an accountant can use directly for ITR filing. |
| Pharmacy billing + stock | Pharmacy module | Schedule H/H1/NDPS registers, FEFO expiry, GST invoicing — only activated for tenants who opt into pharmacy |
| AI integration | AI/ML service | See §8 |

---

## 8. Where AI Actually Fits (with the CDSCO guardrail from §2)

**Bucket A — ship in v1, no medical-device licence needed (administrative, not diagnostic):**
- WhatsApp AI chatbot for booking/rescheduling/FAQs
- No-show prediction → smarter reminder timing
- OCR to digitise handwritten prescriptions/lab reports into structured data
- Ambient scribe: voice-to-text of the consultation for the doctor to review and approve (transcription, not interpretation)
- Demand forecasting for pharmacy/consumable reordering, paired with direct distributor reorder requests (ERP-to-ERP idea borrowed from Marg, §1.1)
- Substitute-medicine lookup during OCR/e-prescription digitisation (idea from Marg's drug database, §1.1)
- Billing-anomaly / revenue-leakage detection
- Natural-language search across records ("diabetic patients overdue for follow-up")

**Bucket B — needs CDSCO SaMD licensing first, treat as a later phase:**
- Differential-diagnosis suggestions, AI risk scoring shown as clinical guidance, image-based screening

Keep v1 firmly in Bucket A. It's still a strong AI story for sales, without taking on regulatory approval timelines before you've validated the core product.

---

## 9. Enterprise-Grade Non-Functionals

- Consent tracking + full audit trail on every access to patient data (DPDP requirement, not just good practice)
- Encryption at rest and in transit; RBAC at the module level
- Defined backup/DR targets (RPO/RTO) before first paying customer
- Hindi + regional language support on billing/pharmacy screens (recurring theme in the Indian pharmacy-software market)
- Pharmacy billing needs to tolerate a dropped connection at the counter (offline-first billing, sync on reconnect)
- Uptime target: 99.9% on the appointment-booking path specifically — that's the feature that loses you a customer fastest if it's down

---

## 10. Cost Categories for the Real Cost Sheet (indicative — confirm before quoting anyone)

| Category | Driver | Indicative figures found in research |
|---|---|---|
| WhatsApp | Meta's own per-message rate (India) | ~₹0.115 per utility/auth message, ~₹0.86–0.99 per marketing message, **plus** a BSP platform fee from ₹0 (direct Meta API) to ₹25,000+/month depending on provider/tier. Rates and billing model (per-message vs per-conversation) have shifted more than once in the last year — re-verify at implementation time. |
| Payments | Razorpay | ~2% per transaction domestically; UPI under ₹2,000 is 0% (NPCI MDR waiver); handles GST/TDS paperwork for you. |
| Cloud infra | Tenant count, data volume, storage of scans/images | Depends on hosting choice (Azure Container Apps vs AKS vs bare VMs) — needs your input on expected tenant count in year 1. |
| ABDM integration | Mostly free government infrastructure | Dev time to integrate, offset by DHIS incentive (up to ₹4L/facility) you can pass through or share with customers. |
| CDSCO licensing | Track 3 (§3.2) — process starts in parallel with Phase 2 engineering, not after | One-time classification + application cost, scales with risk class (A–D). |
| Dev team | In-house vs contract, location | Needs your input — you said you'll share cost/pricing separately, this is the placeholder structure to fill in. |

---

## 11. Phased Roadmap

**Reality check, updated:** a second region and a licensing track are genuinely more scope than the original list, not less. Phase 1 still needs to be tight enough for two people to ship it. Framed against the tracks in §3.2:

- **Phase 1 — Track 1 (CRM + Billing), India adapter:** Patients/Registration, Appointments (any device), Treatment/EMR, Billing, WhatsApp reminders, Wishlist tracker. Deployment Tiers 1–2 only (§3.1). Enough to replace a paper register and land a paying India pilot.
- **Phase 1b — Track 1, UAE adapter (parallel, MVP depth):** same feature set, `IPaymentProvider`/`IComplianceProvider` swapped for the UAE implementations (§3.3). Functionally correct first, fully localised later.
- **Phase 2 — Track 2 (Pharmacy + Billing), India first:** Schedule H/H1/NDPS registers, POS billing on the shared Billing module, Inventory (all 3 stock states), Lab module, Insurance/TPA claims workflow (§1.1 gap). International pharmacy compliance is a separate research task once needed.
- **Phase 3 — Track 3 process starts in parallel with Phase 2 engineering, not after:** begin the CDSCO SaMD licensing process now so it isn't the bottleneck later; Bucket B AI built behind a feature flag, dormant until licensed. Also: ABDM/ABHA integration, ITR/accounting ledger polish, remaining Bucket A AI.
- **Phase 4:** Dedicated-Instance tenancy (§3.1 Tier 3) for the first hospital that demands it; activate Track 3 once the CDSCO licence is granted, plus the equivalent regulatory pathway internationally if Track 3 sells there too.
- **Phase 5 — Track 4 (IPD):** bed/ward management, admission & discharge, nursing charting. Deliberately last — real net-new scope, only worth building once hospital-tier demand (and the team) is there to support it. India first; international IPD compliance is a fresh research task when it comes up.

---

## 12. Resolved vs. Still Open

**Resolved (10 Aug 2026):** tenancy tiers (§3.1), product packaging into 4 tracks including IPD as an explicit later phase (§3.2), dual-region build via adapters with UAE as first international market (§3.3), UAE regulatory floor (§2), Wishlist/ITR scope (§7), team size (2 founders, drives §11), architecture confirmed as modular monolith not microservices (§4).

**Still open:**
1. Rough budget for cloud infra and third-party tools (WhatsApp BSP, Razorpay/Stripe/Telr), so §10's ranges can become real numbers.

Once this is locked, next deliverables are: **PRD** (personas, feature prioritisation, success metrics — scoped per track) → **FRD** (functional spec, Track 1 India + UAE adapter first per §11) → **TRD** (API contracts, DB schema, deployment architecture).

---

### Key sources
- Practo Ray / competitor positioning: practo.com, softwaresuggest.com, medisray.com, medkyo.com
- DPDP Act 2023 & healthcare: securityboulevard.com, dpdpa.com, amlegals.com, ksandk.com
- ABDM/ABHA: adrine.in, cliniqwise.com, caladriushealth.ai
- CDSCO SaMD guidance: cyrilamarchandblogs.com, qualio.com, medicalbuyer.co.in
- .NET 10: devblogs.microsoft.com, dev.to (ismcagdas)
- React 19: react.dev/versions, scrimba.com
- WhatsApp API pricing: richautomate.in, whautomate.com, codingclave.com
- Razorpay/payments: razorpay.com, triggerall.com
- Pharmacy Schedule H compliance: quantbit.io, vyaparapp.in
- UAE PDPL & health data: cookieyes.com, eshieldconsulting.com, almaazmilawyers.com
- UAE data residency: element8.ae, freit.io, decipherzone.com
- UAE SaMD/EDE: ibanet.org, muhami.ae, meddeviceguide.com
- UAE payment gateways: jsb.ae, skimbox.us
