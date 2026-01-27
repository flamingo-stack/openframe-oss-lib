# ⚠️ Deprecated: Icons Module

**This icon module is deprecated.** Please use `@flamingo-stack/openframe-frontend-core/components/icons-v2` instead.

## Why Migrate?

The new `icons-v2` module provides:

- **1,600+ icons** organized in 31 categories (alphabet, arrows, coding, interface, etc.)
- **Consistent API** with `size`, `color`, and `className` props
- **Better TypeScript support** with proper type definitions
- **Smaller bundle size** with tree-shaking support
- **Automatic generation** from SVG sources using @svgr/cli

## Migration Guide

### Old (Deprecated)
```tsx
import { CopyIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';

<CopyIcon className="icon" size={24} color="#888" />
```

### New (Recommended)
```tsx
import { CopyIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';

<CopyIcon className="icon" size={24} color="#888" />
```

### Import by Category
```tsx
// Import from specific category for better tree-shaking
import { ArrowUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2/arrows';
import { CodeIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2/coding';
```

## Available Categories

- `alphabet` - A-Z letters in various styles
- `arrows` - Directional arrows and navigation
- `audio-and-visual` - Media, music, video icons
- `brand-logos` - Popular brand and service logos
- `buildings` - Architecture and real estate
- `charts` - Data visualization and analytics
- `clothes` - Fashion and apparel
- `coding` - Programming and development
- `communication` - Messaging and social
- `date-and-time` - Calendar and clock icons
- `design` - Creative tools and design
- `devices` - Hardware and electronics
- `documents` - Files and paperwork
- `finance` - Money and banking
- `food-and-drinks` - Culinary icons
- `health` - Medical and wellness
- `household` - Home and living
- `interface` - UI controls and actions
- `map-and-travel` - Geography and navigation
- `media-playback` - Play, pause, stop controls
- `number` - Numeric indicators
- `school` - Education and learning
- `security` - Lock, shield, protection
- `shopping` - E-commerce and retail
- `signs-and-symbols` - Common symbols
- `sort-and-filter` - Data organization
- `sport` - Athletics and fitness
- `text-editor` - Text formatting tools
- `users` - People and profiles
- `vehicles-and-delivery` - Transportation
- `weather-and-nature` - Environment icons

## Generating New Icons

To regenerate icons from SVG sources:

```bash
npm run generate:icons
```

This will process all SVG files in `src/components/icons-v2/` and generate TypeScript components in `src/components/icons-v2-generated/`.
