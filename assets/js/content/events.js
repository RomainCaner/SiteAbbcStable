/**
 * content/events.js — Rendu de l'agenda depuis `events.json`.
 *
 * Trois cibles possibles dans le HTML :
 *   `#nextup`       (accueil) → bandeau du prochain rendez-vous
 *   `#events-grid`  (accueil) → les 3 prochains événements
 *   `#agenda-list`  (agenda)  → à venir, puis passés
 */

import { escapeHTML, formatDateFR, todayISO } from '../core/dom.js';
import { getEvents, url } from '../core/data.js';
import { observe } from '../ui/reveal.js';

const HOME_EVENTS_COUNT = 3;

/** Couleur d'accent d'un événement, exposée en variable CSS. */
const ACCENTS = {
  red: 'var(--orange-700)',
  orange: 'var(--orange-500)',
  yellow: '#B8860B',
  green: 'var(--green-600)',
  forest: 'var(--green-800)',
  blue: '#1D5FA8',
  purple: '#6B3FA0',
};
const accentOf = (event) => ACCENTS[event.color] || 'var(--brand)';

/** Découpe une date ISO pour le bloc jour / mois / année. */
function dateParts(iso) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { day: '--', month: '', year: '' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
    year: String(date.getFullYear()),
  };
}

function eventCard(event, { past = false, extraClass = '', delay = null } = {}) {
  const { day, month, year } = dateParts(event.date);
  const classes = ['event', past ? 'event--past' : '', extraClass].filter(Boolean).join(' ');
  return `
    <article class="${classes}"${delay === null ? '' : ` data-delay="${delay}"`} style="--event-accent: ${accentOf(event)}">
      <div class="event__date">
        <span class="event__day">${day}</span>
        <span class="event__month">${escapeHTML(month)}</span>
        <span class="event__year">${year}</span>
      </div>
      <div>
        ${event.category ? `<span class="chip" style="--chip-bg: ${accentOf(event)}">${escapeHTML(event.category)}</span>` : ''}
        <h3 class="event__title">${escapeHTML(event.title)}</h3>
        <div class="event__meta">
          ${event.time ? `<span><i class="fas fa-clock" aria-hidden="true"></i>${escapeHTML(event.time)}</span>` : ''}
          ${event.location ? `<span><i class="fas fa-location-dot" aria-hidden="true"></i>${escapeHTML(event.location)}</span>` : ''}
        </div>
        ${event.description ? `<p class="event__text">${escapeHTML(event.description)}</p>` : ''}
      </div>
    </article>`;
}

const emptyState = (message) => `
  <div class="empty">
    <i class="fas fa-calendar-xmark" aria-hidden="true"></i>
    <p>${escapeHTML(message)}</p>
  </div>`;

/**
 * Bandeau du prochain rendez-vous, sous le hero.
 * C'est le repère principal du visiteur : il affiche la première échéance à
 * venir, ou renvoie simplement vers l'agenda s'il n'y en a aucune.
 */
function renderNextUp(container, next) {
  if (!next) {
    container.className = 'nextup nextup--empty';
    container.innerHTML = `
      <div class="container nextup__inner">
        <p class="nextup__label"><i class="fas fa-calendar" aria-hidden="true"></i> Agenda</p>
        <p class="nextup__title">Aucune date programmée pour le moment.</p>
        <a href="${url('agenda.html')}" class="btn btn--outline btn--sm nextup__cta">Voir l'agenda</a>
      </div>`;
    return;
  }

  const { day, month } = dateParts(next.date);
  container.innerHTML = `
    <div class="container nextup__inner">
      <p class="nextup__label">Prochain<br>rendez-vous</p>
      <p class="nextup__date">${day} ${escapeHTML(month)}</p>
      <div>
        <p class="nextup__title">${escapeHTML(next.title)}</p>
        <p class="nextup__meta">
          ${next.time ? `<span><i class="fas fa-clock" aria-hidden="true"></i>${escapeHTML(next.time)}</span>` : ''}
          ${next.location ? `<span><i class="fas fa-location-dot" aria-hidden="true"></i>${escapeHTML(next.location)}</span>` : ''}
        </p>
      </div>
      <a href="${url('agenda.html')}" class="btn btn--light btn--sm nextup__cta">Tout l'agenda</a>
    </div>`;
}

const agendaSection = (title, events, past) => !events.length ? '' : `
  <section class="list-block">
    <div class="section__head">
      <h2 class="section__title">${title}</h2>
      <p class="card__date">${events.length} événement${events.length > 1 ? 's' : ''}</p>
    </div>
    <div class="stack" style="--flow: var(--space-4)">
      ${events.map((event) => eventCard(event, { past })).join('')}
    </div>
  </section>`;

export async function renderEvents() {
  const nextup = document.getElementById('nextup');
  const grid = document.getElementById('events-grid');
  const list = document.getElementById('agenda-list');
  if (!nextup && !grid && !list) return;

  let events;
  try {
    events = await getEvents();
  } catch (error) {
    console.warn('[ABBC] events.json indisponible :', error);
    const message = emptyState('Impossible de charger les événements.');
    if (grid) grid.innerHTML = message;
    if (list) list.innerHTML = message;
    if (nextup) renderNextUp(nextup, null);
    return;
  }

  events = events
    .filter((event) => event && event.date && event.title)
    .sort((a, b) => a.date.localeCompare(b.date));

  const today = todayISO();
  const upcoming = events.filter((event) => event.date >= today);
  const past = events.filter((event) => event.date < today).reverse();

  if (nextup) renderNextUp(nextup, upcoming[0]);

  if (grid) {
    const next = upcoming.slice(0, HOME_EVENTS_COUNT);
    grid.innerHTML = next.length
      ? next.map((event, i) => eventCard(event, { extraClass: 'reveal', delay: i })).join('')
      : emptyState('Aucun événement à venir pour le moment. Revenez bientôt !');
    observe(grid);
  }

  if (list) {
    list.innerHTML =
      (agendaSection('À venir', upcoming, false)
        || `<div class="list-block">${emptyState('Aucun événement à venir pour le moment.')}</div>`)
      + agendaSection('Déjà passés', past, true);
    observe(list);
  }
}
