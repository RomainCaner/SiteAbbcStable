/**
 * ui/navigation.js — Comportements de l'en-tête et du pied de page.
 *
 * Le mega-menu « Équipes » (desktop et mobile) est généré depuis
 * `teams.json` : ajouter une équipe au JSON suffit à la faire apparaître dans
 * la navigation, sans toucher au fragment HTML.
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

const teamLink = (team, className) => `
  <a href="${url(`equipes/${team.page}`)}" class="${className}">
    <b>${escapeHTML(team.shortName)}</b>
    <span>${escapeHTML(team.level)}</span>
  </a>`;

const groupLabel = (key) => escapeHTML(GROUP_LABELS[key] || key);

function renderDesktopMenu(container, groups) {
  container.innerHTML = Array.from(groups, ([key, teams]) => `
    <div>
      <p class="mega__group-title">${groupLabel(key)}</p>
      ${teams.map((team) => teamLink(team, 'mega__link')).join('')}
    </div>`).join('');
}

function renderMobileMenu(container, groups) {
  container.innerHTML = Array.from(groups, ([key, teams]) => `
    <p class="mobile-nav__group">${groupLabel(key)}</p>
    ${teams.map((team) => teamLink(team, '')).join('')}
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
    if (desktop) desktop.innerHTML = '<p>Menu indisponible.</p>';
  }
}

/**
 * En-tête transparent au-dessus du hero, plein dès que la page défile.
 * Les pages sans hero sont pleines d'emblée (géré en CSS).
 */
function initStickyHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;

  const update = () => header.classList.toggle('is-stuck', window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/** Bouton hamburger : ouvre/ferme le panneau mobile. */
function initMobileNav() {
  const toggle = document.getElementById('nav-toggle');
  const panel = document.getElementById('mobile-nav');
  const icon = document.getElementById('nav-icon');
  if (!toggle || !panel || !icon) return;

  const setOpen = (open) => {
    panel.classList.toggle('is-open', open);
    icon.classList.toggle('fa-bars', !open);
    icon.classList.toggle('fa-xmark', open);
    toggle.setAttribute('aria-expanded', String(open));
    // Empêche la page de défiler derrière le panneau ouvert.
    document.body.style.overflow = open ? 'hidden' : '';
  };

  toggle.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));

  // Un clic sur un lien referme le panneau.
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false);
  });
}

/** Accordéon « Équipes » dans le panneau mobile. */
function initMobileTeamsAccordion() {
  const toggle = document.getElementById('mobile-teams-toggle');
  const sub = document.getElementById('teams-menu-mobile');
  if (!toggle || !sub) return;

  toggle.addEventListener('click', () => {
    const open = !sub.classList.contains('is-open');
    sub.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
}

/** Marque l'entrée de menu correspondant à `<body data-page="…">`. */
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

    // TODO : brancher un vrai service (Brevo, Mailchimp…). Pour l'instant,
    // seule la validité du format est vérifiée côté client.
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
    feedback.className = `form-feedback ${valid ? 'is-success' : 'is-error'}`;
    feedback.textContent = valid
      ? 'Merci ! Votre inscription a bien été prise en compte.'
      : 'Veuillez saisir une adresse email valide.';
    if (valid) input.value = '';
  });
}

/** Branche l'en-tête et le pied de page. À appeler après `loadPartials()`. */
export function initNavigation() {
  initStickyHeader();
  initMobileNav();
  initMobileTeamsAccordion();
  markActivePage();
  initTheme();
  initFooter();
  return renderTeamMenus();
}
