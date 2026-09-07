#!/usr/bin/env python3
"""Récupère les classements FFBB et les écrit dans assets/data/standings.json.

Pourquoi ce script plutôt que le widget Score'n'co :
  - le site n'embarque plus de script tiers (plus rapide, insensible aux
    bloqueurs de contenu, pas de traceur) ;
  - le tableau est rendu par le site, donc à sa charte ;
  - les données sont versionnées dans git, ce qui donne l'historique gratuitement ;
  - si la source tombe, le dernier JSON valide reste servi.

Source : resultats.ffbb.com/championnat/<id>.html — pages publiques, rendues
côté serveur, sans authentification. L'identifiant de chaque équipe se règle
dans assets/data/teams.json (champ `ffbb.championshipId`).

Garde-fou important : un identifiant qui pointe vers la mauvaise poule produit
un tableau parfaitement valide mais qui n'est pas celui du club — une erreur
que rien ne signale à l'affichage. Le script refuse donc tout classement où le
club n'apparaît pas (voir CLUB_PATTERNS). Un identifiant peut ainsi être testé
sans risque : au pire il est rejeté, jamais publié de travers.

Usage :
    python scripts/fetch_standings.py                 # récupère tout
    python scripts/fetch_standings.py --team sf1      # une seule équipe
    python scripts/fetch_standings.py --html-file page.html --team sf1
                                                      # teste le parsing hors ligne
    python scripts/fetch_standings.py --dry-run       # affiche sans écrire

Dépendances : requests, beautifulsoup4 (voir scripts/requirements.txt).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEAMS_FILE = ROOT / "assets" / "data" / "teams.json"
OUTPUT_FILE = ROOT / "assets" / "data" / "standings.json"

BASE_URL = "https://resultats.ffbb.com/championnat/{id}.html"

# Un User-Agent explicite : on s'identifie plutôt que de se faire passer pour
# un navigateur, et on laisse un point de contact.
USER_AGENT = (
    "ABBC-Cornebarrieu-SiteBot/1.0 "
    "(+https://github.com/RomainCaner/SiteAbbcStable; bureau.abbc@gmail.com)"
)

# En-têtes complets : certains serveurs répondent 404 à une requête sans
# Accept, en la prenant pour un client mal formé.
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9",
}
REQUEST_TIMEOUT = 30
DELAY_BETWEEN_REQUESTS = 1.5  # on reste courtois avec la FFBB

# Les serveurs FFBB renvoient regulierement 502/503/504 aux heures chargees.
# On retente quelques fois, en espacant, plutot que d'abandonner la journee.
RETRY_STATUSES = (429, 500, 502, 503, 504)
MAX_ATTEMPTS = 4
RETRY_BACKOFF = 5  # secondes, double a chaque tentative

# Nom du club tel qu'il apparaît dans les tableaux FFBB, pour surligner sa ligne.
CLUB_PATTERNS = (re.compile(r"cornebarrieu", re.I),)


class ParsingError(RuntimeError):
    """La page a été récupérée mais sa structure n'est pas celle attendue."""


# ---------------------------------------------------------------- utilitaires

def clean(text: str) -> str:
    """Normalise un contenu de cellule (espaces insécables, retours ligne)."""
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def to_int(text: str):
    """Convertit une cellule en entier, ou None si ce n'en est pas un."""
    value = clean(text).replace("+", "")
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    return None


def is_club_row(name: str) -> bool:
    return any(pattern.search(name) for pattern in CLUB_PATTERNS)


# ------------------------------------------------------------------- parsing

# Intitulés de colonnes rencontrés sur les tableaux FFBB, ramenés à nos clés.
# Première stratégie : associer par intitulé, ce qui encaisse l'ajout d'une
# colonne en amont sans tout décaler.
COLUMN_ALIASES = {
    "rank": ("clt", "class", "rang", "pos"),
    "team": ("equipe", "équipe", "club", "nom"),
    "points": ("pts", "point", "points"),
    "played": ("jou", "joue", "joué", "mj", "matchs", "match"),
    "won": ("g", "gagne", "gagné", "v", "victoires"),
    "lost": ("p", "perdu", "perdus", "d", "defaites", "défaites"),
    "drawn": ("n", "nul", "nuls"),
    "scored": ("bp", "pour", "pm", "marques", "marqués", "pts mar", "p.m."),
    "conceded": ("bc", "contre", "pe", "encaisses", "encaissés", "pts enc", "p.e."),
    "diff": ("diff", "difference", "différence", "coef"),
}

