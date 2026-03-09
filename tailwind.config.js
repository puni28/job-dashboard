/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        applied: '#3B82F6',
        screening: '#F59E0B',
        interview: '#8B5CF6',
        offer: '#10B981',
        rejected: '#EF4444',
      },
    },
  },
  plugins: [],
};
