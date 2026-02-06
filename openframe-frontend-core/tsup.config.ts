import { defineConfig } from 'tsup'

// Config is split into two builds: client and server/universal.
//
// Problem: tsup bundles all barrel re-exports into a single file and strips
// "use client" directives from individual source files. Components like
// ToggleGroup call createContext() at the module top level. When Next.js
// server code transitively imports a barrel (e.g. components/ui), the entire
// bundle executes on the server where createContext doesn't exist — causing
// "createContext is not a function" errors.
//
// Solution: client entries use `banner` to inject "use client" as the first
// line of every output file. Note: `banner` is incompatible with `treeshake`
// (rollup strips it), so client entries don't use treeshake and server
// entries don't use banner.

export default defineConfig([
  // Client-side entries — these contain React components/hooks that require
  // browser APIs. The "use client" banner tells Next.js to treat the entire
  // bundle as a Client Component boundary.
  {
    entry: {
      'index': 'src/index.ts',
      'components/index': 'src/components/index.ts',
      'components/ui/index': 'src/components/ui/index.ts',
      'components/ui/file-manager/index': 'src/components/ui/file-manager/index.ts',
      'components/features/index': 'src/components/features/index.ts',
      'components/toast/index': 'src/components/toast/index.ts',
      'components/icons/index': 'src/components/icons/index.ts',
      'components/icons-v2-generated/index': 'src/components/icons-v2-generated/index.ts',
      'components/navigation/index': 'src/components/navigation/index.ts',
      'hooks/index': 'src/hooks/index.ts',
      'utils/index': 'src/utils/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom', 'next', '@tanstack/react-query'],
    banner: {
      js: '"use client";',
    },
  },
  // Server/universal entries — pure types, configs, and server-safe utilities.
  // No "use client" needed; treeshake enabled to reduce bundle size.
  {
    entry: {
      'nats/index': 'src/nats/index.ts',
      'types/index': 'src/types/index.ts',
      'types/navigation': 'src/types/navigation.ts',
      'types/announcement': 'src/types/announcement.ts',
      'assets/index': 'src/assets/index.ts',
      'fonts': 'src/fonts.ts',
      'tailwind.config': './tailwind.config.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    external: ['react', 'react-dom', 'next', '@tanstack/react-query'],
    treeshake: true,
  },
])
