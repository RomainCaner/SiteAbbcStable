/**
 * ui/balltravel.js — Le ballon descend la page avec le visiteur.
 *
 * Au-delà du hero, le ballon quitte son cadre, rétrécit, et rebondit le long
 * de la marge droite. Arrivé en bas, il se pose à la place du bouton
 * « retour en haut » et en prend le rôle.
 *
 * Ce module ne crée pas une seconde scène 3D : il déplace le canvas existant
 * dans une couche fixe (voir `BasketballScene.attachTo`). Rendre le conteneur
 * du hero `position: fixed` ferait s'effondrer la mise en page derrière lui, et
 * la page sauterait sous le curseur.
 *
 * Le ballon est un **objet physique**, pas une courbe. Une première version
 * calait sa hauteur sur une fonction du défilement : réversible, mais dès qu'on
 * arrêtait de défiler le ballon restait figé en plein vol — un ballon suspendu
 * en l'air ne trompe personne.
 *
 * Désormais le défilement **donne de l'énergie** — chaque cran de molette est
 * une impulsion vers le haut, comme un dribble — et la gravité fait le reste.
 * S'arrêter ne fige plus rien : le ballon retombe, rebondit de moins en moins
 * haut, et se pose. Seule la position horizontale reste calée sur la
 * progression dans la page, où l'immobilité est naturelle.
 */

