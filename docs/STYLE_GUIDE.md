# SprintPulse Style Guide

Visual and code style reference for SprintPulse, generated from the live design tokens in `app/globals.css` and usage patterns across the codebase.

---

## 1. Design Philosophy

- **Calm and trustworthy**: blues and teals convey focus and clarity for facilitation sessions.
- **Airy and generous**: spacing scale favors breathing room over density.
- **Friendly, not sharp**: rounded corners throughout (6px–20px radii), no hard edges.
- **Accessible by default**: WCAG AA contrast (≥4.5:1) on all text/background pairs, visible focus rings, reduced-motion support.
- **No CSS framework**: pure CSS custom properties (design tokens) consumed via inline `style` objects in JSX. No Tailwind, no CSS-in-JS libraries, no CSS Modules.

---

## 2. Color Palette

### Primary — Calm Blue
Gradient source: `#00c6ff → #0052d4`. Used for primary actions, links, active states, brand elements.

| Token | Hex | Typical Use |
|---|---|---|
| `--color-primary-50` | `#eef8ff` | Subtle backgrounds |
| `--color-primary-100` | `#d9efff` | Hover backgrounds |
| `--color-primary-200` | `#bce3ff` | Borders on light surfaces |
| `--color-primary-300` | `#8ed3ff` | Decorative accents |
| `--color-primary-400` | `#59b8ff` | Secondary accents |
| `--color-primary-500` | `#3396ff` | Focus ring color |
| `--color-primary-600` | `#1a75f5` | Border focus |
| `--color-primary-700` | `#145de1` | **Primary buttons, links, active tabs** |
| `--color-primary-800` | `#174bb6` | Headings, emphasis text |
| `--color-primary-900` | `#19418f` | Darkest accents |

### Secondary — Teal
Accent color for secondary actions and highlights.

| Token | Hex |
|---|---|
| `--color-secondary-50` → `900` | `#effefb` → `#0f534e` |
| Core: `--color-secondary-500` | `#08c4b0` |

### Success — Soft Green

| Token | Hex |
|---|---|
| `--color-success-50` / `100` / `300` | `#f0fdf4` / `#dcfce7` / `#86efac` (backgrounds/borders) |
| `--color-success-700` | `#15803d` (text on success banners) |

### Error — Muted Red
Intentionally muted (not harsh) for destructive actions and validation errors.

| Token | Hex |
|---|---|
| `--color-error-50` / `300` | `#fef2f2` / `#fca5a5` (backgrounds/borders) |
| `--color-error-700` | `#b91c1c` (text on error banners) |

### Warning — Soft Amber

| Token | Hex |
|---|---|
| `--color-warning-50` → `900` | `#fffbeb` → `#78350f` |

### Neutral — Cool Grey (blue-tinted)

| Token | Hex | Use |
|---|---|---|
| `--color-neutral-0` | `#ffffff` | Base white |
| `--color-neutral-50/100` | `#f8fafc` / `#f1f5f9` | Card/table backgrounds |
| `--color-neutral-200/300` | `#e2e8f0` / `#cbd5e1` | Borders |
| `--color-neutral-400/500` | `#94a3b8` / `#64748b` | Muted text |
| `--color-neutral-600` | `#475569` | Secondary text |
| `--color-neutral-900` | `#0f172a` | Primary text |

### Semantic Assignments

| Token | Maps to | Contrast |
|---|---|---|
| `--color-text-primary` | neutral-900 | 15.4:1 on white |
| `--color-text-secondary` | neutral-600 | 7.0:1 on white |
| `--color-text-muted` | neutral-500 | 4.6:1 on white |
| `--color-text-inverse` | neutral-0 | 15.4:1 on neutral-900 |
| `--color-text-on-primary` | neutral-0 | 8.6:1 on primary-700 |
| `--color-bg-primary` | neutral-0 | Cards, surfaces |
| `--color-bg-secondary` | `#f7f9fc` | Soft blue-tinted panels |
| `--color-bg-page` | `#f4f7fb` | Page background |
| `--color-bg-canvas` | neutral-200 | Poll canvas editor backdrop |
| `--color-border-default` | neutral-200 | Standard dividers |
| `--color-border-strong` | neutral-300 | Input borders |
| `--color-border-focus` | primary-600 | Focused input borders |

