# Plan d'implémentation — ERP démo « Domaine des Trois Coteaux — fictif »

Projet neuf construit depuis le pack de cadrage (aucune application antérieure).

## Stack retenue
- React + TypeScript strict + Vite (SPA, pas de SSR), React Router.
- CSS maison à base de tokens (pas de framework UI), éléments HTML natifs (`<dialog>`, `<table>`, `<select>`).
- Persistance : IndexedDB via un petit adaptateur maison (`src/infra/db.ts`), base `domaine-erp-demo` dédiée.
- Tests : Vitest (domaine pur + intégration IndexedDB via `fake-indexeddb`), Testing Library, Playwright (E2E).
- npm + `package-lock.json`. Aucun backend, compte ou secret.

## Architecture
```
src/domain/     types, unités, fonctions pures, commandes (applyCommand), erreurs typées
src/seed/       seed versionné (fixture du pack enrichie), horloge fixe 24/10/2026
src/infra/      adaptateur IndexedDB : état projeté + journal append-only, idempotence, reset ciblé
src/app/        service applicatif (store React), rôles prévisualisés
src/ui/         composants partagés (tokens, tables, dialogues, quantités)
src/features/   écrans par métier
```
- Une commande = `{ type, idempotencyKey, payload }`. Le service exécute dans **une seule transaction
  IndexedDB** : lecture état → `applyCommand` pur (copie, aucune mutation en cas d'erreur) → écriture état + entrée
  de journal. Même clé + même payload → résultat déjà obtenu ; même clé + payload différent → conflit.
- L'état est reconstructible : `replay(seed, journal)` (testé).
- Toutes les vues lisent la même projection via le store ; aucun composant n'écrit un total.

## Conventions de mesure
mL entiers (vin), g entiers (raisin), unités entières (bouteilles, fournitures), centimes (monnaie).
Coût connu : `{ knownCents, incomplete }` — inconnu ≠ zéro. Allocation au prorata du volume consommé, reliquat
conservé dans la source (somme exacte des centimes).

Hypothèse démo annoncée : un contenant ne contient qu'un lot à la fois ; le volume d'un lot = somme de ses occupations.

## Lots
| Lot | Contenu | Statut |
| --- | --- | --- |
| L0 | Initialisation, navigation, schéma, adaptateur IndexedDB, seed, reset | voir HANDOFF / rapport |
| L1 | Assemblage (essai + exécution) → mise → commande/réservation/livraison | |
| L2 | Vignoble (parcelles, missions, observations), récolte (comptages + corrections, transports, réceptions) → lot | |
| L3 | Chai : plan de cave, fiche lot, relevés/analyses, opérations, itinéraires blanc/rouge | |
| L4 | Élevage : transferts avec perte, ouillage, dégustations, blocage/libération qualité | |
| L5 | Achats fournisseurs, réceptions partielles, matières sèches, inventaire, retours clients en quarantaine | |
| L6 | Factures/avoirs/règlements de démo, coûts, pilotage multi-millésimes, prévision de trésorerie, projet 2027 | |
| L7 | Visite guidée, états dégradés, accessibilité, recette navigateur | |

Le statut réel de chaque lot est tenu dans `HANDOFF.md` / le rapport final.
