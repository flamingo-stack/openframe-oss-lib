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
- **admin-hub**: Pink accent (#F357BB), dark theme  
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
```css
/* Font families */
font-family: var(--font-heading);  /* Azeret Mono */
font-family: var(--font-body);     /* DM Sans */

/* Responsive typography */
--fluid-text-xs to --fluid-text-6xl
```

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
// Platform-aware colors automatically applied
<button className="bg-accent text-on-accent">
  Platform Button
</button>

// ODS spacing tokens
<div className="p-space-4 m-space-2">
  Consistent Spacing
</div>
```

### CSS-in-JS Integration
Access design tokens in CSS-in-JS solutions:

```jsx
const StyledComponent = styled.div`
  background-color: var(--color-bg-card);
  color: var(--color-text-primary);
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
  --space-custom: 2.5rem;
}
```

## Troubleshooting

### Styles Not Loading
Ensure you're importing the correct path:
```css
@import "@flamingo/ui-kit/styles"; /* ✅ Correct */
@import "@flamingo/ui-kit/styles/index.css"; /* ❌ Incorrect */
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
3. **Leverage platform theming** by using accent colors and semantic tokens
4. **Test across all platforms** when making style changes
5. **Keep custom styles minimal** - prefer using design system tokens

## Migration from Legacy Styles

If migrating from individual style files:

1. Remove individual `@import` statements for ODS files
2. Replace with single `@import "@flamingo/ui-kit/styles"`
3. Delete duplicate style files from your project
4. Update any hardcoded colors/spacing to use CSS variables
5. Test that platform theming still works correctly

## Contributing

When adding new styles to the ui-kit:

1. **Design tokens** go in the appropriate `ods-*.css` file
2. **Application-specific styles** go in `app-globals.css`
3. **Platform-specific overrides** go in `ods-dynamic-theming.css`
4. **Update this README** when adding new features or changing structure
5. **Test across all platforms** before committing changes