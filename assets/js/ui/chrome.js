/**
 * ui/chrome.js — Éléments d'interface présents sur toutes les pages :
 * barre de progression au scroll et bouton « retour en haut ».
 *
 * Les deux dépendent du footer/navbar injectés : à appeler après
 * `loadPartials()`.
 */

/** Barre fine en haut de page indiquant la progression de lecture. */
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;

  const update = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    bar.style.width = `${ratio * 100}%`;
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}

/** Bouton flottant qui apparaît après 400 px de défilement. */
function initBackToTop() {
  const button = document.getElementById('back-to-top');
  if (!button) return;

  window.addEventListener('scroll', () => {
    button.classList.toggle('is-visible', window.scrollY > 400);
  }, { passive: true });

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

export function initChrome() {
  initScrollProgress();
  initBackToTop();
}
