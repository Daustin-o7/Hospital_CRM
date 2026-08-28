---
name: frontend-design
description: Anti-slop frontend design skill for Hospital_CRM. Synthesises taste-skill (anti-generic UI), Vercel Web Interface Guidelines (interactions, accessibility, performance), and awesome-design-skills (visual craft). Activate whenever editing any .tsx, .css, or UI file in the frontend directory. Works identically in Antigravity and OpenCode.
---

# Frontend Design Skill — Hospital CRM

> **When to activate**: Auto-load for every frontend file edit (`.tsx`, `.css`, `.html`, `vite.config.ts`).
> **Priority**: Overrides generic styling defaults. Subordinate only to `AGENTS.md` project rules.

---

## SOURCES & CONFLICT RESOLUTION

This skill distils three sources. Where they conflict, the resolution is listed:

| Source | Role | Conflict rule |
|---|---|---|
| **taste-skill** (Leonxlnx) | Anti-generic UI aesthetic — layout, typography, motion, spacing | Visual taste wins over generic Tailwind defaults |
| **Vercel Web Interface Guidelines** | Interaction quality, accessibility, loading states, performance | Interaction correctness is non-negotiable — always apply |
| **awesome-design-skills** | Visual craft vocabulary — hierarchy, contrast, rhythm, whitespace | Used to audit & elevate any design before shipping |

**Resolved conflicts:**
- Taste-skill favours dark/glass aesthetics; the project uses **light theme** (user-specified). Apply taste-skill's *layout and typography rigour* to the light palette.
- Vercel says "no `maximum-scale=1`" to respect user zoom — keep viewport without zoom-lock.
- Awesome-design-skills calls for clear hierarchy contrast — combine with Vercel's 4.5:1 WCAG contrast minimum.

---

## PART 1: TASTE — STOP THE SLOP

### Forbidden Patterns (never generate these)
- Generic Tailwind card: `rounded-lg shadow p-4 bg-white` — too plain
- Arial/sans-serif without a declared custom font
- All-caps labels as the only visual hierarchy device
- Plain grey placeholder boxes — use real data or a skeleton with motion
- Rainbow icon colours — stick to a 2-colour icon palette (primary + muted)
- Gradient text that spans the entire page width without restraint
- Hover: `opacity-50` — always prefer a purposeful state change
- Full-width solid-colour buttons with no depth or feedback
- Tables with `border` on every cell — use row separators only

