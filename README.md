# SigneDuo

Un mini "Duolingo" pour la Langue des Signes Française (LSF), qui suit tes mains via la caméra pour t'entraîner aux chiffres et à une partie de l'alphabet manuel.

**100% statique, aucun framework, aucun serveur.** Le suivi de main tourne entièrement dans le navigateur grâce à [MediaPipe Hands](https://developers.google.com/mediapipe) (chargé depuis un CDN). Rien n'est envoyé nulle part — la vidéo ne quitte jamais l'appareil.

## Déployer sur GitHub Pages

1. Crée un nouveau dépôt sur GitHub (ex. `signeduo`).
2. Mets tout le contenu de ce dossier (`index.html`, `css/`, `js/`) à la racine du dépôt, puis pousse :
   ```bash
   git init
   git add .
   git commit -m "Premier envoi de SigneDuo"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/signeduo.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings → Pages → Source → Deploy from a branch**, choisis la branche `main` et le dossier `/ (root)`.
4. Après une minute ou deux, le site est accessible à `https://TON-PSEUDO.github.io/signeduo/`.

Aucune étape de build n'est nécessaire : c'est du HTML/CSS/JS pur, servi tel quel.

⚠️ La caméra ne fonctionne que sur une origine sécurisée (`https://`, ce que GitHub Pages fournit automatiquement) — elle ne marchera pas si tu ouvres simplement `index.html` en local via `file://` dans certains navigateurs. Pour tester en local, lance un petit serveur, par exemple :
```bash
python3 -m http.server 8000
```
puis ouvre `http://localhost:8000`.

## Comment ça marche

- `js/hand-tracking.js` initialise le `HandLandmarker` de MediaPipe et détecte 21 points de repère sur la main à chaque frame de la caméra.
- `js/signs.js` transforme ces points en un vecteur simple (quels doigts sont tendus, quel est l'écartement entre index et majeur) et compare ce vecteur à la forme cible du signe en cours.
- `js/app.js` gère la navigation, le parcours de leçons, les points d'XP et la série de jours (tout stocké dans `localStorage`, propre à chaque navigateur).

## Limites connues (honnêteté d'abord)

- Seules des **formes de main statiques** sont reconnues (chiffres 1 à 5, et les lettres I, Y, L, U, V, B, F, W). Les signes qui impliquent un mouvement, une orientation précise du poignet ou une expression du visage (ce qui concerne une grande partie de la vraie LSF) ne sont pas couverts.
- La détection est basée sur des seuils simples (distances normalisées entre repères). Elle fonctionne bien en général mais peut se tromper selon l'éclairage, l'angle de la main ou la webcam utilisée. Les seuils sont ajustables dans `extractFeatures()` et `matchSign()` (fichier `js/signs.js`) si tu veux les affiner.
- Certaines formes se recoupent volontairement (ex. le chiffre 4 et la lettre B utilisent la même configuration de doigts) — c'est signalé dans l'interface plutôt que caché.
- Ce n'est pas un substitut à un vrai cours de LSF. C'est un outil d'échauffement pour la mémoire musculaire des formes de main.

## Pistes d'évolution

- Ajouter plus de lettres en combinant la détection de forme avec l'orientation de la paume (produit vectoriel entre landmarks).
- Ajouter un mode "miroir" pour comparer sa main à une photo/vidéo de référence.
- Ajouter des signes dynamiques (mots simples) en suivant la trajectoire du poignet sur plusieurs frames.
