# Open Questions & Legal/Tax Compliance Register

This register documents legal, tax, licensing, and regulatory decisions, assumptions made, safest defaults adopted, and items pending formal legal/CA counsel review.

---

## 1. Drug Master Data Licensing (CDCI vs. TrueMD)

### Background
The drug master database supports doctor prescription search, generic autocomplete, brand mapping, and in-house pharmacy dispensing. Two open/external sources were initially referenced in preliminary requirements:
1. **CDCI (Common Drug Codes for India)**
2. **TrueMD**

### Findings & Audit
1. **Common Drug Codes for India (CDCI)**:
   - **Origin & Authority**: Produced by National Resource Centre for EHR Standards (NRCeS) at Centre for Development of Advanced Computing (C-DAC), Pune (Government of India).
   - **License**: Creative Commons Attribution 4.0 International Public License ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
   - **Rights**: Permitted for redistribution within India and creation of derivative works and implementation-related products/services in India.
   - **Attribution & Restrictions**: Contains identifiers from SNOMED CT International Release under SNOMED CT Affiliate terms. Brand/trade names remain copyright of their respective owners. C-DAC provides no warranty of fitness or completeness.
   - **Status**: **APPROVED & IN USE** (`Medicine/CommonDrugCodesForIndia_FlatFilePackage`).

2. **TrueMD**:
   - **Origin**: Third-party commercial API / scraped Indian pharmacy medicine database.
   - **License & Provenance**: The TrueMD project and its public API endpoints are discontinued and abandonware; no explicit open-source license grant (MIT, Apache, or CC) exists for redistributed datasets.
   - **Safest Default Taken**: **DROPPED ENTIRELY**.
   - **Remediation**: All code references and prospective data dependencies on TrueMD have been excised. The application relies exclusively on verified in-house `HospitalMaster` entries and official Government of India open-source `CDCI` data.

---

## 2. Notification 12/2017 & GST on Combined Healthcare/Pharmacy Bills

### Decision
Health care services by a clinical establishment or an authorised medical practitioner are GST-exempt under Notification No. 12/2017 - Central Tax (Rate). Pharmacy drug sales are taxable supplies subject to reverse GST calculation from printed MRP (HSN `3004xxxx` at 5%, 12%, or 18%).
- **Default Adopted**: Consultation and medical services remain on the `INV` series (exempt Bill of Supply), while counter drug dispensing produces an independent, non-merged `PHARM` tax invoice linked via `LinkedPharmacyInvoiceId`. Neither document compromises the tax exemption of the other.
