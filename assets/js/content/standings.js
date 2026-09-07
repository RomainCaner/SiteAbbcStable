/**
 * content/standings.js — Classement rendu par le site.
 *
 * Les données viennent de `assets/data/standings.json`, produit par
 * `scripts/fetch_standings.py` depuis l'API FFBB et commité par le workflow
 * `.github/workflows/classements.yml`.
 *
 * Avantages par rapport au widget Score'n'co, qu'il remplace : aucun script
 * tiers sur la page, le tableau suit la charte du site, et les données restent
 * servies même si la FFBB est indisponible (c'est le dernier JSON commité qui
 * s'affiche).
 *
 * Tant qu'une équipe n'a pas de classement dans le JSON, `content/teams.js`
 * affiche un encart d'attente. Renseigner `ffbb.pouleId` dans teams.json suffit
 * à la brancher — voir `scripts/decouvrir_poules.py` pour trouver l'identifiant.
 */

import { escapeHTML } from '../core/dom.js';
import { fetchData } from '../core/data.js';

/** Colonnes du tableau, dans l'ordre d'affichage. */
const COLUMNS = [
  { key: 'rank', label: 'Clt', short: 'Clt', align: 'center' },
  { key: 'team', label: 'Équipe', short: 'Équipe', align: 'left' },
  { key: 'points', label: 'Points', short: 'Pts', align: 'center' },
  { key: 'played', label: 'Joués', short: 'J', align: 'center' },
  { key: 'won', label: 'Gagnés', short: 'G', align: 'center' },
  { key: 'lost', label: 'Perdus', short: 'P', align: 'center' },
  { key: 'scored', label: 'Points marqués', short: 'BP', align: 'center' },
  { key: 'conceded', label: 'Points encaissés', short: 'BC', align: 'center' },
  { key: 'diff', label: 'Différence', short: '+/-', align: 'center' },
];

/** Classements de toutes les équipes, ou `null` si le fichier est absent. */
export async function getStandings() {
  try {
    const data = await fetchData('standings.json');
    return data?.teams || {};
  } catch (error) {
    console.warn('[ABBC] standings.json indisponible :', error);
    return null;
  }
}

const formatDate = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Mention de la source. Elle n'est cliquable que si c'en est une : les
 * classements venus de l'API sont décrits par « API FFBB, poule <id> », qui
 * ferait un href cassé.
 */
function sourceHTML(source) {
  if (!source) return '';
  const isURL = /^https?:\/\//i.test(source);
  if (!isURL) return ' · Source FFBB';
  return ` · <a href="${escapeHTML(source)}" target="_blank" rel="noopener">Source FFBB</a>`;
}

/** Cellule : les colonnes absentes de la source affichent un tiret. */
function cell(row, column) {
  const value = row[column.key];
  if (value == null || value === '') return '<td class="standings__num">—</td>';

  if (column.key === 'team') {
    return `<td class="standings__team">${escapeHTML(value)}</td>`;
  }
  if (column.key === 'rank') {
    return `<td class="standings__rank">${escapeHTML(String(value))}</td>`;
  }
  if (column.key === 'diff') {
    const sign = value > 0 ? '+' : '';
    const tone = value > 0 ? ' is-positive' : value < 0 ? ' is-negative' : '';
    return `<td class="standings__num${tone}">${sign}${escapeHTML(String(value))}</td>`;
  }
  return `<td class="standings__num">${escapeHTML(String(value))}</td>`;
}

/**
 * Tableau de classement complet.
 * @param {object} standing entrée `teams[slug]` de standings.json
 */
export function standingsHTML(standing) {
  const rows = standing.rows || [];
  if (!rows.length) return '';

  // On n'affiche que les colonnes réellement présentes dans les données :
  // les championnats départementaux publient parfois moins de statistiques.
  const columns = COLUMNS.filter((column) =>
    rows.some((row) => row[column.key] != null && row[column.key] !== ''));

  const head = columns.map((column) => `
    <th scope="col" class="is-${column.align}">
      <span class="standings__label-long">${escapeHTML(column.label)}</span>
      <span class="standings__label-short">${escapeHTML(column.short)}</span>
    </th>`).join('');

  const body = rows.map((row) => `
    <tr${row.isClub ? ' class="is-club"' : ''}>
      ${columns.map((column) => cell(row, column)).join('')}
    </tr>`).join('');

  return `
    <div class="standings">
      ${standing.competition ? `<p class="standings__competition">${escapeHTML(standing.competition)}</p>` : ''}
      <div class="standings__scroll">
        <table class="standings__table">
          <caption class="visually-hidden">
            Classement ${escapeHTML(standing.competition || 'du championnat')}
          </caption>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <p class="standings__footer">
        ${standing.updatedAt ? `Mis à jour le ${escapeHTML(formatDate(standing.updatedAt))}` : ''}
        ${sourceHTML(standing.source)}
      </p>
    </div>`;
}
