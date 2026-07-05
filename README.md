# Site ABBC — Association Basket-Ball Cornebarrieu

Site vitrine officiel de l'Association Basket-Ball de Cornebarrieu (ABBC), construit en HTML statique avec Tailwind CSS et les widgets Scorenco pour les résultats et classements en temps réel.

---

## Architecture du projet

```
SiteAbbcStable/
│
├── index.html              # Page d'accueil (Le Club, agenda, matchs, actus, présentation)
├── agenda.html             # Agenda complet (rendu depuis events.json)
├── actualites.html         # Liste des actualités (rendu depuis news.json)
├── article.html            # Article unique (article.html?slug=...)
├── boutique.html           # Boutique en ligne (lien HelloAsso)
├── contact.html            # Coordonnées
├── partenaires.html        # Partenaires du club
│
├── partials/               # Composants HTML partagés
│   ├── navbar.html         # Barre de navigation (mega-menu, dark toggle)
│   └── footer.html         # Pied de page (newsletter, back-to-top)
│
├── assets/
│   ├── css/
│   │   ├── styles.css            # Styles globaux + variables dark mode
│   │   └── tailwind.input.css    # Entrée Tailwind (build optionnel)
│   ├── js/
│   │   └── main.js         # Loader partials + UI globale + thème + rendu data
│   ├── data/               # Contenu éditable (voir « Gérer le contenu »)
│   │   ├── config.json     # Saison, chiffres clés, liens réseaux
│   │   ├── events.json     # Événements du club (agenda)
│   │   └── news.json       # Articles / actualités
│   └── images/
│       ├── Logo.jpg        # Logo du club
│       ├── Baniere.jpg     # Bannière héro
│       └── sg1.jpg         # Photo équipe SG1
│
├── equipes/                # 9 pages d'équipe (SF1-3, SG1-2, U18F/G, U15F/G)
│
├── package.json            # Tailwind build optionnel + dev server
├── tailwind.config.js      # Config Tailwind (purge des classes)
└── .gitignore
```

---

## Stack technique

