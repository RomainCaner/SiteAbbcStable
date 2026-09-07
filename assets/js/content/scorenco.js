/**
 * content/scorenco.js — Intégration des widgets Score'n'co.
 *
 * Le script de Score'n'co scanne le DOM au chargement : si l'on injecte les
 * widgets après coup (pages d'équipe générées en JS), ils ne sont pas
 * détectés. On charge donc le script *après* avoir posé les conteneurs, et
 * une seule fois par page.
 *
 * Où trouver un identifiant de widget : sur scorenco.com, ouvrir l'équipe
 * ou la compétition → « Partager » → « Widget » → l'ID figure dans le code
 * fourni (`data-widget-id`). Il se renseigne ensuite dans `teams.json`
 * (par équipe) ou `config.json` (widgets du club).
 */

import { escapeHTML } from '../core/dom.js';

const SCRIPT_URL = 'https://widgets.scorenco.com/host/widgets.js';

let scriptPromise = null;

/**
 * Conteneur d'un widget Score'n'co, ou un encart d'attente si l'identifiant
 * n'est pas encore renseigné — mieux qu'un spinner qui tourne indéfiniment.
 *
 * @param {string} type  type de widget (`ranking`, `players`, `previous-next`…)
 * @param {string} id    identifiant Score'n'co, éventuellement vide
 * @param {string} hint  message affiché tant que l'identifiant manque
 */
export function widgetHTML(type, id, hint = 'Donnée bientôt disponible.') {
  if (!id) {
    return `
      <div class="scorenco-pending">
        <i class="fas fa-hourglass-half" aria-hidden="true"></i>
        <p>${escapeHTML(hint)}</p>
        <p class="scorenco-pending__help">Identifiant Score'n'co à renseigner dans <code>assets/data/teams.json</code>.</p>
      </div>`;
  }
  return `
    <div class="scorenco-widget" data-widget-type="${escapeHTML(type)}" data-widget-id="${escapeHTML(id)}">
      <div class="ldsdr" aria-hidden="true"></div>
      Score'n'co - ABB Cornebarrieu
    </div>`;
}

/**
 * Charge le script Score'n'co (une seule fois), après que les conteneurs
 * de widgets sont présents dans le DOM.
 */
export function loadScorenco() {
  if (scriptPromise) return scriptPromise;
  if (!document.querySelector('.scorenco-widget')) return Promise.resolve();

  scriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      console.warn('[ABBC] Widgets Score\'n\'co non chargés (réseau ou bloqueur de pub).');
      document.querySelectorAll('.scorenco-widget').forEach((node) => {
        node.classList.add('scorenco-widget--failed');
        node.textContent = 'Résultats momentanément indisponibles.';
      });
      resolve();
    });
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Widgets du club (hors équipes) déclarés dans `config.json`.
 * Aujourd'hui : le tableau des rencontres de la semaine sur l'accueil.
 */
export function renderClubWidgets(config) {
  const container = document.getElementById('club-week-events');
  if (!container) return;
  const id = config?.scorenco?.weekEvents || '';
  container.innerHTML = widgetHTML('week-events', id, 'Rencontres de la semaine bientôt disponibles.');
}
