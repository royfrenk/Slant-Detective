import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{tsx,ts}"],
  theme: {
    extend: {
      colors: {
        background: "#f7f9fb",
        surface: "#ffffff",
        "surface-variant": "#f2f4f6",
        primary: "#1e293b",
        "primary-container": "#334155",
        "on-primary": "#ffffff",
        "on-surface": "#191c1e",
        "on-surface-variant": "#45474c",
        outline: "#e1e3e8",
        tertiary: "#ba1a1a",
        "primary-fixed": "#00668a",
        "on-tertiary-container": "#e96666",
        "slate-chip": "#64748b",
        "dim-word-choice": "#6d28d9",
        "dim-framing": "#0891b2",
      },
      boxShadow: {
        ambient: "0 12px 32px -4px rgba(25, 28, 30, 0.08)",
        chrome: "0 1px 0 0 rgba(25, 28, 30, 0.06)",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s ease-in-out infinite",
      },
      letterSpacing: {
        wordmark: "0.12em",
        "smoke-label": "0.08em",
      },
    },
  },
  plugins: [],
};

export default config;
