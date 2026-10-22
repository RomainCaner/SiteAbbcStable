/**
 * ui/balltravel.js — Le ballon descend la page avec le visiteur.
 *
 * Au-delà du hero, le ballon quitte son cadre, rétrécit, et se balade dans la
 * fenêtre. Arrivé en bas, il se pose à la place du bouton « retour en haut »
 * et en prend le rôle.
 *
 * Ce module ne crée pas une seconde scène 3D : il déplace le canvas existant
 * dans une couche fixe (voir `BasketballScene.attachTo`). Rendre le conteneur
 * du hero `position: fixed` ferait s'effondrer la mise en page derrière lui, et
 * la page sauterait sous le curseur.
 *
 * Le ballon est un **objet physique en deux dimensions**. Le défilement lui
 * donne de l'énergie — chaque cran de molette est une impulsion vers le haut
 * et un peu sur le côté, comme un dribble — et la gravité fait le reste : il
 * rebondit sur le sol et sur les bords de la fenêtre, roule, ralentit.
 *
 * On peut aussi **l'attraper et le lancer** à la souris (ou au doigt sur
 * tablette) : sa vitesse au lâcher est celle du geste.
 *
 * Pour ne pas finir posé sur un paragraphe, le ballon qui roule au sol est
 * ramené doucement vers sa place de repos, dans la marge droite — comme sur
 * un sol légèrement en pente. En l'air, rien ne le retient.
 */

