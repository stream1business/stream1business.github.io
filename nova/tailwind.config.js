/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nova: {
          bg: '#000000',
          teal: '#2DE1C2',
          violet: '#8A4FFF',
          shadow: '#120826',
          glow: '#B58CFF'
        }
      },
      fontFamily: {
        display: ['Orbitron', 'Michroma', 'Rajdhani', 'sans-serif']
      }
    }
  },
  plugins: []
}
