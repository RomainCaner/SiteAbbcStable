/**
 * core/dom.js — Helpers DOM et formatage.
 *
 * Aucune dépendance : ce module ne connaît ni les données du site,
 * ni son interface. Il ne contient que des fonctions pures ou des
 * raccourcis sur le document.
 */

/** Raccourci `querySelector` (retourne `null` si absent). */
export const qs = (selector, root = document) => root.querySelector(selector);

/** Raccourci `querySelectorAll` renvoyant un vrai tableau. */
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/**
 * Échappe une valeur avant injection dans du HTML.
 * À utiliser sur TOUTE donnée venant d'un fichier JSON.
 */
export function escapeHTML(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

/** Date ISO (AAAA-MM-JJ) → « samedi 11 décembre 2026 ». */
export function formatDateFR(iso) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso || '';
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Date du jour au format ISO, pour comparer des chaînes AAAA-MM-JJ. */
export const todayISO = () => new Date().toISOString().slice(0, 10);

/** `true` si l'utilisateur a demandé à réduire les animations. */
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
