# Guts

Calendrier personnel avec Guts, un renard qui grandit avec les tâches tenues et protège le temps libre.

- Application : https://medbensito.github.io/guts/
- Sur iPhone : ouvrir le lien dans Safari, puis Partager › Sur l'écran d'accueil.
- Les données restent sur l'appareil (stockage du navigateur). Réglages › Sauvegarde : copie automatique chiffrée sur l'appareil
  avant l'envoi (AES-GCM, clé tirée d'un code de récupération qui ne quitte pas l'appareil ; le service ne garde que 7 jours
  de copies illisibles), ou export dans un fichier.
- Réglages › Verrou Face ID : une clé d'accès (WebAuthn) propre à Guts, demandée à l'ouverture et au retour après le délai choisi.
  Réglages du verrou gardés sur l'appareil seulement (`guts-verrou`), hors des données.

## Fichiers

- `index.html` : l'application, assemblée par `build.sh` à partir de `src/page.html` et `src/renard.js`.
- `sw.js` : fonctionnement hors ligne (réseau d'abord, copie en cache sinon).
- `manifest.webmanifest`, `icones/` : installation sur l'écran d'accueil.
- `rappels/` : le service de rappels (Cloudflare Worker, Web Push chiffré, tâche planifiée chaque minute)
  et le coffre des sauvegardes chiffrées (`/coffre/<empreinte du code>`).
  Déployé par `.github/workflows/rappels.yml` (secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`),
  qui publie son adresse dans `rappels.json`. Ne pas modifier ce fichier à la main.
