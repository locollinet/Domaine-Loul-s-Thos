---
name: manage-sales-and-stock
description: Relier stock, qualité, commandes, réservations, livraisons, retours,
  factures illustratives et règlements dans l’ERP démo. Utiliser pour gestion commerciale
  et disponibilité sans double déstockage.
---

# Séparer chaque effet de gestion
Lire [modèle](../../../docs/domaine/ERP-MODEL.md) et [scénario](../../../docs/domaine/DEMO-SCENARIO.md).

1. Identifier SKU et lot de mise ; plusieurs millésimes/formats restent distincts. Garder lieux, quantités physiques, réservées et bloquées. Calculer disponibilité sans double soustraction d'une même unité.
2. Devis sans mutation de stock. Commande confirmée avec réservation selon politique explicite, par lot dans la démo. Contrôler qualité et disponible. Réservation future distincte si ajoutée, jamais mélangée au stock présent.
3. Livraison partielle : écrire shipment, diminuer physique et réservation consommée ; conserver reste à livrer. Idempotence et transaction sur tous les effets. Facturer une livraison n'enlève plus de bouteilles.
4. Retour physique ≠ avoir financier. Un retour peut aller en quarantaine, il ne devient pas vendable automatiquement. Avoir plafonné et relié au document concerné, sans remise en stock implicite.
5. Facturation de démonstration, marquée sans valeur comptable/réglementaire. EUR, centimes, HT/TVA/TTC et arrondi testé ; pas de connexion à une plateforme de facturation. Règlements et échéances séparés des documents et du stock. Un paiement ne crée pas une vente.
6. Fixture : réserver 120 sur 660, livrer 72 → physique 588, réservé 48, disponible 540 sur ce lot. Facture démo de 72 × 20 € HT, TVA fictive 20 %, total 1 728 € TTC, paiement 1 000 €, solde 728 €. Les 36 bouteilles 2023 ne sont pas comprises dans ces positions.

## Tests
Deux commandes en concurrence, quantité indisponible, blocage qualité, livraison partielle, retry, facture sans déstockage, avoir sans retour, retour supérieur au livré déjà retourné, formats distincts, rechargement et coût manquant. Vérifier rôles de prévisualisation sans promettre auth réelle.

## Sortie
Liste clients/commandes, détail avec états séparés, disponibilité navigable, preuve de livraison fictive et document commercial de démo. Tous les montants dérivés des lignes et de la même projection, aucun KPI hardcodé.
