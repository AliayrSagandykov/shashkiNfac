/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        board: {
          light: '#F0D9B5',
          dark: '#B58863',
        },
      },
    },
  },
  plugins: [],
}
