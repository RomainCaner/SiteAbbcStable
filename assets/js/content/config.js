/**
 * content/config.js — Propage `config.json` dans le HTML.
 *
 * Deux mécanismes, volontairement simples :
 *   `<span data-config="season">`     → remplacé par la valeur du JSON
 *   `<a data-social="instagram">`     → href remplacé si une vraie URL existe
 *
 * Les valeurs encore marquées « TODO » sont ignorées : le contenu écrit en dur
 * dans le HTML reste alors visible, ce qui évite d'afficher un placeholder.
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
  document.querySelectorAll('[data-social]').forEach((link) => {
    const value = social[link.dataset.social];
    if (value && !isPlaceholder(value)) link.href = value;
  });

  return config;
}
