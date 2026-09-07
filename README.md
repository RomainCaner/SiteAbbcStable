# Site ABBC — Association Basket-Ball Cornebarrieu

Site vitrine officiel de l'Association Basket-Ball de Cornebarrieu.
HTML statique, CSS maison, modules ES natifs, widgets Score'n'co pour les
résultats en temps réel et une scène 3D Three.js sur la page d'accueil.

**Aucune étape de build.** Pas de bundler, pas de framework, pas de Tailwind :
un serveur HTTP local suffit pour développer.

---

## Démarrage

> `fetch()` et les modules ES ne fonctionnent pas en `file://`. Ouvrir les
> fichiers par double-clic laisse la page vide : il faut un serveur HTTP.

```bash
python -m http.server 8080     # ou : npm install && npm run dev
# → http://localhost:8080
```

Autres options : *Live Server* sous VS Code, ou `docker compose up`
(nginx, port 8080).

---

## Identité visuelle

Les couleurs viennent du blason du club, pas d'une palette générique :

| Rôle | Valeur | Origine |
|---|---|---|
| Vert ABBC | `#226321` | fond du blason |
| Orange | `#E85F11` | ballon du blason |
| Blanc | `#FFFFFF` | typographie du blason |

Le vert porte les grandes bandes et les en-têtes de page, l'orange sert
d'accent unique : boutons d'action, surtitres, liens, bandeau du prochain
rendez-vous. Les deux polices — **Barlow Condensed** en majuscules pour les
titres, **Inter** pour le texte courant — reprennent les codes des sites de
clubs sportifs.

Tout est piloté par les jetons de `assets/css/tokens.css` : changer la marque
se fait dans ce seul fichier.

---

## Architecture

```
SiteAbbcStable/
│
├── index.html            Accueil (hero 3D, prochain rendez-vous, actus, agenda)
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
├── scripts/              récupération des classements FFBB (hors site)
├── .github/workflows/    mise à jour automatique des classements
│
├── assets/
│   ├── data/             ← LE CONTENU DU SITE (voir « Gérer le contenu »)
│   ├── css/              tokens · base · components
│   ├── js/               Modules ES (voir ci-dessous)
│   └── images/
│
└── Dockerfile · nginx.conf · docker-compose.yml
```

### CSS — trois couches, dans cet ordre

| Fichier | Rôle |
|---|---|
| `tokens.css` | Variables : couleurs, typo, espacements, formes, durées. Le thème sombre se contente de redéfinir ces variables. |
| `base.css` | Reset, typographie, conteneurs, grilles, accessibilité, animations d'apparition. |
| `components.css` | Tous les composants du site : en-tête, hero, cartes, sections, widgets, pied de page. Sommaire numéroté en tête de fichier. |

Les composants n'utilisent que les **rôles sémantiques** (`--bg`, `--text`,
`--brand`, `--accent`…), jamais les couleurs brutes. C'est ce qui permet au
mode sombre de fonctionner sans une seule règle `!important`, et aux bandes
`.section--dark` / `.section--brand` d'adapter automatiquement tout leur
contenu.

### JavaScript — 13 modules ES

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
│   ├── navigation.js     En-tête collant, menu mobile, mega-menu, pied de page
│   ├── chrome.js         Barre de progression, bouton retour en haut
│   ├── reveal.js         Apparitions au scroll, compteurs animés
│   └── hero3d.js         Scène 3D du bandeau d'accueil
│
└── content/              Rendu des données du club
    ├── config.js         Applique config.json ([data-config], [data-social])
    ├── events.js         Bandeau « prochain rendez-vous » + agenda
    ├── news.js           Actualités (grille éditoriale, liste, article)
    ├── teams.js          Fiches d'équipe + annuaire
    ├── standings.js      Classement rendu par le site (données FFBB)
    └── scorenco.js       Widgets Score'n'co (repli)
```

**Le rendu est piloté par le HTML.** Chaque module cherche ses conteneurs
(`#events-grid`, `#team-page`, `#news-grid`…) et ne fait rien s'il ne les
trouve pas. Ajouter une page revient à écrire son HTML : aucun câblage dans
`main.js`.

### Conventions des pages

```html
<html lang="fr" data-base="../">              <!-- profondeur : "" ou "../" -->
<body data-page="equipes" data-team="sf1">    <!-- page active + équipe -->
  <div data-partial="navbar"></div>
  …
  <div data-partial="footer"></div>
  <script type="module" src="../assets/js/main.js"></script>
```

- `data-base` : profondeur de la page, pour que les chemins restent corrects
  depuis `equipes/`.
- `data-page` : souligne l'entrée de menu correspondante.
- `data-hero` (accueil uniquement) : rend l'en-tête transparent au-dessus du
  bandeau, puis plein au défilement.

