---
name: manage-bottling-and-supplies
description: Coder achats/réceptions de matières sèches, ordre de mise, conditionnement,
  habillage et création de lots de bouteilles. Utiliser pour le passage du vin en
  vrac au stock commercial.
---

# Produire un stock commercial justifié
Lire [modèle](../../../docs/domaine/ERP-MODEL.md), [scénario](../../../docs/domaine/DEMO-SCENARIO.md) et [qualité](../../../docs/domaine/QUALITY.md).

1. Créer nomenclature de démo : format, bouteille, fermeture, étiquette et carton. Montrer prérequis et manquants avant validation. Une commande fournisseur ne crée pas de physique ; gérer réception partielle et reste à recevoir.
2. Préparer ordre : lots sources, quantités, format, nombre prévu, date, matériel/prestataire fictif et contrôles. Distinguer préparation et réalisation.
3. Valider atomiquement disponibilité de vin, blocages, fournitures, lieux et lots ; consommer les entrées, créer lot(s) de mise et sorties, affecter coûts et historique. Si un prérequis échoue, aucune mutation partielle.
4. Fixture : 500 L consommés = 660 × 0,75 L + 5 L de pertes ; 660 unités de bouteilles/bouchons/étiquettes et 110 cartons de six. N'afficher aucune formule de perte réglementaire présumée. Les fournitures sont de la démo, pas une recommandation de conditionnement.
5. Tiré-bouché et habillé sont distincts lorsque le parcours les utilise ; habiller ne recrée pas de bouteilles pleines. La mise minimale du fixture produit directement l'état habillé et consomme toute sa nomenclature.
6. Conserver lot fournisseur d'emballage si disponible, lot de vin, date et lot de mise ; relier les expéditions ultérieures pour recherche aval.

## Tests
Bouchons insuffisants : rien n'est consommé ; retry identique : une mise ; volume perdu inexpliqué : refus ; changement de format : recalcul explicite ; casse/échantillon : sortie distincte ; correction après vente : procédure contrôlée. Fournitures restantes après fixture : 340 bouteilles, 340 bouchons, 340 étiquettes, 90 cartons.

## Sortie
Parcours complet préparation → contrôle → exécution → bilan, stock mis à jour et tests. Aucune étiquette ou attestation prétendument conforme ; documents et mentions de démo explicites.
