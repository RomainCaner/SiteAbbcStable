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
# On associe par intitulé plutôt que par position : une colonne ajoutée en
# amont ne décale plus tout le reste.
COLUMN_ALIASES = {
    "rank": ("clt", "class", "rang", "pos"),
    "team": ("equipe", "équipe", "club", "nom"),
    "points": ("pts", "point", "points"),
    "played": ("jou", "joue", "joué", "mj", "matchs", "match"),
    "won": ("g", "gagne", "gagné", "v", "victoires"),
    "lost": ("p", "perdu", "d", "defaites", "défaites"),
    "drawn": ("n", "nul", "nuls"),
    "scored": ("bp", "pour", "marques", "marqués"),
    "conceded": ("bc", "contre", "encaisses", "encaissés"),
    "diff": ("diff", "difference", "différence", "coef"),
}


def build_header_map(cells: list[str]) -> dict[int, str]:
    """Associe l'index de chaque colonne à une clé normalisée."""
    mapping: dict[int, str] = {}
    for index, label in enumerate(cells):
        key = clean(label).lower().rstrip(".")
        for field, aliases in COLUMN_ALIASES.items():
            if key in aliases and field not in mapping.values():
                mapping[index] = field
                break
    return mapping


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

        header_cells = [clean(c.get_text()) for c in rows[0].select("th, td")]
        header_map = build_header_map(header_cells)

        # Un vrai tableau de classement porte au moins un rang et un nom d'équipe.
        if "team" not in header_map.values():
            continue

        entries = []
        for row in rows[1:]:
            cells = row.select("td")
            if len(cells) < 3:
                continue

            entry = {}
            for index, field in header_map.items():
                if index >= len(cells):
                    continue
                raw = clean(cells[index].get_text())
                entry[field] = raw if field == "team" else to_int(raw)

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
        "(colonnes attendues : classement, équipe, points…)"
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