# Seconde stratégie : la disposition réelle des tableaux FFBB, relevée sur un
# scraper en production (github.com/niko4nicolas/FFBB_Alternative). Une ligne
# compte 18 cellules, 17 quand la compétition n'attribue pas de bonus — d'où
# le décalage appliqué aux trois dernières colonnes.
POSITIONAL_LAYOUT = {
    "rank": 0,
    "team": 1,
    "points": 2,
    "played": 3,
    "won": 4,
    "lost": 5,
}
POSITIONAL_TAIL = {"scored": 15, "conceded": 16, "diff": 17}
FULL_ROW_LENGTH = 18


def build_header_map(cells: list[str]) -> dict[int, str]:
    """Associe l'index de chaque colonne à une clé normalisée."""
    mapping: dict[int, str] = {}
    for index, label in enumerate(cells):
        key = clean(label).lower().rstrip(".")
        for field, aliases in COLUMN_ALIASES.items():
            # Première occurrence gagnante : les tableaux FFBB répètent certains
            # intitulés (G/P par exemple) pour les sous-totaux domicile/extérieur,
            # et ce sont les colonnes de gauche qui portent le total.
            if key in aliases and field not in mapping.values():
                mapping[index] = field
                break
    return mapping


def cell_text(cell) -> str:
    """Texte d'une cellule ; le nom d'équipe est encapsulé dans un lien."""
    link = cell.find("a")
    return clean((link or cell).get_text())


def is_data_row(cells) -> bool:
    """Une ligne de classement commence par un rang numérique."""
    return len(cells) >= 6 and to_int(cell_text(cells[0])) is not None


def extract_row(cells, header_map: dict[int, str]) -> dict:
    """Extrait une ligne en combinant les deux stratégies.

    L'association par intitulé passe en premier ; tout champ qu'elle n'a pas su
    remplir est repris à sa position connue. Une colonne dont l'intitulé aurait
    changé n'est donc plus perdue.
    """
    entry: dict = {}

    for index, field in header_map.items():
        if index < len(cells):
            raw = cell_text(cells[index])
            entry[field] = raw if field == "team" else to_int(raw)

    # Repli positionnel sur les colonnes de tête.
    for field, index in POSITIONAL_LAYOUT.items():
        if entry.get(field) in (None, "") and index < len(cells):
            raw = cell_text(cells[index])
            entry[field] = raw if field == "team" else to_int(raw)

    # Repli positionnel sur les colonnes de queue, décalées d'un cran quand la
    # compétition n'a pas de colonne bonus.
    offset = 0 if len(cells) >= FULL_ROW_LENGTH else len(cells) - FULL_ROW_LENGTH
    for field, index in POSITIONAL_TAIL.items():
        position = index + offset
        if entry.get(field) is None and 0 <= position < len(cells):
            entry[field] = to_int(cell_text(cells[position]))

    return entry


# ---------------------------------------------- plateforme moderne (JSON)

# Correspondance approximative entre les clés d'un objet JSON et nos champs.
# On teste par inclusion, sans connaître les noms exacts employés par la FFBB.
JSON_KEY_HINTS = {
    "rank": ("rang", "position", "classement", "place", "clt"),
    "team": ("nomequipe", "nomusuel", "equipe", "team", "libelle", "nom"),
    "points": ("point",),
    "played": ("joue", "played", "matchs", "rencontres", "mj"),
    "won": ("gagne", "victoire", "won", "win"),
    "lost": ("perdu", "defaite", "lost"),
    "scored": ("marque", "pour", "inscrits", "bp"),
    "conceded": ("encaisse", "contre", "recus", "bc"),
    "diff": ("difference", "diff", "ecart", "goalaverage"),
}

# Clés à ignorer : elles contiennent « point » ou « nom » sans être ce qu'on veut.
JSON_KEY_EXCLUDE = ("id", "uuid", "code", "url", "logo", "image", "couleur")


def normalise_key(key: str) -> str:
    return re.sub(r"[^a-z]", "", key.lower())


def looks_like_team_name(value) -> bool:
    return isinstance(value, str) and 2 < len(value) < 80 and any(c.isalpha() for c in value)


