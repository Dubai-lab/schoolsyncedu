/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./student.html",
    "./attend.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Space-separated RGB channels behind CSS variables, with the original
        // values as fallbacks. Two things depend on this shape:
        //   - the <alpha-value> placeholder keeps opacity modifiers working
        //     (bg-primary-50/30 and friends — 69 of them across the codebase),
        //     which a plain var(--x, #hex) colour would silently break
        //   - the mobile app retints every primary-* utility at once by setting
        //     these variables to a school's brand colour
        // The web app never sets them, so it renders exactly as before.
        primary: {
          50:  'rgb(var(--brand-50-rgb,  240 244 255) / <alpha-value>)',
          100: 'rgb(var(--brand-100-rgb, 224 233 255) / <alpha-value>)',
          500: 'rgb(var(--brand-500-rgb,  59  95 226) / <alpha-value>)',
          600: 'rgb(var(--brand-600-rgb,  45  79 214) / <alpha-value>)',
          700: 'rgb(var(--brand-700-rgb,  30  59 191) / <alpha-value>)',
          900: 'rgb(var(--brand-900-rgb,  15  31 107) / <alpha-value>)',
        },
        accent: {
          500: '#f59e0b',
          600: '#d97706',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}