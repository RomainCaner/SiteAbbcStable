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
import { initBallTravel } from './ui/balltravel.js';
import { applyConfig } from './content/config.js';
import { renderEvents } from './content/events.js';
import { renderNews, renderArticle } from './content/news.js';
import { renderTeams } from './content/teams.js';
import { renderClubFixtures } from './content/fixtures.js';
import { renderPartners } from './content/partners.js';
// Widgets Score'n'co, remplacés par les données FFBB (voir l'étape 6 plus bas).
// import { loadScorenco, renderClubWidgets } from './content/scorenco.js';

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
    renderClubFixtures(),
    renderPartners(),
  ]);

  // 5. `config.json` est appliqué après coup pour couvrir aussi les
  //    `data-config` présents dans le HTML généré (fiches d'équipe).
  //
  //    Les widgets Score'n'co étaient chargés ici, une fois leurs conteneurs
  //    en place. Ils sont neutralisés : classements et rencontres viennent
  //    désormais de l'API FFBB (standings.json, fixtures.json), sans script
  //    tiers sur la page. Le module content/scorenco.js est conservé — pour
  //    le rétablir, réactiver son import ci-dessus et ces deux appels :
  //
  //      renderClubWidgets(config);
  //      loadScorenco();
  await applyConfig();

  // 7. Le ballon suit le visiteur une fois le hero dépassé. Il a besoin de la
  //    scène — donc de son chargement — et du bouton « retour en haut », déjà
  //    en place depuis l'étape 1.
  const scene = await hero3d;
  if (scene) initBallTravel(scene);
}

bootstrap().catch((error) => {
  console.error('[ABBC] Initialisation interrompue :', error);
});
