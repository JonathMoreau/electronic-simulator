# Gestionnaire de Breadboard

Application Node.js pour gérer et visualiser une carte breadboard électronique.

## Installation

1. Installer les dépendances :
```bash
npm install
```

## Utilisation

1. Démarrer le serveur :
```bash
npm start
```

2. Ouvrir votre navigateur à l'adresse :
```
http://localhost:3000
```

## Fonctionnalités

- **Visualisation de la breadboard** : Affichage visuel d'une breadboard standard avec :
  - Rails d'alimentation (positif et négatif) en haut et en bas
  - Zone centrale avec colonnes pour placer des composants
  
- **Interaction** :
  - Cliquez sur un trou pour le sélectionner
  - Survolez un trou pour voir ses informations
  - Boutons pour effacer ou réinitialiser la breadboard

## Structure du projet

- `server.js` : Serveur Express
- `public/index.html` : Interface utilisateur
- `public/styles.css` : Styles de la breadboard
- `public/breadboard.js` : Logique de gestion de la breadboard

## Prochaines fonctionnalités

- Placement de composants électroniques
- Connexions entre les trous
- Simulation de circuits
- Export/Import de configurations

