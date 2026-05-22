/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0b10',
        'bg-elev': '#14151e',
        'bg-elev-2': '#1a1c28',
        border: '#232636',
        'border-bright': '#2e3247',
        text: '#f0f1f5',
        'text-dim': '#8b8fa3',
        'text-muted': '#5a5e72',
        lime: '#d4ff3a',
        'brand-green': '#2dd674',
        'brand-red': '#ff4757',
        purple: '#a78bfa',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
