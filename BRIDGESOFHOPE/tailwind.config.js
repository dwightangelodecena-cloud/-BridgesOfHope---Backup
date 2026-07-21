/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Canonical Bridges of Hope brand orange (matches --bh-brand in styles/tokens.css).
        // Was '#f15a29' which appeared 0 times in the codebase; the real brand value is '#f54e25'.
        brand: {
          DEFAULT: '#f54e25',
          light: '#ff6a3d',
          hover: '#e0421a',
          strong: '#d63e17',
        },
      },
    },
  },
  plugins: [],
}