import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Moon, Sun } from 'lucide-react'
import React from 'react'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { ThemeProvider, useThemeToggle } from '../components/providers/theme-provider'

const meta = {
  title: 'Foundations/Theme',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Demonstrates the ODS light/dark theme system. The `ThemeProvider` (wrapping `next-themes`) sets `data-theme="light|dark"` on `<html>`, and `src/styles/ods-colors.css` swaps the `--ods-*` primitives accordingly. Use `useThemeToggle()` to build your own toggle UI.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function ThemeToggleButton() {
  const { isDark, toggle, mounted } = useThemeToggle()
  return (
    <Button
      variant="outline"
      onClick={toggle}
      leftIcon={mounted ? (isDark ? <Sun /> : <Moon />) : undefined}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {mounted ? (isDark ? 'Switch to light' : 'Switch to dark') : 'Toggle theme'}
    </Button>
  )
}

function ThemeStatusBar() {
  const { theme, isDark, setTheme, toggle, mounted } = useThemeToggle()
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ods-border bg-ods-card p-4">
      <span className="text-body-sm text-ods-text-secondary">Current theme:</span>
      <Badge variant={isDark ? 'secondary' : 'outline'} className="uppercase">
        {mounted ? theme : '…'}
      </Badge>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button size="small" variant="outline" onClick={() => setTheme('light')}>
          Set light
        </Button>
        <Button size="small" variant="outline" onClick={() => setTheme('dark')}>
          Set dark
        </Button>
        <Button size="small" variant="accent" onClick={toggle}>
          Toggle
        </Button>
      </div>
    </div>
  )
}

interface SwatchProps {
  name: string
  /** Tailwind class that consumes the token (e.g. `bg-ods-bg`). */
  className: string
  /** Render dark text instead of light (for very light tokens). */
  darkLabel?: boolean
}

function Swatch({ name, className, darkLabel }: SwatchProps) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className={`${className} h-16 w-full rounded-md border border-ods-border flex items-end justify-start p-2`}
      >
        <span
          className={`text-caption font-mono ${
            darkLabel ? 'text-black/70' : 'text-white/80'
          }`}
        >
          {name.replace(/^bg-|^text-|^border-/, '')}
        </span>
      </div>
      <span className="text-caption text-ods-text-secondary font-mono">{name}</span>
    </div>
  )
}

function TokenGrid() {
  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-h5 text-ods-text-primary mb-3">Surfaces</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Swatch name="bg-ods-bg" className="bg-ods-bg" />
          <Swatch name="bg-ods-card" className="bg-ods-card" />
          <Swatch name="bg-ods-bg-surface" className="bg-ods-bg-surface" />
          <Swatch name="bg-ods-bg-hover" className="bg-ods-bg-hover" />
        </div>
      </div>

      <div>
        <h3 className="text-h5 text-ods-text-primary mb-3">Text</h3>
        <div className="rounded-lg border border-ods-border bg-ods-card p-4 space-y-1">
          <p className="text-ods-text-primary">text-ods-text-primary — primary text</p>
          <p className="text-ods-text-secondary">text-ods-text-secondary — secondary text</p>
          <p className="text-ods-text-tertiary">text-ods-text-tertiary — tertiary text</p>
          <p className="text-ods-text-muted">text-ods-text-muted — muted text</p>
          <p className="text-ods-text-disabled">text-ods-text-disabled — disabled text</p>
        </div>
      </div>

      <div>
        <h3 className="text-h5 text-ods-text-primary mb-3">Accent &amp; status</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Swatch name="bg-ods-accent" className="bg-ods-accent" darkLabel />
          <Swatch name="bg-ods-success" className="bg-ods-success" />
          <Swatch name="bg-ods-error" className="bg-ods-error" />
          <Swatch name="bg-ods-warning" className="bg-ods-warning" darkLabel />
          <Swatch name="bg-ods-info" className="bg-ods-info" darkLabel />
        </div>
      </div>

      <div>
        <h3 className="text-h5 text-ods-text-primary mb-3">Borders</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="h-16 rounded-md border-2 border-ods-border bg-ods-card flex items-center justify-center text-caption font-mono text-ods-text-secondary">
            border-ods-border
          </div>
          <div className="h-16 rounded-md border-2 border-ods-border-hover bg-ods-card flex items-center justify-center text-caption font-mono text-ods-text-secondary">
            border-ods-border-hover
          </div>
          <div className="h-16 rounded-md border-2 border-ods-border-focus bg-ods-card flex items-center justify-center text-caption font-mono text-ods-text-secondary">
            border-ods-border-focus
          </div>
        </div>
      </div>
    </section>
  )
}

