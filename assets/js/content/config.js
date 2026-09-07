/**
 * content/config.js — Propage `config.json` dans le HTML.
 *
 * Deux mécanismes, volontairement simples :
 *   `<span data-config="season">`     → remplacé par la valeur du JSON
 *   `<a data-social="instagram">`     → href remplacé si une vraie URL existe
 *
 * Les valeurs encore marquées « TODO » masquent leur lien social : mieux vaut
 * une icône en moins qu'une icône qui renvoie à l'accueil du réseau.
 */

import { getConfig } from '../core/data.js';

const isPlaceholder = (value) => String(value).startsWith('TODO');

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
    if (value != null && !isPlaceholder(value)) element.textContent = value;
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

  return config;
}
