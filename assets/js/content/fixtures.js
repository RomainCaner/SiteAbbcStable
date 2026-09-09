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
import { observe } from '../ui/reveal.js';

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
 * Tuile compacte d'une équipe, pour la vue d'ensemble de l'accueil.
 * @param {object} team  entrée de teams.json
 * @param {object} entry entrée `teams[slug]` de fixtures.json
 */
function clubTileHTML(team, entry, delay) {
  const next = entry?.next;
  if (!next) return '';

  const heure = formatTime(next.date);
  return `
    <a href="${url(`equipes/${team.page}`)}" class="fixture-tile reveal" data-delay="${delay}">
      <p class="fixture-tile__team">${escapeHTML(team.shortName)}</p>
      <p class="fixture-tile__opponent">
        <span class="fixture-tile__prefix">${next.isHome ? 'reçoit' : 'se déplace à'}</span>
        ${escapeHTML(next.opponent)}
      </p>
      <p class="fixture-tile__when">
        ${escapeHTML(formatDay(next.date))}${heure ? ` · ${escapeHTML(heure)}` : ''}
      </p>
    </a>`;
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

/**
 * Vue d'ensemble sur l'accueil : la prochaine rencontre de chaque équipe,
 * la plus proche en premier. Ne fait rien hors de la page d'accueil.
 */
export async function renderClubFixtures() {
  const container = document.getElementById('club-fixtures');
  if (!container) return;

  const [teams, fixtures] = await Promise.all([getTeams(), getFixtures()]);
  const tuiles = (teams || [])
    .map((team) => ({ team, entry: fixtures?.[team.slug] }))
    .filter(({ entry }) => entry?.next)
    .sort((a, b) => a.entry.next.date.localeCompare(b.entry.next.date));

  if (!tuiles.length) {
    container.innerHTML = fixturePendingHTML(
      'Aucune rencontre programmée pour le moment.');
    return;
  }

  container.innerHTML = `
    <div class="fixture-grid">
      ${tuiles.map(({ team, entry }, i) => clubTileHTML(team, entry, i % 3)).join('')}
    </div>`;
  observe(container);
}
