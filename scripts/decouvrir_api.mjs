/**
 * Sonde une page FFBB avec un vrai navigateur pour trouver d'où viennent les
 * classements.
 *
 * Pourquoi un navigateur alors que le reste du projet se contente de requests :
 * competitions.ffbb.com est une application Next.js. La page renvoyée par le
 * serveur ne contient que les rencontres — le classement de la poule
 * sélectionnée est chargé après coup, par une requête que seul un navigateur
 * déclenche. Six récupérations en HTTP simple l'ont confirmé : le club
 * n'apparaît que dans les données de rencontres.
 *
 * Ce script ne fait pas partie de la mise à jour quotidienne. Il sert une seule
 * fois, pour relever l'adresse de l'API ; une fois connue, fetch_standings.py
 * l'interroge directement, sans navigateur.
 *
 *   node scripts/decouvrir_api.mjs "https://competitions.ffbb.com/..."
 */
import { chromium } from 'playwright';

const CLUB = /cornebarrieu/i;
// Clés qui signent un classement plutôt qu'un calendrier de rencontres.
const CLASSEMENT = /"(classement|position|rang|points|victoires|defaites|paniersMarques|nombreMatchs)"/i;

const url = process.argv[2];
if (!url) {
  console.error('Usage : node scripts/decouvrir_api.mjs <url>');
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  locale: 'fr-FR',
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
});

/** Une entrée par réponse retenue : on garde le corps pour l'analyser après. */
const reponses = [];

page.on('response', async (response) => {
  const type = (response.headers()['content-type'] || '').toLowerCase();
  const requete = response.request();
  // Le document HTML lui-même est déjà connu ; on cherche ce qu'il appelle.
  if (requete.resourceType() === 'document') return;
  if (!type.includes('json') && !type.includes('text/x-component')) return;
  let corps = '';
  try {
    corps = await response.text();
  } catch {
    return; // réponse déjà consommée ou avortée
  }
  reponses.push({
    url: response.url(),
    statut: response.status(),
    type: requete.resourceType(),
    taille: corps.length,
    corps,
  });
});

console.log(`Page sondée : ${url}\n`);

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // networkidle échoue sur les pages qui gardent une connexion ouverte : on
  // l'essaie, et on se rabat sur une attente fixe.
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(4000);
} catch (erreur) {
  console.log(`Chargement incomplet : ${erreur.message}\n`);
}

// --- 1. Ce que la page a rendu -------------------------------------------
const rendu = await page.evaluate((motif) => {
  const tableaux = Array.from(document.querySelectorAll('table')).map((t) => ({
    lignes: t.querySelectorAll('tbody tr').length,
    entetes: Array.from(t.querySelectorAll('thead th')).map((th) => th.textContent.trim()),
    apercu: Array.from(t.querySelectorAll('tbody tr'))
      .slice(0, 3)
      .map((tr) => Array.from(tr.cells).map((c) => c.textContent.trim()).join(' | ')),
  }));
  const club = new RegExp(motif, 'i');
  return {
    tableaux,
    // Les onglets nomment les vues disponibles : c'est là qu'on lit si le
    // classement est une page à part ou un panneau de celle-ci.
    onglets: Array.from(document.querySelectorAll('a[role="tab"], [role="tab"], nav a'))
      .map((e) => e.textContent.trim())
      .filter((t) => t && t.length < 40)
      .slice(0, 30),
    clubVisible: club.test(document.body.innerText),
  };
}, CLUB.source);

console.log('--- Rendu de la page ---');
console.log(`  Club visible à l'écran : ${rendu.clubVisible ? 'oui' : 'non'}`);
console.log(`  Onglets : ${rendu.onglets.join(' · ') || '—'}`);
if (!rendu.tableaux.length) console.log('  Aucun <table> dans la page.');
rendu.tableaux.forEach((t, i) => {
  console.log(`  Tableau ${i + 1} : ${t.lignes} lignes — ${t.entetes.join(' / ')}`);
  t.apercu.forEach((l) => console.log(`      ${l}`));
});

// --- 2. Ce que la page a appelé ------------------------------------------
console.log(`\n--- Requêtes JSON (${reponses.length}) ---`);
if (!reponses.length) console.log('  Aucune. Tout est rendu côté serveur.');

