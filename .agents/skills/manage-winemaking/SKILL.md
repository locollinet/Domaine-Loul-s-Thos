---
name: manage-winemaking
description: 'Coder le suivi de vinification des vins tranquilles blancs et rouges
  : lots, contenants, opérations, relevés, analyses, fermentations et décisions humaines.
  Utiliser pour le chai et les modèles d’itinéraires.'
---

# Suivre l'élaboration sans prescrire
Lire [modèle](../../../docs/domaine/ERP-MODEL.md), [métier](../../../docs/domaine/DOMAIN.md) et [UX](../../../docs/domaine/DESIGN.md).

1. Définir lot, contenant, état technique et origine. Ne pas déduire des litres à partir de caisses/kg sans mesure ou hypothèse estimative explicitement saisie. Préserver filiation de réception.
2. Fournir deux itinéraires indicatifs éditables (blanc/rouge), avec étapes facultatives ou parallèles. FML non imposée, fermentation en cuve ou fût possible. Les gabarits ne sont pas une recette œnologique.
3. Écrire commandes pour affectation, relevé, analyse, tâche/opération et transition contrôlée. Journaliser les opérations réalisées ; une tâche planifiée n'a pas encore consommé d'intrant ni déplacé de volume.
4. Paramètre de mesure = valeur + unité + prélèvement + source + lot/contenant. Dates d'analyse et de saisie distinctes. Signaler trou de mesure ou unité incompatible ; ne pas interpoler une valeur comme réelle. Historique d'une correction conservé.
5. Fiche lot avec chronologie, mesures, analyses, observations et prochaines actions. Plan de cave et vue liste/table avec capacité et occupations. Graphique uniquement à partir de mesures du lot réellement présentes.
6. Alertes optionnelles de démo sur seuils explicitement illustratifs, configurables et non prescriptifs ; aucune dose ou température de conduite conseillée par défaut. Pas de contrôle d'automate.

## Tests
Relevé sur mauvais lot/refus ; unité incompatible ; valeur manquante ; date prélèvement différente de saisie ; étape facultative sautée avec motif ; correction auditée ; réception reliée au lot ; opération avec consommable insuffisant refusée atomiquement. Ne pas coder des normes réglementaires universelles sous forme de seuils.

## Livrables
Écrans réellement branchés, commandes, schémas et tests. Distinguer analyses préchargées, saisies manuelles et laboratoire non connecté. Décisions du maître de chai et de l'œnologue restent humaines.