def map_json_row(row: dict) -> dict:
    """Ramène un objet JSON de la FFBB à notre schéma, par correspondance de clés."""
    entry: dict = {}
    for raw_key, value in row.items():
        key = normalise_key(raw_key)
        if any(bad in key for bad in JSON_KEY_EXCLUDE):
            continue
        for field, hints in JSON_KEY_HINTS.items():
            if field in entry or not any(hint in key for hint in hints):
                continue
            if field == "team":
                # Le nom peut être imbriqué : {"equipe": {"nom": "..."}}.
                candidate = value.get("nom") if isinstance(value, dict) else value
                if looks_like_team_name(candidate):
                    entry[field] = clean(candidate)
            elif isinstance(value, (int, float)) or (isinstance(value, str) and value.lstrip("+-").isdigit()):
                entry[field] = to_int(str(value))
            break
    return entry


def collect_standings_tables(node, found: list, depth: int = 0) -> None:
    """Collecte, dans une structure JSON, tous les tableaux ressemblant à un
    classement.

    Plutôt que de deviner le chemin d'accès, on parcourt tout et on retient les
    tableaux d'objets porteurs d'un nom d'équipe. L'extraction est ainsi
    indépendante du nommage employé par la FFBB.
    """
    if depth > 12:
        return

    if isinstance(node, list):
        rows = [item for item in node if isinstance(item, dict)]
        if len(rows) >= 3:
            named = [m for m in (map_json_row(row) for row in rows) if m.get("team")]
            if len(named) >= 3:
                found.append(named)
        for item in node:
            collect_standings_tables(item, found, depth + 1)

    elif isinstance(node, dict):
        for value in node.values():
            collect_standings_tables(value, found, depth + 1)


def parse_hydration(html: str):
    """Extrait le classement des données JSON déposées dans la page.

    Les applications web modernes embarquent les données affichées dans un bloc
    JSON. Les lire évite d'avoir à interpréter un DOM construit en JavaScript.

    Parmi les tableaux candidats, on retient celui qui contient le club : c'est
    à la fois la façon de trouver le bon et la garantie d'être sur la bonne
    poule. Si aucun ne le contient alors que des classements existent, l'URL
    vise une autre poule — et on le dit.
    """
    for name, pattern in HYDRATION_BLOCKS:
        found = pattern.search(html)
        if not found:
            continue
        raw = found.group(1).strip().rstrip(";")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        candidates: list = []
        collect_standings_tables(data, candidates)
        if not candidates:
            continue

        for rows in candidates:
            if any(is_club_row(row["team"]) for row in rows):
                for row in rows:
                    row["isClub"] = is_club_row(row["team"])
                return rows, name

        # Des classements existent, mais aucun ne mentionne le club.
        sample = candidates[0][:4]
        raise ParsingError(
            "le club n'apparaît pas dans ce classement "
            f"({len(candidates[0])} équipes : {', '.join(r['team'] for r in sample)}…). "
            "L'URL pointe probablement vers une autre poule."
        )

    return None, None


