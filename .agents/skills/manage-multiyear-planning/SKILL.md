---
name: manage-multiyear-planning
description: Construire le pilotage multi-millésimes, les coûts techniques, capacités,
  engagements et prévisions de trésorerie du domaine. Utiliser pour tableaux de bord,
  budgets, scénarios et projets de renouvellement.
---

# Piloter des temporalités différentes
Lire [modèle](../../../docs/domaine/ERP-MODEL.md), [produit](../../../docs/domaine/PRODUCT.md) et [scénario](../../../docs/domaine/DEMO-SCENARIO.md).

1. Définir chaque indicateur : question, grain, population, unité, date d'effet, source, filtre et traitement des manquants. Définir filtres contextuels (millésime, date de vente, horizon prévu) ; un filtre n'enlève pas silencieusement l'autre millésime d'un stock physique global.
2. Montrer coexistence : ancien stock, vin en élevage, prochain conditionnement, récolte en cours, projet de plantation. Les données 2023–2027 sont des positions/scénarios distincts, pas une tendance statistique inventée.
3. Calculer capacité avec occupations présentes et mouvements prévus séparés. Capacité nominale ≠ capacité libre exploitable ; nettoyage/maintenance ou incompatibilité peuvent limiter. Aucun double comptage d'un lot réparti entre plusieurs contenants.
4. Coûts : source, poste, date, lot et allocation. Allouer coût historique de vin au prorata des quantités consommées avec conservation des centimes ; méthode documentée. Ne pas compter achats de fournitures et consommation deux fois. Coût incomplet signalé ; ne pas convertir inconnu en zéro.
5. Séparer coût technique, valorisation comptable à valider, prix potentiel, marge sur coût connu et profit. Pas de marge réalisée sans méthode explicite de coût des sorties ; coûts clôturés non modifiés silencieusement.
6. Prévision de trésorerie versionnée : factures à recevoir/payer et échéances, règlements acquis, hypothèses de vente et dépenses futures distincts. Jamais présenter prévision comme solde bancaire réel. Projet de renouvellement avec dates, hypothèses, budget et pièces ; pas d'autorisation légale automatique.
7. Visualiser seulement des données calculées. Chaque KPI mène à un détail rapprochable. Préférer calendrier, tableau ou graphe explicatif à des jauges décoratives.

## Tests
Millésime ancien vendu sur exercice récent ; coûts tardifs ; filtre période ; poste manquant ; total des allocations conservé ; prévision modifiée sans altérer réalisé ; acompte/paiement partiel ; bouteille non livrable ; capacité occupée sur plusieurs campagnes. Vérifier mêmes valeurs dans détail et tableau de bord.

## Sortie
Indicateurs utiles, définitions visibles, scénarios datés, détail des hypothèses et tests. Aucune promesse de résultat économique ou certification comptable.
