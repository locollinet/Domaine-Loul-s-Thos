---
name: model-vineyard-operations
description: Modéliser parcelles, missions, comptages, transports, réceptions et corrections
  viticoles. Utiliser dès qu’une fonction touche aux quantités, identités, statuts,
  rendements ou règles métier.
---

# Protéger le sens des données
Lire [invariants](../../../docs/domaine/DOMAIN.md) avant de créer le schéma initial partagé. Ne pas supposer qu'un ancien modèle existe.

1. Dessiner le flux d'une seule opération en entrée → validation → persistance → projection. Nommer source, domaine, campagne, unité et acteur.
2. Séparer entités de référence, commandes, événements acceptés et vues calculées. Ne pas exposer un datastore brut à tous les composants.
3. Définir les schémas d'entrée et les erreurs métier typées. Valider aux frontières client et serveur, avec serveur autoritaire.
4. Écrire d'abord les tests d'invariants du lot, puis des fonctions métier pures. Utiliser des types discriminés et des unités explicites ; ne pas masquer l'incertitude dans un `number` optionnel universel.
5. Introduire uniquement les objets nécessaires au lot. Éviter une entité générique avec 40 champs optionnels.

## Cas à traiter
Identité parcellaire distincte du nom, du point GPS et du propriétaire. Plusieurs passages et équipes sur une unité. Travail partiel et interruption. Annulation d'une mission sans effacer le réalisé. Correction traçable avec contrôle de version. Agrégat calculé sur événements acceptés, avec local en attente séparé.

Choisir une convention de correction conformément à DOMAIN.md. Deux corrections concurrentes ne doivent pas se cumuler ni s'écraser. Un formulaire « éditer quantité » doit produire cette opération, pas mettre à jour silencieusement l'original.

## Exemple de recette
Créer 8 puis 4 caisses d'un même type. Réenvoyer le second événement sans effet supplémentaire. Corriger 4 en 3 : résultat 11. Conserver l'original, le motif et l'auteur. Aucun kilogramme n'apparaît sans mesure ou estimation explicite distincte. Une autre mission à 12 caisses ne doit pas être incluse dans ce cumul.

## Livrables
Types/schémas, fonctions de domaine, tests des invariants, exemples de payload fictifs, et note courte de convention. Créer un schéma initial et un seed reproductible. Les évolutions ultérieures du schéma de CE projet doivent préserver ses données de test ; aucune reprise d'une application antérieure n'est demandée.

## Modèle ERP partagé
Lire [modèle ERP](../../../docs/domaine/ERP-MODEL.md) avant tout schéma partagé. Ce skill traite surtout l'amont ; ne pas réduire l'ERP à son périmètre. Introduire dès le socle les identités lot, contenant, cuvée, mise et article, puis implémenter les règles détaillées dans les skills spécialisés. Les validations serveur visent le mode partagé ; l'adaptateur local centralise les mêmes invariants en démo. Ne pas bloquer le seed pour attendre une API réelle.
