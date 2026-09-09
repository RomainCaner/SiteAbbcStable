# Site ABBC — Association Basket-Ball Cornebarrieu

Site vitrine officiel de l'Association Basket-Ball de Cornebarrieu.
HTML statique, CSS maison, modules ES natifs, classements et rencontres tirés
de l'API FFBB, et une scène 3D Three.js sur la page d'accueil.

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
├── scripts/              récupération FFBB : classements, rencontres, découverte
├── .github/workflows/    mise à jour automatique (3× par semaine)
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

### JavaScript — 17 modules ES

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
    ├── fixtures.js       Prochaine rencontre + dernier résultat (données FFBB)
    ├── partners.js       Partenaires du club
    └── scorenco.js       Widgets Score'n'co — neutralisé, conservé
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
Saison, chiffres clés, coordonnées et liens réseaux. Ces valeurs alimentent
tous les `<span data-config="…">` et les liens `data-social`. Un réseau laissé à `TODO`
voit son icône masquée. La section `scorenco` y subsiste sans être lue. Un lien social laissé à `TODO` conserve celui écrit dans le HTML.

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
| `ffbb.pouleId` | identifiant de poule FFBB — **c'est lui qui branche le classement et les rencontres** |
| `widgets` | anciens identifiants Score'n'co, conservés mais plus lus |

**Ajouter une équipe** : ajouter l'entrée dans `teams.json`, puis copier une
page existante de `equipes/` en changeant son `data-team`, son `<title>` et sa
`<meta name="description">`. Rien d'autre.

**Trouver un `pouleId`** : lancer `scripts/decouvrir_poules.py` (voir
« Brancher une équipe » plus bas). Tant qu'il est vide, la fiche affiche un
encart « bientôt disponible » — jamais un chargement infini.

### `events.json` — agenda
Champs : `title`, `category`, `color` (`red`, `orange`, `yellow`, `green`,
`forest`, `blue`, `purple`), `icon` (nom Font Awesome sans `fa-`), `date`
(`AAAA-MM-JJ`), `time`, `location`, `description`.

Le **premier événement à venir** alimente automatiquement le bandeau orange
sous le bandeau d'accueil. Les événements passés sont masqués sur l'accueil
mais restent visibles sur `agenda.html`.

### `partners.json` — partenaires
Liste affichée sur `partenaires.html`. Chaque entrée : `name` (obligatoire, sert
aussi de texte alternatif), `logo` (chemin depuis la racine, par exemple
`assets/images/partenaires/xxx.png`) et `url` (site du partenaire, facultatif).

Sans `logo`, le nom s'affiche en toutes lettres — utile en attendant le fichier.
Tant que la liste est **vide**, la page montre une invitation à devenir
partenaire, jamais des blocs d'exemple.

