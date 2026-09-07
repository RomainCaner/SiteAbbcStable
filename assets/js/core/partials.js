/**
 * core/partials.js — Injection des fragments HTML partagés.
 *
 * La navbar et le footer vivent dans `partials/`. Ils sont chargés par `fetch`
 * puis insérés dans les conteneurs `[data-partial]` de la page. Le jeton
 * `{{base}}` présent dans les fragments est remplacé par la profondeur de la
 * page courante, pour que les liens restent corrects depuis `equipes/`.
 *
 * `fetch` ne fonctionne pas en `file://` : le site doit être servi en HTTP
 * (cf. README). En cas d'échec, un message explicite remplace le fragment
 * plutôt que de laisser une page muette.
 */

import { basePath, url } from './data.js';

async function loadPartial(container) {
  const name = container.dataset.partial;
  try {
    const res = await fetch(url(`partials/${name}.html`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const markup = (await res.text()).replaceAll('{{base}}', basePath);
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    container.replaceWith(template.content);
  } catch (error) {
    console.warn(`[ABBC] Fragment « ${name} » non chargé :`, error);
    container.innerHTML =
      '<p class="partial-error">Composant indisponible — le site doit être servi ' +
      'via un serveur HTTP (voir le README).</p>';
  }
}

/**
 * Charge tous les fragments de la page en parallèle.
 * @returns {Promise<void>} résolue une fois le DOM complet.
 */
export async function loadPartials() {
  const containers = Array.from(document.querySelectorAll('[data-partial]'));
  await Promise.all(containers.map(loadPartial));
}
