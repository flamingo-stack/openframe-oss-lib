import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import tailwindcssAnimate from 'tailwindcss-animate'
import containerQueries from '@tailwindcss/container-queries'

const odsTypographyPlugin = plugin(({ addUtilities }) => {
  addUtilities({
    '.text-h1': {
      fontFamily: 'var(--font-h1-family)',
      fontWeight: 'var(--font-h1-weight)',
      fontSize: 'var(--font-size-h1-title)',
      lineHeight: 'var(--font-line-space-h1-main-title)',
      letterSpacing: '-0.02em',
    },
    '.text-h2': {
      fontFamily: 'var(--font-h2-family)',
      fontWeight: 'var(--font-h2-weight)',
      fontSize: 'var(--font-size-h2-sub-title)',
      lineHeight: 'var(--font-line-space-h2-sub-title)',
      letterSpacing: '-0.02em',
    },
    '.text-h3': {
      fontFamily: 'var(--font-h3-family)',
      fontWeight: 'var(--font-h3-weight)',
      fontSize: 'var(--font-size-h3-body)',
      lineHeight: 'var(--font-line-space-h3-body)',
      letterSpacing: '-0.02em',
    },
    '.text-h4': {
      fontFamily: 'var(--font-h4-family)',
      fontWeight: 'var(--font-h4-weight)',
      fontSize: 'var(--font-size-h4-body)',
      lineHeight: 'var(--font-line-space-h4-body)',
    },
    '.text-h5': {
      fontFamily: 'var(--font-h5-family)',
      fontWeight: 'var(--font-h5-weight)',
      fontSize: 'var(--font-size-h5-caption)',
      lineHeight: 'var(--font-line-space-h5-caption)',
      textTransform: 'uppercase',
      letterSpacing: '-0.02em',
    },
    '.text-h6': {
      fontFamily: 'var(--font-h6-family)',
      fontWeight: 'var(--font-h6-weight)',
      fontSize: 'var(--font-size-h6-caption)',
      lineHeight: 'var(--font-line-space-h6-caption)',
    },
    // Monospace body/code text (commands, ids, paths, code blocks): Azeret Mono
    // at the h6 responsive scale, no transform, neutral letter-spacing (unlike
    // text-h5's uppercase -0.02em label styling).
    '.text-code': {
      fontFamily: 'var(--font-family-heading)',
      fontWeight: 'var(--font-weight-medium)',
      fontSize: 'var(--font-size-h6-caption)',
      lineHeight: 'var(--font-line-space-h6-caption)',
    },
  })
})

/**
 * Make Tailwind opacity modifiers (`bg-ods-error/10`, `hover:bg-ods-accent/90`, …)
 * actually work on var()-based ODS tokens. Without `<alpha-value>` in the color
 * definition Tailwind v3 silently generates NOTHING for `ods-*\/N` classes — the
 * element loses that declaration entirely. `color-mix` keeps un-suffixed classes
 * visually identical (a 100% mix is the color itself) while letting the modifier
 * scale the alpha.
 */
const withAlphaValue = (color: string) => `color-mix(in srgb, ${color} calc(<alpha-value> * 100%), transparent)`

