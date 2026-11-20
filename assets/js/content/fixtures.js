/**
 * content/fixtures.js — Prochaine rencontre d'une équipe.
 *
 * Les données viennent de `assets/data/fixtures.json`, produit par
 * `scripts/fetch_standings.py` depuis l'API FFBB et commité par le workflow
 * `.github/workflows/classements.yml`. Une entrée par équipe :
 *
 *   { next: {…}, last: {…}, count: 26, updatedAt: "…" }
 *
 * `next` et `last` peuvent être nuls — avant le premier match de la saison, ou
 * après le dernier. Chaque rendu gère ce cas plutôt que de le supposer.
 *
 * Remplace le widget « previous-next » de Score'n'co : aucun script tiers, la
 * charte du site, et la donnée reste servie même si la FFBB est indisponible
 * (c'est le dernier JSON commité qui s'affiche).
 */

import { escapeHTML } from '../core/dom.js';
import { fetchData, getTeams, url } from '../core/data.js';


/** Rencontres de toutes les équipes, ou `null` si le fichier est absent. */
export async function getFixtures() {
  try {
    const data = await fetchData('fixtures.json');
    return data?.teams || {};
  } catch (error) {
    console.warn('[ABBC] fixtures.json indisponible :', error);
    return null;
  }
}

/** « samedi 19 septembre » — le jour de la semaine compte pour un match. */
function formatDay(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** « 20h00 », ou chaîne vide si l'horaire n'est pas encore fixé. */
function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const heures = date.getHours();
  const minutes = date.getMinutes();
  if (!heures && !minutes) return ''; // minuit = horaire non renseigné côté FFBB
  return `${heures}h${String(minutes).padStart(2, '0')}`;
}

/** Bloc jour / mois détaché, comme sur les cartes d'agenda. */
function dateBadge(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `
    <div class="fixture__date" aria-hidden="true">
      <span class="fixture__day">${String(date.getDate()).padStart(2, '0')}</span>
      <span class="fixture__month">${date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</span>
    </div>`;
}

/**
 * Carte de la prochaine rencontre.
 * @param {object} fixture entrée `next` de fixtures.json
 */
export function nextFixtureHTML(fixture) {
  const heure = formatTime(fixture.date);
  // L'adresse complète en infobulle : elle est trop longue pour la ligne,
  // mais c'est elle qui sert quand on cherche le gymnase.
  const lieu = fixture.venue
    ? `<span class="fixture__venue"${fixture.address ? ` title="${escapeHTML(fixture.address)}"` : ''}>${escapeHTML(fixture.venue)}</span>`
    : '';

  return `
    <article class="fixture fixture--next">
      <p class="fixture__label">
        <i class="fas fa-calendar-day" aria-hidden="true"></i>
        Prochaine rencontre
        ${fixture.journee ? `<span class="fixture__round">Journée ${escapeHTML(fixture.journee)}</span>` : ''}
      </p>

      <div class="fixture__body">
        ${dateBadge(fixture.date)}
        <div class="fixture__teams">
          <p class="fixture__matchup">
            <span class="${fixture.isHome ? 'is-club' : ''}">${escapeHTML(fixture.home)}</span>
            <span class="fixture__vs">reçoit</span>
            <span class="${fixture.isHome ? '' : 'is-club'}">${escapeHTML(fixture.away)}</span>
          </p>
          <p class="fixture__when">
            ${escapeHTML(formatDay(fixture.date))}${heure ? ` à ${escapeHTML(heure)}` : ''}
          </p>
        </div>
      </div>

      <p class="fixture__foot">
        <span class="fixture__where ${fixture.isHome ? 'is-home' : 'is-away'}">
          <i class="fas fa-location-dot" aria-hidden="true"></i>
          ${fixture.isHome ? 'À domicile' : 'À l’extérieur'}
        </span>
        ${lieu}
      </p>
    </article>`;
}

/**
 * Ligne du dernier résultat connu, affichée sous la prochaine rencontre.
 * @param {object} fixture entrée `last` de fixtures.json
 */
export function lastResultHTML(fixture) {
  const pour = fixture.isHome ? fixture.scoreHome : fixture.scoreAway;
  const contre = fixture.isHome ? fixture.scoreAway : fixture.scoreHome;
  // Un match sans score saisi n'a pas d'issue : ni victoire, ni défaite.
  const issue = pour == null || contre == null ? '' : pour > contre ? 'win' : pour < contre ? 'loss' : 'draw';
  const etiquette = { win: 'Victoire', loss: 'Défaite', draw: 'Match nul' }[issue] || 'Résultat';

  return `
    <div class="fixture__last">
      <p class="fixture__label">Dernier match</p>
      <p class="fixture__result is-${issue || 'unknown'}">
        <span class="fixture__outcome">${etiquette}</span>
        ${pour != null && contre != null
          ? `<span class="fixture__score">${pour} – ${contre}</span>`
          : ''}
        <span class="fixture__against">contre ${escapeHTML(fixture.opponent)}</span>
      </p>
    </div>`;
}

/** Encart affiché quand l'équipe n'a pas de calendrier exploitable. */
export function fixturePendingHTML(message) {
  return `
    <div class="fixture fixture--empty">
      <i class="fas fa-calendar-xmark" aria-hidden="true"></i>
      <p>${escapeHTML(message)}</p>
    </div>`;
}

/**
 * Bloc complet pour une fiche d'équipe : prochaine rencontre, puis dernier
 * résultat s'il y en a un.
 * @param {object|null} entry entrée `teams[slug]` de fixtures.json
 */
