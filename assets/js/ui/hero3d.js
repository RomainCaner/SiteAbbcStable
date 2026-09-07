/**
 * ui/hero3d.js — Ballon de basket 3D du bandeau d'accueil.
 *
 * Trois.js est chargé dynamiquement depuis un CDN, uniquement si la page
 * contient un conteneur `[data-hero3d]` et que WebGL est disponible : les
 * autres pages ne paient pas le coût du téléchargement.
 *
 * Le ballon est entièrement procédural (géométrie + texture dessinée sur un
 * `<canvas>`) : aucun fichier de modèle à héberger, et tout se règle depuis
 * l'objet `SETTINGS` ci-dessous.
 *
 * Comportements :
 *   - rotation automatique et léger flottement vertical ;
 *   - glisser à la souris ou au doigt pour faire tourner le ballon ;
 *   - rendu mis en pause hors écran et quand l'onglet est masqué ;
 *   - `prefers-reduced-motion` : une seule image, aucune animation ;
 *   - sans WebGL ou sans réseau : le contenu de repli du HTML reste affiché.
 */

/** Version figée : à faire évoluer volontairement, pas au fil de l'eau. */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js';

const SETTINGS = {
  ballRadius: 1,
  cameraDistance: 4.4,
  autoSpin: 0.35,       // vitesse de rotation automatique, en radians/seconde
  floatAmplitude: 0.06, // amplitude du flottement vertical, en unités de scène
  floatSpeed: 0.8,
  dragSensitivity: 0.006,
  damping: 0.94,        // inertie après un glisser (0 = arrêt net, 1 = infini)
  leather: '#c8622a',
  leatherLight: '#e8873f',
  seam: '#1b1614',
};

/**
 * Texture du ballon dessinée sur un canvas 2D.
 *
 * L'image est plaquée en projection équirectangulaire : une ligne horizontale
 * devient un cercle autour du ballon (l'équateur), une ligne verticale devient
 * un méridien. Les deux sinusoïdes forment les coutures incurvées.
 */
