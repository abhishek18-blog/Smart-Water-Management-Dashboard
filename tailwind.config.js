/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tech-cyan': '#00f2ff',
        'tech-dark': '#050505',
        'tech-panel': '#0f1115',
        'tech-border': '#2a3b47',
        'tech-alert': '#ff2a2a',
        'tech-warn': '#fbbf24',
        'tech-success': '#10b981',
      },
      fontFamily: {
        'display': ['Rajdhani', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}