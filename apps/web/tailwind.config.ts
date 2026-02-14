import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1440px"
      }
    },
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        base: "hsl(var(--bg-base))",
        panel: "hsl(var(--bg-panel))",
        elevated: "hsl(var(--bg-elevated))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))"
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))"
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))"
        },
        signal: {
          up: "hsl(var(--signal-up))",
          down: "hsl(var(--signal-down))",
          neutral: "hsl(var(--signal-neutral))"
        }
      },
      borderRadius: {
        xl: "1rem",
        lg: "0.8rem",
        md: "0.6rem",
        sm: "0.4rem"
      },
      boxShadow: {
        panel: "0 18px 45px -24px rgba(0,0,0,0.68)",
        glow: "0 0 0 1px rgba(45, 212, 191, 0.3), 0 18px 40px -18px rgba(45, 212, 191, 0.28)",
        redglow: "0 0 0 1px rgba(248, 113, 113, 0.35), 0 18px 40px -18px rgba(248, 113, 113, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;
