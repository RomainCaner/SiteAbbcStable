/**
 * tools/ffbb-core.js — L'API FFBB interrogée depuis le navigateur.
 *
 * Pourquoi dans le navigateur : depuis le 19/10/2026, le pare-feu de la FFBB
 * (BunnyCDN) refuse les machines de GitHub. Le workflow planifié ne peut plus
 * rien récupérer. Ouverte par un membre du club, la page `outils/ffbb.html`
 * fait les mêmes appels que `scripts/fetch_standings.py`, mais depuis une
 * connexion ordinaire, que le pare-feu laisse passer.
 *
 * Ce module ne touche pas au DOM : il interroge l'API et produit
 * `standings.json` et `fixtures.json` au format exact du script Python, pour
 * que le site les lise sans rien changer. Les requêtes reprennent celles de
 * `ffbb-data-client` (jetons publics, Directus, Meilisearch).
 */

const CONFIG_URLS = [
  'https://bo.ffbb.com/items/configuration',
  'https://bo.ffbb.app/items/configuration',
];
const API_URL = 'https://bo.ffbb.com/';
const MEILI_URL = 'https://meilisearch-prod.ffbb.app/';

/** Même reconnaissance du club que CLUB_PATTERNS dans le script Python. */
const CLUB = /cornebarrieu/i;
export const isClub = (name) => CLUB.test(name || '');

/** Champs demandés pour une poule : classement et calendrier en un appel. */
const POULE_FIELDS = [
  'id', 'nom',
  'classements.position', 'classements.points', 'classements.matchJoues',
  'classements.gagnes', 'classements.perdus',
  'classements.paniersMarques', 'classements.paniersEncaisses', 'classements.difference',
  'classements.idEngagement.nom', 'classements.organisme_nom', 'classements.organisme.nom',
  'rencontres.numeroJournee', 'rencontres.date_rencontre',
  'rencontres.nomEquipe1', 'rencontres.nomEquipe2',
  'rencontres.idEngagementEquipe1.nom', 'rencontres.idEngagementEquipe2.nom',
  'rencontres.resultatEquipe1', 'rencontres.resultatEquipe2',
  'rencontres.joue', 'rencontres.remise',
  'rencontres.salle.libelle', 'rencontres.salle.adresse',
];

/** Erreur lisible : dit quelle étape a échoué et pourquoi. */
export class FFBBError extends Error {
  constructor(etape, detail) {
    super(`${etape} : ${detail}`);
    this.etape = etape;
  }
}

/**
 * Appel réseau. Un `fetch` qui lève une TypeError sans réponse signifie, dans
 * un navigateur, que la requête a été refusée avant d'aboutir — le plus
 * souvent par la politique CORS du serveur, parfois par un bloqueur.
 */
async function requete(etape, url, options = {}, fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(url, options);
  } catch (error) {
    throw new FFBBError(etape, `requête refusée par le navigateur (${error.message}). `
      + 'Le serveur de la FFBB n\'autorise sans doute pas les appels depuis un autre site (CORS), '
      + 'ou un bloqueur de publicité intercepte la requête.');
  }
  if (res.status === 403) throw new FFBBError(etape, 'HTTP 403 — accès refusé par le pare-feu de la FFBB.');
  if (!res.ok) throw new FFBBError(etape, `HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new FFBBError(etape, 'réponse illisible (pas du JSON).');
  }
}

/** Jetons publics de l'application FFBB. */
export async function fetchTokens(fetchImpl = fetch) {
  let derniere;
  for (const url of CONFIG_URLS) {
    try {
      const json = await requete('Jetons', url, {}, fetchImpl);
      const data = json?.data ?? json;
      // `key_dh` : jeton Directus (données) ; `key_ms` : jeton Meilisearch.
      const api = data?.key_dh;
      const meili = data?.key_ms;
      if (api && meili) return { api, meili };
      derniere = new FFBBError('Jetons', `réponse de ${url} sans jetons.`);
    } catch (error) {
      derniere = error;
    }
  }
  throw derniere;
}

/** Engagements du club (une ligne par équipe engagée en championnat). */
export async function searchEngagements(tokens, query = 'Cornebarrieu', fetchImpl = fetch) {
  const json = await requete('Recherche des engagements', `${MEILI_URL}multi-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.meili}` },
    body: JSON.stringify({ queries: [{ indexUid: 'ffbbserver_engagements', q: query, limit: 100 }] }),
  }, fetchImpl);
  const hits = json?.results?.[0]?.hits ?? [];
  return hits
    .map((hit) => ({
      id: hit.id,
      club: hit.nomClub || hit.nomOrganisme || '',
      equipe: hit.nomEquipe || hit.nomUsuel || hit.nom || '',
      numero: String(hit.numeroEquipe ?? ''),
      sexe: hit.sexe || '',
      age: hit.age || '',
      categorie: hit.categorie?.code || hit.categorie?.libelle || '',
      niveau: hit.niveau?.libelle || hit.niveau?.code || '',
      competition: hit.idCompetition?.nom || '',
      poule: hit.idPoule?.nom || '',
      pouleId: hit.idPoule?.id ? String(hit.idPoule.id) : '',
    }))
    .filter((e) => e.pouleId && (isClub(e.club) || isClub(e.equipe)));
}

/** Une poule : classement et rencontres. */
export async function fetchPoule(tokens, pouleId, fetchImpl = fetch) {
  const params = new URLSearchParams();
  POULE_FIELDS.forEach((f) => params.append('fields[]', f));
  params.set('deep[rencontres][_limit]', '1000');
  params.set('deep[classements][_limit]', '1000');
  const json = await requete(`Poule ${pouleId}`, `${API_URL}items/ffbbserver_poules/${pouleId}?${params}`, {
    headers: { Authorization: `Bearer ${tokens.api}` },
  }, fetchImpl);
  const poule = json?.data ?? json;
  if (!poule || typeof poule !== 'object') throw new FFBBError(`Poule ${pouleId}`, 'réponse vide.');
  return poule;
}

// ------------------------------------------------------------ mise en forme

const clean = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const toInt = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** « LONS BASKET - 1 » → « LONS BASKET » ; « - 3 » est gardé : « … 3 ». */
export function cleanTeamName(name) {
  const n = clean(name);
  const m = n.match(/\s*-\s*(\d{1,2})\s*$/);
  if (!m) return n;
  const base = n.slice(0, m.index).trimEnd();
  return m[1] === '1' ? base : `${base} ${m[1]}`;
}

/** Classement d'une poule, au schéma de standings.json (garde-fou compris). */
export function standingFromPoule(poule, { competition, pouleId, now }) {
  const rows = (poule.classements || [])
    .map((c) => {
      const team = clean(c.idEngagement?.nom || c.organisme_nom || c.organisme?.nom || '');
      return {
        rank: toInt(c.position),
        team,
        points: toInt(c.points),
        played: toInt(c.matchJoues),
        won: toInt(c.gagnes),
        lost: toInt(c.perdus),
        scored: toInt(c.paniersMarques),
        conceded: toInt(c.paniersEncaisses),
        diff: toInt(c.difference),
        isClub: isClub(team),
      };
    })
    .filter((r) => r.team)
    // L'API trie le rang comme du texte (1, 10, 11, 2…).
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.team.localeCompare(b.team));

  if (!rows.length) throw new FFBBError(`Poule ${pouleId}`, 'aucun classement publié pour le moment.');
  if (!rows.some((r) => r.isClub)) {
    throw new FFBBError(`Poule ${pouleId}`, `le club n'apparaît pas dans ce classement (${rows.slice(0, 3).map((r) => r.team).join(', ')}…) : mauvaise poule ?`);
  }
  return { competition, rows, source: `API FFBB, poule ${pouleId}`, updatedAt: now };
}

