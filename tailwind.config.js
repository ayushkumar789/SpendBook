/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5c2d91',
        secondary: '#7c3aed',
        pagebg: '#f8f5ff',
        cashin: '#22c55e',
        cashout: '#ef4444',
        balance: '#3b82f6',
        card: '#ffffff',
        border: '#e2e8f0',
        muted: '#94a3b8',
        body: '#1e293b',
      },
    },
  },
  plugins: [],
};
