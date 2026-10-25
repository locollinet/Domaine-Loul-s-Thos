---
name: verify-domaine-release
description: Tester les fonctionnalités de Domaine, auditer sécurité et UX et décider
  si une version est démo ou pilote. Utiliser après chaque tranche, avant une démonstration,
  une PR ou une livraison.
---

# Exiger une preuve proportionnée au risque
Lire [matrice](../../../docs/domaine/QUALITY.md) et [UX](../../../docs/domaine/DESIGN.md). Examiner le diff et relier chaque exigence à une preuve.

1. Détecter scripts/lockfile et services nécessaires. Exécuter lint, types, tests et build disponibles. Pour commandes manquantes, les signaler ou les créer si le lot l'autorise ; ne pas inventer un succès.
2. Tester fonctions pures avec valeurs limites ; persistance avec infrastructure de test réelle ; auth et droits via la frontière effective. Un mock d'API ne prouve pas l'isolation des domaines.
3. Couvrir en E2E le parcours livré. Préférer sélecteurs sémantiques, état de test déterministe, horloge contrôlée et identifiants stables. Attendre une condition observable, pas des délais arbitraires.
4. Examiner navigateur, console, réseau et captures sur mobile et desktop ; vérifier le fonctionnement, pas seulement l'apparence. Consulter les rapports d'accessibilité et compléter manuellement clavier/focus/zoom.
5. Pour sync et migrations, exécuter les scénarios de panne pertinents. Ne pas marquer hors ligne testé à partir du seul mode réseau désactivé après chargement.
6. Corriger d'abord perte de données, fuite inter-domaines et calcul faux ; puis blocages UX, erreurs et régressions ; puis finitions. Ne pas masquer une alerte pour obtenir du vert.

## CI et sécurité du dépôt
Proposer workflow reproductible à partir des vraies commandes et de versions supportées. Permissions GitHub minimales. Ne pas donner de secrets aux contributions non fiables ni utiliser `pull_request_target` pour exécuter leur code avec secrets. Ne pas désactiver les contrôles pour contourner une difficulté. Aucun déploiement production implicite.

## Rapport obligatoire
- Périmètre réellement vérifié et environnement.
- Commandes exécutées avec résultat, sans faux logs.
- Cas métier, sécurité et navigateur couverts.
- Non exécuté : raison, conséquence et procédure restante.
- Bloquants P0 (sécurité/perte/calcul), P1 (parcours cassé), P2 (amélioration).
- Verdict : démo locale / pilote bloqué / pilote éligible sous conditions documentées. Ne pas attribuer une certification ou un SLO garanti.

Un contrôle statique de ce pack ne constitue pas une exécution de Copilot ou une validation de l'application. Si le navigateur n'est pas disponible, le dire et fournir la recette restante.

## Recette ERP
Une démo locale peut être livrée sans backend si clairement étiquetée et sans données sensibles ; ne pas confondre cela avec un pilote partagé. Vérifier le parcours complet de DEMO-SCENARIO.md et les cas ERP de QUALITY.md. Lancer le validateur du fixture puis porter ses cas dans les tests de l'app : le validateur de référence ne teste pas l'app. Ne pas déclarer la cible livrée si les modules aval sont des placeholders.
