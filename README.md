# Site ABBC — Association Basket-Ball Cornebarrieu

Site vitrine officiel de l'Association Basket-Ball de Cornebarrieu (ABBC), construit en HTML statique avec Tailwind CSS et les widgets Scorenco pour les résultats et classements en temps réel.

---

## Architecture du projet

```
SiteAbbcStable/
│
├── index.html              # Page d'accueil (agenda, matchs, présentation)
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
│   │   └── main.js         # Loader partials + UI globale + thème
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
