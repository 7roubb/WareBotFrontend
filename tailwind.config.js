/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fffef2',
          100: '#fffce0',
          200: '#fff8c5',
          300: '#fff4a3',
          400: '#fff081',
          500: '#FFEB3B',
          600: '#fdd835',
          700: '#f9a825',
          800: '#f57f17',
          900: '#f57f17',
        },
        accent: {
          50: '#f8f9fa',
          100: '#f0f3f7',
          200: '#e1e8f0',
          300: '#c8d5e5',
          400: '#98abb8',
          500: '#6b7e8f',
          600: '#4a5f76',
          700: '#33455c',
          800: '#1f2d42',
          900: '#0f1821',
        },
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(135deg, #1f2d42 0%, #0f1821 100%)',
        'gradient-card': 'linear-gradient(135deg, #2a3d52 0%, #1f2d42 100%)',
        'gradient-yellow': 'linear-gradient(135deg, #FFEB3B 0%, #fdd835 100%)',
      },
      boxShadow: {
        'neo': '0 10px 30px rgba(0, 0, 0, 0.3)',
        'neo-md': '0 5px 15px rgba(0, 0, 0, 0.2)',
        'neo-sm': '0 2px 8px rgba(0, 0, 0, 0.15)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
