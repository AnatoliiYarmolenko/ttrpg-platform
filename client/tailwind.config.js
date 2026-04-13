/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-dark": "#164A41",
        "brand-medium": "#4D774E",
        "brand-light": "#9DC88D",
        "brand-accent": "#F1B24A",
        "brand-white": "#FFFFFF",
        brand: {
          dark: "#164A41",
          medium: "#4D774E",
          light: "#9DC88D",
          accent: "#F1B24A",
          white: "#FFFFFF",
        },
        'dark-teal': '#164A41',
        'medium-green': '#4D774E',
        'light-green': '#9DC88D',
        'golden-orange': '#F1B24A',
        'pure-white': '#FFFFFF',
      },
    },
  },
  plugins: [],
}