def parse_standings(html: str) -> dict:
    """Extrait le classement d'une page FFBB, quelle que soit la plateforme.

    Deux stratégies, essayées dans cet ordre :
      1. les données JSON embarquées dans la page (plateforme moderne) ;
      2. le tableau HTML `.liste` (ancienne plateforme).

    Lève ParsingError si aucune n'aboutit : mieux vaut un échec visible dans le
    workflow qu'un JSON silencieusement vide qui remplacerait de bonnes données.
    """
    rows, source_kind = parse_hydration(html)
    if rows:
        competition = ""
        match = re.search(r"<title>(.*?)</title>", html, re.S | re.I)
        if match:
            competition = clean(re.sub(r"\s*\|\s*FFBB\s*$", "", match.group(1)))
        return {"competition": competition, "rows": rows, "extraction": source_kind}

    try:
        from bs4 import BeautifulSoup
    except ImportError:  # pragma: no cover
        sys.exit("beautifulsoup4 manquant : pip install -r scripts/requirements.txt")

    soup = BeautifulSoup(html, "html.parser")

    title_node = soup.select_one("#idTdDivision")
    competition = clean(title_node.get_text()) if title_node else ""

    tables = soup.select("table.liste") or soup.select(".liste") or soup.select("table")
    if not tables:
        raise ParsingError(
            "aucun tableau ni bloc de données JSON — page probablement rendue en JavaScript"
        )

    for table in tables:
        rows = table.select("tr")
        if len(rows) < 2:
            continue

        # Le tableau peut comporter plusieurs lignes d'en-tête (regroupements) :
        # on prend comme en-tête la dernière ligne précédant la première ligne
        # de données, plutôt que systématiquement la première.
        header_map: dict[int, str] = {}
        entries = []

        for row in rows:
            cells = row.select("td")
            if not is_data_row(cells):
                labels = [clean(c.get_text()) for c in row.select("th, td")]
                candidate = build_header_map(labels)
                if candidate:
                    header_map = candidate
                continue

            entry = extract_row(cells, header_map)
            name = entry.get("team") or ""
            if not name:
                continue
            entry["team"] = name
            entry["isClub"] = is_club_row(name)
            entries.append(entry)

        if entries:
            if not any(entry["isClub"] for entry in entries):
                raise ParsingError(
                    "le club n'apparaît pas dans ce classement "
                    f"({len(entries)} équipes : {', '.join(e['team'] for e in entries[:4])}…). "
                    "L'identifiant pointe probablement vers une autre poule."
                )
            return {"competition": competition, "rows": entries, "extraction": "tableau HTML"}

    raise ParsingError(
        "ni données JSON exploitables, ni tableau de classement lisible dans la page"
    )


# ---------------------------------------------------------------- récupération

