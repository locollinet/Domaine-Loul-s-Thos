---
name: manage-aging-and-blends
description: Implémenter élevage, occupation des contenants, transferts, pertes, ouillages
  et assemblages avec filiation et conservation des volumes. Utiliser pour mouvements
  de chai, essais ou assemblages réalisés.
---

# Conserver les volumes et l'histoire
Lire [modèle ERP](../../../docs/domaine/ERP-MODEL.md) et [scénario](../../../docs/domaine/DEMO-SCENARIO.md).

1. Définir entrée(s), sortie(s), contenant(s), volumes en mL, date et motif. Vérifier disponibilité, capacité, qualité et chronologie avant mutation. Agrégats lot et occupation doivent se rapprocher.
2. Transfert partiel : débiter source, créditer destination et tracer perte séparément. Ouillage : consommer le vin d'une source explicite ; conserver filiation et capacité. Un changement de contenant n'est pas nécessairement un nouveau lot ; une transformation/fusion peut l'être.
3. Essai d'assemblage : simulation sans stock consommé. Exécution : commande atomique produisant lot enfant, liens pondérés sur entrées réelles et allocations de coût. Ne jamais fusionner les sources en effaçant leur identité.
4. Assemblage du fixture : 300 L du lot A, 200 L de B → 500 L enfant ; reliquats 300 L et 200 L. Les millésimes et mentions sont conservés sans certification automatique d'appellation.
5. Élevage : journal de dégustations/opérations, calendrier, contenant, date prévue de disponibilité et qualité. Conserver ancienne prévision et motif d'évolution si utile ; prévu ≠ produit vendable.
6. Propager la traçabilité amont/aval à travers division, fusion et mise. Correction d'une source déjà transformée : interdire réécriture aveugle, proposer correction contrôlée ou blocage des descendants selon règle.

## Tests
Surcapacité, volume négatif, source insuffisante, auto-transfert invalide, ouillage sans source, essai sans effet, retry sans duplication, assemblage cyclique refusé, trace de chaque origine après division/fusion, perte non comptée deux fois, coût total conservé. Vérifier plusieurs millésimes simultanément.

## Livrables
Services métier partagés, vues plan/table/chronologie, prévisualisation et confirmation utile selon risque, tests et filiation navigable. Ne pas imposer partout un assemblage avant ou après élevage.