---

## Gérer le contenu (sans toucher au code)

Tout ce qui change souvent vit dans `assets/data/`. Modifiez le JSON,
rafraîchissez la page. Les valeurs à compléter sont marquées **`TODO`**.

### `config.json` — réglages globaux
Saison, chiffres clés, coordonnées, liens réseaux et widgets du club. Ces
valeurs alimentent tous les `<span data-config="…">` et les liens
`data-social`. Un lien social laissé à `TODO` conserve celui écrit dans le HTML.

### `teams.json` — les équipes **(source unique)**
Ce fichier alimente à lui seul :
- le mega-menu « Équipes » de l'en-tête (desktop et mobile),
- la page `equipes.html`,
- l'intégralité des 9 pages `equipes/*.html`.

| Champ | Rôle |
|---|---|
| `slug` | identifiant interne, doit correspondre au `data-team` de la page |
| `page` | nom du fichier dans `equipes/` |
| `group` | `seniors` ou `jeunes` (regroupement dans le menu) |
| `shortName` / `displayName` | « SF1 » / « Senior Féminine 1 » |
| `level`, `coach`, `description` | affichés sur la fiche |
| `accent` | `green`, `forest`, `orange` ou `ochre` |
| `widgets` | identifiants Score'n'co : `nextGames`, `players`, `ranking` |

**Ajouter une équipe** : ajouter l'entrée dans `teams.json`, puis copier une
page existante de `equipes/` en changeant son `data-team`, son `<title>` et sa
`<meta name="description">`. Rien d'autre.

**Trouver un identifiant Score'n'co** : sur `scorenco.com`, ouvrir l'équipe ou
la compétition → *Partager* → *Widget* ; l'identifiant est la valeur
`data-widget-id` du code fourni. Tant qu'un identifiant est vide, la page
affiche un encart « bientôt disponible » — jamais un chargement infini.

### `events.json` — agenda
Champs : `title`, `category`, `color` (`red`, `orange`, `yellow`, `green`,
`forest`, `blue`, `purple`), `icon` (nom Font Awesome sans `fa-`), `date`
(`AAAA-MM-JJ`), `time`, `location`, `description`.

Le **premier événement à venir** alimente automatiquement le bandeau orange
sous le bandeau d'accueil. Les événements passés sont masqués sur l'accueil
mais restent visibles sur `agenda.html`.

