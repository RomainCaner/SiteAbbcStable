/**
 * content/teams.js — Fiches d'équipe et annuaire.
 *
 * Les neuf pages `equipes/*.html` sont des coquilles : elles ne portent que
 * leurs métadonnées SEO et un `<body data-team="sf1">`. Tout le corps de la
 * page est produit ici depuis `teams.json`, ce qui évite d'avoir neuf fois la
 * même structure à maintenir.
 *
 * Cibles dans le HTML :
 *   `#team-page`  (equipes/*.html) → fiche complète de l'équipe
 *   `#teams-grid` (equipes.html)   → cartes de toutes les équipes
 */

import { escapeHTML } from '../core/dom.js';
import { getTeams, url } from '../core/data.js';
import { observe } from '../ui/reveal.js';
// import { widgetHTML } from './scorenco.js';  // widgets Score'n'co : voir plus bas
import { getStandings, standingsHTML } from './standings.js';
import { getFixtures, fixturesPanelHTML } from './fixtures.js';

/**
 * Couleur d'accent par équipe, exposée en variable CSS.
 * Les valeurs restent dans l'identité du club (vert du blason, orange du
 * ballon) : la teinte distingue les catégories sans sortir de la marque.
 */
const ACCENTS = {
  green: 'var(--green-600)',   // seniors féminines
  forest: 'var(--green-800)',  // seniors masculins
  orange: 'var(--orange-500)', // U18
  ochre: '#B8860B',            // U15
};
const accentOf = (team) => ACCENTS[team.accent] || 'var(--brand)';

const GROUP_LABELS = { seniors: 'Seniors', jeunes: 'Jeunes' };

/** « Entraîneur » ou « Entraîneurs » : plusieurs équipes sont encadrées à deux ou trois. */
const encadrementLabel = (coach) =>
  coach && /,| et /.test(coach) ? 'Entraîneurs' : 'Entraîneur';

const infoRow = (label, value) => `
  <div class="info-row">
    <dt>${label}</dt>
    <dd>${value}</dd>
  </div>`;

const panel = (icon, title, body) => `
  <div class="panel reveal">
    <h2 class="panel__title"><i class="fas fa-${icon}" aria-hidden="true"></i>${title}</h2>
    ${body}
  </div>`;

/**
 * Bloc classement : tableau maison si `standings.json` couvre l'équipe, encart
 * d'attente sinon. Renseigner `ffbb.pouleId` dans teams.json suffit à basculer
 * une équipe.
 *
 * Les widgets Score'n'co sont conservés en commentaire le temps que les quatre
 * équipes jeunes soient branchées sur la FFBB — elles sont engagées en CTC et
 * n'apparaissent pas encore sous le nom du club.
 *
 *   return `<div class="widget-frame">${widgetHTML('ranking', team.widgets?.ranking,
 *             'Classement bientôt disponible.')}</div>`;
 */
function rankingHTML(team, standing) {
  if (standing?.rows?.length) return standingsHTML(standing);
  return `
    <div class="widget-pending">
      <i class="fas fa-hourglass-half" aria-hidden="true"></i>
      <p>Classement bientôt disponible.</p>
      <p class="widget-pending__help">
        Identifiant de poule à renseigner dans <code>assets/data/teams.json</code>
        (<code>ffbb.pouleId</code>), voir <code>scripts/decouvrir_poules.py</code>.
      </p>
    </div>`;
}

/**
 * Fiche complète d'une équipe : informations, prochaine rencontre, classement.
 *
 * Un panneau « Effectif » a existé ici. Il n'affichait qu'un encart d'attente :
 * l'API FFBB ne donne pas les compositions, et le widget Score'n'co qui en
 * était la seule source est neutralisé. Un tiers de la rangée pour « bientôt
 * publié » coûtait plus qu'il ne rapportait. Pour le rétablir le jour où une
 * liste existe (dans teams.json, ou par l'API), rajouter un `panel('users',
 * 'Effectif', …)` ici et repasser la grille en `grid--3`.
 */