def fetch_url(url: str) -> str:
    """Requête HTTP courtoise, avec réessais sur erreur serveur.

    Les serveurs FFBB renvoient assez souvent des 502/503/504 passagers. Une
    seule tentative ferait échouer la mise à jour du jour pour rien ; on
    réessaie en espaçant, sans jamais insister au point de peser sur eux.
    """
    try:
        import requests
    except ImportError:  # pragma: no cover
        sys.exit("requests manquant : pip install -r scripts/requirements.txt")

    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = requests.get(url, headers=REQUEST_HEADERS, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as error:  # coupure, DNS, délai dépassé
            last_error = error
        else:
            if response.status_code not in RETRY_STATUSES:
                break
            last_error = requests.HTTPError(
                f"{response.status_code} {response.reason}", response=response
            )

        if attempt < MAX_ATTEMPTS:
            pause = RETRY_BACKOFF * (2 ** (attempt - 1))
            print(f"    tentative {attempt}/{MAX_ATTEMPTS} en échec ({last_error}) — "
                  f"nouvel essai dans {pause} s", file=sys.stderr)
            time.sleep(pause)
    else:
        raise last_error

    response.raise_for_status()
    # Les pages FFBB sont en latin-1 mais ne l'annoncent pas toujours.
    if not response.encoding or response.encoding.lower() == "iso-8859-1":
        response.encoding = response.apparent_encoding or "utf-8"
    return response.text


def fetch_html(championship_id: str) -> str:
    return fetch_url(BASE_URL.format(id=championship_id))


CHAMPIONSHIP_LINK = re.compile(r"championnat/([0-9a-f]{6,})\.html", re.I)

# Identifiants de la plateforme competitions.ffbb.com (poule, phase, équipe) :
# de longs entiers, aussi bien dans les URL que dans les données d'hydratation.
# On les capte sans contexte, la longueur suffit à les distinguer.
FFBB_NUMERIC_ID = re.compile(r"\b(\d{12,18})\b")

# Blocs JSON déposés par les frameworks web dans la page. S'ils sont présents,
# ils contiennent en général les données affichées, ce qui évite de parser du
# HTML : c'est la piste à privilégier sur la plateforme moderne.
HYDRATION_BLOCKS = (
    ("__NEXT_DATA__", re.compile(r'id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)),
    ("__NUXT__", re.compile(r"window\.__NUXT__\s*=\s*(.*?)</script>", re.S)),
    ("__INITIAL_STATE__", re.compile(r"window\.__INITIAL_STATE__\s*=\s*(.*?)</script>", re.S)),
)


def report_page(url: str, html: str) -> None:
    """Décrit ce que contient une page FFBB, pour comprendre à quoi on a affaire.

    Utile quand la page de départ ne donne aucun résultat : selon qu'elle est
    rendue côté serveur, qu'elle expose ses données dans un bloc JSON ou
    qu'elle charge tout en JavaScript, la marche à suivre n'est pas la même.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text().strip() if soup.title else "(sans titre)"
    links = soup.select("a[href]")

    print("\n--- Diagnostic de la page ---")
    print(f"  Titre        : {title}")
    print(f"  Taille       : {len(html)} caractères")
    print(f"  Liens <a>    : {len(links)}")

    for name, pattern in HYDRATION_BLOCKS:
        found = pattern.search(html)
        if found:
            print(f"  Bloc {name} : PRÉSENT ({len(found.group(1))} caractères)")
            print("               → les données sont dans la page, exploitables sans HTML")

    numeric = sorted(set(FFBB_NUMERIC_ID.findall(html)))
    if numeric:
        print(f"  Identifiants numériques trouvés ({len(numeric)}) : {', '.join(numeric[:12])}")

    api_hints = sorted(set(re.findall(r"https?://[\w.-]*ffbb\.com/[\w/.-]*api[\w/.-]*", html, re.I)))
    if api_hints:
        print(f"  URL d'API repérées : {', '.join(api_hints[:5])}")

    if links and not numeric:
        sample = [a.get("href", "") for a in links[:14]]
        print(f"  Exemples de liens : {', '.join(h[:52] for h in sample if h)}")

    if len(links) < 5 and not any(p.search(html) for _, p in HYDRATION_BLOCKS):
        print("  ⚠ Page quasiment vide côté serveur : contenu chargé en JavaScript.")
        print("    Il faudra viser l'API plutôt que le HTML.")
    print("--- fin du diagnostic ---\n")


def discover(start_url: str) -> list[tuple[str, str, int]]:
    """Trouve les championnats où le club apparaît, à partir d'une page FFBB.

    Le principe évite d'avoir à connaître la structure de la page de départ :
    on relève tous les liens vers /championnat/<id>.html qu'elle contient, puis
    on ouvre chaque candidat et on ne garde que ceux dont le classement
    mentionne le club. Le contrôle de présence sert donc de validateur.

    Si la page ne mène nulle part, un diagnostic décrit ce qu'elle contient
    réellement, afin de savoir vers quoi se tourner.

    À lancer depuis un environnement ayant accès à la FFBB — typiquement le
    runner GitHub Actions (onglet Actions → Classements FFBB → Run workflow,
    champ « decouvrir »).

    @returns liste de (identifiant, nom de compétition, nombre d'équipes)
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:  # pragma: no cover
        sys.exit("beautifulsoup4 manquant : pip install -r scripts/requirements.txt")

    print(f"Page de départ : {start_url}")
    html = fetch_url(start_url)
    report_page(start_url, html)

    ids = []
    for href in {a.get("href", "") for a in BeautifulSoup(html, "html.parser").select("a[href]")}:
        found = CHAMPIONSHIP_LINK.search(href)
        if found and found.group(1) not in ids:
            ids.append(found.group(1))

    # La page de départ peut elle-même être une page de championnat.
    own = CHAMPIONSHIP_LINK.search(start_url)
    if own and own.group(1) not in ids:
        ids.insert(0, own.group(1))

    if not ids:
        print("Aucun lien vers /championnat/<id>.html sur cette page.", file=sys.stderr)
        print("Le diagnostic ci-dessus indique vers quoi se tourner.", file=sys.stderr)
        return []

    print(f"{len(ids)} championnat(s) à tester…\n")
    matches = []
    for index, championship_id in enumerate(ids):
        if index:
            time.sleep(DELAY_BETWEEN_REQUESTS)
        try:
            standings = parse_standings(fetch_html(championship_id))
        except ParsingError as error:
            print(f"  ✗ {championship_id}  {error}")
            continue
        except Exception as error:
            print(f"  ✗ {championship_id}  récupération impossible ({error})")
            continue
        matches.append((championship_id, standings["competition"], len(standings["rows"])))
        print(f"  ✓ {championship_id}  {standings['competition']} — {len(standings['rows'])} équipes")

    if matches:
        print("\nÀ reporter dans assets/data/teams.json :")
        for championship_id, competition, _ in matches:
            print(f'  "ffbb": {{ "championshipId": "{championship_id}" }}   → {competition}')
    else:
        print("\nAucun championnat trouvé contenant le club sur cette page.", file=sys.stderr)
    return matches


def url_variants(url: str) -> list[str]:
    """Formes équivalentes d'une URL de classement FFBB.

    Selon la ligue, le classement est servi sur `/competitions/<code>/classement`
    ou directement sur `/competitions/<code>`, avec les mêmes paramètres de
    phase et de poule. On essaie les deux plutôt que d'imposer une forme.
    """
    variants = [url]
    if "/classement?" in url:
        variants.append(url.replace("/classement?", "?"))
    elif "/classement" in url:
        variants.append(url.replace("/classement", ""))
    else:
        base, _, query = url.partition("?")
        variants.append(f"{base.rstrip('/')}/classement" + (f"?{query}" if query else ""))
    return variants


def fetch_standings_page(url: str) -> tuple[str, str]:
    """Récupère la page de classement en essayant les formes d'URL connues.

    @returns (html, url réellement utilisée)
    """
    errors = []
    for candidate in url_variants(url):
        try:
            return fetch_url(candidate), candidate
        except Exception as error:
            errors.append(f"{candidate.split('?')[0]} → {error}")
    raise RuntimeError(" | ".join(errors))


def load_teams() -> list[dict]:
    teams = json.loads(TEAMS_FILE.read_text(encoding="utf-8"))
    return [t for t in teams if t.get("slug")]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--team", help="ne traiter qu'une équipe (slug)")
    parser.add_argument("--html-file", help="parser un fichier local au lieu d'appeler la FFBB")
    parser.add_argument("--dry-run", action="store_true", help="afficher sans écrire le JSON")
    parser.add_argument(
        "--discover",
        metavar="URL",
        help="trouver les identifiants de championnat du club depuis une page FFBB "
             "(page du club ou d'une de ses équipes)",
    )
    args = parser.parse_args()

    if args.discover:
        return 0 if discover(args.discover) else 1

    teams = load_teams()
    if args.team:
        teams = [t for t in teams if t["slug"] == args.team]
        if not teams:
            sys.exit(f"équipe inconnue : {args.team}")

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    result = {"teams": {}}
    failures = []
    first = True

    for team in teams:
        slug = team["slug"]
        ffbb = team.get("ffbb") or {}
        # `classementUrl` : URL de la page de classement, copiée depuis le
        # navigateur. `championshipId` : ancienne plateforme, conservé pour
        # compatibilité.
        source_url = ffbb.get("classementUrl", "")
        if not source_url and ffbb.get("championshipId"):
            source_url = BASE_URL.format(id=ffbb["championshipId"])

        if args.html_file:
            html = Path(args.html_file).read_text(encoding="utf-8", errors="replace")
        elif source_url:
            if not first:
                time.sleep(DELAY_BETWEEN_REQUESTS)
            first = False
            try:
                html, source_url = fetch_standings_page(source_url)
            except Exception as error:  # réseau, 404, 5xx…
                failures.append(f"{slug} : récupération impossible ({error})")
                continue
        else:
            # Pas d'identifiant : l'équipe reste sur le widget Score'n'co.
            continue

        try:
            standings = parse_standings(html)
        except ParsingError as error:
            failures.append(f"{slug} : {error}")
            continue

        standings["source"] = source_url or args.html_file
        standings["updatedAt"] = now
        result["teams"][slug] = standings
        print(f"  {slug:6s} {len(standings['rows']):2d} équipes — "
              f"{standings['competition'] or '(sans titre)'} "
              f"[via {standings.pop('extraction', '?')}]")

    if failures:
        print("\nÉchecs :", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)

    if not result["teams"]:
        print(
            "\nAucun classement récupéré. Renseignez 'ffbb.championshipId' dans "
            "assets/data/teams.json (voir le README).",
            file=sys.stderr,
        )
        # Sans données, on ne réécrit pas le fichier : les anciennes valeurs
        # restent servies plutôt que d'être remplacées par du vide.
        return 1 if failures else 0

    payload = {
        "_comment": (
            "Classements produits automatiquement par scripts/fetch_standings.py depuis "
            "resultats.ffbb.com. NE PAS EDITER A LA MAIN : le fichier est reecrit a chaque "
            "execution du workflow .github/workflows/classements.yml."
        ),
        "updatedAt": now,
        **result,
    }

    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    OUTPUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nÉcrit : {OUTPUT_FILE.relative_to(ROOT)} ({len(result['teams'])} équipe(s))")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