/** Les plus prometteuses d'abord : club présent, puis forme de classement. */
const score = (r) => (CLUB.test(r.corps) ? 2 : 0) + (CLASSEMENT.test(r.corps) ? 1 : 0);
for (const r of reponses.sort((a, b) => score(b) - score(a) || b.taille - a.taille)) {
  const marques = [
    CLUB.test(r.corps) ? 'CLUB' : null,
    CLASSEMENT.test(r.corps) ? 'classement' : null,
  ].filter(Boolean);
  console.log(
    `  [${r.statut}] ${r.taille} car. ${marques.length ? `« ${marques.join(' + ')} »` : ''}\n      ${r.url}`,
  );
}

// --- 3. Où sont les clés de classement dans la meilleure candidate -------
//
// Chercher le club ne suffit pas : il figure aussi dans les rencontres, et
// c'est cette occurrence-là qu'on tombe en premier. Ce sont les clés propres
// au classement qu'il faut situer.
const meilleure = reponses.find((r) => score(r) >= 3);
if (meilleure) {
  console.log(`\n--- Clés de classement dans ${meilleure.url} ---`);
  const vues = new Set();
  const motif = new RegExp(CLASSEMENT.source, 'gi');
  let trouve;
  let echantillons = 0;
  while ((trouve = motif.exec(meilleure.corps)) && echantillons < 6) {
    const cle = trouve[1].toLowerCase();
    if (vues.has(cle)) continue; // une occurrence par clé suffit à situer
    vues.add(cle);
    echantillons += 1;
    const debut = Math.max(0, trouve.index - 260);
    console.log(`\n  « ${cle} » à la position ${trouve.index} :`);
    console.log(`    …${meilleure.corps.slice(debut, trouve.index + 460)}…`);
  }
  if (!echantillons) console.log('  Aucune, finalement.');
} else {
  console.log('\nAucune réponse ne contient à la fois le club et une forme de classement.');
}

// --- 4. Les routes atteignables depuis la page ---------------------------
const routes = await page.evaluate(() =>
  Array.from(
    new Set(
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && h.startsWith('/'))
        // On ne veut pas 352 liens mais la forme des routes : les
        // identifiants numériques sont remplacés par un jeton.
        .map((h) => h.split('?')[0].replace(/\/\d{6,}/g, '/<id>')),
    ),
  ).slice(0, 40),
);
console.log(`\n--- Formes de routes de la page (${routes.length}) ---`);
routes.forEach((r) => console.log(`  ${r}`));


// --- 5. Le classement est-il derrière un onglet ? ------------------------
//
// La page s'ouvre sur le calendrier — d'où les rencontres, et le club absent
// de l'écran. S'il existe une commande « Classement », la suivre montre d'où
// vient la donnée : une navigation (autre URL) ou un appel (autre requête).
const avant = reponses.length;
const commande = page
  .locator('a, button, [role="tab"]')
  .filter({ hasText: /classement/i })
  .first();

if (await commande.count()) {
  const libelle = (await commande.textContent())?.trim();
  const href = await commande.getAttribute('href');
  console.log(`\n--- Commande « ${libelle} » trouvée ---`);
  console.log(`  href : ${href ?? '(aucun, c\'est un bouton)'}`);
  await commande.click().catch((e) => console.log(`  clic impossible : ${e.message}`));
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);

  console.log(`  URL après clic : ${page.url()}`);
  const nouvelles = reponses.slice(avant);
  console.log(`  Nouvelles requêtes JSON : ${nouvelles.length}`);
  nouvelles.forEach((r) => {
    const marques = [CLUB.test(r.corps) ? 'CLUB' : null, CLASSEMENT.test(r.corps) ? 'classement' : null]
      .filter(Boolean)
      .join(' + ');
    console.log(`    [${r.statut}] ${r.taille} car. ${marques && `« ${marques} »`}\n        ${r.url}`);
  });

  const apres = await page.evaluate(() =>
    Array.from(document.querySelectorAll('table')).map((t) => ({
      entetes: Array.from(t.querySelectorAll('th')).map((th) => th.textContent.trim()),
      lignes: Array.from(t.querySelectorAll('tbody tr'))
        .slice(0, 12)
        .map((tr) => Array.from(tr.cells).map((c) => c.textContent.trim()).join(' | ')),
    })),
  );
  if (!apres.length) console.log('  Toujours aucun <table>.');
  apres.forEach((t, i) => {
    console.log(`  Tableau ${i + 1} — ${t.entetes.join(' / ')}`);
    t.lignes.forEach((l) => console.log(`      ${l}`));
  });
} else {
  console.log('\nAucune commande « Classement » dans la page.');
}

await browser.close();
