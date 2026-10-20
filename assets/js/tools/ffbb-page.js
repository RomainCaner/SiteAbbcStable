/**
 * tools/ffbb-page.js — Interface de `outils/ffbb.html`.
 *
 * Trois étapes : interroger la FFBB depuis le navigateur, faire valider la
 * poule de chaque équipe, puis publier les fichiers en un commit via l'API
 * GitHub (ou les télécharger). Le jeton GitHub n'est gardé qu'en mémoire,
 * le temps de l'envoi.
 */

import {
  fetchTokens, searchEngagements, fetchPoule,
  standingFromPoule, fixturesFromPoule, proposeMatches, toJsonFile,
} from './ffbb-core.js';

const REPO = 'RomainCaner/SiteAbbcStable';
const BRANCH = 'main';
const STANDINGS_COMMENT = "Classements produits automatiquement par scripts/fetch_standings.py depuis l'API FFBB. NE PAS EDITER A LA MAIN : le fichier est reecrit a chaque execution du workflow .github/workflows/classements.yml.";
const FIXTURES_COMMENT = "Prochaine et derniere rencontre de chaque equipe, produites par scripts/fetch_standings.py depuis l'API FFBB. NE PAS EDITER A LA MAIN : le fichier est reecrit a chaque execution du workflow .github/workflows/classements.yml.";

const $ = (id) => document.getElementById(id);
const state = { tokens: null, engagements: [], teamsFile: null, teams: [], files: null };

function log(list, ok, text) {
  const li = document.createElement('li');
  const icon = document.createElement('i');
  icon.className = `fas ${ok ? 'fa-check ok' : 'fa-xmark ko'}`;
  icon.setAttribute('aria-hidden', 'true');
  li.append(icon, document.createTextNode(` ${text}`));
  $(list).append(li);
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const data = (file) => fetch(`../assets/data/${file}`, { cache: 'no-store' }).then((r) => r.json());

function engagementLabel(e) {
  const reperes = [e.sexe, e.age || e.categorie].filter(Boolean).join(' ');
  return `n°${e.numero || '?'} · ${e.competition || e.niveau}${e.poule ? ` · poule ${e.poule}` : ''}${reperes ? ` · ${reperes}` : ''}`;
}

// --------------------------------------------------------------- étape 1

async function search() {
  $('log-1').replaceChildren();
  $('btn-search').disabled = true;
  try {
    state.teamsFile = await data('teams.json');
    state.teams = state.teamsFile.filter((t) => t && t.slug);

    state.tokens = await fetchTokens();
    log('log-1', true, 'Jetons FFBB obtenus.');
    $('tok-api').textContent = state.tokens.api;
    $('tok-meili').textContent = state.tokens.meili;
    $('tokens-box').hidden = false;

    state.engagements = await searchEngagements(state.tokens);
    log('log-1', true, `${state.engagements.length} engagement(s) du club avec une poule.`);
    renderMap();
    $('step-2').hidden = false;
  } catch (error) {
    log('log-1', false, error.message);
  } finally {
    $('btn-search').disabled = false;
  }
}

function renderMap() {
  const proposition = proposeMatches(state.teams, state.engagements);
  const rows = state.teams.map((team) => {
    const label = document.createElement('label');
    const name = document.createElement('span');
    name.textContent = team.shortName;
    const select = document.createElement('select');
    select.dataset.slug = team.slug;
    select.add(new Option('Aucune', ''));
    state.engagements.forEach((e) => select.add(new Option(engagementLabel(e), e.pouleId)));
    // Une poule connue mais absente de la recherche reste proposée.
    const connue = team.ffbb?.pouleId;
    if (connue && !state.engagements.some((e) => e.pouleId === String(connue))) {
      select.add(new Option(`Poule actuelle ${connue} (absente de la recherche)`, String(connue)));
    }
    select.value = proposition[team.slug] || '';
    label.append(name, select);
    return label;
  });
  $('map').replaceChildren(...rows);
}

// --------------------------------------------------------------- étape 2

async function fetchAll() {
  $('log-2').replaceChildren();
  $('btn-fetch').disabled = true;
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
  const standings = { _comment: STANDINGS_COMMENT, updatedAt: now, teams: {} };
  const fixtures = { _comment: FIXTURES_COMMENT, updatedAt: now, teams: {} };
  const choix = Object.fromEntries([...$('map').querySelectorAll('select')].map((s) => [s.dataset.slug, s.value]));

  try {
    for (const team of state.teams) {
      const pouleId = choix[team.slug];
      if (!pouleId) continue;
      const engagement = state.engagements.find((e) => e.pouleId === pouleId);
      try {
        const poule = await fetchPoule(state.tokens, pouleId);
        const competition = team.group === 'jeunes' && engagement?.competition ? engagement.competition : team.level || '';
        standings.teams[team.slug] = standingFromPoule(poule, { competition, pouleId, now });
        const cal = fixturesFromPoule(poule, { now });
        if (cal) fixtures.teams[team.slug] = cal;
        const rang = standings.teams[team.slug].rows.find((r) => r.isClub)?.rank;
        log('log-2', true, `${team.shortName} : ${standings.teams[team.slug].rows.length} équipes, ${rang}e`
          + (cal ? ` — ${cal.count} rencontres${cal.next ? `, prochaine le ${cal.next.date.slice(0, 10)} contre ${cal.next.opponent}` : ''}` : ' — calendrier vide'));
      } catch (error) {
        log('log-2', false, `${team.shortName} : ${error.message}`);
      }
      await pause(400); // on reste courtois avec la FFBB
    }

    if (!Object.keys(standings.teams).length) {
      log('log-2', false, 'Aucun classement récupéré : rien à publier.');
      return;
    }
    // teams.json : seuls les identifiants de poule changent.
    const teamsFile = state.teamsFile.map((entry) => {
      if (!entry?.slug || !(entry.slug in choix)) return entry;
      const ffbb = { ...(entry.ffbb || {}) };
      if (choix[entry.slug]) ffbb.pouleId = choix[entry.slug];
      else delete ffbb.pouleId;
      return { ...entry, ffbb };
    });

    state.files = {
      'assets/data/standings.json': toJsonFile(standings),
      'assets/data/fixtures.json': toJsonFile(fixtures),
      'assets/data/teams.json': toJsonFile(teamsFile),
    };
    $('step-3').hidden = false;
  } finally {
    $('btn-fetch').disabled = false;
  }
}

// --------------------------------------------------------------- étape 3

async function github(token, path, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`GitHub ${res.status} : ${detail.message || res.statusText}`
      + (res.status === 401 || res.status === 403 || res.status === 404 ? ' — vérifiez le jeton et sa permission Contents (Read and write) sur SiteAbbcStable.' : ''));
  }
  return res.json();
}

