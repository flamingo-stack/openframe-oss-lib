import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
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
        // OPEN DESIGN SYSTEM (ODS) COLORS - SHARED
        // =================================================
        // These are the canonical ODS color utilities used across all apps
        
        // Background colors
        "bg-primary": "var(--color-bg)",                    // #161616
        "bg-card": "var(--color-bg-card)",                  // #212121
        "bg-hover": "var(--color-bg-hover)",                // #2b2b2b
        "bg-active": "var(--color-bg-active)",              // #353535
        "bg-surface": "var(--color-bg-surface)",            // #3a3a3a
        "bg-overlay": "var(--color-bg-overlay)",
        "bg-skeleton": "var(--color-bg-skeleton)",
        
        // Text colors
        "text-primary": "var(--color-text-primary)",        // #fafafa
        "text-secondary": "var(--color-text-secondary)",    // #888888
        "text-tertiary": "var(--color-text-tertiary)",      // #444444
        "text-muted": "var(--color-text-muted)",            // #747474
        "text-subtle": "var(--color-text-subtle)",
        "text-disabled": "var(--color-text-disabled)",     // #3a3a3a
        "text-on-accent": "var(--color-text-on-accent)",    // #212121
        "text-on-dark": "var(--color-text-on-dark)",
        "text-placeholder": "var(--color-text-placeholder)",
        
        // Border colors
        "border-primary": "var(--color-border-default)",    // #3a3a3a
        "border-hover": "var(--color-border-hover)",        // #444444
        "border-active": "var(--color-border-active)",      // #4e4e4e
        "border-focus": "var(--color-border-focus)",        // #ffc008
        "border-subtle": "var(--color-border-subtle)",
        "border-strong": "var(--color-border-strong)",     // #888888
        
        // Accent colors
        "accent-primary": "var(--color-accent-primary)",    // #ffc008
        "accent-hover": "var(--color-accent-hover)",        // #f5b600
        "accent-active": "var(--color-accent-active)",      // #ebac00
        "accent-focus": "var(--color-accent-focus)",
        "accent-disabled": "var(--color-accent-disabled)",
        
        // Status colors
        "success": "var(--color-success)",
        "success-hover": "var(--color-success-hover)",
        "success-active": "var(--color-success-active)",
        "error": "var(--color-error)",
        "error-hover": "var(--color-error-hover)",
        "error-active": "var(--color-error-active)",
        "warning": "var(--color-warning)",
        "warning-hover": "var(--color-warning-hover)",
        "warning-active": "var(--color-warning-active)",
        "info": "var(--color-info)",
        "info-hover": "var(--color-info-hover)",
        "info-active": "var(--color-info-active)",
        
        // Interactive states
        "disabled": "var(--color-disabled)",
        "focus-ring": "var(--color-focus-ring)",
        "focus-visible": "var(--color-focus-visible)",
        
        // Links
        "link": "var(--color-link)",
        "link-hover": "var(--color-link-hover)",
        "link-visited": "var(--color-link-visited)",

        // Convenience shortcuts
        "divider": "var(--color-divider)",                  // #3a3a3a

        // ODS namespace - FLAT structure to match ui-kit component usage
        "ods-bg": "var(--color-bg)",
        "ods-card": "var(--color-bg-card)",
        "ods-bg-hover": "var(--color-bg-hover)",
        "ods-bg-active": "var(--color-bg-active)",
        "ods-bg-surface": "var(--color-bg-surface)",
        "ods-border": "var(--color-border-default)",
        "ods-border-hover": "var(--color-border-hover)",
        "ods-border-focus": "var(--color-border-focus)",
        "ods-divider": "var(--color-divider)",
        "ods-text-primary": "var(--color-text-primary)",
        "ods-text-secondary": "var(--color-text-secondary)",
        "ods-text-tertiary": "var(--color-text-tertiary)",
        "ods-text-muted": "var(--color-text-muted)",
        "ods-text-disabled": "var(--color-text-disabled)",
        "ods-text-on-accent": "var(--color-text-on-accent)",
        "ods-text-on-dark": "var(--color-text-on-dark)",
        "ods-accent": "var(--color-accent-primary)",
        "ods-accent-hover": "var(--color-accent-hover)",
        "ods-accent-active": "var(--color-accent-active)",
        "ods-focus": "var(--color-focus-ring)",
        "ods-disabled": "var(--color-disabled)",
        "ods-success": "var(--color-success)",
        "ods-success-hover": "var(--color-success-hover)",
        "ods-error": "var(--color-error)",
        "ods-error-hover": "var(--color-error-hover)",
        "ods-warning": "var(--color-warning)",
        "ods-warning-hover": "var(--color-warning-hover)",
        "ods-info": "var(--color-info)",
        "ods-info-hover": "var(--color-info-hover)",
        "ods-link": "var(--color-link)",
        "ods-link-hover": "var(--color-link-hover)",

        // Adaptive current color (platform-specific)
        "ods-current": "var(--ods-current)",

        // Legacy nested structure (keep for any existing usage)
        ods: {
          bg: "var(--color-bg)",
          card: "var(--color-bg-card)",
          overlay: "var(--color-bg-overlay)",
          skeleton: "var(--color-bg-skeleton)",
          border: "var(--color-border-default)",
          bgHover: "var(--color-bg-hover)",
          "bg-hover": "var(--color-bg-hover)",
          "card-hover": "var(--color-bg-hover)",
          "bg-active": "var(--color-bg-active)",
          bgActive: "var(--color-bg-active)",
          divider: "var(--color-divider)",
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
          accent: {
            DEFAULT: "var(--color-accent-primary)",
            hover: "var(--color-accent-hover)",
            active: "var(--color-accent-active)",
            focus: "var(--color-accent-focus)",
            disabled: "var(--color-accent-disabled)",
          },
          success: {
            DEFAULT: "var(--color-success)",
            hover: "var(--color-success-hover)",
            active: "var(--color-success-active)",
          },
          error: {
            DEFAULT: "var(--color-error)",
            hover: "var(--color-error-hover)",
            active: "var(--color-error-active)",
          },
          warning: {
            DEFAULT: "var(--color-warning)",
            hover: "var(--color-warning-hover)",
            active: "var(--color-warning-active)",
          },
          info: {
            DEFAULT: "var(--color-info)",
            hover: "var(--color-info-hover)",
            active: "var(--color-info-active)",
          },
          disabled: "var(--color-disabled)",
          focus: "var(--color-focus-ring)",
          "focus-visible": "var(--color-focus-visible)",
          link: {
            DEFAULT: "var(--color-link)",
            hover: "var(--color-link-hover)",
            visited: "var(--color-link-visited)",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        mono: ["Azeret Mono", "monospace"],
        body: ["DM Sans", "sans-serif"],
        heading: ["Azeret Mono", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}