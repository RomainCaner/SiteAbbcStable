# Site ABBC — Association Basket-Ball Cornebarrieu

Site vitrine officiel de l'Association Basket-Ball de Cornebarrieu (ABBC), construit en HTML statique avec Tailwind CSS et les widgets Scorenco pour les résultats et classements en temps réel.

---

## Architecture du projet

```
SiteAbbcStable/
│
├── index.html              # Page d'accueil (agenda, matchs, présentation)
├── boutique.html           # Boutique en ligne (lien HelloAsso)
├── contact.html            # Coordonnées et formulaire de contact
├── partenaires.html        # Présentation des partenaires du club
│
├── assets/
│   ├── css/
│   │   └── styles.css      # Styles globaux (gradients, animations, widgets)
│   ├── js/
│   │   └── main.js         # Menu mobile + animations au scroll (IntersectionObserver)
│   └── images/
│       ├── Logo.jpg        # Logo du club (rond, utilisé nav + footer)
│       ├── Baniere.jpg     # Bannière héro de la page d'accueil
│       └── sg1.jpg         # Photo de l'équipe SG1
│
└── equipes/
    ├── sf1.html            # Senior Féminine 1 (Nationale 3)
    ├── sf2.html            # Senior Féminine 2
    ├── sf3.html            # Senior Féminine 3
    ├── sg1.html            # Senior Garçon 1
    ├── sg2.html            # Senior Garçon 2
    ├── U18F.html           # U18 Filles
    ├── u18G.html           # U18 Garçons
    ├── U15F.html           # U15 Filles
    └── U15G.html           # U15 Garçons
```

---

## Stack technique

| Technologie | Rôle |
|---|---|
| HTML5 | Structure de toutes les pages |
| [Tailwind CSS](https://tailwindcss.com) (CDN) | Mise en page et utilitaires CSS |
| CSS personnalisé (`styles.css`) | Animations, gradients, loader Scorenco |
| JavaScript (`main.js`) | Menu burger mobile, animations au scroll |
| [Font Awesome 6](https://fontawesome.com) (CDN) | Icônes |
| [Google Fonts — Inter](https://fonts.google.com/specimen/Inter) | Typographie |
| [Scorenco Widgets](https://widgets.scorenco.com) | Résultats, classements et effectifs en temps réel |

---

## Flux de navigation

```
index.html (Accueil)
│
├── equipes/ ──────────────────────────────────────┐
│   ├── sf1.html  sf2.html  sf3.html               │
│   ├── sg1.html  sg2.html                         │
│   ├── U18F.html  u18G.html                       │
│   └── U15F.html  U15G.html                       │
│         │                                        │
│         └── Retour → ../index.html ──────────────┘
│
├── boutique.html    (lien externe : HelloAsso)
├── contact.html     (mailto : bureau.abbc@gmail.com)
└── partenaires.html
```

---

## Pages d'équipe — structure type

Chaque page dans `equipes/` suit le même modèle :

```
┌─────────────────────────────────────────────┐
│  Barre de navigation (Logo + liens)         │
├─────────────────────────────────────────────┤
│  En-tête équipe (nom, catégorie)            │
├─────────────────────────────────────────────┤
│  Informations  │  Prochaines    │  Effectif │
│  (coach, niv.) │  rencontres    │  (joueurs)│
│                │  [Scorenco]    │  [Scorenco]│
├─────────────────────────────────────────────┤
│  Classement [Widget Scorenco]               │
├─────────────────────────────────────────────┤
│  Footer (liens rapides, réseaux, newsletter)│
└─────────────────────────────────────────────┘
```

---

## Lancer le site en local

Aucune dépendance à installer. Il suffit d'ouvrir `index.html` dans un navigateur ou d'utiliser une extension type **Live Server** (VS Code / Cursor) pour le rechargement automatique.

---

## Auteur

Site conçu et développé par **Romain Caner** — saison 2026.  
Contact club : [bureau.abbc@gmail.com](mailto:bureau.abbc@gmail.com)
