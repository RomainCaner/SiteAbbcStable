/**
 * ui/navigation.js — Comportements de la navbar et du footer.
 *
 * Le mega-menu « Équipes » (desktop et mobile) est généré depuis
 * `teams.json` : ajouter une équipe au JSON suffit à la faire apparaître
 * dans la navigation, sans toucher au HTML du fragment.
 */

import { escapeHTML } from '../core/dom.js';
import { getTeams, url } from '../core/data.js';
import { initTheme } from '../core/theme.js';

const GROUP_LABELS = {
  seniors: 'Seniors',
  jeunes: 'Jeunes',
};

/** Regroupe les équipes par `group`, en conservant l'ordre du JSON. */
function groupTeams(teams) {
  const groups = new Map();
  teams.forEach((team) => {
    const key = team.group || 'autres';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(team);
  });
  return groups;
}

const teamLink = (team, className) =>
  `<a href="${url(`equipes/${team.page}`)}" class="${className}" role="menuitem">
     ${escapeHTML(team.shortName)} — ${escapeHTML(team.level)}
   </a>`;

function renderDesktopMenu(container, groups) {
  container.innerHTML = Array.from(groups, ([key, teams]) => `
    <div>
      <h3 class="team-menu-title team-menu-title--${escapeHTML(key)}">
        ${escapeHTML(GROUP_LABELS[key] || key)}
      </h3>
      <ul class="space-y-2">
        ${teams.map((team) => `<li>${teamLink(team, 'block text-gray-700 hover:text-blue-600 text-sm')}</li>`).join('')}
      </ul>
    </div>`).join('');
}

function renderMobileMenu(container, groups) {
  container.innerHTML = Array.from(groups, ([key, teams]) => `
    <p class="team-menu-title team-menu-title--${escapeHTML(key)} px-4 pt-3 pb-1 text-xs">
      ${escapeHTML(GROUP_LABELS[key] || key)}
    </p>
    ${teams.map((team) => teamLink(team, 'block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100')).join('')}
  `).join('');
}

async function renderTeamMenus() {
  const desktop = document.getElementById('teams-menu-desktop');
  const mobile = document.getElementById('teams-menu-mobile');
  if (!desktop && !mobile) return;

  try {
    const groups = groupTeams(await getTeams());
    if (desktop) renderDesktopMenu(desktop, groups);
    if (mobile) renderMobileMenu(mobile, groups);
  } catch (error) {
    console.warn('[ABBC] Menu des équipes non généré :', error);
  }
}

/** Bouton hamburger : ouvre/ferme le panneau mobile. */
function initMobileMenu() {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('mobile-menu');
  const icon = document.getElementById('nav-icon');
  if (!toggle || !menu || !icon) return;

  const setOpen = (open) => {
    menu.classList.toggle('hidden', !open);
    icon.classList.toggle('fa-bars', !open);
    icon.classList.toggle('fa-times', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(menu.classList.contains('hidden')));

  // Un clic sur n'importe quel lien du panneau le referme.
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
}

/** Accordéon « Équipes » à l'intérieur du panneau mobile. */
function initMobileTeamsAccordion() {
  const toggle = document.getElementById('mobile-teams-toggle');
  const menu = document.getElementById('mobile-teams-menu');
  const icon = document.getElementById('mobile-teams-icon');
  if (!toggle || !menu || !icon) return;

  toggle.addEventListener('click', () => {
    const open = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !open);
    icon.classList.toggle('rotate-180', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
}

/** Souligne l'entrée de menu correspondant à `<body data-page="…">`. */
function markActivePage() {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll(`[data-nav="${page}"]`).forEach((link) => {
    link.dataset.active = 'true';
  });
}

/** Année courante + retour visuel du formulaire newsletter. */
function initFooter() {
  const year = document.getElementById('current-year');
  if (year) year.textContent = String(new Date().getFullYear());

  const form = document.getElementById('newsletter-form');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('newsletter-email');
    const feedback = document.getElementById('newsletter-feedback');
    if (!input || !feedback) return;

    // TODO : brancher un vrai service (Mailchimp, Brevo…). Pour l'instant,
    // seule la validité du format est vérifiée côté client.
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
    feedback.className = valid ? 'success' : 'error';
    feedback.textContent = valid
      ? 'Merci ! Votre inscription a bien été prise en compte.'
      : 'Veuillez saisir une adresse email valide.';
    if (valid) input.value = '';
  });
}

/** Branche navbar + footer. À appeler après `loadPartials()`. */
export function initNavigation() {
  initMobileMenu();
  initMobileTeamsAccordion();
  markActivePage();
  initTheme();
  initFooter();
  return renderTeamMenus();
}
