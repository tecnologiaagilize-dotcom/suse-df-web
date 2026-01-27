/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2ECC71", // Green (Sustainability)
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#3498DB", // Blue (Trust)
          foreground: "#FFFFFF",
        },
        background: "#F5F7FA",
        foreground: "#2C3E50",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
