#!/usr/bin/env python3
"""Liste les poules où le club est engagé, via l'API FFBB.

Remplace la recherche d'identifiants à partir des pages web, qui obligeait à
lire des URL dans le navigateur et se cassait à chaque évolution du site. Ici,
une recherche sur le nom du club renvoie tous ses engagements de la saison, avec
l'identifiant de poule à reporter dans assets/data/teams.json.

    python scripts/decouvrir_poules.py                  # cherche « Cornebarrieu »
    python scripts/decouvrir_poules.py "Blagnac"        # un autre club

Nécessite un accès réseau à la FFBB : à lancer depuis le workflow
(.github/workflows/classements.yml, champ « poules ») si l'environnement local
ne l'a pas.
"""
from __future__ import annotations

import sys

CLUB_PAR_DEFAUT = "Cornebarrieu"
# Assez large pour couvrir les 9 équipes du club sans ramener tout le comité.
LIMITE = 100


def texte(valeur) -> str:
    """Aplati les champs qui sont tantôt une chaîne, tantôt un objet nommé."""
    if valeur is None:
        return ""
    if isinstance(valeur, str):
        return valeur
    for attribut in ("nom", "libelle", "code"):
        trouve = getattr(valeur, attribut, None)
        if isinstance(trouve, str) and trouve:
            return trouve
    return ""


def main() -> int:
    try:
        from ffbb_data_client import FFBBDataClient
    except ImportError:
        sys.exit(
            "ffbb-data-client manquant : pip install -r scripts/requirements.txt"
        )

    recherche = sys.argv[1] if len(sys.argv) > 1 else CLUB_PAR_DEFAUT
    print(f"Engagements trouvés pour « {recherche} »\n")

    client = FFBBDataClient.create()
    resultat = client.search_engagements(recherche, limit=LIMITE)
    hits = getattr(resultat, "hits", None) or []

    if not hits:
        print("Aucun engagement trouvé.", file=sys.stderr)
        print(
            "Essayez une autre orthographe, ou le nom officiel du club tel qu'il "
            "apparaît sur competitions.ffbb.com.",
            file=sys.stderr,
        )
        return 1

    lignes = []
    for hit in hits:
        poule = getattr(hit, "id_poule", None)
        poule_id = getattr(poule, "id", None)
        if not poule_id:
            continue  # engagement sans poule attribuée (compétition à venir)
        lignes.append(
            {
                "equipe": texte(getattr(hit, "nom_equipe", None)) or texte(hit.nom),
                "club": texte(getattr(hit, "nom_club", None)),
                "competition": texte(getattr(hit, "id_competition", None)),
                "poule": texte(getattr(poule, "nom", None)),
                "poule_id": poule_id,
                "niveau": texte(getattr(hit, "niveau", None)),
                "categorie": texte(getattr(hit, "categorie", None)),
            }
        )

    if not lignes:
        print(
            f"{len(hits)} engagement(s) trouvé(s), mais aucun n'a de poule attribuée.",
            file=sys.stderr,
        )
        return 1

    lignes.sort(key=lambda l: (l["club"], l["competition"], l["equipe"]))
    largeur = max(len(l["equipe"]) for l in lignes)
    for ligne in lignes:
        print(
            f"  {ligne['equipe']:<{largeur}}  {ligne['poule_id']}  "
            f"{ligne['competition']} — poule {ligne['poule'] or '?'}"
            f"{'  [' + ligne['categorie'] + ']' if ligne['categorie'] else ''}"
        )

    print("\nÀ reporter dans assets/data/teams.json, sur l'équipe correspondante :")
    print(f'  "ffbb": {{ "pouleId": "{lignes[0]["poule_id"]}" }}')
    print(
        "\nLe rapprochement équipe du site ↔ engagement FFBB se fait à la main : "
        "les intitulés diffèrent (SF1 côté site, « Séniors Féminines 1 » côté FFBB)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
