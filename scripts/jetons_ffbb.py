#!/usr/bin/env python3
"""
Affiche les deux jetons de l'API FFBB, à copier dans les secrets du dépôt.

Pourquoi : depuis le 19/10/2026, le pare-feu de la FFBB refuse aux machines de
GitHub l'adresse où ffbb-data-client va chercher ces jetons
(bo.ffbb.com/items/configuration). Lancé depuis une connexion ordinaire — la
box de la maison —, ce script les récupère ; GitHub n'a plus qu'à les lire
dans ses secrets, sans passer par l'adresse bloquée.

    pip install -r scripts/requirements.txt
    python scripts/jetons_ffbb.py

Puis, sur GitHub : Settings → Secrets and variables → Actions → New repository
secret, une fois pour chaque nom affiché.

Ces jetons sont ceux que l'application publique de la FFBB distribue à tout
visiteur ; ils restent néanmoins hors du dépôt, dans les secrets. S'ils
changent un jour, la mise à jour échouera de nouveau : relancer ce script.
"""

import sys


def main() -> int:
    try:
        from ffbb_data_client.utils.token_manager import TokenManager
    except ImportError:
        print("ffbb-data-client manquant : pip install -r scripts/requirements.txt", file=sys.stderr)
        return 1

    try:
        # Sans cache : on veut les jetons servis aujourd'hui, pas une copie.
        tokens = TokenManager.get_tokens(use_cache=False)
    except Exception as erreur:  # noqa: BLE001 — on veut le message, quel qu'il soit
        print(f"Récupération impossible : {erreur}", file=sys.stderr)
        print("Cette connexion est peut-être bloquée elle aussi : essayer depuis un autre réseau.",
              file=sys.stderr)
        return 1

    print("Secrets à créer sur GitHub (Settings → Secrets and variables → Actions) :\n")
    print(f"  API_FFBB_APP_BEARER_TOKEN = {tokens.api_token}")
    print(f"  MEILISEARCH_BEARER_TOKEN  = {tokens.meilisearch_token}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
