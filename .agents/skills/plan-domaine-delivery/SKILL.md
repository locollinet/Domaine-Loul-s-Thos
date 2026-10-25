---
name: plan-domaine-delivery
description: Initialiser depuis zéro et construire un ERP viticole de démonstration
  de bout en bout, sans client pilote. Utiliser au démarrage, pour la stack, les lots
  de développement et la continuité multi-millésimes.
---

# Construire le nouveau projet
Lire [AGENTS.md](../../../AGENTS.md), [produit](../../../docs/domaine/PRODUCT.md), [modèle](../../../docs/domaine/ERP-MODEL.md) et [scénario](../../../docs/domaine/DEMO-SCENARIO.md).

1. Partir explicitement d'un projet neuf contenant des documents et skills, pas d'une app à reprendre. Vérifier versions de Node/gestionnaire, permissions, état Git éventuel et accès aux paquets. Ne pas perdre du temps à chercher du code historique.
2. Retenir domaine fictif, périodes et hypothèses du pack sans questionnaire client. Décrire brièvement la stack choisie puis initialiser à la racine sans écraser le cadrage. Si générateur incompatible avec dossier non vide, utiliser temporaire sans conflit ou initialisation manuelle.
3. Base proposée : React, TypeScript strict, Vite, routeur, primitives accessibles, styles cohérents, Vitest/Testing Library et Playwright. Versions stables compatibles réellement vérifiées, lockfile reproductible. Ajouter carte, graphiques ou autres dépendances seulement pour un besoin du lot. Pas de SSR, microservices ou infrastructure distribuée par défaut.
4. Démo locale sans backend obligatoire : services applicatifs, fonctions métier pures, adaptateur IndexedDB transactionnel et seed versionné. Prendre un gestionnaire de dépendances et un modèle de données partagés. Les composants ne modifient pas indépendamment des totaux.
5. Écrire IMPLEMENTATION-PLAN.md en lots L0–L7. Commencer par une colonne vertébrale assemblage → mise → commande/livraison avec historique fictif préchargé ; ensuite construire l'amont, vinification, élevage, achats et pilotage. Aucune réduction de cible au comptage des vendanges.
6. Charger les skills spécialisés au bon moment ; créer les tests en même temps. Pour le mandat complet, vérifier puis poursuivre les lots sans nouvelle permission à chaque écran. Un audit isolé n'est pas le livrable demandé.
7. Si blocage, expliquer ce qui manque et comment le lever ; préserver le travail et écrire HANDOFF.md exact. Ne pas inventer des installations ou tests réussis. Ne pas pousser, déployer ni lancer un service payant sans accord.

## Sortie
Projet initialisé et lançable, plan court, schéma partagé, lots effectivement codés, commandes de test et limites. Réutiliser ensuite les composants créés dans ce dépôt sans supposer un héritage applicatif. Démo locale ≠ sécurité multi-client réelle ; le passage à un usage réel sera un chantier distinct.
