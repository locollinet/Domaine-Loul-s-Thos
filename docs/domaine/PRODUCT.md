# Produit — ERP générique de démonstration

## Point de départ
Projet neuf. Le dépôt contient le cadrage et les skills uniquement ; aucune application, stack, base de données ou implémentation antérieure n'est présumée. Initialiser et coder le produit dans ce dépôt. Ne pas prévoir de reprise ou de migration d'un ancien logiciel. Les millésimes historiques ci-dessous sont des données fictives à créer pour le scénario.

## Objectif
Construire avant toute personnalisation un ERP cohérent pour « Domaine des Trois Coteaux — fictif ». Vins tranquilles blancs et rouges, production française, plusieurs cuvées et millésimes, vente B2B et commandes simples de particuliers. La démo doit illustrer l'essentiel de la chaîne de valeur d'un domaine-type, pas prétendre couvrir toutes les pratiques de la filière.

Aucun client réel, validation d'œnologue, service externe ou connexion comptable n'est requis pour démarrer la démo. La validation métier humaine et la sécurité d'exploitation deviennent des prérequis AVANT un usage réel, pas avant une démonstration fictive.

## Périmètre à coder
| Module | Fonctions démontrables |
| --- | --- |
| Domaine & patrimoine | Parcellaire, cépages, dates de plantation, accès, historique et projet de renouvellement |
| Travaux & récolte | Missions, équipes, observations, maturité saisie, comptages, transports, réceptions |
| Vinification | Lots, plan de cave, affectations, relevés, analyses saisies, opérations, tâches et statuts |
| Élevage & assemblage | Occupation, transferts, ouillage, pertes explicites, dégustations, essais et assemblages réalisés |
| Conditionnement | Ordre de mise, besoins en matières sèches, contrôles, production et lots de mise |
| Stocks & achats | Vin en cours, vrac, bouteilles, matières sèches ; approvisionnements simples, réception fournisseur et inventaire |
| Commerce | Clients fictifs, tarifs, devis/commandes, réservations, livraison et retour contrôlé |
| Finance de démo | Facture illustrative, avoir, échéance, règlement ; coûts connus et prévisions séparées |
| Pilotage | Lots multi-millésimes, stocks, engagements, capacités, coûts et calendrier de disponibilité |
| Qualité & traçabilité | Blocage/libération, généalogie amont/aval, incidents, pièces et historique |

## Parcours centraux
1. Origine → réception → lot → contenant → relevé/opération → disponibilité.
2. Lots sources → assemblage → lot résultant → mise → stock de bouteilles.
3. Commande → réservation → livraison → facture démo → règlement.
4. Bouteille/client livré → lot de mise → lots sources → origines, et recherche inverse.
5. Lecture simultanée des récoltes récentes, vins en élevage, produits vendables et plantations futures.

## Développement progressif, cible complète
L0 : vérifier les outils disponibles puis initialiser le projet neuf, sa stack, ses scripts, sa navigation, ses schémas partagés, son adaptateur local et son seed cohérent. Aucune phase d’audit de reprise.
L1 : première colonne vertébrale assemblage → mise → commande/livraison, avec lots d'origine préchargés et historique explicite. Tester conservation et idempotence immédiatement. Cette tranche rend rapidement visible la différence entre ERP et application de vendanges.
L2 : créer les fonctions de vignoble, travaux, récolte et réception, puis les relier aux lots du même moteur métier.
L3 : suivi blanc/rouge, relevés, analyses, opérations et plan de cave.
L4 : élevage, transferts, contenants, dégustations, essais/assemblages et blocages qualité.
L5 : achats/réceptions, matières sèches, conditionnement enrichi, inventaire et retours.
L6 : devis, documents financiers de démo, règlements et pilotage pluriannuel.
L7 : visite complète, états dégradés, accessibilité et recette.

L1 inclut un moteur minimal partagé de lots/mouvements ; L3–L5 l'enrichissent sans dupliquer les règles. Lors d'une demande globale, poursuivre les lots dans le mandat et la capacité disponibles ; si interruption technique, laisser HANDOFF.md précis plutôt que déclarer le produit terminé. Ne pas construire 30 écrans vides avant de relier le premier flux.

## Hypothèses de démo
Organisation unique, EUR, fuseau Europe/Paris, coûts de démonstration non comptables, prix HT avec TVA explicitement fictive paramétrée. Pas d'obligation de facturation réelle. Plusieurs rôles prévisualisables ; authentification réelle facultative tant qu'aucune donnée sensible/partagée. Horloge injectable et date de démonstration fixe.
Blanc et rouge ont des modèles d'itinéraires éditables ; ni fermentation malolactique ni ordre assemblage/élevage ne sont universellement obligatoires. Historique préchargé ≠ chaque étape déjà codée.

## Limites de la démo
Pas de certification ni télétransmission réglementaire effective, paie ou comptabilité générale complète, commande d'automates, diagnostic/conseil œnologique autonome. Pas d'effervescents, spiritueux, gestion coopérative ou groupe multi-entités dans la première démo. Prévoir les points d'extension sans les implémenter tous.

## Adaptation ultérieure
Paramétrer vocabulaire, unités, rôles, itinéraires, documents, règles et intégrations. Ne pas copier le produit par client. Lors du passage au réel : audit des droits et données, validations métier/réglementaires, serveur, sauvegarde/restauration, reprise et support.