### Required Taste Rules
1. **One signature colour per surface** — teal (#0d9488) is the accent; slate (#1e293b) is text. Nothing else.
2. **Three font sizes max per component** — label (0.7rem), body (0.875rem), heading (1.1–1.5rem).
3. **Spacing in 4px increments** — gap-1 (4px), gap-2 (8px), gap-4 (16px), gap-6 (24px), gap-8 (32px).
4. **Micro-animation on every interactive element** — 150ms ease for hover, 200ms ease for state changes.
5. **Borders are hairlines** — 1px solid #e2e8f0; never 2px+.
6. **Icons are monochrome** — currentColor only; 16–18px for inline, 20px for nav.
7. **Empty states are designed** — never a blank area; always a short message + optional CTA.
8. **Data density over decoration** — if there's an animation, it must communicate status or guide attention.

---

## PART 2: VERCEL INTERACTION QUALITY

Apply every rule below without exception:

### Interactions
- All flows are keyboard-operable (Tab, Enter, Escape, Arrow keys).
- Every focusable element shows a `:focus-visible` ring (2px solid #0d9488, 2px offset).
- Touch targets ≥ 44px on mobile, ≥ 24px on desktop.
- Input font-size ≥ 16px (prevents iOS Safari zoom).
- Never disable `paste` in `<input>` or `<textarea>`.
- Loading buttons: show spinner + keep original label (e.g. "Saving…").
- Loading delay: 150ms show-delay, 300ms minimum visible time to avoid flicker.
- Optimistic UI: update immediately, rollback + show toast on failure.
- Confirm all destructive actions (delete, clear, cancel) — modal or undo toast.
- `touch-action: manipulation` on all buttons and interactive elements.

### Animations
- Use `prefers-reduced-motion` — wrap all animations with the media query.
- Duration: 100–250ms for micro-interactions; 300–400ms for page transitions.
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (Material ease-in-out).
- Never animate layout properties (width, height, top, left) — only transform + opacity.
- Animations serve communication: loading, state change, error, success.

### Layout
- Single column on mobile (< 640px); sidebar layout on desktop (≥ 1024px).
- Sidebar width: 256px (fixed). Content max-width: 1280px centred.
- Section spacing: 32px between modules (gap-8).
- Form fields: full-width, label above, error below.
- Sticky headers must not cover focused elements (z-index hierarchy enforced).
- No orphan text — `text-wrap: balance` on headings; `text-wrap: pretty` on paragraphs.

### Content
- Sentence case for all labels (not ALL CAPS or Title Case for body text).
- Verbs for actions: "Save patient", not "Submit".
- Ellipsis for in-progress states: "Saving…", "Loading…".
- Empty values: dash (`—`) never blank.
- Dates: DD MMM YYYY format (28 Aug 2026). Relative for < 7 days ("3 days ago").
- Numbers: Indian locale (`en-IN`) for currency (₹1,23,456).

### Performance
- Images: `loading="lazy"`, explicit `width` + `height`, WebP.
- No layout shift on load — reserve space for async content with skeletons.
- Bundle: no library for utility that fits in < 5 lines of vanilla JS/CSS.
- Fonts: `font-display: swap`, preconnect to Google Fonts.

---

## PART 3: VISUAL CRAFT VOCABULARY

Audit every component against this checklist before shipping:

| Craft principle | Check |
|---|---|
| **Hierarchy** | Is the most important thing visually loudest? One clear focal point per card |
| **Contrast** | Text/background ≥ 4.5:1 (WCAG AA). Use Colour Contrast Checker |
| **Rhythm** | Consistent spacing — same gap pattern repeated, not arbitrary px values |
| **Whitespace** | Does removing 20% of the content make the layout look broken? If not, add more space |
| **Alignment** | All elements snap to a grid; nothing floats arbitrarily |
| **Consistency** | Same component, same visual treatment everywhere (button size, icon size, label style) |
| **Restraint** | ≤ 3 decorative elements per page section; no gradients on gradients |
| **Motion** | Exactly one element moves at a time per user action |

---

## PART 4: HOSPITAL CRM DESIGN SYSTEM

### Colour Tokens
```css
--color-surface:    #ffffff       /* card backgrounds */
--color-base:       #f8fafc       /* page background */
--color-border:     #e2e8f0       /* hairline borders */
--color-text:       #1e293b       /* primary text */
--color-text-muted: #64748b       /* secondary text */
--color-accent:     #0d9488       /* teal — primary action */
--color-accent-hover: #0f766e    /* teal dark */
--color-accent-bg:  #f0fdfa       /* teal surface */
--color-danger:     #be123c       /* destructive */
--color-success:    #15803d       /* positive status */
--color-warning:    #b45309       /* caution */
```

### Typography Scale
```
Page title:    Outfit 24px/700  text-slate-900
Section head:  Outfit 18px/700  text-slate-800
Card title:    Outfit 15px/600  text-slate-800
Body:          Plus Jakarta Sans 14px/400  text-slate-700
Label:         Plus Jakarta Sans 11px/700 uppercase letter-spacing-wide text-slate-500
Mono (IDs):    JetBrains Mono 13px  text-slate-600
```

### Spacing System
Use multiples of 4px exclusively:
`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px`
In Tailwind: `p-1 p-2 p-3 p-4 p-6 p-8 p-12 p-16`

### Component Patterns

**Cards** — white surface, 1px slate-200 border, 12px radius, 8px soft shadow:
```css
background: #fff;
border: 1px solid #e2e8f0;
border-radius: 12px;
box-shadow: 0 1px 4px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
```

**Primary Button** — teal gradient, 12px radius, 600 weight, 150ms hover:
```css
background: linear-gradient(135deg, #0d9488, #0891b2);
border-radius: 10px; padding: 10px 20px;
font-size: 14px; font-weight: 600; color: #fff;
transition: all 150ms ease;
```
Hover: translateY(-1px) + deeper shadow. Disabled: opacity 0.55.

**Form Inputs** — white bg, slate-200 border, teal focus ring:
```css
background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
padding: 8px 12px; font-size: 14px; /* ≥ 16px on mobile */
transition: border-color 150ms, box-shadow 150ms;
```
Focus: `border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,.15)`

**Status Badges** — pill shape, coloured bg, same-family border, 700 weight:
- Scheduled: blue-50 bg, blue-200 border, blue-700 text
- Completed: green-50 bg, green-200 border, green-700 text
- Cancelled: rose-50 bg, rose-200 border, rose-700 text
- Pending: amber-50 bg, amber-200 border, amber-700 text

**Table Rows** — no vertical dividers; horizontal hairlines only; hover: slate-50 bg:
```css
th: bg-slate-50, 11px/700/uppercase/slate-500, 12px 20px padding
td: 14px/slate-700, 14px 20px padding, border-bottom: 1px solid #f1f5f9
tr:hover td: background: #f8fafc
```

**Navigation (Sidebar)** — active item: teal-50 bg, teal-700 text, teal-200 border, 600 weight.
Inactive: slate-600 text, hover: slate-50 bg.

**Skeleton Loaders** — animate shimmer (background-position sweep) not pulse:
```css
@keyframes shimmer {
  from { background-position: -200% 0 }
  to { background-position: 200% 0 }
}
background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
background-size: 200% 100%;
animation: shimmer 1.4s infinite;
```

---

## PART 5: PAGE-SPECIFIC PATTERNS

### Dashboard
- KPI stat cards: large number (32px/700), trend indicator (arrow + colour), subtitle label.
- Activity feed: timeline with left border + dot marker.
- Charts: only if data warrants — no decorative charts.

### Patient List
- Search bar is always visible (sticky), not hidden behind a filter button.
- Patient row: avatar initial + name + ID + phone + last-visit date.
- Row click navigates to patient detail; no separate "View" button.

### Appointments
- Date column: relative for upcoming (e.g. "Tomorrow, 10:30 AM"), absolute for past.
- Status chip on every row.
- "New Appointment" button: top-right, always visible.

### Consultations
- Split-pane on desktop: patient context left, notes editor right.
- Version history badge on saved notes.

### Billing
- Invoice total: large, prominent.
- GST breakdown: collapsible.
- Payment status: coloured pill.

### Login
- Centred card on a soft gradient background (not solid colour).
- No decorative images unless medically relevant.
- Role preset buttons are secondary style, clearly labelled.

---

## PART 6: ANTI-PATTERNS CHECKLIST

Before submitting any frontend diff, verify none of these exist:

- [ ] Hardcoded hex colours not in the token list above
- [ ] Font sizes that aren't in the typography scale
- [ ] `transition: all` — always specify which property
- [ ] Animations that move layout (width/height/top/left)
- [ ] Missing `aria-label` on icon-only buttons
- [ ] `console.log` left in production code
- [ ] Empty states that show nothing
- [ ] Hover state that's just `opacity-75`
- [ ] `z-index` values over 100 without a comment
- [ ] Inline styles when a CSS class exists
- [ ] Missing `:focus-visible` ring on interactive elements
- [ ] Contrast ratio < 4.5:1 for body text
- [ ] Input `font-size` < 16px on mobile
- [ ] Generic gradient: `from-blue-500 to-purple-500`

---

## PART 7: AGENT WORKFLOW

When asked to edit any frontend file:

1. **Read** the component first — understand what it renders before changing it.
2. **Check** the anti-patterns list above.
3. **Apply** the design system tokens (Part 4) — no raw colours.
4. **Test the Vercel checklist** (Part 2) — focus, touch targets, loading states.
5. **Apply taste** (Part 1) — is the result distinct, not generic?
6. **Run** `npm run build` after changes to confirm TypeScript compiles.

---

*Sources: [taste-skill](https://github.com/Leonxlnx/taste-skill) · [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) · [awesome-design-skills](https://github.com/bergside/awesome-design-skills)*