type ColorTree = { [key: string]: string | ColorTree }
const withAlphaSupport = (tree: ColorTree): ColorTree =>
  Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === 'string' ? withAlphaValue(value) : withAlphaSupport(value),
    ]),
  )

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Dynamically generated classes for table hide/show functionality
    'hidden',
    'md:hidden',
    'lg:hidden',
    'md:flex',
    'lg:flex',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Shadcn/ui base colors (keep for compatibility)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // =================================================
        // ODS (Open Design System) COLORS
        // =================================================
        // Single nested structure: generates bg-ods-*, text-ods-*, border-ods-* utilities
        ods: withAlphaSupport({
          // Backgrounds
          bg: "var(--color-bg)",
          card: "var(--color-bg-card)",
          overlay: "var(--color-bg-overlay)",
          skeleton: "var(--color-bg-skeleton)",
          "bg-hover": "var(--color-bg-hover)",
          "bg-active": "var(--color-bg-active)",
          "bg-surface": "var(--color-bg-surface)",
          "card-hover": "var(--color-bg-hover)",
          divider: "var(--color-divider)",

          // Borders
          border: {
            DEFAULT: "var(--color-border-default)",
            hover: "var(--color-border-hover)",
            active: "var(--color-border-active)",
            focus: "var(--color-border-focus)",
          },

          // Text
          text: {
            primary: "var(--color-text-primary)",
            secondary: "var(--color-text-secondary)",
            tertiary: "var(--color-text-tertiary)",
            muted: "var(--color-text-muted)",
            subtle: "var(--color-text-subtle)",
            disabled: "var(--color-text-disabled)",
            "on-accent": "var(--color-text-on-accent)",
            "on-dark": "var(--color-text-on-dark)",
          },

          // Accent
          accent: {
            DEFAULT: "var(--color-accent-primary)",
            hover: "var(--color-accent-hover)",
            active: "var(--color-accent-active)",
            focus: "var(--color-accent-focus)",
            disabled: "var(--color-accent-disabled)",
          },

          // Status
          success: {
            DEFAULT: "var(--color-success)",
            hover: "var(--color-success-hover)",
            active: "var(--color-success-active)",
            secondary: "var(--color-success-secondary)",
            "secondary-hover": "var(--color-success-secondary-hover)",
            "secondary-active": "var(--color-success-secondary-active)",
          },
          error: {
            DEFAULT: "var(--color-error)",
            hover: "var(--color-error-hover)",
            active: "var(--color-error-active)",
            secondary: "var(--color-error-secondary)",
            "secondary-hover": "var(--color-error-secondary-hover)",
            "secondary-active": "var(--color-error-secondary-active)",
          },
          warning: {
            DEFAULT: "var(--color-warning)",
            hover: "var(--color-warning-hover)",
            active: "var(--color-warning-active)",
            secondary: "var(--color-warning-secondary)",
            "secondary-hover": "var(--color-warning-secondary-hover)",
            "secondary-active": "var(--color-warning-secondary-active)",
          },
          info: {
            DEFAULT: "var(--color-info)",
            hover: "var(--color-info-hover)",
            active: "var(--color-info-active)",
          },

          // Interactive states
          disabled: "var(--color-disabled)",
          focus: "var(--color-focus-ring)",
          "focus-visible": "var(--color-focus-visible)",

          // Links
          link: {
            DEFAULT: "var(--color-link)",
            hover: "var(--color-link-hover)",
            visited: "var(--color-link-visited)",
          },

          // Brand colors (theme-independent)
          flamingo: {
            pink: "var(--ods-flamingo-pink-base)",
            cyan: "var(--ods-flamingo-cyan-base)",
          },
          "open-yellow": {
            DEFAULT: "var(--ods-open-yellow-base)",
            secondary: "var(--ods-open-yellow-secondary)",
          },

          // Attention tokens (ods-colors.css). Components reference these BY
          // NAME (error-state.tsx: `border-ods-attention-red-error` etc.) —
          // without these mappings Tailwind silently generates NOTHING for
          // the class and the component renders colorless in every consumer.
          attention: {
            "red-error": "var(--ods-attention-red-error)",
            "red-error-hover": "var(--ods-attention-red-error-hover)",
            "red-error-action": "var(--ods-attention-red-error-action)",
            "red-error-secondary": "var(--ods-attention-red-error-secondary)",
            "red-error-secondary-hover": "var(--ods-attention-red-error-secondary-hover)",
            "red-error-secondary-action": "var(--ods-attention-red-error-secondary-action)",
            "yellow-warning": "var(--ods-attention-yellow-warning)",
            "yellow-warning-hover": "var(--ods-attention-yellow-warning-hover)",
            "yellow-warning-action": "var(--ods-attention-yellow-warning-action)",
            "yellow-warning-secondary": "var(--ods-attention-yellow-warning-secondary)",
            "yellow-warning-secondary-hover": "var(--ods-attention-yellow-warning-secondary-hover)",
            "yellow-warning-secondary-action": "var(--ods-attention-yellow-warning-secondary-action)",
            "green-success": "var(--ods-attention-green-success)",
            "green-success-hover": "var(--ods-attention-green-success-hover)",
            "green-success-action": "var(--ods-attention-green-success-action)",
            "green-success-secondary": "var(--ods-attention-green-success-secondary)",
            "green-success-secondary-hover": "var(--ods-attention-green-success-secondary-hover)",
            "green-success-secondary-action": "var(--ods-attention-green-success-secondary-action)",
          },

          // Adaptive platform color
          current: "var(--ods-current)",
        }),
      },
      // Custom breakpoints (aligned with ODS responsive tokens from Figma)
      screens: {
        'md': '800px',   // Tablet: 50rem
        'lg': '1280px',  // Desktop: 80rem
        'xl': '1440px',  // Large desktop: 90rem
      },

      borderRadius: {
        lg: "var(--radius)", // 8px
        md: "calc(var(--radius) - 2px)", // 6px
        sm: "calc(var(--radius) - 4px)", // 4px
        xs: "calc(var(--radius) - 6px)", // 2px
      },

      maxWidth: {
        'ods-content-narrow': '600px',
      },

      fontFamily: {
        sans: ["var(--font-family-body)"],
        mono: ["var(--font-family-heading)"],
        body: ["var(--font-family-body)"],
        heading: ["var(--font-family-heading)"],
      },

      // =================================================
      // TYPOGRAPHY
      // =================================================
      fontSize: {
        // Responsive heading sizes (from ods-responsive-tokens.css)
        'heading-1': ['var(--font-size-h1-title)', { lineHeight: 'var(--font-line-space-h1-main-title)' }],
        'heading-2': ['var(--font-size-h2-sub-title)', { lineHeight: 'var(--font-line-space-h2-sub-title)' }],
        'heading-3': ['var(--font-size-h3-body)', { lineHeight: 'var(--font-line-space-h3-body)' }],
        'heading-4': ['var(--font-size-h4-body)', { lineHeight: 'var(--font-line-space-h4-body)' }],
        'heading-5': ['var(--font-size-h5-caption)', { lineHeight: 'var(--font-line-space-h5-caption)' }],
        'heading-6': ['var(--font-size-h6-caption)', { lineHeight: 'var(--font-line-space-h6-caption)' }],
      },

      // =================================================
      // SHADOWS
      // =================================================
      boxShadow: {
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'modal': 'var(--shadow-modal)',
        'dropdown': 'var(--shadow-dropdown)',
        'tooltip': 'var(--shadow-tooltip)',
        'focus': 'var(--shadow-focus)',
        'accent': 'var(--shadow-accent)',
        'accent-lg': 'var(--shadow-accent-lg)',
      },

      // =================================================
      // TRANSITIONS
      // =================================================
      transitionDuration: {
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
        'slower': 'var(--duration-slower)',
      },
      transitionTimingFunction: {
        'bounce': 'var(--ease-bounce)',
        'elastic': 'var(--ease-elastic)',
      },

      // =================================================
      // Z-INDEX
      // =================================================
      zIndex: {
        'dropdown': 'var(--z-dropdown)',
        'sticky': 'var(--z-sticky)',
        'fixed': 'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        'modal': 'var(--z-modal)',
        'popover': 'var(--z-popover)',
        'tooltip': 'var(--z-tooltip)',
        'notification': 'var(--z-notification)',
        'debug': 'var(--z-debug)',
      },

      // =================================================
      // ANIMATIONS
      // =================================================
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Endless chip strip (QuickActionMarquee): the track renders its items
        // twice, so -50% lands exactly one copy over for a seamless loop.
        "qa-marquee": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "qa-marquee": "qa-marquee var(--qa-marquee-duration,40s) linear infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate, odsTypographyPlugin, containerQueries],
}

export default config