**Rule: always reference semantic tokens (`--color-text-primary`) over raw scale tokens (`--color-neutral-900`) when styling components.** Use the raw scale only when defining new semantic tokens.

---

## 3. Typography

**Font family**: [Inter](https://fonts.google.com/specimen/Inter) (loaded via Google Fonts in `app/layout.tsx`), falling back to system sans-serif.

```
--font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-family-mono: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', Menlo, Consolas, monospace;
```

### Scale (1.25 modular ratio)

| Token | Size | Typical Use |
|---|---|---|
| `--font-size-xs` | 12px | Metadata, timestamps |
| `--font-size-sm` | 14px | Secondary text, form hints, table cells |
| `--font-size-base` | 16px | Body text, inputs |
| `--font-size-lg` | 18px | Subheadings |
| `--font-size-xl` | 20px | Section headings (h2) |
| `--font-size-2xl` | 24px | Page/card headings (h1) |
| `--font-size-3xl` | 30px | Hero text |
| `--font-size-4xl` | 36px | Landing page hero |

### Weights & Line Heights

| Weight tokens | Value |
|---|---|
| `--font-weight-normal` | 400 |
| `--font-weight-medium` | 500 (labels) |
| `--font-weight-semibold` | 600 (headings, buttons, active tabs) |
| `--font-weight-bold` | 700 (page titles) |

| Line height tokens | Value | Use |
|---|---|---|
| `--line-height-tight` | 1.25 | Headings |
| `--line-height-normal` | 1.5 | Body default |
| `--line-height-relaxed` | 1.75 | Long-form / markdown content |

---

## 4. Spacing

4px base unit, generous scale for an airy layout:

```
--space-0: 0        --space-5: 20px     --space-12: 48px
--space-1: 4px       --space-6: 24px     --space-16: 64px
--space-2: 8px       --space-8: 32px     --space-20: 80px
--space-3: 12px      --space-10: 40px    --space-24: 96px
--space-4: 16px
```

**Common patterns**: form field gaps use `--space-4`; card padding uses `--space-6` to `--space-8`; page section spacing uses `--space-8`+.

---

## 5. Border Radius

Rounded, friendly aesthetic — never square corners on interactive elements.

| Token | Size | Use |
|---|---|---|
| `--radius-sm` | 6px | Focus outlines, inline code |
| `--radius-md` | 8px | Inputs, buttons, alert banners |
| `--radius-lg` | 12px | Cards, modals |
| `--radius-xl` | 16px | Large panels |
| `--radius-2xl` | 20px | Hero/feature cards |
| `--radius-full` | 9999px | Pills, avatars, badges |

---

## 6. Elevation (Shadows)

Shadows are tuned to be *visible* against the tinted page background (`#f4f7fb`), not pure white.

| Token | Use |
|---|---|
| `--shadow-sm` | Subtle card resting state |
| `--shadow-md` | Raised cards, dropdowns |
| `--shadow-lg` | Modals, popovers |
| `--shadow-xl` | Highest elevation (dialogs) |

---

## 7. Motion

| Token | Duration | Use |
|---|---|---|
| `--transition-fast` | 150ms ease | Hover states, button presses |
| `--transition-normal` | 250ms ease | Panel expand/collapse |
| `--transition-slow` | 350ms ease | Skip-link reveal, larger layout shifts |

Keyframes defined globally: `spin` (loading spinners), `fadeIn` (content entrance), `pulse` (live/loading indicators).

**Always respect `prefers-reduced-motion`** — the global stylesheet already disables animation/transition durations for users who request it. Don't override this in component-level styles.

---

## 8. Accessibility Standards

- **Focus rings**: 2px solid `--focus-ring-color` (primary-500), 2px offset, on every interactive element (`:focus-visible`, not `:focus`). Never remove outlines without providing an equivalent indicator.
- **Skip link**: `.skip-link` class, present in every layout, jumps to `#main-content`.
- **Screen-reader-only content**: use `.sr-only` utility class for visually hidden but accessible text.
- **Forced-colors / high-contrast mode**: `:focus-visible` falls back to `3px solid CanvasText`.
- **Contrast**: every new text/background pairing must hit ≥4.5:1 (body text) or ≥3:1 (large text ≥24px). Verify against the documented ratios in section 2.
- **Semantic roles**: alerts use `role="alert"`, status messages use `role="status"`.

---

## 9. Component Patterns

Components are plain function components using **inline `style` objects** that reference CSS variables directly — not Tailwind classes, not styled-components. Example, from `AuthForm.tsx`:

```tsx
<div
  style={{
    padding: 'var(--space-8)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--radius-lg)',
  }}
>
```

### Primary Button

```tsx
<button
  style={{
    width: '100%',
    padding: 'var(--space-3)',
    backgroundColor: 'var(--color-primary-700)',
    color: 'var(--color-text-on-primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-semibold)',
    cursor: 'pointer',
  }}
>
  Submit
</button>
```

### Text Input

```tsx
<input
  style={{
    width: '100%',
    padding: 'var(--space-3)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-base)',
  }}
/>
```

Label pattern: `display: block`, `fontWeight: var(--font-weight-medium)`, `marginBottom: var(--space-2)`.

### Alert / Banner

```tsx
<div
  role="alert"
  style={{
    padding: 'var(--space-3)',
    backgroundColor: 'var(--color-error-50)',
    border: '1px solid var(--color-error-300)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-error-700)',
    fontSize: 'var(--font-size-sm)',
    marginBottom: 'var(--space-4)',
  }}
>
  Error message
</div>
```

Swap `error` → `success` (or `warning`) token family for other states.

### Tabs (underline style)

```tsx
<button
  style={{
    flex: 1,
    padding: 'var(--space-3)',
    border: 'none',
    borderBottom: isActive ? '2px solid var(--color-primary-700)' : '2px solid transparent',
    backgroundColor: 'transparent',
    color: isActive ? 'var(--color-primary-700)' : 'var(--color-text-secondary)',
    fontWeight: 'var(--font-weight-semibold)',
    cursor: 'pointer',
  }}
>
  Tab Label
</button>
```

### Card

```tsx
<div
  style={{
    padding: 'var(--space-6)',
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
  }}
>
```

### Link / Text Button

```tsx
<button
  style={{
    background: 'none',
    border: 'none',
    color: 'var(--color-primary-700)',
    fontSize: 'var(--font-size-sm)',
    cursor: 'pointer',
  }}
>
```

---

## 10. Markdown Content Styling

Help pages (`app/help/`) render markdown via `.markdown-content`. Key rules:
- Max width 720px, centered, `line-height: relaxed`.
- `h1`: primary-800, bottom border.
- Inline `code`: neutral-100 background, `radius-sm`.
- Tables: bordered, `neutral-50` header background, horizontally scrollable on overflow.
- Blockquotes: 4px `primary-300` left border.

---

## 11. Usage Rules

1. **Never hardcode colors, spacing, or radii** — always reference the CSS variable (`var(--color-primary-700)`), even in inline styles.
2. **No new CSS frameworks.** Extend `app/globals.css` tokens rather than introducing Tailwind, CSS Modules, or styled-components.
3. **New semantic states** (e.g. a new alert type) should get a token in the existing palette family (success/error/warning) rather than an arbitrary new hue, unless a design decision explicitly calls for it.
4. **Every interactive element needs a visible `:focus-visible` state** — inherited automatically unless you override `outline`.
5. **Match existing radius/shadow pairing**: small elements (inputs, buttons, badges) → `radius-md` or smaller; containers (cards, modals) → `radius-lg`+ with a shadow.
6. **Test new color pairs for AA contrast** before shipping (target ≥4.5:1 for body text).

---

*Generated from `app/globals.css` and component usage patterns across `components/`. Source of truth for all tokens is `app/globals.css` — update there first, then reflect changes here.*
