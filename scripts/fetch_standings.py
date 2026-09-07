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
REQUEST_TIMEOUT = 20
DELAY_BETWEEN_REQUESTS = 1.5  # on reste courtois avec la FFBB

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


def parse_standings(html: str) -> dict:
    """Extrait le classement d'une page de championnat FFBB.

    Lève ParsingError si la structure attendue est absente : mieux vaut un
    échec visible dans le workflow qu'un JSON silencieusement vide qui
    remplacerait de bonnes données.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:  # pragma: no cover
        sys.exit("beautifulsoup4 manquant : pip install -r scripts/requirements.txt")

    soup = BeautifulSoup(html, "html.parser")

    title_node = soup.select_one("#idTdDivision")
    competition = clean(title_node.get_text()) if title_node else ""

    tables = soup.select("table.liste") or soup.select(".liste")
    if not tables:
        raise ParsingError(
            "aucun tableau '.liste' trouvé — la page a probablement changé de structure"
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
            return {"competition": competition, "rows": entries}

    raise ParsingError(
        "tableau '.liste' présent mais aucune ligne de classement exploitable "
        "(une ligne doit commencer par un rang numérique)"
    )


# ---------------------------------------------------------------- récupération

def fetch_html(championship_id: str) -> str:
    try:
        import requests
    except ImportError:  # pragma: no cover
        sys.exit("requests manquant : pip install -r scripts/requirements.txt")

    url = BASE_URL.format(id=championship_id)
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    # Les pages FFBB sont en latin-1 mais ne l'annoncent pas toujours.
    if not response.encoding or response.encoding.lower() == "iso-8859-1":
        response.encoding = response.apparent_encoding or "utf-8"
    return response.text


def load_teams() -> list[dict]:
    teams = json.loads(TEAMS_FILE.read_text(encoding="utf-8"))
    return [t for t in teams if t.get("slug")]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--team", help="ne traiter qu'une équipe (slug)")
    parser.add_argument("--html-file", help="parser un fichier local au lieu d'appeler la FFBB")
    parser.add_argument("--dry-run", action="store_true", help="afficher sans écrire le JSON")
    args = parser.parse_args()

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
        championship_id = (team.get("ffbb") or {}).get("championshipId", "")

        if args.html_file:
            html = Path(args.html_file).read_text(encoding="utf-8", errors="replace")
        elif championship_id:
            if not first:
                time.sleep(DELAY_BETWEEN_REQUESTS)
            first = False
            try:
                html = fetch_html(championship_id)
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

        standings["source"] = BASE_URL.format(id=championship_id) if championship_id else args.html_file
        standings["updatedAt"] = now
        result["teams"][slug] = standings
        print(f"  {slug:6s} {len(standings['rows']):2d} équipes — {standings['competition'] or '(sans titre)'}")

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
