---
name: secure-domaine-access
description: Sécuriser authentification, rôles, isolation par domaine, API, fichiers
  et exports. Utiliser pour tout backend, données partagées, règles Firebase/SQL,
  invitation ou passage vers un pilote réel.
---

# Vérifier l'autorisation à chaque frontière
Lire [invariants](../../../docs/domaine/DOMAIN.md) et [qualité](../../../docs/domaine/QUALITY.md). Inspecter la stack réellement présente ; ne pas mélanger des exemples Firebase et SQL comme s'ils étaient interchangeables.

1. Établir une matrice minimale des rôles : chef d'équipe (missions affectées et saisies permises), responsable (planification/validation), réception (réceptions autorisées), direction (consultation permise), administrateur (configuration). Affiner les droits selon besoin ; pas de rôle admin par défaut.
2. Déduire l'identité d'une session validée ; charger l'appartenance active au domaine. Un organizationId transmis par le client ne prouve jamais l'accès.
3. Contrôler lectures directes, listes, agrégats, souscriptions, mutations, téléchargement de pièces et exports. Éviter les fuites par noms, compteurs et recherche.
4. Faire valider côté serveur les opérations critiques : idempotence, unités, version, campagne ouverte, rôle et parentés d'objets du même domaine.
5. Tester deux domaines et deux utilisateurs réels de test. Tenter accès par identifiant deviné, requête sans filtre, changement de payload et écriture directe au datastore.

## Selon backend
Firebase : règles en refus par défaut et émulateurs ; sécuriser aussi Storage. Les SDK Admin contournent les règles : vérifier explicitement les droits dans fonctions/endpoints privilégiés. Ne pas exposer de clé de service. Les paramètres publics d'un SDK ne doivent pas être pris pour une politique d'accès.
SQL : migrations versionnées, contraintes, index et transactions ; RLS si exposé au client. Une clé de service ne doit pas être livrée au navigateur. Les voies privilégiées font leur propre contrôle d'autorisation.

## Web et données
Limiter les payloads et fichiers ; vérifier type réel et taille, autoriser les formats utiles, servir les pièces avec contrôle d'accès. Prévenir XSS, injection, CSRF selon mode de session, formules dans exports CSV et URLs dangereuses. Ne pas journaliser tokens, données sensibles ou contenus complets inutilement. Utiliser variables d'environnement documentées et `.env.example` sans secret.

Les liens d'invitation sont limités, révocables et associés au bon domaine. Tester retrait de rôle et session encore ouverte. Pas de géolocalisation continue par défaut. Minimiser les données salariés ; la conformité RGPD et les durées exactes demandent validation par le responsable.

## Sortie
Matrice des droits implémentés, contrôles automatisés exécutés, risques restants. Bloquer l'étiquette « pilote partagé prêt » si l'isolation ou la restauration ne sont pas démontrées. Ne pas toucher à la production pendant une revue.

## Démo locale et rôles
Un mode local fictif sans backend est autorisé et doit être livré sans attendre un pilote. Sélecteur de rôle = simulation explicite. Ajouter maître de chai (opérations), qualité (blocage/libération), conditionnement, stock, commercial et finance à la matrice lorsque ces modules sont branchés. Démontrer séparation des tâches en UX sans prétendre à une sécurité réelle. Auth serveur, autorisation effective et isolation restent bloquantes uniquement avant l'usage partagé/réel.
