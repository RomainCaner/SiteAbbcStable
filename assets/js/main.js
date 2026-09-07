/**
 * main.js — Point d'entrée du site ABBC.
 *
 * Chargé en module (`<script type="module">`) : il est donc différé par
 * défaut, et le DOM est prêt à son exécution.
 *
 * Rôle : orchestrer, pas implémenter. Chaque comportement vit dans son
 * module, et les modules ne s'appellent pas entre eux — c'est ce fichier
 * qui décide de l'ordre.
 *
 *   core/    infrastructure (données, thème, fragments HTML, helpers)
 *   ui/      comportements d'interface, indépendants du contenu
 *   content/ rendu des données du club (config, agenda, actus, équipes)
 *
 * Le rendu des pages est piloté par le HTML : chaque module cherche ses
 * conteneurs (`#events-grid`, `#team-page`…) et ne fait rien s'il ne les
 * trouve pas. Ajouter une page revient donc à écrire son HTML, sans
 * toucher à ce fichier.
 */

import { loadPartials } from './core/partials.js';
import { initNavigation } from './ui/navigation.js';
import { initChrome } from './ui/chrome.js';
import { initReveal } from './ui/reveal.js';
import { initHero3D } from './ui/hero3d.js';
import { applyConfig } from './content/config.js';
import { renderEvents } from './content/events.js';
import { renderNews, renderArticle } from './content/news.js';
import { renderTeams } from './content/teams.js';
import { loadScorenco, renderClubWidgets } from './content/scorenco.js';

async function bootstrap() {
  // 1. Structure : navbar et footer doivent exister avant qu'on les branche.
  await loadPartials();
  await initNavigation();
  initChrome();

  // 2. Animations : l'observateur doit être en place avant l'injection du
  //    contenu, sinon les cartes générées apparaissent sans transition.
  initReveal();

  // 3. La 3D est au-dessus de la ligne de flottaison : on lance son
  //    téléchargement sans attendre le reste de la page.
  const hero3d = initHero3D();

  // 4. Contenu : rendu en parallèle, chaque module gère son propre échec.
  await Promise.all([
    renderEvents(),
    renderNews(),
    renderArticle(),
    renderTeams(),
  ]);

  // 5. `config.json` est appliqué après coup pour couvrir aussi les
  //    `data-config` présents dans le HTML généré (fiches d'équipe).
  const config = await applyConfig();

  // 6. Widgets tiers : le script Score'n'co scanne le DOM à son chargement,
  //    ses conteneurs doivent donc déjà être en place.
  renderClubWidgets(config);
  loadScorenco();

  await hero3d;
}

bootstrap().catch((error) => {
  console.error('[ABBC] Initialisation interrompue :', error);
});
