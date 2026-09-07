# Site ABBC — Association Basket-Ball Cornebarrieu

Site vitrine officiel de l'Association Basket-Ball de Cornebarrieu (ABBC).
HTML statique, Tailwind CSS, modules ES natifs, widgets Score'n'co pour les
résultats et classements en temps réel, et une scène 3D Three.js sur la page
d'accueil.

Aucune étape de build n'est nécessaire pour développer : un serveur HTTP local
suffit.

---

## Démarrage rapide

> `fetch()` ne fonctionne pas en `file://`. Ouvrir les fichiers directement
> dans le navigateur laisse la page vide : il faut un serveur HTTP.

```bash
python -m http.server 8080     # ou : npm install && npm run dev
# → http://localhost:8080
```

Autres options : *Live Server* sous VS Code, ou `docker compose up`
(nginx, port 8080).

---

## Architecture

```
SiteAbbcStable/
│
├── index.html            Accueil (hero 3D, agenda, matchs, actus)
├── equipes.html          Annuaire des équipes
├── agenda.html           Agenda complet
├── actualites.html       Liste des actualités
├── article.html          Article unique (article.html?slug=…)
├── boutique.html         Boutique en ligne (HelloAsso)
├── contact.html          Coordonnées
├── partenaires.html      Partenaires du club
│
├── equipes/              9 coquilles de page équipe (contenu généré depuis teams.json)
├── partials/             navbar.html · footer.html (fragments injectés)
│
├── assets/
│   ├── data/             ← LE CONTENU DU SITE (voir « Gérer le contenu »)
│   ├── css/styles.css    Variables de thème + composants
│   ├── js/               Modules ES (voir ci-dessous)
│   └── images/
│
├── Dockerfile · nginx.conf · docker-compose.yml
└── tailwind.config.js    Build Tailwind optionnel
```

### Organisation du JavaScript

Chaque module a une seule responsabilité et n'appelle pas les autres :
c'est `main.js` qui orchestre l'ordre d'exécution.

```
assets/js/
├── main.js               Point d'entrée : enchaîne les étapes d'initialisation
│
├── core/                 Infrastructure, sans connaissance du contenu
│   ├── dom.js            Helpers DOM, échappement HTML, dates
│   ├── data.js           Chargement + cache des JSON, résolution des chemins
│   ├── theme.js          Mode clair / sombre
│   └── partials.js       Injection de navbar.html et footer.html
│
├── ui/                   Comportements d'interface
│   ├── navigation.js     Menu mobile, mega-menu équipes, page active, footer
│   ├── chrome.js         Barre de progression, bouton retour en haut
│   ├── reveal.js         Apparitions au scroll, compteurs animés
│   └── hero3d.js         Scène 3D du bandeau d'accueil
│
└── content/              Rendu des données du club
    ├── config.js         Applique config.json ([data-config], [data-social])
    ├── events.js         Agenda (accueil + page agenda)
    ├── news.js           Actualités (teaser, liste, article)
    ├── teams.js          Fiches d'équipe + annuaire
    └── scorenco.js       Widgets Score'n'co
```

**Le rendu est piloté par le HTML.** Chaque module cherche ses conteneurs
(`#events-grid`, `#team-page`, `#teams-grid`…) et ne fait rien s'il ne les
trouve pas. Ajouter une page revient donc à écrire son HTML : aucun câblage
dans `main.js`.

### Conventions des pages

```html
<html lang="fr" data-base="../">              <!-- profondeur : "" ou "../" -->
<body data-page="equipes" data-team="sf1">    <!-- page active + équipe -->
  <div data-partial="navbar"></div>
  …
  <div data-partial="footer"></div>
  <script type="module" src="../assets/js/main.js"></script>
```

`data-base` permet aux modules de construire des chemins corrects depuis
n'importe quelle profondeur — c'est ce qui rend `equipes/` possible sans
dupliquer la navbar.

---

## Gérer le contenu (sans toucher au code)

Tout ce qui change souvent vit dans `assets/data/`. Modifiez le JSON,
rafraîchissez la page. Les valeurs à compléter par le club sont marquées
**`TODO`**.

### `config.json` — réglages globaux
Saison, chiffres clés, coordonnées, liens réseaux et widgets du club. Ces
valeurs alimentent tous les `<span data-config="…">` et les liens
`data-social` du site. Un lien social laissé à `TODO` conserve le lien par
défaut du HTML.

### `teams.json` — les équipes **(source unique)**
Un tableau d'équipes. Ce fichier alimente à lui seul :
- le mega-menu « Équipes » de la navbar (desktop et mobile),
- la page `equipes.html`,
- l'intégralité des 9 pages `equipes/*.html`.

| Champ | Rôle |
|---|---|
| `slug` | identifiant interne, doit correspondre au `data-team` de la page |
| `page` | nom du fichier dans `equipes/` |
| `group` | `seniors` ou `jeunes` (regroupement dans le menu) |
| `shortName` / `displayName` | « SF1 » / « Senior Féminine 1 » |
| `level`, `coach`, `description` | affichés sur la fiche |
| `accent` | `blue`, `green`, `purple` ou `orange` |
| `widgets` | identifiants Score'n'co : `nextGames`, `players`, `ranking` |

