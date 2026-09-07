/**
 * content/teams.js — Pages d'équipe et annuaire des équipes.
 *
 * Les neuf pages `equipes/*.html` sont des coquilles : elles ne portent que
 * leurs métadonnées SEO et un `<body data-team="sf1">`. Tout le corps de la
 * page est produit ici depuis `teams.json`, ce qui évite d'avoir neuf fois
 * la même structure à maintenir.
 *
 * Cibles dans le HTML :
 *   `#team-page`   (equipes/*.html) → fiche complète de l'équipe
 *   `#teams-grid`  (equipes.html)   → cartes de toutes les équipes
 */

import { escapeHTML } from '../core/dom.js';
import { getTeams, url } from '../core/data.js';
import { observe } from '../ui/reveal.js';
import { widgetHTML } from './scorenco.js';

/** Dégradés Tailwind par accent, pour garder des classes complètes (purge-safe). */
const ACCENTS = {
  blue: 'from-blue-500 to-cyan-500',
  green: 'from-green-500 to-emerald-500',
  purple: 'from-purple-500 to-pink-500',
  orange: 'from-orange-500 to-red-500',
};

const gradient = (accent) => ACCENTS[accent] || ACCENTS.blue;

const GROUP_LABELS = { seniors: 'Seniors', jeunes: 'Jeunes' };

/** Carte blanche standard, utilisée pour les trois blocs d'une fiche équipe. */
const panel = (icon, accent, title, body) => `
  <div class="bg-white p-8 rounded-2xl shadow-lg card-hover border border-gray-100 bounce-in">
    <div class="w-16 h-16 bg-gradient-to-br ${gradient(accent)} rounded-2xl flex items-center justify-center mx-auto mb-6">
      <i class="fas fa-${icon} text-white text-2xl" aria-hidden="true"></i>
    </div>
    <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">${title}</h2>
    ${body}
  </div>`;

const infoRow = (icon, label, value) => `
  <div class="flex items-center gap-3">
    <i class="fas fa-${icon} text-blue-600" aria-hidden="true"></i>
    <span><strong>${label} :</strong> ${value}</span>
  </div>`;

function teamPageHTML(team) {
  const name = escapeHTML(team.displayName || team.name);
  const short = escapeHTML(team.shortName);

  return `
    <section class="py-20 px-6 bg-white">
      <div class="max-w-6xl mx-auto text-center fade-in">
        <nav aria-label="Fil d'Ariane" class="breadcrumb justify-center">
          <a href="${url('index.html')}">Accueil</a>
          <span aria-hidden="true">›</span>
          <a href="${url('equipes.html')}">Équipes</a>
          <span aria-hidden="true">›</span>
          <span class="breadcrumb-current">${short}</span>
        </nav>
        <h1 class="text-4xl md:text-6xl font-bold text-gray-800 mb-6">
          <span class="block text-blue-600">${short}</span>
          <span class="block text-green-600">ABB Cornebarrieu</span>
        </h1>
        <p class="text-xl text-gray-600 mb-4">${name}</p>
        ${team.description ? `<p class="text-gray-500 max-w-2xl mx-auto">${escapeHTML(team.description)}</p>` : ''}
        <div class="w-24 h-1 bg-gradient-to-r from-blue-600 to-green-600 mx-auto mt-8" aria-hidden="true"></div>
      </div>
    </section>

    <section class="py-20 px-6 bg-gray-50">
      <div class="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <!-- Seul le bloc « Informations » prend l'accent de l'équipe ; les deux
             autres gardent une couleur fixe pour rester identifiables d'une
             équipe à l'autre. -->
        ${panel('info-circle', team.accent, 'Informations', `
          <div class="space-y-4 text-gray-600">
            ${infoRow('tag', 'Catégorie', name)}
            ${infoRow('calendar', 'Saison', '<span data-config="season">2026-2027</span>')}
            ${infoRow('user-tie', 'Entraîneur', escapeHTML(team.coach || 'À définir'))}
            ${infoRow('trophy', 'Niveau', escapeHTML(team.level || 'À définir'))}
          </div>`)}

        ${panel('calendar-alt', 'green', 'Prochaines rencontres',
          widgetHTML('previous-next', team.widgets?.nextGames, 'Calendrier bientôt disponible.'))}

        ${panel('users', 'purple', 'Effectif',
          widgetHTML('players', team.widgets?.players, 'Effectif bientôt publié.'))}
      </div>
    </section>

    <section id="classement" class="py-20 px-6 bg-white">
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-12 fade-in">
          <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">Classement</h2>
          <div class="w-24 h-1 bg-gradient-to-r from-blue-600 to-green-600 mx-auto" aria-hidden="true"></div>
          <p class="text-gray-600 mt-6 text-lg">Classement en temps réel de l'équipe ${short}</p>
        </div>
        <div class="bg-gradient-to-r from-blue-50 to-green-50 p-8 rounded-2xl fade-in">
          ${widgetHTML('ranking', team.widgets?.ranking, 'Classement bientôt disponible.')}
        </div>
      </div>
    </section>`;
}

