/**
 * content/partners.js — Partenaires du club.
 *
 * Les données viennent de `assets/data/partners.json`. Ajouter un partenaire
 * revient à déposer son logo dans `assets/images/partenaires/` et à ajouter une
 * entrée : aucune modification du HTML.
 *
 * Un partenaire sans logo affiche son nom en toutes lettres — c'est mieux qu'un
 * bloc vide en attendant le fichier. Et tant qu'il n'y en a aucun, la page
 * montre une invitation à le devenir plutôt que des blocs d'exemple.
 *
 * Cible dans le HTML : `#partners-grid` (partenaires.html).
 */

import { escapeHTML } from '../core/dom.js';
import { fetchData } from '../core/data.js';
import { observe } from '../ui/reveal.js';

const CONTACT = 'mailto:bureau.abbc@gmail.com?subject=Demande%20de%20partenariat';

/** Une tuile : le logo s'il existe, le nom sinon. Cliquable si un site est donné. */
function partnerHTML(partner) {
  const name = escapeHTML(partner.name || '');
  if (!name) return '';

  const inner = partner.logo
    ? `<img src="${escapeHTML(partner.logo)}" alt="${name}" loading="lazy">`
    : `<p class="partner__name">${name}</p>`;

  if (!partner.url) return `<div class="partner">${inner}</div>`;
  return `
    <a class="partner" href="${escapeHTML(partner.url)}" target="_blank" rel="noopener"
       aria-label="${name} — ouvrir le site (nouvel onglet)">${inner}</a>`;
}

/** Aucun partenaire : une invitation, pas un vide ni de faux logos. */
const emptyHTML = () => `
  <div class="partners-empty">
    <i class="fas fa-handshake" aria-hidden="true"></i>
    <p class="partners-empty__title">Cette page accueillera bientôt nos partenaires.</p>
    <p class="partners-empty__text">
      Vous souhaitez soutenir le club et y figurer&nbsp;?
    </p>
    <a href="${CONTACT}" class="btn btn--primary btn--sm">Devenir partenaire</a>
  </div>`;

export async function renderPartners() {
  const container = document.getElementById('partners-grid');
  if (!container) return;

  let partners = [];
  try {
    const data = await fetchData('partners.json');
    partners = (data?.partners || []).filter((p) => p && p.name);
  } catch (error) {
    // Le fichier absent ou illisible ne doit pas laisser un trou dans la page :
    // l'invitation reste pertinente dans les deux cas.
    console.warn('[ABBC] partners.json indisponible :', error);
  }

  // `classList.toggle` plutôt que `className` : écraser la liste effacerait
  // `is-revealed`, que l'observateur d'apparition a pu poser avant ce rendu —
  // et il ne suit plus l'élément une fois révélé.
  const remplie = partners.length > 0;
  container.classList.toggle('partners', remplie);
  container.innerHTML = remplie ? partners.map(partnerHTML).join('') : emptyHTML();
  observe(container);
}
