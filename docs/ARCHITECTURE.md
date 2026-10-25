# Architecture technique — ERP Domaine des Trois Coteaux (fictif)

## 1. Principes fondamentaux
- **Projet autonome & Démo locale** : L'application fonctionne à 100 % dans le navigateur sans backend obligatoire, sans compte payant ni configuration complexe.
- **Transactions & Persistance locale** : Un adaptateur IndexedDB dédié (`src/infra/db.ts`, base `domaine-erp-demo`) stocke la projection d'état ainsi qu'un journal *append-only*.
- **Opérations atomiques & Commandes pures** : Toute modification métier passe par une fonction pure `applyCommand()` (`src/domain/commands/`) exécutée dans une transaction IndexedDB unifiée. En cas de refus métier ou d'erreur, la transaction est annulée : aucun stock ou volume n'est consommé.
- **Gestion stricte de l'idempotence** : Chaque commande porte une `idempotencyKey`. Un retry avec le même payload renvoie le résultat mémorisé sans ré-exécuter ; une même clé avec un payload différent déclenche un conflit explicite.
- **Règles de mesures** :
  - Volumes de vin en **mL entiers** (`volumeMl`).
  - Masses de raisin en **g entiers** (`grossG`, `tareG`, `netG`).
  - Monnaie en **centimes entiers** (`knownCents`, `htCents`).
  - Conditionnement & fournitures en **unités entières**.
  - Inconnu ≠ zéro (les coûts incomplets portent un drapeau `incomplete: true`).
  - Les kilogrammes de raisin ne sont **jamais** convertis automatiquement en litres de vin sans mesure ou récolte explicite.
- **Distinctions de stocks commerciales** :
  `Stock physique ≠ Réservé ≠ Bloqué qualité ≠ Disponible vendable`.

---

## 2. Structure des dossiers
```
src/
  domain/               # Modèle métier pur
    types.ts            # Types discriminés et interfaces du domaine
    quantities.ts       # Conversions exactes, prorata et centimes
    selectors.ts        # Sélecteurs (positions de stock, volumes, balances)
    errors.ts           # Erreurs typées DomainError
    commands/           # Commandes pures (cellar, vineyard, commercial)
  infra/
    db.ts               # Adaptateur IndexedDB transactionnel + journal
    ai.ts               # Connecteur Google AI Studio (SDK @google/genai)
  seed/
    seed.ts             # Jeu de données initial multi-millésimes 2023-2027
  ui/
    theme.css           # Direction artistique (fond pierre #F6F5F0, vert forêt #235443, raisin #694456)
  features/
    overview/           # Vue d'ensemble (5 millésimes simultanés, KPI, alertes)
    vineyard/           # Schéma parcellaire, missions, comptages, réceptions
    cellar/             # Plan de cuves/fûts, relevés réels, cinétique SVG, dégustations
    aging/              # Barriques 2024, soutirages, simulateur d'assemblage
    bottling/           # Nomenclature matières sèches (BOM), ordres de mise
    supplies/           # Commandes fournisseurs, réceptions partielles, inventaire
    sales/              # Devis, commandes, réservations, livraisons, retours
    finance/            # Factures démo (sans valeur comptable), échéancier, projet 2027
    traceability/       # Arbre généalogique amont/aval complet
    demo/               # Modale du scénario guidé de 10 minutes
    ai/                 # Drawer Copilote IA connecté à Google AI Studio
  App.tsx               # Shell applicatif avec bandeau démo & navigation
  main.tsx              # Point d'entrée React 19
tests/
  fixture.test.ts       # Portage des cas du validateur de référence
  quality_cases.test.ts # Invariants métier (tare >= brut, versioning des corrections)
  integration/db.test.ts# Persistance IndexedDB & idempotence
  ui.test.tsx           # Rendu Testing Library & navigation
e2e/
  demo.spec.ts          # Test de recette E2E Playwright sur navigateur réel
docs/
  ARCHITECTURE.md       # Cette documentation
  AI_STUDIO_PROMPT.md   # Guide pour AI Studio / Google IDX
```

---

## 3. Commandes du projet
```bash
npm run dev           # Démarre le serveur local Vite sur http://localhost:5173
npm run build         # Vérification des types + bundle de production (tsc -b && vite build)
npm run typecheck     # Contrôle strict TypeScript (tsc -b --noEmit)
npm run lint          # Linter ESLint
npm test              # Suite de tests Vitest (unitaires + intégration)
npm run test:e2e      # Tests navigateur Playwright
npm run validate:fixture # Vérificateur de référence Python
```
