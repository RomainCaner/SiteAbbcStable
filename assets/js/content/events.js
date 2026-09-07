/**
 * content/events.js — Rendu de l'agenda depuis `events.json`.
 *
 * Deux cibles possibles dans le HTML :
 *   `#events-grid`  (accueil)  → les 3 prochains événements
 *   `#agenda-list`  (agenda)   → à venir, puis passés
 */

import { escapeHTML, formatDateFR, todayISO } from '../core/dom.js';
import { getEvents } from '../core/data.js';
import { observe } from '../ui/reveal.js';

const HOME_EVENTS_COUNT = 3;

function eventCard(event) {
  const accent = event.color || 'blue';
  return `
    <article class="bg-white p-6 rounded-2xl shadow-lg card-hover border border-gray-100 slide-in">
      <div class="flex items-center justify-between mb-4">
        <div class="w-12 h-12 bg-${accent}-600 rounded-full flex items-center justify-center">
          <i class="fas fa-${escapeHTML(event.icon || 'calendar')} text-white text-xl" aria-hidden="true"></i>
        </div>
        <span class="bg-${accent}-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
          ${escapeHTML(event.category)}
        </span>
      </div>
      <h3 class="text-xl font-bold text-gray-800 mb-3">${escapeHTML(event.title)}</h3>
      <div class="space-y-2 text-gray-600">
        <p class="flex items-center gap-2"><i class="fas fa-calendar text-${accent}-600" aria-hidden="true"></i> ${escapeHTML(formatDateFR(event.date))}</p>
        <p class="flex items-center gap-2"><i class="fas fa-clock text-${accent}-600" aria-hidden="true"></i> ${escapeHTML(event.time)}</p>
        <p class="flex items-center gap-2"><i class="fas fa-map-marker-alt text-${accent}-600" aria-hidden="true"></i> ${escapeHTML(event.location)}</p>
      </div>
      <p class="text-sm text-gray-500 mt-4">${escapeHTML(event.description)}</p>
    </article>`;
}

const emptyState = (message) => `
  <div class="col-span-full text-center text-gray-500 py-12">
    <i class="fas fa-calendar-times text-4xl mb-4 opacity-50" aria-hidden="true"></i>
    <p>${escapeHTML(message)}</p>
  </div>`;

const eventSection = (title, events, dimmed) => !events.length ? '' : `
  <section class="mb-16">
    <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
      <span class="w-2 h-8 bg-gradient-to-b from-blue-600 to-green-600 rounded-full" aria-hidden="true"></span>${title}
    </h2>
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8${dimmed ? ' opacity-70' : ''}">
      ${events.map(eventCard).join('')}
    </div>
  </section>`;

export async function renderEvents() {
  const grid = document.getElementById('events-grid');
  const list = document.getElementById('agenda-list');
  if (!grid && !list) return;

  let events;
  try {
    events = await getEvents();
  } catch (error) {
    console.warn('[ABBC] events.json indisponible :', error);
    const message = emptyState('Impossible de charger les événements.');
    if (grid) grid.innerHTML = message;
    if (list) list.innerHTML = message;
    return;
  }

  events = events
    .filter((event) => event && event.date && event.title)
    .sort((a, b) => a.date.localeCompare(b.date));

  const today = todayISO();
  const upcoming = events.filter((event) => event.date >= today);
  const past = events.filter((event) => event.date < today).reverse();

  if (grid) {
    const next = upcoming.slice(0, HOME_EVENTS_COUNT);
    grid.innerHTML = next.length
      ? next.map(eventCard).join('')
      : emptyState('Aucun événement à venir pour le moment. Revenez bientôt !');
    observe(grid);
  }

  if (list) {
    list.innerHTML =
      (eventSection('À venir', upcoming, false)
        || '<p class="text-gray-500 mb-16">Aucun événement à venir pour le moment.</p>')
      + eventSection('Événements passés', past, true);
    observe(list);
  }
}
