/**
 * main.js - ABBC Cornebarrieu
 * Scripts communs à toutes les pages du site
 */

// --- Animation au scroll (IntersectionObserver) ---

const scrollObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
);

document.querySelectorAll('.slide-in, .fade-in, .bounce-in').forEach((el) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  scrollObserver.observe(el);
});

// --- Toggle du menu mobile (bouton hamburger) ---

const menuToggle = document.querySelector('nav button.md\\:hidden');
const mobileMenu = document.querySelector('nav ul');

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
    mobileMenu.classList.toggle('flex');
    mobileMenu.classList.toggle('flex-col');
    mobileMenu.classList.toggle('absolute');
    mobileMenu.classList.toggle('top-full');
    mobileMenu.classList.toggle('left-0');
    mobileMenu.classList.toggle('right-0');
    mobileMenu.classList.toggle('bg-blue-900');
    mobileMenu.classList.toggle('p-4');
    mobileMenu.classList.toggle('shadow-lg');

    const icon = menuToggle.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-bars');
      icon.classList.toggle('fa-times');
    }
  });
}
