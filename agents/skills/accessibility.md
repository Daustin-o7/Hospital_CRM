# Engineering Skill: Accessibility & Front-Desk Usability (`skills/accessibility.md`)

This document defines WCAG 2.1 AA accessibility standards, high-contrast UI guidelines, touch target sizing, keyboard navigation, and front-desk usability practices for SAMSTACK AI.

---

## Purpose

To ensure the SAMSTACK AI PWA interface is accessible, usable, and fatigue-free for clinic front-desk staff operating under fast-paced walk-in conditions and doctors on mobile/tablet devices.

---

## Scope

Applies to all React 19 frontend UI components, form controls, queue displays, color systems, typography, aria attributes, and keyboard interaction patterns.

---

## Verified Information

- **NFR Target**: WCAG 2.1 AA Compliance (§14 NFR table).
- **Target Device Reality**: Front-desk smartphones, tablets, and low-cost desktop monitors.
- **Operational Reality**: High-volume, fast-paced walk-in environments requiring low cognitive friction and high contrast.

---

## Implementation Details

### 1. Touch Target & Spacing Rules
- Minimum touch target size for interactive buttons, inputs, and queue tokens: **44px × 44px**.
- High visual separation between "Check In", "Cancel", and "Reschedule" actions to prevent mis-clicks.

### 2. High Contrast & Typography Standards
- Color contrast ratio for text elements against background MUST meet minimum **4.5:1** for standard text and **3:1** for large text / UI controls.
- Typography: Use legible sans-serif font stack (Inter, Roboto, system-ui). Base font size minimum **16px** to prevent automatic browser zoom on mobile input focus.

```css
/* Accessibility root token standards */
:root {
  --font-base: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-base: 1rem; /* 16px */
  --touch-target-min: 44px;
  --color-text-main: #0f172a; /* Slate 900 */
  --color-bg-main: #ffffff;
  --color-focus-ring: #2563eb; /* Accessible Blue */
}

button, input, select {
  min-height: var(--touch-target-min);
  min-width: var(--touch-target-min);
  font-size: var(--font-size-base);
}

:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

### 3. Keyboard & Screen Reader Accessibility
- All interactive controls MUST be reachable and operable via Keyboard (`Tab`, `Enter`, `Space`).
- Modals and queue dropdowns MUST trap focus when open and restore focus when closed.
- Form controls MUST include explicit `<label htmlFor="...">` bindings or `aria-label` attributes.

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=682) — WCAG 2.1 AA NFR

---

## Dependencies

- Native HTML5 Semantic Elements (`<main>`, `<nav>`, `<header>`, `<article>`, `<button>`)
- WAI-ARIA 1.2 specification

---

## Risks

- **Color-Only State Indicators**: Using red/green dots alone to indicate appointment status without text labels or icons (violates WCAG 1.4.1).
- **Small Click Targets on Tablets**: Creating tiny action icons that cause accidental cancellations during fast-paced queue check-ins.

---

## Future Improvements

- Automated accessibility testing integration using `@axe-core/react` during frontend component unit tests.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Screen reader software testing suite choice (NVDA vs VoiceOver) for compliance validation.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=682)
