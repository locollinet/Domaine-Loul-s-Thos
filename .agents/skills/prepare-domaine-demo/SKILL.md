---
name: prepare-domaine-demo
description: Préparer un ERP démo générique avec données fictives persistantes, plusieurs
  millésimes et un scénario vignoble–chai–mise–vente–pilotage. Utiliser pour seed,
  reset, visite ou démonstration avant tout client pilote.
---

# Démontrer la chaîne de valeur complète
Lire [produit](../../../docs/domaine/PRODUCT.md), [scénario](../../../docs/domaine/DEMO-SCENARIO.md), [fixture](./demo-fixture.json) et [validateur](./scripts/validate_fixture.py).

1. Utiliser « Domaine des Trois Coteaux — fictif », sans reprendre un vrai client. La fixture est un petit contrat de recette, pas une base complète ni une migration. Enrichir avec équipes, clients fictifs, fiches, tâches et mesures sans casser ses invariants.
2. Représenter 2023 en bouteilles, 2024 en élevage, 2025 à mettre, 2026 en élaboration et 2027 en projet. Horloge fixe/injectable ; ne pas tout enfermer sous une campagne. Fiche d'un même vin sur deux années ≠ même stock.
3. Importer références et historique une seule fois dans un namespace versionné local ; reset explicite limité à la démo. Contrôler intégrité des relations, quantités et dates. Un nouveau seed ne doit pas effacer les actions en cours sans consentement.
4. Exécuter réellement commandes et recalculs ; les actions de la visite ne sont pas des changements de chiffres codés en dur. Essai d'assemblage sans effet, exécution avec effet, mise atomique, réservation et livraison partielle. Conserver après rechargement.
5. Cartes : liste et schéma illustratif accessibles sans clé. Aucun GPS de test présenté comme point réel. Services externes simulés nommés comme tels ; document financier sans valeur légale.
6. Exécuter le validateur Python et les tests de l'app. Le premier valide les données et le modèle de référence seulement. La qualité de l'app exige ses propres tests et une revue navigateur.

## Sortie
Démo lançable, état multi-millésimes, scénario de 10 minutes, reset sûr et limites explicites. Ne pas exiger adaptation à un domaine particulier avant ce livrable. Une simulation de rôles ne fournit pas une authentification réelle. Ne pas inventer succès de synchronisation, clients déployés, conformité ou gains.
