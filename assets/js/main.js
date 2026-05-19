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
  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'none';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.slide-in, .fade-in, .bounce-in').forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      observer.observe(el);
    });
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
  });
})();
