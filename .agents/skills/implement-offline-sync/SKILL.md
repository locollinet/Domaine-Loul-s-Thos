---
name: implement-offline-sync
description: Concevoir et tester la persistance locale, la PWA et la synchronisation
  hors ligne des saisies de terrain. Utiliser pour IndexedDB, cache, files de commandes,
  reprise réseau, conflits ou données périmées.
---

# Ne jamais confondre cache et synchronisation
Lire [invariants](../../../docs/domaine/DOMAIN.md) et [recette](../../../docs/domaine/QUALITY.md). Déterminer d'abord si le lot demande consultation hors ligne, saisie locale ou synchronisation partagée. Un service worker seul n'offre pas les trois.

## Frontières
- Service worker : shell et assets selon politique de cache ; pas de cache aveugle des réponses privées.
- IndexedDB : projection locale minimale et outbox durable. IndexedDB n'est pas une sauvegarde garantie : le navigateur peut évincer ses données.
- Serveur : autorisation actuelle, validation, idempotence et acceptation.
- Interface : distinguer connecté/déconnecté, fraîcheur, réception serveur et validation métier.

## Algorithme cible
1. Générer eventId et clé d'idempotence une seule fois. Persister saisie et entrée outbox dans une transaction locale avant d'annoncer l'enregistrement local.
2. Afficher l'effet local en attente séparément des données acquittées. Ne pas recompter l'événement lorsqu'il revient du serveur.
3. Au lancement, au retour au premier plan et après succès réseau : tenter l'envoi. `navigator.onLine` est un indice, pas une preuve que l'API répond. Pas de dépendance exclusive à Background Sync, notamment sur mobile.
4. Limiter les envois concurrents, préserver les dépendances, gérer plusieurs onglets avec verrou/lease adapté. Garder la même clé lors d'un retry ; backoff borné et jitter pour erreurs transitoires.
5. Timeout ambigu : demander/réessayer la même opération ; le serveur renvoie le résultat déjà accepté. Idempotence et modification métier doivent être atomiques.
6. Refus permanent ou conflit : conserver la donnée, arrêter les retries aveugles, expliquer et proposer une résolution autorisée. Un token expiré demande réauthentification ; un droit révoqué n'est pas récupéré par retry.
7. Après acquittement, réconcilier une seule contribution. Conserver l'audit utile et suivre la politique de rétention.

## Sécurité locale
Partitionner stockage et files par domaine ET utilisateur. Empêcher lecture des données précédentes après déconnexion/changement de compte ; traiter les saisies non envoyées avant purge, sans les exposer à l'utilisateur suivant. Définir une politique explicite de réauthentification pour appareils partagés. Ne pas promettre effacement distant d'un appareil hors ligne. Ne pas stocker de secrets serveur ni de jetons sensibles dans un cache applicatif improvisé.

## Mise à jour PWA
Ne pas recharger une app au milieu d'une saisie. Définir migrations IndexedDB, compatibilité des événements en attente et reprise après nouvelle version. Précharger uniquement les informations nécessaires à la journée. Les cartes hors ligne demandent droits et stockage adaptés ; ne pas télécharger massivement des tuiles publiques.

## Tests bloquants
Fermeture après saisie, panne entre acceptation serveur et réponse, double onglet, expiration auth, révocation, changement de domaine, conflit de correction, évolution du schéma avec outbox existante et échec de quota. Tester les vrais navigateurs des pilotes. Documenter ce qui est absent du simulateur ou non testé.
