# Project Crystal Design System

A unified design system for consistent UI/UX across the application.

## Color System

### Base Hues
- **Brand**: `--hue-brand: 260` (Blue)
- **Success**: `--hue-success: 145` (Green)
- **Warning**: `--hue-warning: 85` (Amber)
- **Error**: `--hue-error: 25` (Red)

### Dark Mode (Default)
```css
--bg-base: oklch(10% 0.005 260);        /* Deepest neutral */
--bg-elevated: oklch(14% 0.008 260);   /* Card surfaces */
--bg-hover: oklch(18% 0.01 260);       /* Hover states */
--bg-active: oklch(22% 0.012 260);     /* Active states */
--bg-overlay: oklch(12% 0.005 260 / 0.5); /* Backdrops */

--brand-primary: oklch(58% 0.12 260);
--brand-hover: oklch(52% 0.13 260);
--brand-subtle: oklch(58% 0.06 260);
--brand-soft: oklch(58% 0.03 260 / 0.1);
--brand-glow: oklch(58% 0.08 260 / 0.2);

--text-primary: oklch(95% 0.01 260);
--text-secondary: oklch(75% 0.012 260);
--text-tertiary: oklch(60% 0.01 260);
--text-muted: oklch(50% 0.008 260);
```

### Light Mode
```css
--bg-base: oklch(97% 0.005 260);        /* warm white */
--bg-elevated: oklch(100% 0 0);         /* pure white */
--bg-hover: oklch(95% 0.008 260);       /* subtle hover */
--bg-active: oklch(92% 0.01 260);       /* active state */
--bg-overlay: oklch(0% 0 0 / 0.4);     /* backdrop */

--brand-primary: oklch(55% 0.15 260);
--brand-hover: oklch(50% 0.16 260);
--brand-subtle: oklch(55% 0.06 260);
--brand-soft: oklch(55% 0.03 260 / 0.1);
--brand-glow: oklch(55% 0.08 260 / 0.2);

--text-primary: oklch(18% 0.01 260);
--text-secondary: oklch(40% 0.012 260);
--text-tertiary: oklch(55% 0.01 260);
--text-muted: oklch(65% 0.008 260);
```

## Typography

### Font Stack
```css
--font-sans: 'Geist', system-ui, -apple-system, sans-serif;
--font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, monospace;
--font-display: 'Fraunces', 'Geist', serif;
```

### Type Scale
```css
--text-xs: 0.75rem;    /* 12px - captions */
--text-sm: 0.875rem;   /* 14px - labels */
--text-base: 1rem;     /* 16px - body */
--text-lg: 1.125rem;   /* 18px - lead */
--text-xl: 1.25rem;    /* 20px - small headings */
--text-2xl: 1.5rem;    /* 24px - h4 */
--text-3xl: 1.875rem;  /* 30px - h3 */
--text-4xl: 2.25rem;   /* 36px - h2 */
--text-5xl: 3rem;      /* 48px - h1 */
```

## Spacing System (4pt Grid)
```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

## Border Radius
```css
--radius-none: 0;
--radius-sm: 0.375rem;   /* 6px */
--radius-md: 0.5rem;     /* 8px */
--radius-lg: 0.75rem;    /* 12px */
--radius-xl: 1rem;       /* 16px */
--radius-full: 9999px;   /* pills */
```

## Shadows
```css
--shadow-none: none;
--shadow-xs: 0 1px 2px oklch(0% 0 0 / 0.3);
--shadow-sm: 0 1px 3px oklch(0% 0 0 / 0.4), 0 1px 2px oklch(0% 0 0 / 0.2);
--shadow-md: 0 4px 6px -1px oklch(0% 0 0 / 0.4), 0 2px 4px -2px oklch(0% 0 0 / 0.2);
--shadow-lg: 0 10px 15px -3px oklch(0% 0 0 / 0.5), 0 4px 6px -4px oklch(0% 0 0 / 0.3);
--shadow-xl: 0 20px 25px -5px oklch(0% 0 0 / 0.6), 0 8px 10px -6px oklch(0% 0 0 / 0.4);
```

## Motion
```css
--duration-instant: 50ms;
--duration-fast: 120ms;
--duration-normal: 180ms;
--duration-slow: 260ms;
--duration-slower: 350ms;

--ease-out: cubic-bezier(0.16, 1, 0.3, 1);       /* decelerate */
--ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1); /* strong decelerate */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);     /* smooth */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* bounce */
```

## Z-Index
```css
--z-base: 0;
--z-dropdown: 50;
--z-sticky: 100;
--z-drawer: 200;
--z-modal: 300;
--z-popover: 400;
--z-tooltip: 500;
--z-toast: 600;
--z-overlay: 1000;
```

## Components

### Card
```html
<div class="card">Card content</div>
<div class="card card-hover">Interactive card</div>
<div class="card card-interactive">Interactive card</div>
```

### Button
```html
<button class="btn btn-primary">Primary</button>
<button class="btn btn-secondary">Secondary</button>
<button class="btn btn-ghost">Ghost</button>
<button class="btn btn-danger">Danger</button>

<!-- Sizes -->
<button class="btn btn-sm">Small</button>
<button class="btn">Default</button>
<button class="btn btn-lg">Large</button>
```

### Input
```html
<input class="input" type="text" placeholder="Enter text">
```

### Navigation Item
```html
<a href="#" class="nav-item">Nav Item</a>
<a href="#" class="nav-item nav-item-active">Active Nav Item</a>
```

### Badge
```html
<span class="badge badge-subtle">Subtle</span>
<span class="badge badge-brand">Brand</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-error">Error</span>
```

## Utilities

### Focus Ring
```html
<div class="focus-ring">Element with focus ring</div>
```

### Text Truncation
```html
<div class="text-truncate">Truncated text</div>
<div class="text-truncate-2">Two line truncated text</div>
```

### Animation
```html
<div class="animate-fade-in">Fade in</div>
<div class="animate-slide-up">Slide up</div>
<div class="animate-scale-in">Scale in</div>
```

## Responsive Breakpoints

- Mobile: `max-width: 767px`
- Tablet: `min-width: 768px` and `max-width: 1023px`
- Desktop: `min-width: 1024px`
- 4K: `min-width: 2560px`

## Theme Switching

The theme can be controlled with the `data-theme` attribute on the `html` element:

```html
<html data-theme="dark"> <!-- Dark theme -->
<html data-theme="light"> <!-- Light theme -->
```

JavaScript utility for theme switching is available in `src/scripts/theme-init.js`.