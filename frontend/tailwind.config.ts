import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#08080C",
        card: "#12121A",
        card2: "#1A1A24",
        border: "#242433",
        accent: "#7C5CFF",
        accent2: "#00E5FF",
        muted: "#9A9AAF",
        muted2: "#6B6B80",
        success: "#00E676",
      },
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
