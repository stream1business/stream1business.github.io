/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nova: {
          teal: '#2DE1C2',
          violet: '#8A4FFF',
          shadow: '#120826',
          glow: '#B58CFF'
        }
      },
      fontFamily: {
        display: ['Orbitron', 'Michroma', 'Rajdhani', 'sans-serif']
      },
      letterSpacing: {
        nova: '0.15em'
      }
    }
  },
  plugins: []
}
