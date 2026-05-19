/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './equipes/*.html',
    './partials/*.html',
    './assets/js/*.js',
  ],
  theme: {
    extend: {
      colors: {
        abbc: {
          blue: '#1e3a8a',
          green: '#059669',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
