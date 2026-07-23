/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nova: {
          teal: '#2DE1C2',
          violet: '#8A4FFF',
          indigo: '#120826',
          halo: '#B58CFF'
        }
      },
      fontFamily: {
        display: ['Orbitron', 'Michroma', 'Rajdhani', 'sans-serif']
      }
    }
  },
  plugins: []
}