const SETTINGS = {
  // En dessous, la fenêtre est trop étroite : le ballon passerait son temps
  // sur le texte.
  minWidth: 640,
  gutter: 24,
  landAt: 0.985,      // part du parcours au-delà de laquelle le ballon se pose

  // --- Physique verticale, en pixels et en secondes ---
  gravity: 2600,
  restitution: 0.66,  // part de la vitesse conservée au rebond
  kickPerPixel: 7,    // impulsion vers le haut, par pixel défilé
  // Plafond de vitesse : sans lui, six crans de molette d'affilée
  // s'additionnent et le ballon se colle en haut de l'écran.
  speedMax: 1500,
  restSpeed: 110,     // en dessous, le rebond ne se voit plus : on se pose
  maxStep: 1 / 30,    // pas d'intégration maximal, si l'onglet a été en pause
  ceiling: 48,        // hauteur maximale, pour rester sous l'en-tête

  // --- Physique horizontale ---
  sideKick: 0.55,       // part de l'impulsion verticale envoyée sur le côté
  sideSpeedMax: 1300,
  wallRestitution: 0.7, // rebond sur les bords de la fenêtre
  airDrag: 0.35,        // freinage en l'air (par seconde)
  rollFriction: 3,      // freinage au sol (par seconde)
  homePull: 9,          // rappel vers la place de repos, au sol seulement
  restSide: 6,          // vitesse horizontale sous laquelle on se pose

  // --- Lancer ---
  throwMax: 2200,       // vitesse maximale au lâcher
  tapSlop: 6,           // en deçà, en pixels, le geste est un clic

  spinPerPixel: 0.0008,
  rollSpin: 0.004,      // rotation quand il roule
  squashDecay: 0.82,
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
  // quand le ballon touche, positif quand il est en l'air. `x` est le bord
  // gauche du ballon dans la fenêtre.
  let height = 0;
  let velocity = 0;
  let x = 0;
  let vx = 0;
  let squash = 0;

  // Prise en main : position du pointeur et vitesse du geste.
  let drag = null;

  const sizeOf = () => host.offsetWidth || 96;
  const floorOf = (size) => window.innerHeight - size - SETTINGS.gutter;

  /**
   * Place de repos : en bas de page, celle du bouton « retour en haut », dont
   * le ballon prend le rôle ; ailleurs, juste à sa gauche — posé sur le
   * bouton, il le masquerait et intercepterait ses clics.
   */
  function homeX(size, atEnd) {
    const r = toTop?.getBoundingClientRect();
    if (r?.width) {
      return atEnd ? r.left + r.width / 2 - size / 2 : r.left - size - 12;
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

  function setLanded(value) {
    if (landed === value) return;
    landed = value;
    host.classList.toggle('is-landed', value);
    document.body.classList.toggle('has-landed-ball', value);
  }

  function detach() {
    stopLoop();
    drag = null;
    if (!travelling) return;
    travelling = false;
    height = 0;
    velocity = 0;
    vx = 0;
    squash = 0;
    setLanded(false);
    host.classList.remove('is-travelling', 'is-grabbed');
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

    const size = sizeOf();
    const floor = floorOf(size);
    const maxHeight = floor - SETTINGS.ceiling;
    const left = SETTINGS.gutter;
    const right = window.innerWidth - size - SETTINGS.gutter;
    const atEnd = progress(rect) >= SETTINGS.landAt;
    const home = homeX(size, atEnd);

    if (drag) {
      // Tenu en main : le ballon suit le pointeur, la physique attend.
      x = clamp(drag.x - size / 2, left, right);
      height = clamp(floor - (drag.y - size / 2), 0, maxHeight);
    } else {
      // --- Vertical : intégration, rebond au sol, plafond ---
      velocity -= SETTINGS.gravity * dt;
      height += velocity * dt;

      if (height <= 0) {
        height = 0;
        if (velocity < -SETTINGS.restSpeed) {
          velocity = -velocity * SETTINGS.restitution;
          // L'écrasement est proportionnel à la violence du contact.
          squash = Math.max(squash, clamp(Math.abs(velocity) / 900));
        } else {
          velocity = 0;
        }
      }
      if (height > maxHeight) {
        height = maxHeight;
        if (velocity > 0) velocity = -velocity * 0.3;
      }

      // --- Horizontal : freinage, rappel au sol, rebond sur les bords ---
      const onFloor = height === 0 && velocity === 0;
      if (onFloor) {
        vx += (home - x) * SETTINGS.homePull * dt;
        vx *= Math.exp(-SETTINGS.rollFriction * dt);
        scene.addSpin(vx * dt * SETTINGS.rollSpin);
      } else {
        vx *= Math.exp(-SETTINGS.airDrag * dt);
      }
      x += vx * dt;

      if (x < left || x > right) {
        x = x < left ? left : right;
        vx = -vx * SETTINGS.wallRestitution;
        squash = Math.max(squash, clamp(Math.abs(vx) / 2400));
        scene.addSpin(-vx * 0.0004);
      }

      // Presque arrivé et presque immobile : on cale, pour que la boucle s'arrête.
      if (onFloor && Math.abs(vx) < SETTINGS.restSide && Math.abs(home - x) < 1.5) {
        x = home;
        vx = 0;
      }
    }

    host.style.translate = `${Math.round(x)}px ${Math.round(floor - height)}px`;

    squash *= SETTINGS.squashDecay;
    scene.setSquash(squash);

    // --- Posé : le ballon prend le rôle du bouton ---
    const resting = !drag && height === 0 && velocity === 0 && vx === 0 && x === home;
    if (atEnd && resting) setLanded(true);
    else if (landed && (!atEnd || drag || !resting)) setLanded(false);

    // Immobile et en place : on rend la main jusqu'au prochain mouvement.
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
      x = homeX(sizeOf(), false);
      height = 0;
      velocity = 0;
      vx = 0;
    }

    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    if (drag) return;

    // Chaque pixel défilé pousse le ballon vers le haut, dans les deux sens :
    // remonter la page le fait rebondir autant que la descendre.
    const kick = Math.abs(delta) * SETTINGS.kickPerPixel;
    velocity = Math.min(velocity + kick, SETTINGS.speedMax);

    // …et sur le côté, au hasard, avec une préférence pour le côté le plus
    // dégagé : près d'un bord, il repart plutôt vers le centre.
    const size = sizeOf();
    const centre = (window.innerWidth - size) / 2;
    const bias = -(x - centre) / Math.max(centre, 1);
    const direction = clamp(Math.random() * 2 - 1 + bias * 0.8, -1, 1);
    vx = clamp(vx + direction * kick * SETTINGS.sideKick, -SETTINGS.sideSpeedMax, SETTINGS.sideSpeedMax);

    scene.addSpin(delta * SETTINGS.spinPerPixel);
    wake();
  }

  // --- Attraper et lancer ---

  function onPointerDown(event) {
    if (!travelling || event.button > 0) return;
    event.preventDefault();
    host.setPointerCapture(event.pointerId);
    host.classList.add('is-grabbed');
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      t: performance.now(),
      vx: 0,
      vy: 0,
      moved: false,
    };
    velocity = 0;
    vx = 0;
    wake();
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const now = performance.now();
    const dt = Math.max((now - drag.t) / 1000, 1 / 240);
    // Vitesse du geste, lissée : un dernier mouvement saccadé ne doit pas
    // décider seul de la trajectoire.
    drag.vx = drag.vx * 0.6 + ((event.clientX - drag.x) / dt) * 0.4;
    drag.vy = drag.vy * 0.6 + ((event.clientY - drag.y) / dt) * 0.4;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.t = now;
    if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > SETTINGS.tapSlop) drag.moved = true;
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const geste = drag;
    drag = null;
    host.classList.remove('is-grabbed');

    if (!geste.moved) {
      // Un clic : posé en bas de page, il remonte en haut ; sinon, il saute.
      if (landed) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      velocity = SETTINGS.speedMax * 0.8;
      vx = (Math.random() * 2 - 1) * 400;
    } else {
      // Lancé : la vitesse du geste devient celle du ballon. L'axe vertical
      // est inversé (l'écran descend, la hauteur monte).
      const vitesse = Math.hypot(geste.vx, geste.vy);
      const facteur = vitesse > SETTINGS.throwMax ? SETTINGS.throwMax / vitesse : 1;
      vx = geste.vx * facteur;
      velocity = -geste.vy * facteur;
      scene.addSpin(vx * 0.0006);
    }
    setLanded(false);
    wake();
  }

  host.addEventListener('pointerdown', onPointerDown);
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerup', onPointerUp);
  host.addEventListener('pointercancel', onPointerUp);

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
