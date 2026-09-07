/**
 * ui/reveal.js — Animations d'apparition au scroll et compteurs animés.
 *
 * Le module expose `observe()` pour que le contenu injecté après coup
 * (événements, actualités, équipes) bénéficie du même effet que le HTML
 * statique, sans que chaque module ait à connaître l'IntersectionObserver.
 *
 * Si l'utilisateur a demandé à réduire les animations, tout est affiché
 * immédiatement et aucun observateur n'est créé.
 */

import { prefersReducedMotion } from '../core/dom.js';

const REVEAL_SELECTOR = '.reveal';

let revealObserver = null;
let reducedMotion = false;

function reveal(element) {
  element.classList.add('is-revealed');
}

/**
 * Révèle les éléments animés contenus dans `root`.
 * Appelé au démarrage sur `document`, puis sur chaque conteneur rempli
 * dynamiquement.
 */
export function observe(root = document) {
  if (!root) return;
  const targets = root.querySelectorAll(REVEAL_SELECTOR);
  if (reducedMotion || !revealObserver) {
    targets.forEach(reveal);
    return;
  }
  targets.forEach((element) => revealObserver.observe(element));
}

/** Compteurs `[data-counter]` : 0 → valeur cible quand la carte devient visible. */
function animateCounter(element) {
  const target = Number.parseInt(element.dataset.counter, 10);
  const suffix = element.dataset.suffix || '';
  if (Number.isNaN(target)) return;

  if (reducedMotion) {
    element.textContent = target + suffix;
    return;
  }

  const duration = 1500;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - progress) ** 3; // ease-out cubique
    element.textContent = Math.round(target * eased) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  if (reducedMotion) {
    counters.forEach(animateCounter);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animateCounter(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.4 });

  counters.forEach((counter) => observer.observe(counter));
}

/** Met en place les animations d'apparition pour toute la page. */
export function initReveal() {
  reducedMotion = prefersReducedMotion();

  if (!reducedMotion) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  }

  observe(document);
  initCounters();
}
