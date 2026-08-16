import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        correct: "#4ade80",
        present: "#facc15",
        absent: "#6b7280",
      },
    },
  },
  plugins: [],
};

export default config;
