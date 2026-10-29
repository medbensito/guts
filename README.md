# Guts

Calendrier personnel avec Guts, un renard qui grandit avec les tâches tenues et protège le temps libre.

- Application : https://medbensito.github.io/guts/
- Sur iPhone : ouvrir le lien dans Safari, puis Partager › Sur l'écran d'accueil.
- Les données restent sur l'appareil (stockage du navigateur). Réglages › Sauvegarder pour en garder une copie.

## Fichiers

- `index.html` : l'application, assemblée par `build.sh` à partir de `src/page.html` et `src/renard.js`.
- `sw.js` : fonctionnement hors ligne (réseau d'abord, copie en cache sinon).
- `manifest.webmanifest`, `icones/` : installation sur l'écran d'accueil.
- `rappels/` : le service de rappels (Cloudflare Worker, Web Push chiffré, tâche planifiée chaque minute).
  Déployé par `.github/workflows/rappels.yml` (secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`),
  qui publie son adresse dans `rappels.json`. Ne pas modifier ce fichier à la main.
