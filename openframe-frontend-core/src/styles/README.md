# UI Kit Styles Usage Guide

## Overview
This directory contains the complete styling system for @flamingo/ui-kit, including the ODS (Open Design System) and application-specific styles.

## File Structure

```
ui-kit/src/styles/
├── index.css              # Main entry point - imports everything
├── app-globals.css         # Application-specific global styles
├── ods-colors.css          # Color tokens and semantic aliases
├── ods-design-tokens.css   # Spacing, typography, shadows
├── ods-dynamic-theming.css # Platform-specific theme variations
├── ods-fluid-typography.css # Responsive typography system
├── ods-interaction-states.css # Hover, focus, active states
├── ods-responsive-tokens.css # Breakpoints and responsive utilities
└── README.md              # This file
```

## How to Use

### 1. Basic Import (Recommended)
Import the complete styling system in your main CSS file:

```css
/* app/globals.css or src/styles/globals.css */
@import "@flamingo/ui-kit/styles";

@tailwind base;
@tailwind components;
@tailwind utilities;
```

This single import includes:
- All ODS design tokens (colors, typography, spacing, etc.)
- Application-specific global styles (React Easy Crop, Markdown editor, etc.)
- Platform-aware theming
- Utility classes and component styles

### 2. Individual File Imports (Advanced)
If you need granular control, you can import specific files:

```css
/* Import only ODS design tokens */
@import "@flamingo/ui-kit/styles/ods-colors.css";
@import "@flamingo/ui-kit/styles/ods-design-tokens.css";
@import "@flamingo/ui-kit/styles/ods-dynamic-theming.css";

/* Import app-specific styles */
@import "@flamingo/ui-kit/styles/app-globals.css";
```

**Note**: Individual imports are not exposed in package.json exports and are for internal use only.

## What's Included

### ODS Design System
- **Colors**: Comprehensive color palette with semantic aliases
- **Typography**: Fluid responsive typography with clamp() functions
- **Spacing**: Consistent spacing tokens for margins, padding, gaps
- **Interactive States**: Hover, focus, active, disabled state definitions
- **Platform Theming**: Automatic theme switching based on `NEXT_PUBLIC_APP_TYPE`

### Application-Specific Styles
- **React Easy Crop**: Complete styling for image cropping components
- **Markdown Editor**: Dark theme styling for @uiw/react-md-editor
- **Markdown Preview**: Styled markdown rendering
- **Utility Classes**: Scrollbar hiding, mobile zoom prevention, etc.
- **Platform Body Styling**: Platform-specific body background and text colors
- **Vendor Components**: Logo containers, thumbnails, and display utilities

## Platform Support

The styles automatically adapt based on your `NEXT_PUBLIC_APP_TYPE` environment variable:

