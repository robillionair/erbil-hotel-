/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#030305',
        basalt: '#0a0a0e',
        citadelGold: '#d4af37',
        travertine: '#f4f0ea',
        hairline: '#16161a',
        hudCell: '#040406',
        hudGrid: '#141418',
        cyberCyan: '#00f0ff',
        cyberEmerald: '#00e676',
        cyberMagenta: '#ff1e7a',
        cyberAmber: '#ff8a3d',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
