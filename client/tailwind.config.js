const RADIUS_TOKENS = {
  card: "1rem",
  control: "0.75rem",
  pill: "9999px",
};

const SPACING_TOKENS = {
  "18": "4.5rem",
  "22": "5.5rem",
  "30": "7.5rem",
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: RADIUS_TOKENS,
      spacing: SPACING_TOKENS,
    },
  },
  plugins: [],
};