const SETTINGS = {
  // En dessous, la fenêtre est trop étroite : le ballon passerait sur le texte
  // au lieu de longer la marge.
  minWidth: 640,
  // Part de la largeur de fenêtre balayée par l'arc horizontal. Au-delà, le
  // ballon quitte la marge droite et vient couvrir le contenu.
  sweep: 0.2,
  gutter: 24,
  landAt: 0.985,      // part du parcours au-delà de laquelle le ballon se pose

  // --- Physique, en pixels et en secondes ---
  gravity: 2600,
  restitution: 0.66,  // part de la vitesse conservée au rebond
  kickPerPixel: 7,    // impulsion vers le haut, par pixel défilé
  // Plafond de vitesse, pas seulement par impulsion : sans lui, six crans de
  // molette d'affilee s'additionnent et le ballon se colle en haut de l'ecran.
  // 1500 px/s culmine a ~430 px, la hauteur d'un beau rebond.
  speedMax: 1500,
  restSpeed: 110,     // en dessous, le rebond ne se voit plus : on se pose
  maxStep: 1 / 30,    // pas d'intégration maximal, si l'onglet a été en pause
  ceiling: 48,        // hauteur maximale, pour rester sous l'en-tête

  spinPerPixel: 0.0008,
  squashDecay: 0.82,
  easeX: 0.16,        // lissage du déplacement horizontal
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
  let frameId = null;
  let lastTime = 0;

  // État physique. `height` est la hauteur au-dessus du sol, en pixels : zéro
  // quand le ballon touche, positif quand il est en l'air.
  let height = 0;
  let velocity = 0;
  let x = 0;
  let squash = 0;

  /** Position au repos du ballon posé : celle du bouton « retour en haut ». */
  function restingX(size) {
    if (toTop) {
      const r = toTop.getBoundingClientRect();
      if (r.width) return r.left + r.width / 2 - size / 2;
    }
    return window.innerWidth - size - SETTINGS.gutter;
  }

  /** Progression dans la page, une fois le hero dépassé. */
  function progress(rect) {
    const start = window.scrollY + rect.bottom;
    const end = document.documentElement.scrollHeight - window.innerHeight;
    return end > start ? clamp((window.scrollY - start) / (end - start)) : 1;
  }

  function stopLoop() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function detach() {
    stopLoop();
    if (!travelling) return;
    travelling = false;
    landed = false;
    height = 0;
    velocity = 0;
    squash = 0;
    host.classList.remove('is-travelling', 'is-landed');
    document.body.classList.remove('has-landed-ball');
    scene.attachTo(hero);
    scene.setSquash(0);
  }

  /**
   * Une image de simulation. Tourne tant que le ballon bouge, s'arrête de
   * lui-même une fois posé — inutile de brûler du CPU pour un ballon immobile.
   */
  function step(now) {
    frameId = null;
    const dt = Math.min((now - lastTime) / 1000 || 0, SETTINGS.maxStep);
    lastTime = now;

    const rect = hero.getBoundingClientRect();
    if (rect.bottom > 0 || window.innerWidth < SETTINGS.minWidth) { detach(); return; }

    const size = host.offsetWidth || 96;
    const floor = window.innerHeight - size - SETTINGS.gutter;
    const p = progress(rect);
    const atEnd = p >= SETTINGS.landAt;

    // --- Vertical : intégration, rebond, mise au repos ---
    velocity -= SETTINGS.gravity * dt;
    height += velocity * dt;

    if (height <= 0) {
      height = 0;
      if (velocity < -SETTINGS.restSpeed) {
        velocity = -velocity * SETTINGS.restitution;
        // L'écrasement est proportionnel à la violence du contact.
        squash = clamp(Math.abs(velocity) / 900);
      } else {
        velocity = 0;
      }
    }

    // Plafond : le ballon ne doit pas passer derrière l'en-tête.
    const maxHeight = floor - SETTINGS.ceiling;
    if (height > maxHeight) {
      height = maxHeight;
      if (velocity > 0) velocity = 0;
    }

    // --- Horizontal : arc lié à la progression, lissé ---
    const right = window.innerWidth - size - SETTINGS.gutter;
    const targetX = atEnd
      ? restingX(size)
      : right - window.innerWidth * SETTINGS.sweep * Math.sin(p * Math.PI);
    x += (targetX - x) * SETTINGS.easeX;

    host.style.translate = `${Math.round(x)}px ${Math.round(floor - height)}px`;

    squash *= SETTINGS.squashDecay;
    scene.setSquash(squash);

    // --- Posé : le ballon prend le rôle du bouton ---
    const resting = height === 0 && velocity === 0 && Math.abs(targetX - x) < 1;
    if (atEnd && resting && !landed) {
      landed = true;
      host.classList.add('is-landed');
      document.body.classList.add('has-landed-ball');
    } else if (landed && !atEnd) {
      landed = false;
      host.classList.remove('is-landed');
      document.body.classList.remove('has-landed-ball');
    }

    // Immobile et en place : on rend la main jusqu'au prochain défilement.
    if (!resting || squash > 0.01) frameId = requestAnimationFrame(step);
  }

  function wake() {
    if (frameId === null) {
      lastTime = performance.now();
      frameId = requestAnimationFrame(step);
    }
  }

  function onScroll() {
    if (window.innerWidth < SETTINGS.minWidth) { detach(); return; }

    const rect = hero.getBoundingClientRect();
    if (rect.bottom > 0) { detach(); return; }

    if (!travelling) {
      travelling = true;
      host.classList.add('is-travelling');
      scene.attachTo(host);
      scene.start();

      // Départ posé au sol, à droite : le premier cran de molette le fait
      // bondir, plutôt que de le faire apparaître en l'air.
      const size = host.offsetWidth || 96;
      x = window.innerWidth - size - SETTINGS.gutter;
      height = 0;
      velocity = 0;
    }

    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;

    // Chaque pixel défilé pousse le ballon vers le haut, dans les deux sens :
    // remonter la page le fait rebondir autant que la descendre.
    velocity = Math.min(
      velocity + Math.abs(delta) * SETTINGS.kickPerPixel,
      SETTINGS.speedMax,
    );
    scene.addSpin(delta * SETTINGS.spinPerPixel);

    wake();
  }

  host.addEventListener('click', () => {
    if (landed) window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  return {
    destroy() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      detach();
      host.remove();
    },
  };
}