**Ajouter une équipe** : ajouter l'entrée dans `teams.json`, puis copier une
page existante de `equipes/` en changeant son `data-team`, son `<title>` et sa
`<meta name="description">`. Rien d'autre.

**Trouver un identifiant de widget Score'n'co** : sur `scorenco.com`, ouvrir
l'équipe ou la compétition → *Partager* → *Widget* ; l'identifiant est la
valeur `data-widget-id` du code fourni. Tant qu'un identifiant est vide, la
page affiche un encart « bientôt disponible » à la place du widget — jamais un
chargement infini.

### `events.json` — agenda
Champs : `title`, `category`, `color` (`red`, `yellow`, `green`, `blue`,
`purple`, `orange`), `icon` (nom Font Awesome sans `fa-`), `date`
(`AAAA-MM-JJ`), `time`, `location`, `description`.
Les événements passés sont masqués sur l'accueil (3 prochains affichés) mais
restent visibles sur `agenda.html`.

### `news.json` — actualités
Le plus récent en premier. Champs : `slug` (sans espace ni accent), `title`,
`date`, `author`, `image`, `excerpt`, `body` (HTML de l'article).
Chaque carte pointe vers `article.html?slug=…`.

---

## La scène 3D (`assets/js/ui/hero3d.js`)

Le ballon du bandeau d'accueil est **entièrement procédural** : géométrie
Three.js et texture dessinée sur un `<canvas>`. Aucun fichier de modèle à
héberger, tout se règle dans le code.

- Three.js est chargé **dynamiquement depuis un CDN**, uniquement si la page
  contient `[data-hero3d]` et que WebGL est disponible. Les autres pages ne
  téléchargent rien.
- Réglages regroupés dans l'objet `SETTINGS` en haut du fichier : couleurs du
  cuir et des coutures, vitesse de rotation, amplitude du flottement,
  sensibilité et inertie du glisser, distance de caméra.
- Le rendu se met en pause hors écran et quand l'onglet passe en arrière-plan.
- `prefers-reduced-motion` : une seule image, aucune animation.
- Sans WebGL, sans réseau ou avec un bloqueur de scripts, le logo statique du
  HTML reste affiché (`.hero-3d__fallback`) : la page ne casse jamais.

Le conteneur porte un état lisible dans l'inspecteur :
`data-hero3d-state="ready" | "unsupported" | "failed"`.

Pour changer de version de Three.js, modifier la constante `THREE_URL` en haut
du fichier (version épinglée volontairement). Pour héberger la bibliothèque
soi-même : `npm i three`, copier `node_modules/three/build/three.module.min.js`
et `three.core.min.js` dans `assets/vendor/`, puis pointer `THREE_URL` dessus.

---

## Thème clair / sombre

Le thème est stocké dans `localStorage` (clé `abbc-theme`) et appliqué par un
petit script inline dans le `<head>` de chaque page, **avant** le rendu, pour
éviter un flash de contenu clair. `core/theme.js` gère ensuite la bascule.

Les couleurs sont des variables CSS (`--bg-page`, `--text-main`…) redéfinies
sous `[data-theme="dark"]` dans `styles.css`. Comme le site utilise le CDN
Tailwind (classes utilitaires figées dans le HTML), une section d'overrides
`[data-theme="dark"] .bg-white { … !important }` traduit ces classes vers les
variables. C'est le compromis assumé du CDN ; en passant au Tailwind compilé,
on pourrait basculer sur `darkMode: ['selector', '[data-theme="dark"]']` et
supprimer cette section.

---

## Accessibilité

- Skip-link vers le contenu principal sur chaque page
- `focus-ring` visible au clavier, `aria-expanded` sur les menus dépliants
- Fils d'Ariane sur les pages internes
- `prefers-reduced-motion` respecté (animations, compteurs, scène 3D)
- Icônes décoratives en `aria-hidden`, scène 3D annoncée via `role="img"`

---

## Build Tailwind (production, optionnel)

Le site charge le CDN Tailwind par défaut (~3 MB, pratique en développement).
Pour la production :

```bash
npm install
npm run build:css     # → assets/css/tailwind.min.css (~15 KB)
```

Puis remplacer dans chaque page :

```html
<script src="https://cdn.tailwindcss.com"></script>
<!-- par -->
<link rel="stylesheet" href="assets/css/tailwind.min.css">
```

`npm run watch:css` recompile à chaque sauvegarde.

> `tailwind.config.js` contient une **safelist** pour les classes construites
> en JavaScript (couleurs des événements, accents des équipes) : Tailwind ne
> peut pas les repérer en analysant le code, elles seraient purgées sans elle.

---

## Déploiement

```bash
docker compose up -d --build     # nginx sur http://localhost:8080
```

`nginx.conf` gère gzip, le cache long sur les assets, l'absence de cache sur
le HTML et les en-têtes de sécurité.

Le site étant 100 % statique, il fonctionne aussi tel quel sur GitHub Pages,
Netlify ou Vercel — sans configuration.

---

## Auteur

Site conçu et développé par **Romain Caner** — saison 2026.
Contact club : [bureau.abbc@gmail.com](mailto:bureau.abbc@gmail.com)