function teamPageHTML(team, standing, fixtures) {
  const name = escapeHTML(team.displayName || team.name);
  const short = escapeHTML(team.shortName);
  const accent = accentOf(team);

  return `
    <header class="page-head">
      <div class="container">
        <nav aria-label="Fil d'Ariane" class="breadcrumb">
          <a href="${url('index.html')}">Accueil</a>
          <span aria-hidden="true">/</span>
          <a href="${url('equipes.html')}">Équipes</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">${short}</span>
        </nav>

        <div class="team-hero">
          <h1 class="team-hero__code">${short}</h1>
          <div class="team-hero__meta">
            <p class="team-hero__name">${name}</p>
            <p class="team-hero__tags">
              <span class="chip" style="--chip-bg: ${accent}">${escapeHTML(team.level || 'À définir')}</span>
              <span class="chip chip--outline chip--light">${escapeHTML(GROUP_LABELS[team.group] || '')}</span>
            </p>
          </div>
        </div>
        ${team.description ? `<p class="team-hero__desc">${escapeHTML(team.description)}</p>` : ''}
      </div>
    </header>

    <section class="section">
      <div class="container grid grid--2">
        ${panel('circle-info', 'Informations', `
          <dl class="info-list">
            ${infoRow('Catégorie', name)}
            ${infoRow('Saison', '<span data-config="season">2026-2027</span>')}
            ${infoRow(encadrementLabel(team.coach), escapeHTML(team.coach || 'À définir'))}
            ${infoRow('Niveau', escapeHTML(team.level || 'À définir'))}
          </dl>`)}

        ${panel('calendar-days', 'Rencontres', fixturesPanelHTML(fixtures))}
      </div>
    </section>

    <section id="classement" class="section section--dark">
      <div class="container">
        <div class="section__head">
          <div>
            <p class="eyebrow">Championnat</p>
            <h2 class="section__title">Classement <span>${short}</span></h2>
          </div>
          <a href="${url('equipes.html')}" class="link-arrow">
            Toutes les équipes <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </a>
        </div>
        <div class="reveal">${rankingHTML(team, standing)}</div>
      </div>
    </section>`;
}

function notFoundHTML(slug) {
  return `
    <section class="section">
      <div class="container">
        <div class="empty">
          <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
          <h1>Équipe introuvable</h1>
          <p>Aucune équipe « ${escapeHTML(slug || '')} » dans <code>assets/data/teams.json</code>.</p>
          <a href="${url('equipes.html')}" class="link-arrow">
            Voir toutes les équipes <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </section>`;
}

/** Fiche d'une équipe, sur `equipes/<page>`. */
async function renderTeamPage(container) {
  const slug = document.body.dataset.team;
  let teams;
  let standings;
  let fixtures;
  try {
    // Les trois fichiers sont indépendants : un classement ou un calendrier
    // manquant ne doit pas empêcher la fiche de s'afficher. Seul teams.json
    // est indispensable, d'où le try/catch autour du lot.
    [teams, standings, fixtures] = await Promise.all([getTeams(), getStandings(), getFixtures()]);
  } catch (error) {
    console.warn('[ABBC] teams.json indisponible :', error);
    container.innerHTML = notFoundHTML(slug);
    return;
  }

  const team = teams.find((entry) => entry.slug === slug);
  container.innerHTML = team
    ? teamPageHTML(team, standings?.[slug], fixtures?.[slug])
    : notFoundHTML(slug);
  observe(container);
}

function teamCardHTML(team, delay) {
  return `
    <a href="${url(`equipes/${team.page}`)}" class="card card--team reveal" data-delay="${delay}"
       style="--team-accent: ${accentOf(team)}">
      <div class="card__body">
        <p class="card--team__code">${escapeHTML(team.shortName)}</p>
        <p class="card--team__name">${escapeHTML(team.displayName || team.name)}</p>
        <p class="card--team__level">${escapeHTML(team.level || 'À définir')}</p>
        <p class="card__text">${escapeHTML(team.description || '')}</p>
        <p class="card__foot">
          <span class="link-arrow">Voir l'équipe <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
        </p>
      </div>
    </a>`;
}

/** Annuaire complet, sur `equipes.html`, groupé par catégorie. */
async function renderTeamsIndex(container) {
  let teams;
  try {
    teams = await getTeams();
  } catch (error) {
    console.warn('[ABBC] teams.json indisponible :', error);
    container.innerHTML = `
      <div class="empty">
        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        <p>Impossible de charger les équipes.</p>
      </div>`;
    return;
  }

  const groups = new Map();
  teams.forEach((team) => {
    const key = team.group || 'autres';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(team);
  });

  container.innerHTML = Array.from(groups, ([key, list]) => `
    <section class="list-block">
      <div class="section__head">
        <div>
          <p class="eyebrow">${escapeHTML(GROUP_LABELS[key] || key)}</p>
          <h2 class="section__title">${list.length} équipe${list.length > 1 ? 's' : ''}</h2>
        </div>
      </div>
      <div class="grid grid--3">
        ${list.map((team, i) => teamCardHTML(team, i % 3)).join('')}
      </div>
    </section>`).join('');

  observe(container);
}

/** Point d'entrée : détecte la page courante et rend ce qu'il faut. */
export async function renderTeams() {
  const page = document.getElementById('team-page');
  const index = document.getElementById('teams-grid');

  if (page) await renderTeamPage(page);
  if (index) await renderTeamsIndex(index);
}