| Technologie | Rôle |
|---|---|
| HTML5 | Structure de toutes les pages |
| [Tailwind CSS](https://tailwindcss.com) (CDN) | Mise en page et utilitaires CSS |
| CSS personnalisé (`styles.css`) | Variables CSS dark/light, animations, scroll bar, focus states |
| JavaScript (`main.js`) | Loader des partials, thème, mega-menu mobile, compteurs animés, scroll progress, back-to-top |
| [Font Awesome 6](https://fontawesome.com) (CDN) | Icônes |
| [Google Fonts — Inter](https://fonts.google.com/specimen/Inter) | Typographie |
| [Scorenco Widgets](https://widgets.scorenco.com) | Résultats, classements et effectifs en temps réel |

---

## Fonctionnalités UI

- **Agenda dynamique** : événements rendus depuis `events.json`, événements passés masqués sur l'accueil
- **Actualités / blog** : articles rendus depuis `news.json`, page liste + page article (`article.html?slug=`)
- **Contenu piloté par la config** : saison, chiffres clés et liens réseaux depuis `config.json`
- **Mega-menu équipes** (2 colonnes Seniors/Jeunes) au survol desktop, accordion mobile
- **Dark mode** persistant (`localStorage`) avec toggle dans la navbar
- **Barre de progression** au scroll en haut de page
- **Compteurs animés** sur les statistiques de la page d'accueil
- **Bouton "retour en haut"** flottant
- **Skip-link** + `focus-ring` pour navigation clavier (accessibilité)
- **Fil d'Ariane** sur les pages d'équipe
- **Indicateur de page active** dans la navbar (underline animé)
- **Newsletter** avec feedback inline (validation email côté client)
- **Open Graph + meta description** sur chaque page (SEO + partage social)
- Respect de `prefers-reduced-motion`

---

## Gérer le contenu (sans toucher au HTML)

Le contenu qui change souvent est piloté par 3 fichiers JSON dans `assets/data/`.
Modifiez-les, rafraîchissez la page : le site se met à jour tout seul.
Chaque valeur à compléter par le club est marquée **`TODO`** dans les fichiers.

### `config.json` — réglages globaux
Saison, nombre de licenciés/équipes et liens réseaux sociaux. Ces valeurs se
propagent partout (elles remplacent les `<span data-config="...">` du site et les
liens `data-social` du footer). Un lien social laissé à `TODO` conserve le lien
par défaut du footer.

### `events.json` — événements / agenda
Un tableau d'événements. Champs : `title`, `category`, `color` (couleur Tailwind :
`red`, `yellow`, `green`, `blue`, `purple`, `orange`), `icon` (nom Font Awesome
sans `fa-`), `date` (format `AAAA-MM-JJ`), `time`, `location`, `description`.
Les événements **passés** sont masqués sur l'accueil (3 prochains affichés) mais
restent visibles sur `agenda.html`.

### `news.json` — actualités / blog
Un tableau d'articles, **le plus récent en premier**. Champs : `slug` (identifiant
unique dans l'URL, sans espace ni accent), `title`, `date` (`AAAA-MM-JJ`),
`author`, `image` (chemin depuis la racine, ex. `assets/images/xxx.jpg`),
`excerpt` (résumé), `body` (contenu **HTML** de l'article). Chaque carte pointe
vers `article.html?slug=…`.

> Astuce couleurs : le CDN Tailwind génère les classes à la volée, donc les
> couleurs `color` d'`events.json` fonctionnent sans configuration. Si un jour le
> site passe au Tailwind compilé (cf. plus bas), pensez à *safelister* les classes
> `bg-{couleur}-500/600` et `text-{couleur}-600`.

---

## Lancer le site en local

> ⚠️ Le chargement des partials utilise `fetch()`, qui ne fonctionne **pas** avec le protocole `file://`. Il faut un serveur HTTP local.

### Option 1 — Python (zéro installation sur la plupart des machines)
```bash
python -m http.server 8080
# puis ouvrir http://localhost:8080
```

### Option 2 — VS Code Live Server
Clic droit sur `index.html` → *Open with Live Server*.

### Option 3 — npm (si Node.js installé)
```bash
npm install
npm run dev
# puis ouvrir http://localhost:8080
```

---

## Build Tailwind optionnel (production)

Le site utilise Tailwind CDN par défaut (~3 MB). Pour réduire à ~15 KB :

```bash
npm install
npm run build:css
```

Cela génère `assets/css/tailwind.min.css`. Remplacer ensuite dans chaque page :
```html
<script src="https://cdn.tailwindcss.com"></script>
```
par :
```html
<link rel="stylesheet" href="assets/css/tailwind.min.css">
```

Pour le développement, `npm run watch:css` recompile à chaque sauvegarde.

---

## Pages d'équipe — structure type

```
┌─────────────────────────────────────────────┐
│  Navbar (partial) + barre de progression    │
├─────────────────────────────────────────────┤
│  Fil d'Ariane → En-tête équipe              │
├─────────────────────────────────────────────┤
│  Informations  │  Prochaines    │  Effectif │
│  (coach, niv.) │  rencontres    │  (joueurs)│
│                │  [Scorenco]    │  [Scorenco]│
├─────────────────────────────────────────────┤
│  Classement [Widget Scorenco]               │
├─────────────────────────────────────────────┤
│  Footer (partial) + back-to-top             │
└─────────────────────────────────────────────┘
```

---

## Architecture des partials

Chaque page HTML contient :
- `<html data-base="">` (racine) ou `<html data-base="../">` (`equipes/`)
- `<body data-page="accueil|equipes|partenaires|boutique|contact">`
- `<div id="navbar-placeholder"></div>` → remplacé par `partials/navbar.html`
- `<div id="footer-placeholder"></div>` → remplacé par `partials/footer.html`

`main.js` lit `data-base`, fetch les partials, et remplace `{{base}}` par la bonne profondeur de chemin.

---

## Auteur

Site conçu et développé par **Romain Caner** — saison 2026.
Contact club : [bureau.abbc@gmail.com](mailto:bureau.abbc@gmail.com)
