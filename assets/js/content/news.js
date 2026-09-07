/**
 * content/news.js — Rendu des actualités depuis `news.json`.
 *
 * Cibles possibles :
 *   `#news-teaser` (accueil)      → les 3 articles les plus récents
 *   `#news-list`   (actualités)   → tous les articles
 *   `#article-content` (article)  → l'article désigné par `?slug=…`
 */

import { escapeHTML, formatDateFR } from '../core/dom.js';
import { getNews, url } from '../core/data.js';
import { observe } from '../ui/reveal.js';

const TEASER_COUNT = 3;

/** Articles valides, du plus récent au plus ancien. */
async function loadPosts() {
  const posts = await getNews();
  return posts
    .filter((post) => post && post.slug && post.title)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function newsCard(post) {
  const image = post.image
    ? `<img src="${url(escapeHTML(post.image))}" alt="" loading="lazy" class="w-full h-48 object-cover">`
    : '';
  return `
    <a href="${url(`article.html?slug=${encodeURIComponent(post.slug)}`)}"
       class="block bg-white rounded-2xl shadow-lg card-hover border border-gray-100 overflow-hidden slide-in focus-ring">
      ${image}
      <div class="p-6">
        <p class="text-sm text-gray-500 mb-2">
          <i class="fas fa-calendar text-blue-600 mr-1" aria-hidden="true"></i>${escapeHTML(formatDateFR(post.date))}
        </p>
        <h3 class="text-xl font-bold text-gray-800 mb-3">${escapeHTML(post.title)}</h3>
        <p class="text-gray-600">${escapeHTML(post.excerpt)}</p>
        <span class="inline-flex items-center gap-1 mt-4 text-blue-600 font-semibold">
          Lire la suite <i class="fas fa-arrow-right text-xs" aria-hidden="true"></i>
        </span>
      </div>
    </a>`;
}

export async function renderNews() {
  const teaser = document.getElementById('news-teaser');
  const list = document.getElementById('news-list');
  if (!teaser && !list) return;

  let posts;
  try {
    posts = await loadPosts();
  } catch (error) {
    console.warn('[ABBC] news.json indisponible :', error);
    return;
  }

  if (teaser) {
    teaser.innerHTML = posts.slice(0, TEASER_COUNT).map(newsCard).join('');
    observe(teaser);
  }

  if (list) {
    list.innerHTML = posts.length
      ? posts.map(newsCard).join('')
      : '<p class="col-span-full text-center text-gray-500 py-12">Aucune actualité pour le moment.</p>';
    observe(list);
  }
}

const backToNews = `
  <div class="mt-12">
    <a href="${url('actualites.html')}" class="inline-flex items-center gap-2 text-blue-600 font-semibold focus-ring">
      <i class="fas fa-arrow-left" aria-hidden="true"></i> Retour aux actualités
    </a>
  </div>`;

/**
 * Rend l'article correspondant au paramètre `?slug=` de l'URL.
 *
 * Le champ `body` est du HTML rédigé par le club dans `news.json` : il est
 * injecté tel quel (c'est le but), contrairement à tous les autres champs
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
    container.innerHTML = `<p class="text-center text-gray-500 py-12">Impossible de charger l'article.</p>${backToNews}`;
    return;
  }

  const post = posts.find((entry) => entry.slug === slug);
  if (!post) {
    document.title = 'Article introuvable · ABB Cornebarrieu';
    container.innerHTML = `
      <div class="text-center py-16">
        <i class="fas fa-newspaper text-5xl text-gray-300 mb-6" aria-hidden="true"></i>
        <h1 class="text-3xl font-bold text-gray-800 mb-4">Article introuvable</h1>
        <p class="text-gray-600">L'article demandé n'existe pas ou a été déplacé.</p>
      </div>${backToNews}`;
    return;
  }

  document.title = `${post.title} · ABB Cornebarrieu`;
  container.innerHTML = `
    <article class="max-w-3xl mx-auto">
      <nav aria-label="Fil d'Ariane" class="breadcrumb">
        <a href="${url('index.html')}">Accueil</a>
        <span aria-hidden="true">›</span>
        <a href="${url('actualites.html')}">Actualités</a>
        <span aria-hidden="true">›</span>
        <span class="breadcrumb-current">${escapeHTML(post.title)}</span>
      </nav>
      <h1 class="text-3xl md:text-5xl font-bold text-gray-800 mb-4">${escapeHTML(post.title)}</h1>
      <p class="text-gray-500 mb-8">
        <i class="fas fa-calendar text-blue-600 mr-2" aria-hidden="true"></i>${escapeHTML(formatDateFR(post.date))}${post.author ? ` · ${escapeHTML(post.author)}` : ''}
      </p>
      ${post.image ? `<img src="${url(escapeHTML(post.image))}" alt="" class="w-full rounded-2xl shadow-xl mb-8">` : ''}
      <div class="prose-abbc text-lg text-gray-700 leading-relaxed">${post.body || ''}</div>
      ${backToNews}
    </article>`;
}
