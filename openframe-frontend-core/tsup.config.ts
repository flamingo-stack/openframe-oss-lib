import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'components/index': 'src/components/index.ts',
    'components/ui/index': 'src/components/ui/index.ts',
    'components/ui/file-manager/index': 'src/components/ui/file-manager/index.ts',
    'components/features/index': 'src/components/features/index.ts',
    'components/toast/index': 'src/components/toast/index.ts',
    'components/icons/index': 'src/components/icons/index.ts',
    'components/navigation/index': 'src/components/navigation/index.ts',
    'hooks/index': 'src/hooks/index.ts',
    'utils/index': 'src/utils/index.ts',
    'types/index': 'src/types/index.ts',
    'types/navigation': 'src/types/navigation.ts',
    'assets/index': 'src/assets/index.ts',
    'fonts': 'src/fonts.ts',
    'tailwind.config': './tailwind.config.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'next', '@tanstack/react-query'],
  treeshake: true,
})
