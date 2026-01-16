# Icons V2

Modern icon library with 1,600+ icons organized by category.

## Usage

### Basic Import

```tsx
import { ArrowUpIcon, SearchIcon, CopyIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';

function MyComponent() {
  return (
    <div>
      <ArrowUpIcon size={24} color="#000" />
      <SearchIcon size={32} color="#888" className="search-icon" />
      <CopyIcon size={20} color="currentColor" />
    </div>
  );
}
```

### Import by Category

For better tree-shaking, import from specific categories:

```tsx
import { ArrowUpIcon, ArrowDownIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2/arrows';
import { CodeIcon, TerminalIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2/coding';
```

## Props

All icons accept the following props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `number` | `24` | Icon size in pixels (applied to both width and height) |
| `color` | `string` | `"#888888"` | Icon fill color (supports any CSS color value) |
| `className` | `string` | `""` | Additional CSS class names |
| `...props` | `SVGProps<SVGSVGElement>` | - | Any other SVG element props |

## Examples

### Custom Size and Color

```tsx
<ArrowUpIcon size={48} color="#3b82f6" />
```

### Using with Tailwind CSS

```tsx
<SearchIcon
  size={24}
  color="currentColor"
  className="text-blue-500 hover:text-blue-700"
/>
```

### Responsive Sizing

```tsx
<CodeIcon
  size={isMobile ? 20 : 24}
  color="#000"
/>
```

## Available Categories

- **alphabet** (78 icons) - Letters A-Z in circle, square styles
- **arrows** (67 icons) - Directional arrows, chevrons, navigation
- **audio-and-visual** (72 icons) - Music, video, camera, microphone
- **brand-logos** (62 icons) - Popular brands and services
- **buildings** (20 icons) - Architecture, real estate, construction
- **charts** (37 icons) - Graphs, analytics, data visualization
- **clothes** (24 icons) - Fashion, apparel, accessories
- **coding** (61 icons) - Programming, development, terminal
- **communication** (79 icons) - Chat, email, phone, messaging
- **date-and-time** (31 icons) - Calendar, clock, time zones
- **design** (63 icons) - Creative tools, pen, brush, palette
- **devices** (86 icons) - Phones, laptops, tablets, hardware
- **documents** (73 icons) - Files, folders, paperwork
- **finance** (34 icons) - Money, credit cards, banking, invoices
- **food-and-drinks** (66 icons) - Meals, beverages, dining
- **health** (46 icons) - Medical, wellness, fitness
- **household** (70 icons) - Home, furniture, appliances
- **interface** (88 icons) - UI controls, buttons, toggles
- **map-and-travel** (46 icons) - Maps, navigation, locations
- **media-playback** (43 icons) - Play, pause, stop, skip
- **number** (46 icons) - Numbers 0-9 in various styles
- **school** (48 icons) - Education, learning, academic
- **security** (35 icons) - Lock, shield, protection, safety
- **shopping** (59 icons) - Cart, bag, store, e-commerce
- **signs-and-symbols** (54 icons) - Common symbols and signs
- **sort-and-filter** (24 icons) - Data organization, sorting
- **sport** (28 icons) - Athletics, fitness, games
- **text-editor** (40 icons) - Text formatting, editing tools
- **users** (34 icons) - People, profiles, avatars
- **vehicles-and-delivery** (59 icons) - Cars, trucks, transport
- **weather-and-nature** (59 icons) - Sun, rain, trees, animals

## Generating Icons

This directory is auto-generated from SVG sources in `src/components/icons-v2/`.

To regenerate icons after adding or modifying SVGs:

```bash
npm run generate:icons
```

The generation script:
1. Processes SVG files from `src/components/icons-v2/[category]/`
2. Converts them to React components using @svgr/cli
3. Generates TypeScript type definitions
4. Creates category index files
5. Outputs to `src/components/icons-v2-generated/`

## Adding New Icons

1. Add SVG files to the appropriate category folder in `src/components/icons-v2/[category]/`
2. Name files in kebab-case (e.g., `arrow-up.svg`, `code-block.svg`)
3. Run `npm run generate:icons`
4. The component will be available as `[PascalCase]Icon` (e.g., `ArrowUpIcon`, `CodeBlockIcon`)

## Note

⚠️ Do not manually edit files in this directory. They are auto-generated and will be overwritten.
