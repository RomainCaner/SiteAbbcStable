/**
 * ui/parallax.js — Parallaxe au défilement, pilotée par `transform`.
 *
 * Un élément participe en portant `data-parallax="<facteur>"` :
 *
 *   <div class="hero__media" data-parallax="0.22">
 *
 * Le facteur est la fraction du déplacement de l'élément dans la fenêtre qui
 * lui est rendue en sens inverse. Positif, il traîne derrière le défilement et
 * paraît loin ; négatif, il le devance et paraît proche. Deux ou trois valeurs
 * suffisent à donner de la profondeur — au-delà, l'effet se remarque plus que
 * la page.
 *
 * Trois partis pris :
 *
 *   - `transform` seulement, jamais `top` ni `background-position` : le
 *     navigateur compose sans recalculer la mise en page, et le défilement
 *     reste fluide.
 *   - Rien n'est calculé hors écran : un observateur d'intersection tient la
 *     liste des éléments visibles.
 *   - `prefers-reduced-motion` désactive tout, et remet les éléments à zéro.
 *
 * L'effet fonctionne sur mobile, avec une amplitude réduite : sur un écran
 * étroit, un même décalage se voit deux fois plus.
 */

const SETTINGS = {
  maxShift: 140,        // garde-fou, en pixels
  mobileWidth: 768,
  mobileDamping: 0.55,  // amplitude sur écran étroit
};

const SELECTOR = '[data-parallax]';

let observer = null;
const visible = new Set();
let ticking = false;
let damping = 1;

function apply() {
  ticking = false;
  const middle = window.innerHeight / 2;

  visible.forEach((element) => {
    const speed = Number.parseFloat(element.dataset.parallax);
    if (!Number.isFinite(speed) || speed === 0) return;

    const rect = element.getBoundingClientRect();
    // Écart entre le centre de l'élément et celui de la fenêtre : nul quand
    // l'élément est pile au milieu, d'où un décalage nul à ce moment-là.
    const delta = rect.top + rect.height / 2 - middle;
    const shift = Math.max(
      -SETTINGS.maxShift,
      Math.min(SETTINGS.maxShift, -delta * speed * damping),
    );
    element.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
  });
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(apply);
}

function onResize() {
  damping = window.innerWidth < SETTINGS.mobileWidth ? SETTINGS.mobileDamping : 1;
  onScroll();
}

/** Met en place la parallaxe sur tous les `[data-parallax]` de la page. */
export function initParallax() {
  const targets = document.querySelectorAll(SELECTOR);
  if (!targets.length) return null;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Remettre à plat : un élément peut porter une transformation héritée d'une
    // session précédente si la préférence a changé en cours de route.
    targets.forEach((element) => { element.style.transform = ''; });
    return null;
  }

  // La classe dit au CSS d'agrandir les couches de fond : sans marge, les
  // déplacer découvrirait un bord.
  document.documentElement.classList.add('has-parallax');

  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visible.add(entry.target);
      else {
        visible.delete(entry.target);
        entry.target.style.transform = '';
      }
    });
    onScroll();
  }, { rootMargin: '10% 0px' });

  targets.forEach((element) => observer.observe(element));

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  onResize();

  return {
    destroy() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
      visible.forEach((element) => { element.style.transform = ''; });
      visible.clear();
      document.documentElement.classList.remove('has-parallax');
    },
  };
}
