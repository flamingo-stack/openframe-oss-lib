import type { Config } from 'tailwindcss'
// The lib ships its Tailwind preset (ODS tokens, fonts, animations) under this subpath.
import openframeCorePreset from '@flamingo-stack/openframe-frontend-core/tailwind.config.ts'

export default {
  // Compose via the `presets` array (NOT object-spread — that's how Tailwind merges presets).
  presets: [openframeCorePreset as Config],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Lib classes ship in dist/, not src/ — include them so purge doesn't drop them.
    './node_modules/@flamingo-stack/openframe-frontend-core/dist/**/*.{js,mjs,cjs}',
  ],
} satisfies Config
