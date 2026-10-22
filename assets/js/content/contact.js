/**
 * content/contact.js — Formulaire « Envoyer un message au club » (contact.html).
 *
 * Le site est statique : il ne peut pas envoyer d'e-mail lui-même. Le message
 * part vers un service de formulaires (FormSubmit par défaut), qui le
 * retransmet à l'adresse du bureau. L'adresse d'envoi vit dans config.json
 * (`contactForm.endpoint`) : changer de service ne touche pas au code.
 *
 * Si le service est injoignable ou refuse l'envoi, le visiteur n'est pas
 * laissé sans issue : on lui propose son logiciel de messagerie, avec le
 * message déjà rédigé.
 *
 * Anti-spam : un champ piège invisible (`_honey`), que seuls les robots
 * remplissent, plutôt qu'un reCAPTCHA qui ajouterait un script tiers.
 */

import { getConfig } from '../core/data.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function feedback(el, type, text, mailto) {
  el.className = `contact-form__feedback is-${type}`;
  el.textContent = text;
  if (mailto) {
    const link = document.createElement('a');
    link.href = mailto;
    link.textContent = 'Envoyer avec ma messagerie';
    el.append(' ', link, '.');
  }
}

/** Lien e-mail pré-rempli, en repli si le service ne répond pas. */
function mailtoFor(to, data) {
  const corps = [
    data.message,
    '',
    `— ${data.name}`,
    data.phone ? `Téléphone : ${data.phone}` : '',
    `E-mail : ${data.email}`,
  ].filter((ligne, i) => i < 3 || ligne).join('\n');
  return `mailto:${to}?subject=${encodeURIComponent(`[Site ABBC] ${data.topic}`)}&body=${encodeURIComponent(corps)}`;
}

/** Vérifie les champs obligatoires et signale le premier en défaut. */
function validate(form) {
  const champs = {
    name: form.elements.name,
    email: form.elements.email,
    topic: form.elements.topic,
    message: form.elements.message,
    consent: form.elements.consent,
  };
  const erreurs = {
    name: !champs.name.value.trim() && 'Indiquez votre nom.',
    email: !EMAIL.test(champs.email.value.trim()) && 'Indiquez une adresse e-mail valide, pour que le club puisse vous répondre.',
    topic: !champs.topic.value && "Choisissez l'objet de votre message.",
    message: champs.message.value.trim().length < 10 && 'Votre message est un peu court : précisez votre demande.',
    consent: !champs.consent.checked && "Cochez la case d'accord pour que le club puisse traiter votre demande.",
  };
  let premiere = null;
  for (const [nom, erreur] of Object.entries(erreurs)) {
    champs[nom].setAttribute('aria-invalid', erreur ? 'true' : 'false');
    if (erreur && !premiere) premiere = { champ: champs[nom], erreur };
  }
  return premiere;
}

export async function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = document.getElementById('contact-feedback');
  const bouton = form.querySelector('button[type="submit"]');

  let config = {};
  try {
    config = await getConfig();
  } catch {
    // Sans config, on garde les valeurs par défaut ci-dessous.
  }
  const to = config.email || 'bureau.abbc@gmail.com';
  const endpoint = config.contactForm?.endpoint || `https://formsubmit.co/ajax/${to}`;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Un robot a rempli le piège : on fait mine d'avoir envoyé.
    if (form.elements._honey.value) {
      feedback(status, 'success', 'Message envoyé. Merci !');
      form.reset();
      return;
    }

    const erreur = validate(form);
    if (erreur) {
      feedback(status, 'error', erreur.erreur);
      erreur.champ.focus();
      return;
    }

    const data = {
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.trim(),
      email: form.elements.email.value.trim(),
      topic: form.elements.topic.value,
      message: form.elements.message.value.trim(),
    };

    bouton.disabled = true;
    feedback(status, 'pending', 'Envoi en cours…');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          Nom: data.name,
          Téléphone: data.phone || '—',
          email: data.email,
          Objet: data.topic,
          Message: data.message,
          // Champs de service FormSubmit : objet du mail, mise en forme,
          // réponse directe au visiteur, piège à robots.
          _subject: `[Site ABBC] ${data.topic} — ${data.name}`,
          _template: 'table',
          _replyto: data.email,
          _honey: '',
        }),
      });
      const reponse = await res.json().catch(() => ({}));
      const ok = res.ok && String(reponse.success) !== 'false';
      if (!ok) throw new Error(reponse.message || `HTTP ${res.status}`);

      feedback(status, 'success', 'Message envoyé. Le bureau vous répondra par e-mail, en général sous 48 h.');
      form.reset();
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    } catch (error) {
      console.warn('[ABBC] Envoi du formulaire impossible :', error);
      feedback(status, 'error', "Le message n'a pas pu partir.", mailtoFor(to, data));
    } finally {
      bouton.disabled = false;
    }
  });
}
