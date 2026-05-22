/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#000000",
          dark: "#111111",
          gray: "#333333",
          "gray-mid": "#666666",
          "gray-light": "#999999",
          muted: "#f5f5f5",
          accent: "#000000",
          // Legacy aliases for backward compat during migration
          navy: "#000000",
          "navy-mid": "#111111",
          "navy-light": "#222222",
          teal: "#000000",
          "teal-light": "#333333",
          "teal-accent": "#444444",
          gold: "#000000",
          "gold-light": "#333333",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
