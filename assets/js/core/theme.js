/**
 * core/theme.js — Thème clair / sombre.
 *
 * Le thème est appliqué très tôt par un script inline dans le `<head>` de
 * chaque page (voir `partials/head-theme`), afin d'éviter le flash de contenu
 * clair avant l'exécution des modules. Ce fichier ne gère que la suite :
 * lecture de l'état courant, bascule, persistance et icônes.
 */

const STORAGE_KEY = 'abbc-theme';
const root = document.documentElement;

/** Thème actuellement appliqué (`'light'` ou `'dark'`). */
export const currentTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

function syncIcons(theme) {
  document.querySelectorAll('[data-theme-icon]').forEach((icon) => {
    icon.classList.toggle('fa-moon', theme !== 'dark');
    icon.classList.toggle('fa-sun', theme === 'dark');
  });
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Navigation privée ou stockage refusé : le thème vaut pour la session.
  }
  syncIcons(theme);
  document.dispatchEvent(new CustomEvent('abbc:themechange', { detail: { theme } }));
}

/** Bascule clair ↔ sombre. */
export function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

/** Branche les boutons de bascule présents dans la navbar (desktop + mobile). */
export function initTheme() {
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', toggleTheme);
  });
  syncIcons(currentTheme());
}