function ComponentsShowcase() {
  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-h5 text-ods-text-primary mb-3">Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="accent">Accent</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="transparent">Transparent</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline" disabled>
            Disabled
          </Button>
          <Button variant="accent" loading>
            Loading
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-h5 text-ods-text-primary mb-3">Inputs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
          <Input placeholder="Default input" />
          <Input placeholder="With value" defaultValue="user@flamingo.cx" />
          <Input placeholder="Invalid" invalid error="Required" />
          <Input placeholder="Disabled" disabled />
        </div>
      </div>

      <div>
        <h3 className="text-h5 text-ods-text-primary mb-3">Badges</h3>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </div>

      <div>
        <h3 className="text-h5 text-ods-text-primary mb-3">Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>
                Card surface and text adapt to the active theme.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-body-sm text-ods-text-secondary">
                All colors come from <code className="text-ods-accent">--ods-*</code> tokens — the
                same markup renders correctly in both themes.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Inputs &amp; actions</CardTitle>
              <CardDescription>Try interacting — focus rings flip too.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Type something…" />
              <div className="flex gap-2">
                <Button size="small" variant="accent">
                  Save
                </Button>
                <Button size="small" variant="outline">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-h5 text-ods-text-primary mb-3">Alerts</h3>
        <div className="space-y-3 max-w-2xl">
          <Alert>
            <AlertTitle>Informational</AlertTitle>
            <AlertDescription>
              Default alert surface — uses card background and primary text tokens.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Stories                                                             */
/* ------------------------------------------------------------------ */

/**
 * Full showcase — toggle the theme and watch every primitive flip in place.
 *
 * The whole story is wrapped in `<ThemeProvider>`. `useThemeToggle()` is used
 * to drive the toggle button (and `setTheme('light' | 'dark')` is wired to the
 * explicit "Set light / Set dark" buttons). All visible color comes from ODS
 * tokens, so nothing is hardcoded.
 */
export const Showcase: Story = {
  render: () => (
    <ThemeProvider>
      <div className="min-h-screen bg-ods-bg text-ods-text-primary p-6 md:p-10 space-y-8 transition-colors">
        <header className="space-y-2">
          <h1 className="text-h2 text-ods-text-primary">ODS theme switching</h1>
          <p className="text-body text-ods-text-secondary max-w-2xl">
            One <code className="text-ods-accent">data-theme</code> attribute on{' '}
            <code className="text-ods-accent">&lt;html&gt;</code> flips every{' '}
            <code className="text-ods-accent">--ods-*</code> primitive. Components below don&apos;t
            know — and don&apos;t care — which theme is active; they read tokens.
          </p>
        </header>

        <ThemeStatusBar />

        <TokenGrid />
        <ComponentsShowcase />
      </div>
    </ThemeProvider>
  ),
}

/**
 * Minimal example: just the toggle button and a single card.
 *
 * Useful as a copy-paste reference for what consumer apps need to do to add a
 * theme switch: wrap once in `<ThemeProvider>`, then build any button you like
 * around `useThemeToggle()`.
 */
export const ToggleOnly: Story = {
  render: () => (
    <ThemeProvider>
      <div className="min-h-screen bg-ods-bg text-ods-text-primary p-10 flex items-center justify-center transition-colors">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Theme toggle</CardTitle>
            <CardDescription>
              Click the button below — the entire surface, text and border swap themes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ThemeToggleButton />
          </CardContent>
        </Card>
      </div>
    </ThemeProvider>
  ),
}

/**
 * Side-by-side: force light and dark on two halves of the screen at once using
 * the `.theme-light` / `.theme-dark` class escape hatches (no provider needed
 * for these — they directly scope the primitive overrides). Handy for visual
 * diffing without flipping the document.
 */
export const SideBySide: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-screen">
      {(['light', 'dark'] as const).map((mode) => (
        <div
          key={mode}
          className={`theme-${mode} bg-ods-bg text-ods-text-primary p-6 space-y-4 border-r border-ods-border`}
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="uppercase">
              {mode}
            </Badge>
            <span className="text-body-sm text-ods-text-secondary">
              scoped via <code className="text-ods-accent">.theme-{mode}</code>
            </span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Same component, different theme</CardTitle>
              <CardDescription>
                Both halves render identical JSX — only the wrapping class differs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Email" defaultValue="hello@flamingo.cx" />
              <div className="flex gap-2 flex-wrap">
                <Button size="small" variant="accent">
                  Primary
                </Button>
                <Button size="small" variant="outline">
                  Secondary
                </Button>
                <Badge>Default</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="destructive">Error</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  ),
}
