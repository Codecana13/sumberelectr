/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Merah Putih theme
        primary: '#B91C1C', // red-700
        secondary: '#EF4444', // red-500
        dark: '#7F1D1D', // red-900
        // Keep legacy aliases but map to red tones for seamless migration
        blueDark: '#7F1D1D',
        blueMedium: '#B91C1C',
        blueLight: '#F87171',
      },
    },
  },
  plugins: [],
}
