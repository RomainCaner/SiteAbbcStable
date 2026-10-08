/**
 * content/config.js — Propage `config.json` dans le HTML.
 *
 * Trois mécanismes, volontairement simples :
 *   `<span data-config="season">`     → remplacé par la valeur du JSON
 *   `<a data-social="instagram">`     → href remplacé si une vraie URL existe
 *   `#newsletter`                     → affiché si un service d'emailing est désigné
 *
 * Les valeurs encore marquées « TODO » masquent leur lien social : mieux vaut
 * une icône en moins qu'une icône qui renvoie à l'accueil du réseau.
 */

import { getConfig } from '../core/data.js';

const isPlaceholder = (value) => String(value).startsWith('TODO');

/**
 * Écrit une valeur dans l'élément. Une adresse e-mail reçoit un point de coupure
 * après l'arobase : dans un bouton étroit, elle passe à la ligne en
 * « bureau.abbc@ / gmail.com » plutôt qu'au milieu d'un mot.
 */
function writeValue(element, value) {
  const text = String(value);
  const at = text.indexOf('@');
  if (at < 0) {
    element.textContent = text;
    return;
  }
  element.replaceChildren(text.slice(0, at + 1), document.createElement('wbr'), text.slice(at + 1));
}

export async function applyConfig() {
  let config;
  try {
    config = await getConfig();
  } catch (error) {
    console.warn('[ABBC] config.json indisponible :', error);
    return null;
  }

  document.querySelectorAll('[data-config]').forEach((element) => {
    const value = config[element.dataset.config];
    if (value != null && !isPlaceholder(value)) writeValue(element, value);
  });

  const social = config.social || {};
  // Un réseau sans URL renseignée est masqué plutôt que laissé sur l'adresse
  // écrite en dur dans le HTML : celle-ci pointe vers l'accueil du réseau, ce
  // qui envoie le visiteur nulle part. Renseigner la valeur le fait réapparaître.
  document.querySelectorAll('[data-social]').forEach((link) => {
    const value = social[link.dataset.social];
    const renseigne = Boolean(value) && !isPlaceholder(value);
    if (renseigne) link.href = value;
    link.hidden = !renseigne;
  });

  // Newsletter : le formulaire poste vers le service d'emailing du club. Sans
  // adresse renseignée, le bloc reste masqué — il répondait « merci » sans rien
  // envoyer, et le visiteur attendait des emails qui ne viendraient jamais.
  const newsletter = document.getElementById('newsletter');
  const form = document.getElementById('newsletter-form');
  if (newsletter && form) {
    const action = config.newsletter;
    const renseigne = Boolean(action) && !isPlaceholder(action);
    if (renseigne) form.action = action;
    newsletter.hidden = !renseigne;
  }

  return config;
}
