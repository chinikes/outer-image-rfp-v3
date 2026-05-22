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
          navy: "#0F2027",
          "navy-mid": "#1A3040",
          "navy-light": "#203A43",
          teal: "#2C7A7B",
          "teal-light": "#38B2AC",
          "teal-accent": "#4FD1C5",
          gold: "#D4A843",
          "gold-light": "#E8C96A",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
