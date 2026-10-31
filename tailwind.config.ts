import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#F6F1E7",
          subtle: "#EDE7DC",
          card: "#FBF8F3",
        },
        ink: {
          DEFAULT: "#1F1B16",
          muted: "#6B6357",
          faint: "#9C9487",
        },
        chilli: {
          DEFAULT: "#A32A1B",
          hover: "#882215",
          light: "#FDF2F0",
        },
        rule: "#DCD4C5",
        veg: "#167E36",
        nonveg: "#A32A1B",
        pos: {
          bg: "#0F1115",
          panel: "#171B21",
          card: "#1F242C",
          border: "#2E3642",
          text: "#E5E7EB",
          muted: "#9CA3AF",
        },
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Fraunces", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "4px",
      },
      boxShadow: {
        none: "none",
        flat: "0 1px 0 rgba(0,0,0,0.06)",
        kds: "0 2px 4px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};
export default config;
