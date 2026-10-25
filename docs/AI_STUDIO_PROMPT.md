# Instructions pour Google AI Studio / Project IDX

Ce document définit le prompt et les règles de travail lorsqu'un agent d'assistance ou développeur charge ce dépôt GitHub dans **Google AI Studio** ou **Project IDX**.

---

## Prompt de démarrage à coller dans l'environnement AI Studio

```text
Tu reprends le dépôt existant « Domaine viticole avec Thos & Loul's » (Domaine des Trois Coteaux — fictif), déjà importé dans ce projet.

Ne crée pas une nouvelle application et ne réécris pas l'architecture existante.
Commence par lire README.md, docs/ARCHITECTURE.md et docs/domaine/PRODUCT.md.

Principes clés à respecter :
1. Préserve le design (fond pierre #F6F5F0, vert forêt #235443, accent raisin #694456), les fonctionnalités métier et le mode démo local persistant (IndexedDB).
2. L'application fonctionne sans backend obligatoire : aucun serveur Firebase ou base de données externe n'est requis pour la démo. Ne prévois pas de configuration Firebase fictive.
3. Vérifie d'abord que l'application démarre correctement (npm run dev) pour la prévisualisation en direct sur le port 5173.
4. Avant chaque modification importante, explique brièvement le fichier et le problème traité ; après chaque étape, exécute les tests de contrôle (npm run typecheck, npm run lint, npm test, npm run build).
5. Ne mets aucun secret ni clé API en clair dans le code ou dans GitHub. Utilise les variables d'environnement (VITE_GEMINI_API_KEY dans .env.local) ou les paramètres de l'interface.
```

---

## Configuration de la prévisualisation en direct (Live Preview)
- **Commande de démarrage** : `npm run dev`
- **Port** : `5173` (Vite)
- **Persistance** : Gérée nativement par IndexedDB dans le navigateur de prévisualisation (base `domaine-erp-demo`).
- **Bouton Copilote IA** : Présent dans le bandeau supérieur de l'application, alimenté par le SDK `@google/genai` (modèle Gemini 2.5 Flash).
