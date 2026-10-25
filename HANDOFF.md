# HANDOFF — ERP Démo Domaine des Trois Coteaux (fictif)

## Statut d'avancement des lots (L0 – L7)

| Lot | Désignation | Statut | Preuves & Commandes |
|---|---|---|---|
| **L0** | Initialisation, stack, schéma partagé, adaptateur IndexedDB, seed v1 | **Livré & validé** | `npm run typecheck`, `npm run lint` |
| **L1** | Colonne vertébrale : Assemblage 2025 → Mise en bouteilles → Vente / Réservation / Livraison | **Livré & validé** | `tests/fixture.test.ts`, `e2e/demo.spec.ts` |
| **L2** | Vignoble & Récolte : Parcelles, missions, comptages, corrections versionnées, transport, réception au chai | **Livré & validé** | `tests/quality_cases.test.ts`, UI `VineyardView` |
| **L3** | Chai & Vinification : Plan de cave cuves/fûts, relevés réels, cinétique SVG de densité, dégustations, itinéraires | **Livré & validé** | UI `CellarView`, `tests/domain.test.ts` |
| **L4** | Élevage & Assemblage : Barriques 2024, transferts avec pertes déclarées, ouillage, essai d'assemblage & exécution | **Livré & validé** | UI `AgingView`, `tests/fixture.test.ts` |
| **L5** | Matières sèches & Achats : Stock BOM, commandes fournisseurs, réceptions partielles avec coût pondéré, inventaire | **Livré & validé** | UI `SuppliesView` |
| **L6** | Pilotage & Finance démo : Factures sans valeur comptable, encaissements simulés, prévision de trésorerie, projet 2027 | **Livré & validé** | UI `FinanceView` |
| **L7** | Traçabilité amont/aval, visite guidée 10 min, conformité ergonomique WCAG 2.2 AA, recette navigateur E2E | **Livré & validé** | `npm run test:e2e` (Playwright Chromium) |

---

## Ce qui a été réellement testé et exécuté
- **Types TypeScript strict** : `npm run typecheck` (0 erreur).
- **Linter ESLint** : `npm run lint` (0 avertissement).
- **Tests unitaires et d'intégration Vitest** (4 suites, 7 tests réussis) :
  - `tests/fixture.test.ts` : Portage complet des vérifications de `validate_fixture.py` contre le moteur de commandes `applyCommand` pur (conservation volume, calcul exact des centimes, BOM matières sèches, déstockage physique vs réservé, facture démo sans second déstockage).
  - `tests/integration/db.test.ts` : Persistance transactionnelle IndexedDB, idempotence (re-jeu avec même clé renvoie le résultat sauvegardé sans ré-exécuter, re-jeu avec clé identique mais payload différent déclenche un conflit explicite), intégrité en cas de refus métier (roll-back de transaction).
  - `tests/quality_cases.test.ts` : Invariants métier (tare >= brut refusée, correction de comptage auditée avec versioning et détection de conflit concurrent, autorisations selon le rôle simulé).
  - `tests/ui.test.tsx` : Rendu Testing Library, chargement du seed, navigation entre onglets, affichage des 5 millésimes simultanés.
- **Test E2E Playwright** : `npm run test:e2e` exécuté sur Chromium (parcours transverse du scénario de 10 min avec exécution des transactions métier réelles, navigation entre onglets et vérification des soldes de stock).
- **Validateur de référence Python** : `npm run validate:fixture` exécuté avec succès.
- **Build de production Vite** : `npm run build` exécuté avec succès (bundle `dist/` généré).

---

## Ce qui est simulé / Hypothèses de démonstration
- **Horloge fixe** : 24 octobre 2026 (injectable).
- **Prévisualisation de rôles** : Sélecteur simulé dans le bandeau supérieur (Direction, Maître de chai, Chef de culture, Commercial, Gestion). Ce n'est pas une authentification multi-utilisateurs réelle.
- **Documents financiers et devises** : Factures, avoirs et règlements sont explicitement étiquetés comme illustratifs sans valeur comptable, bancaire ou fiscale.
- **Laboratoire et automates** : Non connectés.
- **GPS parcelles** : Aucun point GPS fictif inventé. Un schéma illustratif proportionnel est fourni à la place.

---

## Commandes pour lancer l'application en local
```bash
# Lancer le serveur de développement local
npm run dev
# Ouvrir ensuite http://localhost:5173

# Lancer la suite complète de vérifications
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run validate:fixture
npm run build
```
