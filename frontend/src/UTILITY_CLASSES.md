# Project Crystal Utility Classes

## Layout Utilities

### Flexbox
```css
.flex-center /* display: flex; align-items: center; justify-content: center; */
.flex-between /* display: flex; align-items: center; justify-content: space-between; */
```

### Spacing
```css
.mx-auto /* margin-left: auto; margin-right: auto; */
.my-auto /* margin-top: auto; margin-bottom: auto; */
```

## Typography Utilities

### Font Families
```css
.font-sans /* --font-sans */
.font-mono /* --font-mono */
.font-display /* --font-display */
```

### Text Truncation
```css
.text-truncate /* Single line text truncation */
.text-truncate-2 /* Two line text truncation */
```

## Focus Utilities

```css
.focus-ring /* Focus ring styling */
```

## Animation Utilities

```css
.animate-fade-in /* Fade in animation */
.animate-slide-up /* Slide up animation */
.animate-scale-in /* Scale in animation */
```

## Scrollbar Utilities

```css
.scrollbar-hide /* Hide scrollbars */
```

## Theme Utilities

```css
.theme-toggle /* Theme toggle switch */
```

## Component Utilities

### Cards
```css
.card /* Base card styling */
.card-hover /* Card with hover state */
.card-interactive /* Interactive card */
```

### Buttons
```css
.btn /* Base button styling */
.btn-sm /* Small button */
.btn-lg /* Large button */
.btn-primary /* Primary button */
.btn-secondary /* Secondary button */
.btn-ghost /* Ghost button */
.btn-danger /* Danger button */
```

### Inputs
```css
.input /* Base input styling */
```

### Navigation
```css
.nav-item /* Navigation item */
.nav-item-active /* Active navigation item */
```

### Badges
```css
.badge /* Base badge styling */
.badge-subtle /* Subtle badge */
.badge-brand /* Brand badge */
.badge-success /* Success badge */
.badge-warning /* Warning badge */
.badge-error /* Error badge */
```

### Dividers
```css
.divider /* Horizontal divider */
```

### Loading
```css
.skeleton /* Skeleton loading animation */
```

### Glass Effects
```css
.glass-panel /* Glass panel effect */
.glass /* Basic glass effect */
.glass-card /* Glass card effect */
.glow-border /* Glowing border effect */
.premium-card /* Premium card styling */
```

### Accessibility
```css
.skip-link /* Skip to content link */
```

### Page Structure
```css
.page-shell /* Page container with max-width */
.page-header /* Page header with flex layout */
.page-kicker /* Page kicker text */
```

## Responsive Utilities

### Breakpoints
- Mobile: `max-width: 767px`
- Tablet: `min-width: 768px` and `max-width: 1023px`
- Desktop: `min-width: 1024px`
- 4K: `min-width: 2560px`

### Mobile-specific classes
```css
.hidden-xs /* Hidden on extra small screens */
.xs\:block /* Display block on extra small screens */
.xs\:flex /* Display flex on extra small screens */
.xs\:grid /* Display grid on extra small screens */
```

## Safe Area Utilities

```css
.pb-safe /* Padding bottom safe area */
.pt-safe /* Padding top safe area */
```

## Color Utilities

All colors are defined in the design system and can be used via CSS custom properties:

```css
--bg-base
--bg-elevated
--bg-hover
--bg-active
--bg-overlay
--brand-primary
--brand-hover
--brand-subtle
--brand-soft
--brand-glow
--text-primary
--text-secondary
--text-tertiary
--text-muted
--status-success
--status-success-soft
--status-warning
--status-warning-soft
--status-error
--status-error-soft
--border-subtle
--border-strong
--border-focus
```

## Spacing Scale

```css
--space-0: 0
--space-1: 0.25rem   /* 4px */
--space-2: 0.5rem    /* 8px */
--space-3: 0.75rem   /* 12px */
--space-4: 1rem      /* 16px */
--space-5: 1.25rem   /* 20px */
--space-6: 1.5rem    /* 24px */
--space-8: 2rem      /* 32px */
--space-10: 2.5rem   /* 40px */
--space-12: 3rem     /* 48px */
--space-16: 4rem     /* 64px */
--space-20: 5rem     /* 80px */
--space-24: 6rem     /* 96px */
```

## Typography Scale

```css
--text-xs: 0.75rem    /* 12px */
--text-sm: 0.875rem   /* 14px */
--text-base: 1rem     /* 16px */
--text-lg: 1.125rem   /* 18px */
--text-xl: 1.25rem    /* 20px */
--text-2xl: 1.5rem    /* 24px */
--text-3xl: 1.875rem  /* 30px */
--text-4xl: 2.25rem   /* 36px */
--text-5xl: 3rem      /* 48px */
```