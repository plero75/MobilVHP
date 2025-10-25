RATPVHP – Version HTML/JS statique

Déploiement
-----------
1) Dépose ce dossier à la racine du dépôt GitHub `plero75/RATPVHP`.
2) Dans GitHub → Settings → Pages → Source : choisis `main` et `(root)`.
3) L’URL sera : https://plero75.github.io/RATPVHP/

Configuration
-------------
- Les appels PRIM passent par un proxy Cloudflare et injectent l’en-tête `apikey` :
  PROXY = https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=
  PRIM_API_KEY = (déjà rempli)

Modules
-------
- RER A Joinville-le-Pont : temps réel + fallback GTFS (Navitia via PRIM)
- Tous les bus à Joinville (découverte lignes, affichage permanent, fallback)
- Météo : Open-Meteo (48.835, 2.45)
- Vélib’ : 12163 (Vincennes), 12128 (École du Breuil)
- France Info : bandeau RSS
- Alertes trafic : bannière (RER A, 77, 201, N33)