function notFoundHTML(slug) {
  return `
    <section class="py-24 px-6 text-center">
      <i class="fas fa-triangle-exclamation text-5xl text-gray-300 mb-6" aria-hidden="true"></i>
      <h1 class="text-3xl font-bold text-gray-800 mb-4">Équipe introuvable</h1>
      <p class="text-gray-600 mb-8">
        Aucune équipe « ${escapeHTML(slug)} » dans <code>assets/data/teams.json</code>.
      </p>
      <a href="${url('equipes.html')}" class="text-blue-600 font-semibold focus-ring">Voir toutes les équipes</a>
    </section>`;
}

/** Fiche d'une équipe, sur `equipes/<page>`. */
async function renderTeamPage(container) {
  const slug = document.body.dataset.team;
  let teams;
  try {
    teams = await getTeams();
  } catch (error) {
    console.warn('[ABBC] teams.json indisponible :', error);
    container.innerHTML = '<p class="text-center text-gray-500 py-16">Impossible de charger cette équipe.</p>';
    return;
  }

  const team = teams.find((entry) => entry.slug === slug);
  container.innerHTML = team ? teamPageHTML(team) : notFoundHTML(slug);
  observe(container);
}

function teamCardHTML(team) {
  return `
    <a href="${url(`equipes/${team.page}`)}"
       class="group bg-white rounded-2xl shadow-lg card-hover border border-gray-100 overflow-hidden slide-in focus-ring">
      <div class="h-2 bg-gradient-to-r ${gradient(team.accent)}" aria-hidden="true"></div>
      <div class="p-8">
        <div class="flex items-baseline justify-between mb-4">
          <span class="text-3xl font-bold text-gray-800">${escapeHTML(team.shortName)}</span>
          <span class="text-xs uppercase tracking-wide text-gray-400">${escapeHTML(GROUP_LABELS[team.group] || '')}</span>
        </div>
        <p class="text-gray-700 font-semibold mb-1">${escapeHTML(team.displayName || team.name)}</p>
        <p class="text-sm text-blue-600 font-medium mb-4">${escapeHTML(team.level)}</p>
        <p class="text-sm text-gray-500 mb-6">${escapeHTML(team.description || '')}</p>
        <span class="inline-flex items-center gap-2 text-blue-600 font-semibold text-sm">
          Voir l'équipe <i class="fas fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" aria-hidden="true"></i>
        </span>
      </div>
    </a>`;
}

/** Annuaire complet, sur `equipes.html`. */
async function renderTeamsIndex(container) {
  let teams;
  try {
    teams = await getTeams();
  } catch (error) {
    console.warn('[ABBC] teams.json indisponible :', error);
    container.innerHTML = '<p class="col-span-full text-center text-gray-500 py-16">Impossible de charger les équipes.</p>';
    return;
  }

  container.innerHTML = teams.map(teamCardHTML).join('');
  observe(container);
}

/** Point d'entrée : détecte la page courante et rend ce qu'il faut. */
export async function renderTeams() {
  const page = document.getElementById('team-page');
  const index = document.getElementById('teams-grid');

  if (page) await renderTeamPage(page);
  if (index) await renderTeamsIndex(index);
}