function createBallTexture(THREE) {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Cuir : dégradé vertical pour donner du relief avant même l'éclairage.
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, SETTINGS.leather);
  gradient.addColorStop(0.5, SETTINGS.leatherLight);
  gradient.addColorStop(1, SETTINGS.leather);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Grain du cuir : semis de points sombres translucides.
  ctx.fillStyle = 'rgba(90, 45, 20, 0.16)';
  for (let i = 0; i < 9000; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 1.6 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = SETTINGS.seam;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';

  // Équateur.
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // Méridiens (les deux moitiés d'un même grand cercle passant par les pôles).
  [0.25, 0.75].forEach((ratio) => {
    ctx.beginPath();
    ctx.moveTo(width * ratio, 0);
    ctx.lineTo(width * ratio, height);
    ctx.stroke();
  });

  // Coutures incurvées, symétriques par rapport à l'équateur.
  [1, -1].forEach((direction) => {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = height / 2 + direction * height * 0.34 * Math.sin((x / width) * Math.PI * 2);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Ombre portée : un disque dégradé posé à plat sous le ballon. */
function createShadow(THREE) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
  gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.45;
  return mesh;
}

/** `true` si le navigateur sait créer un contexte WebGL. */
function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

/**
 * Scène complète : création, boucle de rendu, interactions, destruction.
 * Instanciée par `initHero3D()` ; `dispose()` libère toutes les ressources GPU.
 */
class BasketballScene {
  constructor(THREE, container) {
    this.THREE = THREE;
    this.container = container;
    this.clock = new THREE.Clock();
    this.spinVelocity = 0;
    this.dragging = false;
    this.lastPointerX = 0;
    this.visible = true;
    this.frameId = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.buildScene();
    this.attachEvents();
  }

  buildScene() {
    const { THREE, container } = this;
    const { clientWidth: width, clientHeight: height } = container;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    this.camera.position.set(0, 0.55, SETTINGS.cameraDistance);
    this.camera.lookAt(0, -0.1, 0); // legere plongee : l'ombre au sol reste lisible

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(SETTINGS.ballRadius, 96, 96),
      new THREE.MeshStandardMaterial({
        map: createBallTexture(THREE),
        roughness: 0.78,
        metalness: 0.02,
      }),
    );
    this.ball.rotation.z = 0.28; // légère inclinaison, plus naturelle qu'un axe droit

    this.pivot = new THREE.Group();
    this.pivot.add(this.ball);
    this.scene.add(this.pivot);
    this.scene.add(createShadow(THREE));

    // Éclairage « studio » : ambiance douce, lumière principale, deux liserés
    // aux couleurs du club pour détacher le ballon du fond.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x2b2118, 1.1));

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(3, 4, 5);
    this.scene.add(key);

    const rimBlue = new THREE.PointLight(0x3b82f6, 18, 12);
    rimBlue.position.set(-3.5, 1.5, -2.5);
    this.scene.add(rimBlue);

    const rimGreen = new THREE.PointLight(0x10b981, 12, 12);
    rimGreen.position.set(3, -2, -2.5);
    this.scene.add(rimGreen);
  }

  attachEvents() {
    const canvas = this.renderer.domElement;
    canvas.style.touchAction = 'pan-y'; // le glisser vertical continue de scroller

    this.onPointerDown = (event) => {
      this.dragging = true;
      this.lastPointerX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
      this.container.classList.add('is-grabbing');
    };

    this.onPointerMove = (event) => {
      if (!this.dragging) return;
      const delta = event.clientX - this.lastPointerX;
      this.lastPointerX = event.clientX;
      this.spinVelocity = delta * SETTINGS.dragSensitivity;
      this.pivot.rotation.y += this.spinVelocity;
    };

    this.onPointerUp = (event) => {
      this.dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      this.container.classList.remove('is-grabbing');
    };

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    // Ne pas dépenser de GPU pour une scène hors écran ou un onglet en arrière-plan.
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.start();
      else this.stop();
    }, { threshold: 0.01 });
    this.intersectionObserver.observe(this.container);

    this.onVisibilityChange = () => {
      if (document.hidden) this.stop();
      else if (this.visible) this.start();
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.render(this.scene, this.camera);
  }

  frame() {
    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    // Inertie du glisser, qui s'estompe pour revenir à la rotation automatique.
    // Pendant le glisser, la rotation est appliquée par `onPointerMove`.
    this.spinVelocity *= SETTINGS.damping;
    if (!this.dragging) {
      this.pivot.rotation.y += this.spinVelocity + SETTINGS.autoSpin * delta;
    }

    this.pivot.position.y = Math.sin(elapsed * SETTINGS.floatSpeed) * SETTINGS.floatAmplitude;
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(() => this.frame());
  }

  start() {
    if (this.reducedMotion) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.frameId === null) {
      this.clock.getDelta(); // absorbe le temps écoulé pendant la pause
      this.frame();
    }
  }

  stop() {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /** Libère écouteurs, observateurs et ressources GPU. */
  dispose() {
    this.stop();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    this.scene.traverse((object) => {
      object.geometry?.dispose();
      const materials = [].concat(object.material || []);
      materials.forEach((material) => {
        material.map?.dispose();
        material.dispose?.();
      });
    });

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/**
 * Initialise la scène si la page en contient une.
 * @returns {Promise<BasketballScene|null>} `null` si la 3D n'a pas pu démarrer.
 */
export async function initHero3D() {
  const container = document.querySelector('[data-hero3d]');
  if (!container) return null;

  if (!supportsWebGL()) {
    container.dataset.hero3dState = 'unsupported';
    return null;
  }

  try {
    const THREE = await import(THREE_URL);
    const scene = new BasketballScene(THREE, container);
    container.dataset.hero3dState = 'ready';
    scene.start();
    return scene;
  } catch (error) {
    console.warn('[ABBC] Scène 3D non chargée :', error);
    container.dataset.hero3dState = 'failed';
    return null;
  }
}
