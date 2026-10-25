# Démarrer dans Antigravity ou un autre agent de code

Ouvrir le dossier du projet contenant AGENTS.md, .agents/skills et docs/domaine. Coller ce texte dans le chat de l'agent :

```text
Lis AGENTS.md, puis .agents/skills/plan-domaine-delivery/SKILL.md,
docs/domaine/PRODUCT.md et docs/domaine/DEMO-SCENARIO.md.

Je pars DE ZÉRO. Ce dépôt contient les documents et skills de cadrage,
pas une ancienne application. Il n'y a rien à reprendre ni à migrer.
Ne me demande pas de code antérieur, client pilote ou données réelles.

Construis un ERP de démonstration pour le domaine fictif du pack :
vignoble → récolte → vinification → élevage/assemblage → mise en
bouteilles → stocks/achats → commandes/livraisons → pilotage.
Vins tranquilles blancs et rouges, plusieurs millésimes simultanés
et un projet de plantation futur.

Vérifie brièvement les outils, initialise le projet à la racine
sans écraser le cadrage, puis implémente les lots L0–L7.
Démo locale persistante par défaut, sans compte externe obligatoire.
Commence par assemblage → mise → commande/livraison avec historique
fictif préchargé, puis construis les autres modules.

Charge les skills spécialisés selon le lot. Je veux une application
fonctionnelle et reliée, pas une maquette statique. Les commandes
recalculent vraiment les volumes, consommables, stocks, réservations
et filiations ; le tableau de bord reflète le même état.

Soigne la composition visuelle, l'ergonomie desktop et terrain,
l'accessibilité, les erreurs et la clarté des données.
Les documents financiers et services simulés doivent être explicites.

Teste chaque lot, vérifie le navigateur si disponible, puis poursuis
sans demander de confirmation pour chaque écran. Demande un accord
pour une action destructive, un compte/service payant, un secret,
un push GitHub ou un déploiement. Si tu rencontres une limite,
laisse un HANDOFF.md précis. Rapporte livré, testé, simulé et non testé.
```

La présence des skills permet leur découverte lorsque l'outil la prend en charge ; pour une tâche importante, conserver la demande explicite de lire les fichiers. Aucun modèle n'est forcé : sélectionner celui réellement disponible dans l'outil.