### `news.json` — actualités
Le plus récent en premier. Champs : `slug` (sans espace ni accent), `title`,
`date`, `author`, `image`, `excerpt`, `body` (HTML de l'article).
Le premier article occupe la grande carte de la grille d'accueil.

---

## Classements : du widget tiers aux données du club

Le site sait afficher **ses propres tableaux de classement**, alimentés par les
données publiques de la FFBB, au lieu de dépendre des widgets Score'n'co.

### Pourquoi

| | Widget Score'n'co | Classement maison |
|---|---|---|
| Script tiers sur la page | oui | **non** |
| Mise en forme | imposée | **à la charte du site** |
| Bloqueur de contenu | peut le masquer | insensible |
| Source indisponible | bloc vide | **dernier classement connu reste affiché** |
| Historique | aucun | **versionné dans git** |

### Comment ça marche

```
.github/workflows/classements.yml   (tous les jours à 6h UTC)
        │
        ▼
scripts/fetch_standings.py          récupère + parse resultats.ffbb.com
        │
        ▼
assets/data/standings.json          commité si le classement a changé
        │
        ▼
assets/js/content/standings.js      rend le tableau sur la fiche d'équipe
```

Le site étant statique, il ne peut pas appeler la FFBB depuis le navigateur
(CORS). C'est donc GitHub Actions qui récupère les données en amont et les
dépose dans un JSON servi par le site — aucune infrastructure à héberger.

### Brancher une équipe

1. Sur [resultats.ffbb.com](https://resultats.ffbb.com), ouvrir la page du
   championnat de l'équipe. L'URL a la forme
   `resultats.ffbb.com/championnat/`**`b5e6211fe70a`**`.html`.
2. Copier l'identifiant (la partie en gras) dans `assets/data/teams.json` :
   ```json
   "ffbb": { "championshipId": "b5e6211fe70a" }
   ```
3. Lancer le workflow à la main (onglet *Actions* → *Classements FFBB* →
   *Run workflow*), ou attendre la prochaine exécution planifiée.

Tant qu'un `championshipId` est vide, l'équipe **continue d'afficher son widget
Score'n'co**. La bascule se fait donc équipe par équipe, sans rien casser.

### Tester le parsing sans appeler la FFBB

```bash
pip install -r scripts/requirements.txt

# Sur un jeu d'essai fourni
python scripts/fetch_standings.py --html-file scripts/tests/championnat-exemple.html --team sf1 --dry-run

# Sur une vraie page enregistrée depuis le navigateur (Ctrl+S)
python scripts/fetch_standings.py --html-file ma-page.html --team sf1 --dry-run
```

Le script **associe les colonnes par intitulé** (`Clt`, `Equipe`, `Pts`, `J`,
`G`, `P`, `BP`, `BC`, `Diff`) plutôt que par position : une colonne ajoutée par
la FFBB ne décale plus tout le tableau. Si la structure change au point de
devenir illisible, il **échoue bruyamment** (code de sortie 1, message
explicite) au lieu d'écrire un JSON vide qui écraserait de bonnes données.

> ⚠️ Le parsing n'a pas encore été confronté à une vraie page FFBB — il a été
> écrit d'après la structure connue (`#idTdDivision` pour le titre,
> `table.liste` pour le classement) et validé sur un jeu d'essai. La première
> exécution avec un vrai `championshipId` peut demander un ajustement des
> intitulés de colonnes dans `COLUMN_ALIASES`.

### Bon voisinage

Le script s'identifie par un `User-Agent` explicite avec un contact, attend
1,5 s entre deux requêtes et ne tourne qu'une fois par jour. Les championnats
amateurs se jouent le week-end : inutile d'interroger la FFBB plus souvent.

---

## La scène 3D (`assets/js/ui/hero3d.js`)

Le ballon du bandeau d'accueil est **entièrement procédural** : géométrie
Three.js et texture dessinée sur un `<canvas>` (équateur, méridiens, coutures
incurvées, grain du cuir). Aucun fichier de modèle à héberger.

- Réglages regroupés dans l'objet `SETTINGS` en haut du fichier : couleurs du
  cuir et des coutures, vitesse de rotation, flottement, sensibilité et
  inertie du glisser, distance de caméra.
- Éclairage aux couleurs du club : liseré vert d'un côté, orange de l'autre.
- Three.js est chargé **dynamiquement depuis un CDN**, uniquement si la page
  contient `[data-hero3d]` et que WebGL est disponible. Les autres pages ne
  téléchargent rien.
- Le rendu se met en pause hors écran et quand l'onglet passe en arrière-plan.
- `prefers-reduced-motion` : une seule image, aucune animation.
- Sans WebGL, sans réseau ou avec un bloqueur, le logo statique du HTML reste
  affiché : la page ne casse jamais.

Le conteneur porte un état lisible dans l'inspecteur :
`data-hero3d-state="ready" | "unsupported" | "failed"`.

Pour changer de version, modifier `THREE_URL` en haut du fichier (version
épinglée volontairement). Pour héberger la bibliothèque soi-même :
`npm i three`, copier `three.module.min.js` et `three.core.min.js` dans
`assets/vendor/`, puis pointer `THREE_URL` dessus.

---

## Thème clair / sombre

Le thème est stocké dans `localStorage` (clé `abbc-theme`) et appliqué par un
script inline dans le `<head>`, **avant** le rendu, pour éviter tout flash de
contenu clair. `core/theme.js` gère la bascule.

Comme tous les composants passent par les rôles sémantiques, le thème sombre
tient en une vingtaine de lignes à la fin de `tokens.css`.

---

## Accessibilité

- Skip-link vers le contenu principal sur chaque page
- Un seul `<h1>` par page, y compris sur les fiches d'équipe générées
- Focus visible au clavier, `aria-expanded` sur les menus dépliants
- Fils d'Ariane sur toutes les pages internes
- `prefers-reduced-motion` respecté (apparitions, compteurs, scène 3D)
- Icônes décoratives en `aria-hidden`, scène 3D annoncée via `role="img"`

---

## Déploiement

```bash
docker compose up -d --build     # nginx sur http://localhost:8080
```

`nginx.conf` gère gzip, le cache long sur les assets, l'absence de cache sur
le HTML et les en-têtes de sécurité.

Le site étant 100 % statique et sans build, il fonctionne aussi tel quel sur
GitHub Pages, Netlify ou Vercel — sans configuration.

### Dépendances externes

| Ressource | Usage | Repli si injoignable |
|---|---|---|
| Google Fonts | Barlow Condensed + Inter | polices système |
| Font Awesome (cdnjs) | icônes | icônes absentes, mise en page intacte |
| Three.js (jsDelivr) | scène 3D | logo statique |
| Score'n'co | résultats, et classements des équipes non encore basculées | encart « momentanément indisponible » |

Aucune n'est bloquante : le site reste lisible et navigable si toutes tombent.

---

## Auteur

Site conçu et développé par **Romain Caner** — saison 2026.
Contact club : [bureau.abbc@gmail.com](mailto:bureau.abbc@gmail.com)