- **openmsp**: Yellow accent (#FFC008), dark theme
- **flamingo**: Pink accent (#F357BB), light theme
- **openframe**: Cyan accent (#5EFAF0), dark theme
- **flamingo-teaser**: Yellow accent (#FFC008), dark theme

## CSS Variables Available

### Color System
```css
/* Primary color system */
--color-accent-primary      /* Platform-specific accent color */
--color-bg                  /* Main background */
--color-bg-card            /* Card backgrounds */
--color-text-primary       /* Primary text color */
--color-text-secondary     /* Secondary text color */
--color-border-default     /* Default border color */

/* Status colors */
--color-success            /* Success green */
--color-error              /* Error red */
--color-warning            /* Warning amber */
--color-info               /* Info cyan */
```

### Typography

All typography is driven by CSS variables defined in `ods-design-tokens.css`. Both the Tailwind config and component styles reference these variables as a single source of truth.

#### Font Families
```css
/* Base font family tokens (defined in ods-design-tokens.css) */
--font-family-heading: "Azeret Mono", "SF Mono", Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace;
--font-family-body: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

/* Per-heading font family tokens (reference base tokens) */
--font-h1-family: var(--font-family-heading);
--font-h2-family: var(--font-family-heading);
--font-h3-family: var(--font-family-body);
--font-h4-family: var(--font-family-body);
--font-h5-family: var(--font-family-heading);
--font-h6-family: var(--font-family-heading);
```

#### Tailwind Font Family Integration
Tailwind `fontFamily` mappings reference CSS variables, not hardcoded font names:

```typescript
// tailwind.config.ts
fontFamily: {
  sans: ["var(--font-family-body)"],
  mono: ["var(--font-family-heading)"],
  body: ["var(--font-family-body)"],
  heading: ["var(--font-family-heading)"],
}
```

This means `font-sans`, `font-mono`, `font-body`, `font-heading` all resolve through CSS variables, ensuring consistency with the rest of the design system.

#### Typography Utility Classes
The `odsTypographyPlugin` in `tailwind.config.ts` provides composite typography classes that bundle font-family, weight, size, line-height, and letter-spacing:

| Class | Font | Weight | Size | Line Height | Letter Spacing |
|-------|------|--------|------|-------------|----------------|
| `text-h1` | `--font-h1-family` | `--font-h1-weight` | `--font-size-h1-title` | `--font-line-space-h1-main-title` | `-0.02em` |
| `text-h2` | `--font-h2-family` | `--font-h2-weight` | `--font-size-h2-sub-title` | `--font-line-space-h2-sub-title` | `-0.02em` |
| `text-h3` | `--font-h3-family` | `--font-h3-weight` | `--font-size-h3-body` | `--font-line-space-h3-body` | `-0.02em` |
| `text-h4` | `--font-h4-family` | `--font-h4-weight` | `--font-size-h4-body` | `--font-line-space-h4-body` | - |
| `text-h5` | `--font-h5-family` | `--font-h5-weight` | `--font-size-h5-caption` | `--font-line-space-h5-caption` | `-0.02em` + uppercase |
| `text-h6` | `--font-h6-family` | `--font-h6-weight` | `--font-size-h6-caption` | `--font-line-space-h6-caption` | - |

Additionally, Tailwind `fontSize` utilities are available for size + line-height only:

```typescript
// Usage: text-heading-1, text-heading-2, etc.
'heading-1': ['var(--font-size-h1-title)', { lineHeight: 'var(--font-line-space-h1-main-title)' }],
'heading-2': ['var(--font-size-h2-sub-title)', { lineHeight: 'var(--font-line-space-h2-sub-title)' }],
// ...
```

#### Responsive Typography
Font sizes use `clamp()` functions for fluid scaling between breakpoints. The actual values are defined in `ods-responsive-tokens.css`.

### Spacing
```css
/* Consistent spacing scale */
--space-1 through --space-20
--space-px, --space-0_5, etc.
```

## Component Integration

### Using with Tailwind
The styles work seamlessly with Tailwind CSS:

```jsx
// Typography utilities apply all styles at once
<h1 className="text-h1">Main Title</h1>
<h2 className="text-h2">Subtitle</h2>
<p className="font-body text-heading-3">Body text with heading-3 size</p>

// Platform-aware colors automatically applied
<button className="bg-ods-accent text-ods-text-on-accent">
  Platform Button
</button>

// Font family utilities
<span className="font-heading">Azeret Mono text</span>
<span className="font-body">DM Sans text</span>
```

### CSS-in-JS Integration
Access design tokens in CSS-in-JS solutions:

```jsx
const StyledComponent = styled.div`
  background-color: var(--color-bg-card);
  color: var(--color-text-primary);
  font-family: var(--font-family-body);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
`;
```

## Customization

### Adding Custom Styles
For project-specific styles, add them after the ui-kit import:

```css
@import "@flamingo/ui-kit/styles";

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Your custom styles here */
.my-custom-component {
  background: var(--color-accent-primary);
}
```

### Overriding Design Tokens
To override specific tokens, define them after the import:

```css
@import "@flamingo/ui-kit/styles";

:root {
  /* Override specific tokens */
  --color-accent-primary: #custom-color;
  --font-family-body: "Inter", sans-serif;
  --space-custom: 2.5rem;
}
```

## Troubleshooting

### Styles Not Loading
Ensure you're importing the correct path:
```css
@import "@flamingo/ui-kit/styles"; /* Correct */
@import "@flamingo/ui-kit/styles/index.css"; /* Incorrect */
```

### Platform Theming Not Working
1. Check that `NEXT_PUBLIC_APP_TYPE` is set correctly
2. Verify the value matches supported platforms
3. Ensure the import is in your root CSS file

### CSS Variables Undefined
Make sure you're importing the ui-kit styles before using any CSS variables:
```css
/* Import first */
@import "@flamingo/ui-kit/styles";

/* Then use variables */
.my-component {
  color: var(--color-text-primary);
}
```

### Duplicate Styles
If you see duplicate styles, ensure you're not importing both:
- Individual ODS files AND the main styles
- The ui-kit styles AND manual copies of the same styles

## Best Practices

1. **Always import the complete styles** unless you have specific needs for granular imports
2. **Use CSS variables** instead of hardcoded values for consistency
3. **Use `text-h1`..`text-h6` utilities** for headings — they apply the full typography stack (family, weight, size, line-height, letter-spacing)
4. **Use `font-heading` / `font-body`** for font-family only — they reference CSS variables, not hardcoded fonts
5. **Leverage platform theming** by using accent colors and semantic tokens
6. **Test across all platforms** when making style changes
7. **Keep custom styles minimal** - prefer using design system tokens

## Migration from Legacy Styles

If migrating from individual style files:

1. Remove individual `@import` statements for ODS files
2. Replace with single `@import "@flamingo/ui-kit/styles"`
3. Delete duplicate style files from your project
4. Replace hardcoded font names with CSS variable references (e.g. `"DM Sans"` -> `var(--font-family-body)`)
5. Update any hardcoded colors/spacing to use CSS variables
6. Test that platform theming still works correctly

## Contributing

When adding new styles to the ui-kit:

1. **Design tokens** go in the appropriate `ods-*.css` file
2. **Application-specific styles** go in `app-globals.css`
3. **Platform-specific overrides** go in `ods-dynamic-theming.css`
4. **Typography changes** must update both CSS variables in `ods-design-tokens.css` and the plugin in `tailwind.config.ts`
5. **Update this README** when adding new features or changing structure
6. **Test across all platforms** before committing changes
