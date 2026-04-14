/**
 * main.js - ABBC Cornebarrieu
 */

// --- Animations au scroll (IntersectionObserver) ---
const scrollObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'none';
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.slide-in, .fade-in, .bounce-in').forEach((el) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  scrollObserver.observe(el);
});

// --- Menu mobile (hamburger) ---
const navToggle = document.getElementById('nav-toggle');
const mobileMenu = document.getElementById('mobile-menu');
const navIcon = document.getElementById('nav-icon');

if (navToggle && mobileMenu && navIcon) {
  navToggle.addEventListener('click', () => {
    const isOpen = !mobileMenu.classList.contains('hidden');
    mobileMenu.classList.toggle('hidden');
    navIcon.classList.toggle('fa-bars', isOpen);
    navIcon.classList.toggle('fa-times', !isOpen);
  });
}

// --- Accordion "Nos équipes" dans le menu mobile ---
const teamsToggle = document.getElementById('mobile-teams-toggle');
const teamsMenu = document.getElementById('mobile-teams-menu');
const teamsIcon = document.getElementById('mobile-teams-icon');

if (teamsToggle && teamsMenu && teamsIcon) {
  teamsToggle.addEventListener('click', () => {
    teamsMenu.classList.toggle('hidden');
    teamsIcon.classList.toggle('rotate-180');
  });
}

// --- Fermer le menu mobile en cliquant un lien ---
document.querySelectorAll('#mobile-menu a').forEach((link) => {
  link.addEventListener('click', () => {
    if (mobileMenu) mobileMenu.classList.add('hidden');
    if (navIcon) {
      navIcon.classList.add('fa-bars');
      navIcon.classList.remove('fa-times');
    }
  });
});
