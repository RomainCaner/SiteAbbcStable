/**
 * Configuration Tailwind — utilisée uniquement par le build de production
 * (`npm run build:css`). En développement, le site charge le CDN Tailwind,
 * qui génère les classes à la volée.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [
    './*.html',
    './equipes/*.html',
    './partials/*.html',
    './assets/js/**/*.js',
  ],

  /**
   * Classes construites dynamiquement en JavaScript : Tailwind ne peut pas les
   * repérer en analysant le code, il faut donc les déclarer ici.
   *   - couleurs `color` des événements (assets/data/events.json)
   *   - accents des équipes (assets/data/teams.json)
   */
  safelist: [
    {
      pattern: /(bg|text|from|to)-(red|yellow|green|blue|purple|orange|cyan|emerald|pink)-(50|100|500|600|700)/,
    },
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
