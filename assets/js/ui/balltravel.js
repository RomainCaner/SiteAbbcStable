/**
 * ui/balltravel.js — Le ballon descend la page avec le visiteur.
 *
 * Au-delà du hero, le ballon quitte son cadre, rétrécit, et rebondit le long
 * du bord droit au rythme du défilement. Arrivé en bas, il se pose à la place
 * du bouton « retour en haut » et en prend le rôle.
 *
 * Ce que ce module ne fait pas : une seconde scène 3D. Il déplace le canvas
 * existant dans une couche fixe (voir `BasketballScene.attachTo`), ce qui évite
 * de rendre le conteneur du hero `position: fixed` — la mise en page du hero
 * s'effondrerait derrière lui, et la page sauterait sous le curseur.
 *
 * Le mouvement est **piloté par le défilement**, pas par le temps : remonter
 * défait exactement la descente. Une courbe amortie, plus réaliste pour une
 * vraie chute, se lirait à l'envers en remontant.
 */

const SETTINGS = {
  // En dessous, la fenêtre est trop étroite : le ballon passerait sur le texte
  // au lieu de longer la marge.
  minWidth: 640,
  bouncesMin: 3,
  bouncesMax: 6,
  // Part de la largeur de fenêtre balayée par l'arc horizontal. Au-delà, le
  // ballon quitte la marge droite et vient couvrir le contenu.
  sweep: 0.2,
  gutter: 24,
  apexOffset: 48,     // hauteur minimale du sommet de rebond, sous l'en-tête
  spinPerPixel: 0.0008,
  landAt: 0.985,      // part du parcours au-delà de laquelle le ballon se pose
};

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/**
 * Met en place le déplacement du ballon.
 * @param {object} scene instance de BasketballScene
 * @returns {{destroy: () => void}|null} null si le déplacement ne s'applique pas
 */
export function initBallTravel(scene) {
  if (!scene?.container || scene.reducedMotion) return null;

  const hero = scene.container;
  const host = document.createElement('div');
  host.className = 'ball-travel';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);

  const toTop = document.getElementById('back-to-top');

  let travelling = false;
  let landed = false;
  let lastScrollY = window.scrollY;
  let ticking = false;

  /** Nombre de rebonds : un par section, borné pour rester lisible. */
  function bounceCount() {
    const sections = document.querySelectorAll('main section').length;
    return clamp(sections, SETTINGS.bouncesMin, SETTINGS.bouncesMax);
  }

  /** Position au repos du ballon posé : celle du bouton « retour en haut ». */
  function restingSpot(size) {
    if (toTop) {
      const r = toTop.getBoundingClientRect();
      if (r.width) return { x: r.left + r.width / 2 - size / 2, y: r.top + r.height / 2 - size / 2 };
    }
    return { x: window.innerWidth - size - SETTINGS.gutter, y: window.innerHeight - size - SETTINGS.gutter };
  }

  function detach() {
    if (!travelling) return;
    travelling = false;
    landed = false;
    host.classList.remove('is-travelling', 'is-landed');
    document.body.classList.remove('has-landed-ball');
    scene.attachTo(hero);
    scene.setSquash(0);
  }

  function update() {
    ticking = false;

    if (window.innerWidth < SETTINGS.minWidth) { detach(); return; }

    const rect = hero.getBoundingClientRect();
    // Le relais se fait quand le cadre du hero est entièrement passé au-dessus.
    if (rect.bottom > 0) { detach(); return; }

    if (!travelling) {
      travelling = true;
      host.classList.add('is-travelling');
      scene.attachTo(host);
      scene.start();
    }

    const size = host.offsetWidth || 96;
    const start = window.scrollY + rect.bottom;   // position de page du relais
    const end = document.documentElement.scrollHeight - window.innerHeight;
    const p = end > start ? clamp((window.scrollY - start) / (end - start)) : 1;

    if (p >= SETTINGS.landAt) {
      // Posé : le ballon prend le rôle du bouton, qui s'efface.
      const spot = restingSpot(size);
      host.style.translate = `${spot.x}px ${spot.y}px`;
      scene.setSquash(0);
      if (!landed) {
        landed = true;
        host.classList.add('is-landed');
        document.body.classList.add('has-landed-ball');
      }
      return;
    }

    if (landed) {
      landed = false;
      host.classList.remove('is-landed');
      document.body.classList.remove('has-landed-ball');
    }

    const angle = p * Math.PI * bounceCount();
    // |sin| : symétrique, donc remonter défait la descente. La puissance
    // creuse l'approche du sol pour un contact plus franc.
    const bounce = Math.abs(Math.sin(angle)) ** 0.7;

    const floor = window.innerHeight - size - SETTINGS.gutter;
    const apex = SETTINGS.apexOffset;
    const y = floor - bounce * (floor - apex);

    const right = window.innerWidth - size - SETTINGS.gutter;
    const x = right - window.innerWidth * SETTINGS.sweep * Math.sin(p * Math.PI);

    host.style.translate = `${x}px ${y}px`;

    // L'écrasement ne vaut qu'au voisinage immédiat du sol.
    scene.setSquash(1 - clamp(bounce * 3.2));

    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    scene.addSpin(delta * SETTINGS.spinPerPixel);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  host.addEventListener('click', () => {
    if (landed) window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();

  return {
    destroy() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      detach();
      host.remove();
    },
  };
}
