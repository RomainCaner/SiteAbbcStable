/**
 * core/data.js — Accès aux fichiers de contenu (assets/data/*.json).
 *
 * Toutes les pages ne vivent pas à la racine : les pages d'équipe sont dans
 * `equipes/`. Chaque page déclare sa profondeur via `<html data-base="../">`,
 * et ce module s'en sert pour construire des URL correctes partout.
 *
 * Les fichiers sont mis en cache : `getTeams()` peut être appelé par plusieurs
 * modules sans déclencher plusieurs requêtes réseau.
 */

/** Préfixe à ajouter devant tout chemin absolu au site (« », « ../ »…). */
export const basePath = document.documentElement.dataset.base || '';

/** Construit une URL relative à la racine du site. */
export const url = (path) => `${basePath}${path}`;

const cache = new Map();

/**
 * Charge un JSON de `assets/data/`, une seule fois par page.
 * @throws {Error} si le fichier est introuvable ou mal formé.
 */
export function fetchData(filename) {
  if (!cache.has(filename)) {
    const promise = fetch(url(`assets/data/${filename}`)).then((res) => {
      if (!res.ok) throw new Error(`${filename} : HTTP ${res.status}`);
      return res.json();
    });
    // Un échec ne doit pas être mémorisé : on laisse une nouvelle tentative possible.
    promise.catch(() => cache.delete(filename));
    cache.set(filename, promise);
  }
  return cache.get(filename);
}

/** Réglages globaux du site (saison, chiffres clés, réseaux sociaux). */
export const getConfig = () => fetchData('config.json');

/** Événements du club, tels quels (non triés). */
export const getEvents = () => fetchData('events.json');

/** Articles d'actualité, tels quels (non triés). */
export const getNews = () => fetchData('news.json');

/**
 * Équipes du club, nettoyées des entrées incomplètes.
 * Le premier objet de teams.json ne porte qu'un commentaire d'aide :
 * le filtre sur `slug` suffit à écarter toute entrée non exploitable.
 */
export async function getTeams() {
  const teams = await fetchData('teams.json');
  return teams.filter((team) => team && team.slug && team.page);
}
