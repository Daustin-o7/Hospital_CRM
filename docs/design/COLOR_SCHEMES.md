# Hospital CRM — Design System Palettes & Typography

This document records the saved color schemes and typography standards for **SamStack Hospital CRM**.

---

## 1. Saved Color Scheme: Luxury Clinical Forest Sage

Extracted and calibrated from the premium clinical design specification:

| Swatch | Hex Code | RGB | Role / Usage in Hospital CRM |
|---|---|---|---|
| ![#0F1F17](https://via.placeholder.com/16/0F1F17/0F1F17.png) **Forest Obsidian** | `#0F1F17` | `rgb(15, 31, 23)` | Deepest background canvas, dark mode root surface, high-emphasis text, primary active states |
| ![#1E3A2E](https://via.placeholder.com/16/1E3A2E/1E3A2E.png) **Pine Spruce** | `#1E3A2E` | `rgb(30, 58, 46)` | Primary clinical brand color, primary CTA buttons (`.btn-primary`), navigation accents |
| ![#3E5A3F](https://via.placeholder.com/16/3E5A3F/3E5A3F.png) **Muted Botanical Olive** | `#3E5A3F` | `rgb(62, 90, 63)` | Secondary action buttons, active tab indicators, medical specialty badges |
| ![#6B7F67](https://via.placeholder.com/16/6B7F67/6B7F67.png) **Earthy Moss Sage** | `#6B7F67` | `rgb(107, 127, 103)` | Muted secondary text, subtle outline borders, telemetry labels, timeline markers |
| ![#C7CBB8](https://via.placeholder.com/16/C7CBB8/C7CBB8.png) **Soft Alabaster Stone** | `#C7CBB8` | `rgb(199, 203, 184)` | Subtle hairline borders (`--color-border`), card background tints, neutral dividers |
| ![#3D4337](https://via.placeholder.com/16/3D4337/3D4337.png) **Charcoal Olive Slate** | `#3D4337` | `rgb(61, 67, 55)` | Body text secondary, form input labels, table column headers, high-contrast readability |

### CSS Custom Properties
```css
:root {
  --palette-forest-950: #0F1F17; /* Deep Forest Obsidian */
  --palette-forest-900: #1E3A2E; /* Pine Spruce Primary */
  --palette-forest-700: #3E5A3F; /* Muted Botanical Olive */
  --palette-forest-500: #6B7F67; /* Earthy Moss Sage */
  --palette-forest-200: #C7CBB8; /* Soft Alabaster Stone */
  --palette-forest-800: #3D4337; /* Charcoal Olive Slate */
}

/* Optional full theme activation */
[data-theme="forest-sage"],
.theme-forest-sage {
  --brand-primary:       #1E3A2E;
  --brand-primary-hover: #0F1F17;
  --brand-primary-10:    rgba(30, 58, 46, 0.08);
  --brand-primary-20:    rgba(30, 58, 46, 0.18);
  --brand-secondary:     #3E5A3F;
  --brand-accent:        #6B7F67;
  --color-bg:            #F5F6F2;
  --color-surface:       #ffffff;
  --color-surface-raised:#ECEEE6;
  --color-surface-hover: #E3E6DC;
  --color-border:        #C7CBB8;
  --color-border-subtle: #DCDFD2;
  --color-text:          #0F1F17;
  --color-text-secondary:#3D4337;
  --color-text-muted:    #6B7F67;
}
```

---

## 2. Official Typography Standard: Plus Jakarta Sans + Inter

- **Display & Headings (`--font-heading`, `--font-display`)**: **Plus Jakarta Sans** (Weights 600, 700, 800)
  - Geometric, warm, distinctive, authoritative heading presence for clinical modules.
- **Body, UI Controls, Forms & Data Tables (`--font-sans`)**: **Inter** (Weights 400, 500, 600)
  - Exceptional micro-legibility, tall x-height, disambiguated glyphs (1, l, I), tabular numbers for billing and dosage amounts.
- **Telemetry, Hashes & Codes (`--font-mono`)**: **JetBrains Mono** (Weights 400, 500, 700)
  - Monospace fidelity for UHIDs, RX QR codes, digital signature hashes, batch numbers, and ICD-10 codes.

### SIL OFL 1.1 Legal Compliance
- Both fonts are licensed under the SIL Open Font License (OFL) 1.1.
- License files located at:
  - `licenses/OFL-PlusJakartaSans.txt`
  - `licenses/OFL-Inter.txt`
- Full asset register and notice in `THIRD-PARTY-NOTICES.md`.
- ₹0 commercial licensing fees, 100% royalty-free for SaaS subscription models.

