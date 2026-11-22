/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: { extend: { fontFamily: { sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'] } } },
  plugins: [],
};
