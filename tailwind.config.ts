import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#0f172a",
          foreground: "#f8fafc"
        },
        accent: {
          DEFAULT: "#22d3ee",
          ring: "#0ea5e9"
        }
      },
      boxShadow: {
        panel: "0 16px 40px -24px rgba(15, 23, 42, 0.45)"
      },
      gridTemplateColumns: {
        panel: "360px minmax(0, 1fr)"
      }
    }
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")]
};

export default config;