### `news.json` — actualités
Le plus récent en premier. Champs : `slug` (sans espace ni accent), `title`,
`date`, `author`, `image`, `excerpt`, `body` (HTML de l'article).
Le premier article occupe la grande carte de la grille d'accueil.

---

## Classements : du widget tiers aux données du club

Le site affiche **ses propres tableaux de classement et ses propres
rencontres**, alimentés par les données publiques de la FFBB. Les widgets
Score'n'co qu'ils remplacent sont neutralisés.

### Pourquoi

| | Widget Score'n'co | Classement maison |
|---|---|---|
| Script tiers sur la page | oui | **non** |
| Mise en forme | imposée | **à la charte du site** |
| Bloqueur de contenu | peut le masquer | insensible |
| Source indisponible | bloc vide | **dernier classement connu reste affiché** |
| Rencontres | widget tiers | **carte maison, salle et horaire compris** |
| Historique | aucun | **versionné dans git** |

### Comment ça marche

```
.github/workflows/classements.yml   (mer. et sam. 23h55, dim. 18h)
        │
        ▼
scripts/fetch_standings.py          interroge l'API FFBB (poule → classement
        │                               + calendrier des rencontres)
        ├──────────────────────┐
        ▼                      ▼
assets/data/standings.json    assets/data/fixtures.json
        │                      │        (commités s'ils ont changé)
        ▼                      ▼
content/standings.js          content/fixtures.js
  tableau sur la fiche          prochaine rencontre sur la fiche,
  d'équipe                      vue d'ensemble sur l'accueil
```

Le site étant statique, il ne peut pas appeler la FFBB depuis le navigateur
(CORS). C'est donc GitHub Actions qui récupère les données en amont et les
dépose dans un JSON servi par le site — aucune infrastructure à héberger.

### Repères FFBB du club

Vérifiés sur les pages officielles, et conservés dans `config.json` (section
`ffbb`) pour ne pas avoir à les rechercher :

| | |
|---|---|
| Code club | **OCC0031019** |
| Ligue / comité | Occitanie (`occ`) / Haute-Garonne (`0031`) |
| Page du club | [competitions.ffbb.com/…/clubs/occ0031019](https://competitions.ffbb.com/ligues/occ/comites/0031/clubs/occ0031019) |
| SG1 | RM2 Occitanie, poule **PYR-B** — poule `200000003054822` |
| SF1 | NF3, poule **B** — poule `200000003054399` |

### Par où passent les données

La FFBB expose ses compétitions à trois endroits. Le script les connaît tous
les trois, mais ils ne se valent pas :

| | API FFBB | `competitions.ffbb.com` | `resultats.ffbb.com` |
|---|---|---|---|
| Accès | `ffbb-data-client` (PyPI) | page web | page web |
| Désignation | identifiant de poule | URL de classement | `/championnat/<hex>.html` |
| Données | champs nommés et typés | à extraire de la page | tableau HTML |
| Statut | **voie principale** | repli | ancienne plateforme |

**L'API est la voie à privilégier.** Un appel, `get_classement(poule_id)`, et
un objet par équipe avec `position`, `points`, `match_joues`, `gagnes`,
`perdus`, `paniers_marques`, `paniers_encaisses`, `difference` — la
correspondance avec le schéma du site est directe, sans aucune heuristique.
Les jetons sont résolus automatiquement : rien à demander au club, aucun
secret à stocker dans le dépôt.

Les deux autres voies restent en place pour les équipes dont on n'aurait que
l'URL, et pour l'ancienne plateforme.

### Brancher une équipe

Lancer la découverte des poules — *Actions* → *Classements FFBB* → *Run
workflow*, champ **poules** (ou en local, si l'environnement a accès à la
FFBB) :

```bash
python scripts/decouvrir_poules.py Cornebarrieu
```

Elle liste les engagements du club avec, pour chacun, le numéro d'équipe, le
sexe, la catégorie d'âge et l'identifiant de poule :

```
  n°1   NATIONALE FEMININE 3                      poule Poule B  200000003054399   F Seniors
  n°1   Régionale masculine seniors - Division 2  poule PYR-B    200000003054822   M Seniors
```

Reporter l'identifiant dans `assets/data/teams.json`, sur l'équipe
correspondante :

```json
"ffbb": {
  "pouleId": "200000003054822"
}
```

Puis relancer le workflow sans renseigner de champ, ou attendre l'exécution
planifiée.

**Le rapprochement se fait à la main**, et c'est volontaire : les intitulés
diffèrent des deux côtés (`SF2` ici, « Régionale féminine seniors - Division 2 »
là-bas). Le garde-fou ne peut pas rattraper une confusion entre deux équipes
du même club, puisque le club apparaît dans les deux classements — mieux vaut
donc vérifier le numéro d'équipe que supposer.

Une équipe engagée en **CTC** (entente entre clubs) n'apparaît pas sous le nom
du club : la chercher sous le nom de l'entente.

Branchées à ce jour : **SF1** et **SG1**.

### Les rencontres

Le même `pouleId` sert au calendrier : `list_rencontres_by_poule` renvoie les
rencontres de la poule, filtrées sur le club. Le site en publie deux — la
**prochaine à venir** et le **dernier résultat connu** — dans
`assets/data/fixtures.json`.

Trois points que l'API impose :

- **Les noms portent le numéro d'équipe** (`LONS BASKET - 1`) là où le
  classement donne le nom seul. Le numéro est retiré pour l'équipe 1, gardé
  sous une forme lisible sinon : `OUEST TOULOUSAIN BASKET 3` dit qu'on affronte
  leur troisième équipe.
- **La salle n'est qu'un identifiant** (`"7321"`). `get_salle` la résout, mais
  seulement pour les deux rencontres publiées, et le résultat est mémorisé :
  plusieurs équipes du club jouent dans le même gymnase.
- **Une rencontre passée sans score saisi** — report, feuille en attente — ne
  doit pas être annoncée comme prochaine. Le filtre porte sur la date *et* sur
  l'absence de résultat.

Le calendrier est un bonus : son échec est signalé mais ne prive pas le site du
classement, déjà récupéré à ce stade.

### Comment le classement est extrait

Une équipe désignée par `pouleId` passe par l'**API** : un appel, des champs
nommés, rien à interpréter. Tout ce qui suit ne concerne que les équipes
désignées par une URL.

Le seul traitement appliqué aux données de l'API est un **tri par rang** :
l'API renvoie les lignes dans l'ordre lexicographique du rang (1, 10, 11, 12,
2, 3…), et le site les afficherait dans cet ordre.

#### Pour les équipes désignées par une URL

Le script essaie plusieurs **formes du même contenu**, à la demande, et
s'arrête à la première qui donne un classement lisible — les suivantes ne sont
jamais demandées.

Deux formes d'URL (avec et sans `/classement`, selon les ligues) et, sur
`competitions.ffbb.com`, deux formes de réponse :

- **Flux de données** (en-tête `RSC`). Le site est une application Next.js : au
  premier chargement le serveur envoie du HTML, mais avec cet en-tête il envoie
  à la place le flux de données brut — c'est ainsi que le site change de poule
  ou de journée sans recharger la page. Essayé en premier.
- **HTML**, pour l'ancienne plateforme `resultats.ffbb.com`.

Sur chaque document, trois stratégies d'analyse dans cet ordre :

1. **Blocs de données nommés** (`__NEXT_DATA__`, `__NUXT_DATA__`,
   `ng-state`, `__PRELOADED_STATE__`), plus un filet générique sur tout
   `<script type="application/json">` de taille significative. Le script
   parcourt la structure et retient **le tableau qui contient le club**. Les
   champs sont reconnus par correspondance approximative de noms
   (`rangOfficiel`, `nbVictoires`, `pointsInscrits`… sont compris sans avoir
   été prévus), et un nom d'équipe imbriqué (`{"equipe": {"nom": "…"}}`) est
   géré.
2. **Flux Next.js**, sous ses deux formes : encodé dans des chaînes JavaScript
   (`self.__next_f.push`) dans une page HTML, brut dans une réponse `RSC`. Le
   flux n'étant pas un document JSON unique mais une suite de fragments
   préfixés, les tableaux d'objets en sont extraits par lecture à parenthésage
   équilibré. Le flux contient aussi les **rencontres**, où le club figure sans
   classement : entre plusieurs candidats, celui qui porte le plus de points
   l'emporte.
3. **Tableau HTML** — l'ancienne plateforme, avec l'association par intitulé
   doublée du repli positionnel décrit plus bas.

La sortie indique la stratégie retenue :

```
sg1     4 équipes — Régionale Masculine 2 - PYR-B [via flux RSC]
```

Une réponse `RSC` n'ayant pas de `<title>`, le nom de la compétition retombe
alors sur le champ `level` de `teams.json`.

#### Quand la page revient vide

`competitions.ffbb.com` finit par servir une page vidée de son contenu si on
l'appelle trop souvent depuis la même adresse — au navigateur comme en HTTP
simple. Le script le dit explicitement plutôt que de laisser croire à un
défaut d'analyse :

```
sg1 : flux RSC : réponse de 2 378 caractères et 3 liens : trop peu pour une
      page de compétition. Soit l'URL ne mène pas à un classement, soit la
      FFBB a servi une page vide (requête refusée, ou trop d'appels
      rapprochés).
```

Rien à corriger dans le code quand ce message s'affiche : c'est au rythme des
appels qu'il faut laisser du temps. C'est aussi une raison de plus de préférer
`pouleId` à `classementUrl` — l'API, elle, n'a jamais bronché.

#### Une mauvaise poule ne peut pas passer

Une poule ou une URL erronée produirait un tableau parfaitement valide, mais
qui n'est pas celui du club — une erreur qu'aucun contrôle visuel ne rattrape.
Le script **refuse tout classement où le club n'apparaît pas**, quelle que soit
la source, API comprise :

```
sg1 : API FFBB : le club n'apparaît pas dans ce classement
      (12 équipes : MONTPELLIER BC, NIMES BASKET, AGDE BASKET, SETE BASKET…).
      L'identifiant de poule 200000003054822 vise probablement une autre poule.
```

Ce contrôle ne peut pas tout : deux équipes **du même club** apparaissent
chacune dans son classement, donc confondre SF2 et SF3 passerait inaperçu.
C'est pourquoi `decouvrir_poules.py` affiche le numéro d'équipe — il faut le
vérifier plutôt que le supposer.

La reconnaissance du club se règle dans `CLUB_PATTERNS`, en tête de
`scripts/fetch_standings.py`.

#### Si une page résiste

Le mode découverte décrit ce que contient réellement une page — titre, liens,
présence d'un bloc de données, identifiants et URL d'API repérées :

```bash
python scripts/fetch_standings.py --discover "https://competitions.ffbb.com/..."
```

Disponible aussi depuis le workflow, champ `decouvrir`, ce qui permet de
l'exécuter depuis un environnement ayant accès à la FFBB.

Quand ça ne suffit pas — parce que la donnée n'est pas dans le HTML du tout —
`scripts/decouvrir_api.mjs` ouvre la page dans Chromium et relève **ce que le
site appelle réellement** : chaque réponse JSON, classée selon qu'elle contient
le club et des clés de classement, les tableaux rendus à l'écran et la forme
des routes. C'est ce sondage qui a mis au jour l'en-tête `RSC`. Il est ponctuel,
déclenché par le champ `sonder` du workflow, et ne met rien à jour ; la mise à
jour planifiée reste en HTTP simple, sans navigateur.

### Tester sans appeler la FFBB

```bash
pip install -r scripts/requirements.txt

# Sur un jeu d'essai fourni
python scripts/fetch_standings.py --html-file scripts/tests/ffbb-flux-rsc.txt --team sg1 --dry-run

# Sur une vraie page enregistrée depuis le navigateur (Ctrl+S)
python scripts/fetch_standings.py --html-file ma-page.html --team sf1 --dry-run
```

`scripts/tests/` couvre **dix cas**, chacun passant par la stratégie attendue :
tableaux HTML à 18 et 17 colonnes, `__NEXT_DATA__`, `__NUXT__`, flux Next.js
encodé, flux RSC brut, plus trois refus qui doivent rester des refus — deux
mauvaises poules et une page sans classement.

Le repli HTML combine **deux stratégies**, ce qui le rend nettement plus solide
qu'une seule :

1. **Association par intitulé** (`Clt`, `Equipe`, `Pts`, `Jou.`, `G`, `P`,
   `BP`, `BC`, `Diff`…). Encaisse l'ajout d'une colonne en amont sans décaler
   le reste.
2. **Repli positionnel** sur la disposition réelle des tableaux FFBB : une
   ligne compte **18 cellules**, 17 quand la compétition n'attribue pas de
   bonus. Le rang, le nom, les points, les matchs joués, gagnés et perdus sont
   aux index 0 à 5 ; les points marqués, encaissés et l'écart aux index 15 à 17
   (décalés d'un cran dans le cas à 17 colonnes).

Concrètement : si la FFBB renomme « BP » en « Réal. », l'étape 1 ne reconnaît
plus la colonne, mais l'étape 2 la retrouve à sa position. Et si une colonne
est insérée en début de tableau, c'est l'inverse qui joue.

Autres garde-fous :
- le nom d'équipe est lu dans le `<a>` de sa cellule, comme sur les vraies pages ;
- une ligne de données est reconnue à son **rang numérique en première cellule**,
  ce qui permet d'ignorer les lignes d'en-tête de regroupement ;
- une structure devenue illisible provoque un **échec explicite** (code de
  sortie 1) au lieu d'écrire un JSON vide qui écraserait de bonnes données.

### Bon voisinage

Le script s'identifie par un `User-Agent` explicite avec un contact, attend
1,5 s entre deux appels — y compris entre deux tentatives sur la même équipe —
et ne tourne que **trois fois par semaine**. Les championnats amateurs se
jouent le week-end : inutile d'interroger la FFBB plus souvent.

Ce n'est pas qu'une politesse. `competitions.ffbb.com` finit par servir une
page vidée de son contenu quand on l'appelle trop souvent depuis la même
adresse — constaté en développement, après une dizaine d'appels rapprochés.
L'API, elle, n'a jamais bronché.

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

Aucune n'est bloquante : le site reste lisible et navigable si toutes tombent.

**Plus aucun script tiers ne s'exécute sur les pages.** Les widgets Score'n'co
sont neutralisés — en commentaire dans `main.js`, `teams.js` et `index.html`,
le module `content/scorenco.js` étant conservé intact et chaque endroit
indiquant comment le rétablir. Classements et rencontres sont désormais servis
depuis `assets/data/`, donc lisibles même si la FFBB est indisponible : c'est le
dernier JSON commité qui s'affiche.

---

## Auteur

Site conçu et développé par **Romain Caner** — saison 2026.
Contact club : [bureau.abbc@gmail.com](mailto:bureau.abbc@gmail.com)
