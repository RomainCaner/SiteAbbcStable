/**
 * content/news.js — Rendu des actualités depuis `news.json`.
 *
 * Cibles possibles :
 *   `#news-grid`      (accueil)    → grille éditoriale : 1 article en avant + 2
 *   `#news-list`      (actualités) → tous les articles
 *   `#article-content` (article)   → l'article désigné par `?slug=…`
 */

import { escapeHTML, formatDateFR } from '../core/dom.js';
import { getNews, url } from '../core/data.js';
import { observe } from '../ui/reveal.js';

const HOME_COUNT = 3;

/** Articles valides, du plus récent au plus ancien. */
async function loadPosts() {
  const posts = await getNews();
  return posts
    .filter((post) => post && post.slug && post.title)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/**
 * Carte d'actualité.
 * `feature` produit la grande carte avec texte en surimpression sur l'image,
 * utilisée en tête de la grille d'accueil.
 */
function newsCard(post, { feature = false, delay = null } = {}) {
  const media = post.image
    ? `<img src="${url(escapeHTML(post.image))}" alt="" loading="lazy">`
    : '<div class="card__media-empty"></div>';

  return `
    <a href="${url(`article.html?slug=${encodeURIComponent(post.slug)}`)}"
       class="card${feature ? ' card--feature' : ''} reveal"${delay === null ? '' : ` data-delay="${delay}"`}>
      <div class="card__media">${media}</div>
      <div class="card__body">
        <span class="chip">Actualité</span>
        <h3 class="card__title">${escapeHTML(post.title)}</h3>
        <p class="card__text">${escapeHTML(post.excerpt)}</p>
        <p class="card__foot card__date">
          <i class="fas fa-calendar" aria-hidden="true"></i>
          ${escapeHTML(formatDateFR(post.date))}
        </p>
      </div>
    </a>`;
}

const emptyState = (message) => `
  <div class="empty">
    <i class="fas fa-newspaper" aria-hidden="true"></i>
    <p>${escapeHTML(message)}</p>
  </div>`;

export async function renderNews() {
  const grid = document.getElementById('news-grid');
  const list = document.getElementById('news-list');
  if (!grid && !list) return;

  let posts;
  try {
    posts = await loadPosts();
  } catch (error) {
    console.warn('[ABBC] news.json indisponible :', error);
    const message = emptyState('Impossible de charger les actualités.');
    if (grid) grid.innerHTML = message;
    if (list) list.innerHTML = message;
    return;
  }

  if (grid) {
    const [lead, ...rest] = posts.slice(0, HOME_COUNT);
    grid.innerHTML = lead
      ? newsCard(lead, { feature: true })
        + rest.map((post, i) => newsCard(post, { delay: i + 1 })).join('')
      : emptyState('Aucune actualité pour le moment.');
    observe(grid);
  }

  if (list) {
    list.innerHTML = posts.length
      ? posts.map((post, i) => newsCard(post, { delay: i % 3 })).join('')
      : emptyState('Aucune actualité pour le moment.');
    observe(list);
  }
}

const backToNews = `
  <p class="article__back">
    <a href="${url('actualites.html')}" class="link-arrow">
      <i class="fas fa-arrow-left" aria-hidden="true"></i> Retour aux actualités
    </a>
  </p>`;

/**
 * Rend l'article correspondant au paramètre `?slug=` de l'URL.
 *
 * Le champ `body` est du HTML rédigé par le club dans `news.json` : il est
 * injecté tel quel (c'est son rôle), contrairement à tous les autres champs
 * qui sont échappés.
 */
export async function renderArticle() {
  const container = document.getElementById('article-content');
  if (!container) return;

  const slug = new URLSearchParams(window.location.search).get('slug');

  let posts;
  try {
    posts = await loadPosts();
  } catch (error) {
    console.warn('[ABBC] news.json indisponible :', error);
    container.innerHTML = `${emptyState("Impossible de charger l'article.")}${backToNews}`;
    return;
  }

  const post = posts.find((entry) => entry.slug === slug);
  if (!post) {
    document.title = 'Article introuvable · ABB Cornebarrieu';
    container.innerHTML = `
      <div class="empty">
        <i class="fas fa-newspaper" aria-hidden="true"></i>
        <h1>Article introuvable</h1>
        <p>L'article demandé n'existe pas ou a été déplacé.</p>
      </div>${backToNews}`;
    return;
  }

  document.title = `${post.title} · ABB Cornebarrieu`;
  container.innerHTML = `
    <article>
      <nav aria-label="Fil d'Ariane" class="breadcrumb article__breadcrumb">
        <a href="${url('index.html')}">Accueil</a>
        <span aria-hidden="true">/</span>
        <a href="${url('actualites.html')}">Actualités</a>
      </nav>

      <span class="chip">Actualité</span>
      <h1 class="article__title">${escapeHTML(post.title)}</h1>
      <p class="card__date article__meta">
        <i class="fas fa-calendar" aria-hidden="true"></i>
        ${escapeHTML(formatDateFR(post.date))}${post.author ? ` — ${escapeHTML(post.author)}` : ''}
      </p>

      ${post.image ? `<img class="article__cover" src="${url(escapeHTML(post.image))}" alt="">` : ''}

      <div class="prose">${post.body || ''}</div>
      ${backToNews}
    </article>`;
}