/** Prochaine et dernière rencontre du club, au schéma de fixtures.json. */
export function fixturesFromPoule(poule, { now }) {
  const rencontres = (poule.rencontres || [])
    .map((m) => {
      const home = cleanTeamName(m.nomEquipe1 || m.idEngagementEquipe1?.nom || '');
      const away = cleanTeamName(m.nomEquipe2 || m.idEngagementEquipe2?.nom || '');
      if (!home || !away || !m.date_rencontre) return null;
      const clubHome = isClub(home);
      if (!clubHome && !isClub(away)) return null;
      const scoreHome = toInt(m.resultatEquipe1);
      const scoreAway = toInt(m.resultatEquipe2);
      return {
        date: String(m.date_rencontre).replace(/Z$|\.\d+Z?$/, '').slice(0, 19),
        journee: clean(m.numeroJournee),
        home,
        away,
        isHome: clubHome,
        opponent: clubHome ? away : home,
        venue: clean(m.salle?.libelle),
        address: clean(m.salle?.adresse),
        played: Boolean(Number(m.joue)) || (scoreHome !== null && scoreAway !== null),
        postponed: Boolean(m.remise),
        scoreHome,
        scoreAway,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!rencontres.length) return null;
  // Comparaison en heure locale, comme les dates de l'API (sans fuseau).
  const maintenant = localIso(now);
  const aVenir = rencontres.filter((r) => !r.played && r.date >= maintenant);
  const jouees = rencontres.filter((r) => r.played);
  return {
    next: aVenir[0] || null,
    last: jouees[jouees.length - 1] || null,
    count: rencontres.length,
    updatedAt: now,
  };
}

function localIso(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Propose un engagement pour chaque équipe du site : la poule déjà connue
 * d'abord, sinon le sexe, la catégorie d'âge (U15, U18…) et le numéro
 * d'équipe (1 pour SF1, 2 pour SF2…).
 */
export function proposeMatches(teams, engagements) {
  const result = {};
  for (const team of teams) {
    const connue = team.ffbb?.pouleId;
    let choix = engagements.find((e) => connue && e.pouleId === String(connue));
    if (!choix) {
      const code = team.shortName || team.slug.toUpperCase();
      const sexe = /F$|^SF/i.test(code) ? 'F' : 'M';
      const age = (code.match(/U\d{1,2}/i) || [''])[0].toUpperCase();
      const numero = (code.match(/^S[FG](\d)$/i) || [null, '1'])[1];
      const candidats = engagements.filter((e) => {
        const texte = `${e.age} ${e.categorie} ${e.competition}`.toUpperCase();
        const memeSexe = !e.sexe || e.sexe.toUpperCase().startsWith(sexe);
        const memeAge = age ? texte.includes(age) : /SENIOR|^\s*$/.test(texte) || !/U\d/.test(texte);
        return memeSexe && memeAge;
      });
      choix = candidats.find((e) => e.numero === numero) || (candidats.length === 1 ? candidats[0] : null);
    }
    result[team.slug] = choix ? choix.pouleId : '';
  }
  return result;
}

/** JSON écrit comme le script Python (indentation 2, saut de ligne final). */
export const toJsonFile = (data) => `${JSON.stringify(data, null, 2)}\n`;
