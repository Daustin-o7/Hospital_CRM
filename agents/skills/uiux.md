# Engineering Skill: UI/UX Design System & Fast Onboarding (`skills/uiux.md`)

This document defines UI/UX design rules, visual aesthetics, component styles, onboarding friction mitigation, and queue interface standards for SAMSTACK AI.

---

## Purpose

To guide the creation of a stunning, modern, responsive PWA interface that wows clinic owners while keeping operational friction so low that staff require zero formal training.

---

## Scope

Applies to all visual design tokens, layout components, forms, queue displays, color palettes, micro-animations, typography, and onboarding user flows in the frontend.

---

## Verified Information

- **Design Philosophy**: High visual quality combined with ultra-low cognitive friction.
- **Key Onboarding Principle**: Survey evidence (samstack-ai-survey-analysis-v2) surfaced "fear of training" as a primary objection. Onboarding must be fast in reality and look fast in the pitch.
- **Registration Friction Constraint**: Patient registration (FR-06) MUST complete with max 3 required fields (Name, Phone, DOB/Age).
- **Styling Architecture**: Vanilla CSS with custom properties. High-contrast slate/blue healthcare palette, smooth subtle micro-interactions, responsive grid/flexbox layouts.

---

## Implementation Details

### 1. Palette & Design Tokens
Avoid generic browser colors (plain red, plain blue). Use curated, harmonious healthcare-tailored palettes:

```css
:root {
  /* Surface & Background */
  --bg-app: #f8fafc;        /* Slate 50 */
  --bg-surface: #ffffff;
  --bg-surface-hover: #f1f5f9;

  /* Brand Primary */
  --primary-50: #eff6ff;
  --primary-500: #3b82f6;
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;

  /* Clinical Status Tokens */
  --status-booked-bg: #e0f2fe;     /* Light Blue */
  --status-booked-fg: #0369a1;
  --status-checkedin-bg: #dcfce7;  /* Light Green */
  --status-checkedin-fg: #15803d;
  --status-completed-bg: #f3e8ff;  /* Light Purple */
  --status-completed-fg: #6b21a8;
  --status-cancelled-bg: #fee2e2;  /* Light Red */
  --status-cancelled-fg: #b91c1c;

  /* Elevation & Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

### 2. Daily Queue Display Design (FR-11, FR-12)
- **Token Highlight**: Current active checked-in token displayed in large, bold numbers (`font-size: 2.5rem`) so front-desk staff can see room state at a glance.
- **Action Buttons**: Quick single-tap "Check In", "Start Consultation", and "Bill Invoice" triggers.

### 3. Patient Consultation View Design (FR-14, FR-15, FR-16)
- **Tabbed Layout**: Clear separation between Chief Complaint / Diagnosis (FR-14), Prescription Form (FR-15), and Timeline History (FR-16).
- **Version Badges**: Amended notes MUST carry a visible pill badge: `Amended v2 (25 Aug 2026)` with expandable previous version history.

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=60-66) — Onboarding design principle
- [`docs/samstack-ai-survey-analysis-v2.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-survey-analysis-v2.md) — Survey evidence on training fear

---

## Dependencies

- Google Fonts (Inter / Roboto)
- Native CSS Custom Properties

---

## Risks

- **Form Bloat**: Adding 10 required fields to registration, re-introducing the "fear of training" onboarding friction.
- **Cluttered Visuals**: Overcrowding the daily queue monitor view with unnecessary clinical metadata that receptionists do not need.

---

## Future Improvements

- Dark mode palette tokens (`--bg-app: #0f172a`) for night-shift emergency OPD views.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Brand primary accent color confirmation for SAMSTACK logo integration.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=60-66)
- [`docs/samstack-ai-survey-analysis-v2.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-survey-analysis-v2.md)