export function fixturesPanelHTML(entry) {
  if (!entry) {
    return fixturePendingHTML('Calendrier bientôt disponible pour cette équipe.');
  }
  if (!entry.next && !entry.last) {
    return fixturePendingHTML('Aucune rencontre au calendrier pour le moment.');
  }

  return [
    entry.next ? nextFixtureHTML(entry.next) : fixturePendingHTML('Saison terminée — aucune rencontre à venir.'),
    entry.last ? lastResultHTML(entry.last) : '',
  ].join('');
}

/**
 * La rencontre la plus proche, toutes équipes confondues, sous une forme
 * comparable aux événements de l'agenda.
 *
 * Sert au bandeau « prochain rendez-vous » de l'accueil, qui doit arbitrer
 * entre un match et un événement du club — sans quoi il annonce le repas de
 * Noël alors qu'il y a un match dans quatre jours.
 *
 * @returns {Promise<object|null>} { kind, date, time, title, location, href, cta }
 */
export async function nextClubFixture() {
  const [teams, fixtures] = await Promise.all([getTeams(), getFixtures()]);

  const candidats = (teams || [])
    .map((team) => ({ team, next: fixtures?.[team.slug]?.next }))
    .filter(({ next }) => next?.date);
  if (!candidats.length) return null;

  const { team, next } = candidats.reduce((a, b) => (a.next.date <= b.next.date ? a : b));
  return {
    kind: 'match',
    date: next.date.slice(0, 10),
    time: formatTime(next.date),
    title: `${team.shortName} ${next.isHome ? 'reçoit' : 'se déplace à'} ${next.opponent}`,
    location: next.venue,
    href: url(`equipes/${team.page}`),
    cta: 'Voir l\'équipe',
  };
}

/** Lundi 0 h de la semaine d'une date, pour regrouper un week-end de matchs. */
function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** « samedi 21 et dimanche 22 novembre », ou « samedi 21 novembre ». */
function daysLabel(dates) {
  const jours = [...new Set(dates.map((iso) => iso.slice(0, 10)))].sort();
  const libelle = (iso, mois) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR',
    mois ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'long', day: 'numeric' });
  if (jours.length === 1) return libelle(jours[0], true);
  const premiers = jours.slice(0, -1).map((iso) => libelle(iso, false));
  return `${premiers.join(', ')} et ${libelle(jours[jours.length - 1], true)}`;
}

/** Une ligne du tableau : heure, équipe, adversaire, salle. */
function boardRowHTML(team, next) {
  const heure = formatTime(next.date);
  return `
    <li>
      <a class="board__row" href="${url(`equipes/${team.page}`)}">
        <span class="board__time">${heure ? escapeHTML(heure) : 'Horaire à venir'}</span>
        <span class="board__team">${escapeHTML(team.shortName)}</span>
        <span class="board__match">${next.isHome ? 'reçoit' : 'à'} ${escapeHTML(next.opponent)}</span>
        <span class="board__place${next.isHome ? ' is-home' : ''}">${next.isHome ? 'À domicile' : escapeHTML(next.venue || 'Extérieur')}</span>
      </a>
    </li>`;
}

/**
 * « Ce week-end » sur l'accueil : les matchs du prochain week-end de
 * compétition, jour par jour, comme un tableau d'affichage de gymnase.
 *
 * On ne montre qu'un week-end — celui du match le plus proche — plutôt que la
 * prochaine rencontre de chacune des quatorze équipes : c'est la question que
 * se pose un parent ou un supporter. Les matchs à domicile sont signalés, car
 * ce sont ceux où l'on peut venir.
 */
export async function renderClubFixtures() {
  const container = document.getElementById('club-fixtures');
  if (!container) return;
  const titre = document.getElementById('week-title');

  const [teams, fixtures] = await Promise.all([getTeams(), getFixtures()]);
  // Un match d'hier peut rester « prochain » jusqu'à la mise à jour suivante
  // des données : on l'écarte plutôt que de l'annoncer.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const matchs = (teams || [])
    .map((team) => ({ team, next: fixtures?.[team.slug]?.next }))
    .filter(({ next }) => next?.date && next.date.slice(0, 10) >= aujourdhui)
    .sort((a, b) => a.next.date.localeCompare(b.next.date));

  if (!matchs.length) {
    container.innerHTML = fixturePendingHTML('Aucune rencontre programmée pour le moment.');
    return;
  }

  // Le week-end du match le plus proche : du lundi au dimanche de sa semaine.
  const debut = mondayOf(matchs[0].next.date);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 7);
  const semaine = matchs.filter(({ next }) => new Date(next.date) < fin);
  const cetteSemaine = mondayOf(new Date()).getTime() === debut.getTime();

  if (titre) titre.textContent = cetteSemaine ? 'Ce week-end' : 'Prochain week-end de match';

  const parJour = new Map();
  semaine.forEach((m) => {
    const jour = m.next.date.slice(0, 10);
    if (!parJour.has(jour)) parJour.set(jour, []);
    parJour.get(jour).push(m);
  });

  const domicile = semaine.filter(({ next }) => next.isHome).length;
  container.innerHTML = `
    <p class="board__summary">
      ${escapeHTML(daysLabel(semaine.map(({ next }) => next.date)))} :
      ${semaine.length} match${semaine.length > 1 ? 's' : ''}${domicile
        ? `, dont ${domicile} à domicile`
        : ', tous à l\'extérieur'}.
    </p>
    <div class="board">
      ${[...parJour.entries()].map(([jour, liste]) => `
        <section class="board__day" aria-label="${escapeHTML(formatDay(`${jour}T12:00:00`))}">
          <h3 class="board__date">${escapeHTML(formatDay(`${jour}T12:00:00`))}</h3>
          <ol class="board__list">${liste.map(({ team, next }) => boardRowHTML(team, next)).join('')}</ol>
        </section>`).join('')}
    </div>`;
}