/** Un seul commit pour les trois fichiers, donc un seul redéploiement. */
async function publish() {
  $('log-3').replaceChildren();
  const token = $('gh-token').value.trim();
  if (!token) {
    log('log-3', false, 'Collez d\'abord un jeton GitHub.');
    return;
  }
  $('btn-publish').disabled = true;
  try {
    const ref = await github(token, `git/ref/heads/${BRANCH}`);
    const parent = await github(token, `git/commits/${ref.object.sha}`);
    const tree = await github(token, 'git/trees', {
      method: 'POST',
      body: JSON.stringify({
        base_tree: parent.tree.sha,
        tree: Object.entries(state.files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })),
      }),
    });
    if (tree.sha === parent.tree.sha) {
      log('log-3', true, 'Rien n\'a changé depuis la dernière mise à jour.');
      return;
    }
    const date = new Date().toLocaleDateString('fr-FR');
    const commit = await github(token, 'git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: `Classements et rencontres FFBB au ${date} (depuis le navigateur)`,
        tree: tree.sha,
        parents: [ref.object.sha],
      }),
    });
    await github(token, `git/refs/heads/${BRANCH}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    });
    log('log-3', true, `Publié (commit ${commit.sha.slice(0, 7)}). Le site se met à jour d'ici une à deux minutes.`);
  } catch (error) {
    log('log-3', false, error.message);
  } finally {
    $('btn-publish').disabled = false;
  }
}

function download() {
  for (const [path, content] of Object.entries(state.files || {})) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    a.download = path.split('/').pop();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}

$('btn-search').addEventListener('click', search);
$('btn-fetch').addEventListener('click', fetchAll);
$('btn-publish').addEventListener('click', publish);
$('btn-files').addEventListener('click', download);
