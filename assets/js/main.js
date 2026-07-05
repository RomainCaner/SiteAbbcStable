/**
 * main.js - ABBC Cornebarrieu
 * Chargement des partials + comportements UI globaux.
 *
 * Le thème (dark/light) est posé en amont via un script inline dans le
 * <head> de chaque page pour éviter le flash de contenu non stylé (FOUC).
 */

(function () {
  'use strict';

  const html = document.documentElement;
  const base = html.dataset.base || '';

  // ===== Theme (dark mode) =====
  function applyTheme(theme) {
    html.dataset.theme = theme;
    try { localStorage.setItem('abbc-theme', theme); } catch (_) {}
    updateThemeIcons(theme);
  }

  function updateThemeIcons(theme) {
    document.querySelectorAll('#theme-icon, #theme-icon-mobile').forEach((icon) => {
      icon.classList.toggle('fa-moon', theme !== 'dark');
      icon.classList.toggle('fa-sun', theme === 'dark');
    });
  }

  function toggleTheme() {
    applyTheme(html.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  // ===== Components loader =====
  async function loadComponent(placeholderId, file) {
    const placeholder = document.getElementById(placeholderId);
    if (!placeholder) return;
    try {
      const res = await fetch(`${base}partials/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const markup = (await res.text()).replace(/\{\{base\}\}/g, base);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = markup.trim();
      placeholder.replaceWith(...wrapper.childNodes);
    } catch (err) {
      console.warn(`[ABBC] Impossible de charger ${file}:`, err);
      placeholder.innerHTML =
        '<p style="text-align:center;padding:1rem;color:#dc2626;font-family:sans-serif">' +
        'Composant indisponible. Servir le site via un serveur HTTP (cf. README).</p>';
    }
  }

  async function loadAllPartials() {
    await Promise.all([
      loadComponent('navbar-placeholder', 'navbar.html'),
      loadComponent('footer-placeholder', 'footer.html'),
    ]);
    initNavbar();
    initFooter();
    initBackToTop();
    initScrollProgress();
    loadConfig();
  }

  // ===== Data helpers =====
  async function fetchJSON(file) {
    const res = await fetch(`${base}assets/data/${file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function formatDateFR(iso) {
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso || '';
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // ===== Site config (config.json) =====
  let siteConfig = null;
  async function loadConfig() {
    try {
      siteConfig = await fetchJSON('config.json');
    } catch (err) {
      console.warn('[ABBC] config.json indisponible:', err);
      return;
    }
    // Textes pilotes par la config (saison, chiffres cles)
    ['season', 'licencies', 'equipesCount'].forEach((key) => {
      const val = siteConfig[key];
      if (val == null) return;
      document.querySelectorAll(`[data-config="${key}"]`).forEach((el) => {
        el.textContent = val;
      });
    });
    // Liens reseaux sociaux (on ne remplace que si une vraie URL est fournie)
    const social = siteConfig.social || {};
    document.querySelectorAll('[data-social]').forEach((a) => {
      const url = social[a.dataset.social];
      if (url && !String(url).startsWith('TODO')) a.href = url;
    });
  }

  // ===== Navbar interactions =====
  function initNavbar() {
    const navToggle = document.getElementById('nav-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const navIcon = document.getElementById('nav-icon');

    if (navToggle && mobileMenu && navIcon) {
      navToggle.addEventListener('click', () => {
        const willOpen = mobileMenu.classList.contains('hidden');
        mobileMenu.classList.toggle('hidden');
        navIcon.classList.toggle('fa-bars', !willOpen);
        navIcon.classList.toggle('fa-times', willOpen);
        navToggle.setAttribute('aria-expanded', String(willOpen));
      });
    }

    const teamsToggle = document.getElementById('mobile-teams-toggle');
    const teamsMenu = document.getElementById('mobile-teams-menu');
    const teamsIcon = document.getElementById('mobile-teams-icon');
    if (teamsToggle && teamsMenu && teamsIcon) {
      teamsToggle.addEventListener('click', () => {
        const willOpen = teamsMenu.classList.contains('hidden');
        teamsMenu.classList.toggle('hidden');
        teamsIcon.classList.toggle('rotate-180', willOpen);
        teamsToggle.setAttribute('aria-expanded', String(willOpen));
      });
    }

    document.querySelectorAll('#mobile-menu a').forEach((link) => {
      link.addEventListener('click', () => {
        if (mobileMenu) mobileMenu.classList.add('hidden');
        if (navIcon) { navIcon.classList.add('fa-bars'); navIcon.classList.remove('fa-times'); }
        if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Indicateur de page active
    const page = document.body.dataset.page;
    if (page) {
      document.querySelectorAll(`.nav-link[data-nav="${page}"]`).forEach((link) => {
        link.dataset.active = 'true';
      });
    }

    document.querySelectorAll('#theme-toggle, #theme-toggle-mobile').forEach((btn) => {
      btn.addEventListener('click', toggleTheme);
    });
    updateThemeIcons(html.dataset.theme || 'light');
  }

  // ===== Footer interactions =====
  function initFooter() {
    const year = document.getElementById('current-year');
    if (year) year.textContent = new Date().getFullYear();

    const form = document.getElementById('newsletter-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('newsletter-email');
      const feedback = document.getElementById('newsletter-feedback');
      if (!email || !feedback) return;
      const value = email.value.trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      feedback.className = '';
      feedback.classList.remove('hidden');
      feedback.classList.add(valid ? 'success' : 'error');
      feedback.textContent = valid
        ? 'Merci ! Votre inscription a bien été prise en compte.'
        : 'Veuillez saisir une adresse email valide.';
      if (valid) email.value = '';
    });
  }

  // ===== Back to top =====
  function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ===== Scroll progress bar =====
  function initScrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ===== Scroll-triggered animations =====
  let revealObserver = null;

  function prepAndObserve(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    if (revealObserver) revealObserver.observe(el);
  }

  // Revele les elements animes injectes dynamiquement (evenements, actus).
  function observeWithin(container) {
    if (!container) return;
    container.querySelectorAll('.slide-in, .fade-in, .bounce-in').forEach(prepAndObserve);
  }

  function initScrollAnimations() {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'none';
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.slide-in, .fade-in, .bounce-in').forEach(prepAndObserve);
  }

  // ===== Evenements (events.json) =====
  function eventCardHTML(ev) {
    const color = ev.color || 'blue';
    return `
      <div class="bg-white p-6 rounded-2xl shadow-lg card-hover border border-gray-100 slide-in">
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-${color}-600 rounded-full flex items-center justify-center">
            <i class="fas fa-${escapeHTML(ev.icon || 'calendar')} text-white text-xl" aria-hidden="true"></i>
          </div>
          <span class="bg-${color}-500 text-white px-3 py-1 rounded-full text-sm font-semibold">${escapeHTML(ev.category)}</span>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-3">${escapeHTML(ev.title)}</h3>
        <div class="space-y-2 text-gray-600">
          <p class="flex items-center gap-2"><i class="fas fa-calendar text-${color}-600" aria-hidden="true"></i> ${escapeHTML(formatDateFR(ev.date))}</p>
          <p class="flex items-center gap-2"><i class="fas fa-clock text-${color}-600" aria-hidden="true"></i> ${escapeHTML(ev.time)}</p>
          <p class="flex items-center gap-2"><i class="fas fa-map-marker-alt text-${color}-600" aria-hidden="true"></i> ${escapeHTML(ev.location)}</p>
        </div>
        <p class="text-sm text-gray-500 mt-4">${escapeHTML(ev.description)}</p>
      </div>`;
  }

  function emptyStateHTML(message) {
    return `<div class="col-span-full text-center text-gray-500 py-12">
      <i class="fas fa-calendar-times text-4xl mb-4 opacity-50" aria-hidden="true"></i>
      <p>${escapeHTML(message)}</p>
    </div>`;
  }

  async function renderEvents() {
    const grid = document.getElementById('events-grid');
    const list = document.getElementById('agenda-list');
    if (!grid && !list) return;

    let events;
    try {
      events = await fetchJSON('events.json');
    } catch (err) {
      console.warn('[ABBC] events.json indisponible:', err);
      const msg = emptyStateHTML('Impossible de charger les événements.');
      if (grid) grid.innerHTML = msg;
      if (list) list.innerHTML = msg;
      return;
    }

    events = events.filter((e) => e && e.date && e.title);
    events.sort((a, b) => a.date.localeCompare(b.date));
    const today = todayISO();

    // Accueil : 3 prochains evenements a venir
    if (grid) {
      const upcoming = events.filter((e) => e.date >= today).slice(0, 3);
      grid.innerHTML = upcoming.length
        ? upcoming.map(eventCardHTML).join('')
        : emptyStateHTML('Aucun événement à venir pour le moment. Revenez bientôt !');
      observeWithin(grid);
    }

    // Page agenda : a venir (croissant) puis passes (decroissant)
    if (list) {
      const upcoming = events.filter((e) => e.date >= today);
      const past = events.filter((e) => e.date < today).reverse();
      const section = (title, items, dim) => !items.length ? '' : `
        <div class="mb-16">
          <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
            <span class="w-2 h-8 bg-gradient-to-b from-blue-600 to-green-600 rounded-full"></span>${title}
          </h2>
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8${dim ? ' opacity-70' : ''}">
            ${items.map(eventCardHTML).join('')}
          </div>
        </div>`;
      list.innerHTML =
        (section('À venir', upcoming, false) || `<p class="text-gray-500 mb-16">Aucun événement à venir pour le moment.</p>`) +
        section('Événements passés', past, true);
      observeWithin(list);
    }
  }

  // ===== Actualites (news.json) =====
  function newsCardHTML(post) {
    const img = post.image
      ? `<img src="${base}${escapeHTML(post.image)}" alt="" loading="lazy" class="w-full h-48 object-cover">`
      : '';
    return `
      <a href="${base}article.html?slug=${encodeURIComponent(post.slug)}" class="block bg-white rounded-2xl shadow-lg card-hover border border-gray-100 overflow-hidden slide-in focus-ring">
        ${img}
        <div class="p-6">
          <p class="text-sm text-gray-500 mb-2"><i class="fas fa-calendar text-blue-600 mr-1" aria-hidden="true"></i>${escapeHTML(formatDateFR(post.date))}</p>
          <h3 class="text-xl font-bold text-gray-800 mb-3">${escapeHTML(post.title)}</h3>
          <p class="text-gray-600">${escapeHTML(post.excerpt)}</p>
          <span class="inline-flex items-center gap-1 mt-4 text-blue-600 font-semibold">Lire la suite <i class="fas fa-arrow-right text-xs" aria-hidden="true"></i></span>
        </div>
      </a>`;
  }

  async function renderNews() {
    const teaser = document.getElementById('news-teaser');
    const listing = document.getElementById('news-list');
    if (!teaser && !listing) return;

    let posts;
    try {
      posts = await fetchJSON('news.json');
    } catch (err) {
      console.warn('[ABBC] news.json indisponible:', err);
      return;
    }

    posts = posts.filter((p) => p && p.slug && p.title);
    posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    if (teaser) {
      teaser.innerHTML = posts.slice(0, 3).map(newsCardHTML).join('');
      observeWithin(teaser);
    }
    if (listing) {
      listing.innerHTML = posts.length
        ? posts.map(newsCardHTML).join('')
        : `<p class="col-span-full text-center text-gray-500 py-12">Aucune actualité pour le moment.</p>`;
      observeWithin(listing);
    }
  }

  // ===== Article unique (article.html?slug=...) =====
  async function renderArticle() {
    const container = document.getElementById('article-content');
    if (!container) return;

    const slug = new URLSearchParams(window.location.search).get('slug');
    const backLink = `<div class="mt-12"><a href="${base}actualites.html" class="inline-flex items-center gap-2 text-blue-600 font-semibold focus-ring"><i class="fas fa-arrow-left" aria-hidden="true"></i> Retour aux actualités</a></div>`;

    let posts;
    try {
      posts = await fetchJSON('news.json');
    } catch (err) {
      container.innerHTML = `<p class="text-center text-gray-500 py-12">Impossible de charger l'article.</p>${backLink}`;
      return;
    }

    const post = posts.find((p) => p.slug === slug);
    if (!post) {
      document.title = 'Article introuvable · ABB Cornebarrieu';
      container.innerHTML = `
        <div class="text-center py-16">
          <i class="fas fa-newspaper text-5xl text-gray-300 mb-6" aria-hidden="true"></i>
          <h1 class="text-3xl font-bold text-gray-800 mb-4">Article introuvable</h1>
          <p class="text-gray-600">L'article demandé n'existe pas ou a été déplacé.</p>
        </div>${backLink}`;
      return;
    }

    document.title = `${post.title} · ABB Cornebarrieu`;
    container.innerHTML = `
      <article class="max-w-3xl mx-auto">
        <nav aria-label="Fil d'Ariane" class="text-sm text-gray-500 mb-6">
          <a href="${base}index.html" class="hover:text-blue-600">Accueil</a>
          <span class="mx-2" aria-hidden="true">›</span>
          <a href="${base}actualites.html" class="hover:text-blue-600">Actualités</a>
          <span class="mx-2" aria-hidden="true">›</span>
          <span class="text-blue-600 font-semibold">${escapeHTML(post.title)}</span>
        </nav>
        <h1 class="text-3xl md:text-5xl font-bold text-gray-800 mb-4">${escapeHTML(post.title)}</h1>
        <p class="text-gray-500 mb-8"><i class="fas fa-calendar text-blue-600 mr-2" aria-hidden="true"></i>${escapeHTML(formatDateFR(post.date))}${post.author ? ` · ${escapeHTML(post.author)}` : ''}</p>
        ${post.image ? `<img src="${base}${escapeHTML(post.image)}" alt="" class="w-full rounded-2xl shadow-xl mb-8">` : ''}
        <div class="prose-abbc text-lg text-gray-700 leading-relaxed">${post.body || ''}</div>
        ${backLink}
      </article>`;
  }

  // ===== Animated counters =====
  function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.counter, 10);
        const suffix = el.dataset.suffix || '';
        const duration = 1500;
        const start = performance.now();
        const step = (now) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        observer.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach((c) => observer.observe(c));
  }

  // ===== Bootstrap =====
  document.addEventListener('DOMContentLoaded', () => {
    loadAllPartials();
    initScrollAnimations();
    initCounters();
    renderEvents();
    renderNews();
    renderArticle();
  });
})();
