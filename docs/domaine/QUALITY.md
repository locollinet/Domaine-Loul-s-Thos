# Qualité — matrice minimale

## Preuves attendues par couche
1. Domaine : fonctions pures testées sur quantités, transitions, corrections et regroupements.
2. Persistance : tests d'intégration sur contraintes, atomicité et concurrence ; pas uniquement mocks.
3. Sécurité : tests directs de l'API ou des règles du datastore, y compris lectures, listes, exports et pièces jointes.
4. Parcours : tests navigateur sur la tranche livrée, états dégradés et rôles.
5. Terrain : essais manuels sur appareils pilotes, réseau dégradé, reprise et lisibilité réelle.

## Matrice des cas
| Cas | Résultat attendu |
| --- | --- |
| 8 caisses puis 4, même type et périmètre | 12 caisses ; aucun poids inventé |
| Réenvoyer le même événement | Toujours 12, pas 16 ni 24 |
| Même clé, payload différent | Conflit ; pas d'acceptation silencieuse |
| Corriger le second comptage 4 → 3 | 11 ; original et motif retrouvables |
| Deux corrections concurrentes du même événement | Une acceptée et une en conflit, sans écrasement |
| 12 caisses et une pesée indépendante | Deux mesures distinctes ; écart en kg seulement si base comparable explicite |
| Poids brut 250 kg, tare 30 kg | Net 220 kg ; mesure fictive pour test |
| Tare supérieure au brut | Refus avec message métier |
| Position absente | Fiche consultable, pas de pin inventé |
| Même nom, propriétaires différents | Deux unités distinctes |
| Récolte partielle puis reprise | Réalisé conservé ; mission non clôturée prématurément |
| Transport multi-origines | Lignes et quantités d'origine conservées |
| Saisie hors ligne puis fermeture de l'app | File conservée ; pas de perte au redémarrage |
| Réponse serveur perdue après acceptation | Retry avec même clé ; un seul effet |
| Accès révoqué pendant une période hors ligne | Refus au serveur ; données locales en attente conservées avec accès protégé |
| Changement d'utilisateur ou de domaine | Aucun mélange de cache, file ou données sensibles |
| Utilisateur domaine B demande un ID de A | Lecture/écriture/listing/export refusés |
| Campagne clôturée avant remontée d'une saisie | Rejet ou réouverture autorisée selon règle explicite ; pas de mutation silencieuse |
| Import répété / mauvais format / données manquantes | Prévisualisation et erreurs ; pas de mutation partielle cachée |
| Restauration de sauvegarde | Quantités et historique rapprochés sur environnement isolé |

## Commandes
Détecter gestionnaire, scripts et versions dans le dépôt ; utiliser son lockfile. Si projet neuf, créer des scripts documentés `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build` correspondant à de vraies commandes. Ne jamais créer un script de test qui retourne le succès sans exécuter de test. Documenter émulateurs, variables et services nécessaires.

CI cible : installation reproductible, lint, types, tests unitaires/intégration, build ; E2E dans un job séparé si nécessaire, sans clé de production. Vérifier que les échecs font réellement échouer le job ; pas de `continue-on-error` masquant les contrôles critiques. Ne pas déployer automatiquement en production avec ce pack.

## Porte de sortie
DEMO : données fictives et statut local explicites, navigation et persistance testées.
PILOTE PARTAGÉ : backend et auth réels, isolation testée, file/recette appareils, restauration testée, support et secours définis.
PRODUCTION : validation du client, exploitation et incidents, restauration, engagements et responsabilités contractualisés. Le présent pack n'accorde aucune certification.

Rapport : modifications / commandes exécutées et résultats / scénarios navigateur vus / tests non exécutés / risques ouverts / prochaine tranche. Distinguer test ajouté de test exécuté.

## recette ERP complète
Une démo locale de bout en bout n'exige pas les prérequis du pilote partagé. Ne pas bloquer le développement en attendant un domaine réel. En revanche, une démo de trois écrans de vendanges n'est plus le produit demandé.

| Cas ERP | Résultat attendu |
| --- | --- |
| Même lot réparti dans plusieurs contenants | Volumes et somme du lot conservés, identité distincte |
| Transfert avec perte | Source, destination, perte et capacité rapprochés |
| Assemblage de lots | Entrées débitées une fois, lot enfant et filiation créés |
| Essai d'assemblage | Aucun stock réel consommé tant que non exécuté |
| Mise sans assez de bouchons | Aucun vin ni aucune fourniture consommés |
| Mise exécutée puis retry | Un seul lot de mise et une seule consommation |
| Lot bloqué | Physique conservé ; réservation/livraison selon règle, pas d'expédition illégitime |
| Commande et livraison partielle | Physique, réservation résiduelle, disponible et reliquat cohérents |
| Facturation de livraison existante | Pas de second déstockage |
| Avoir sans retour physique | Stock inchangé |
| Rechargement après commande | État identique et persistant |
| Changer filtre année de vente | Stock d'autres millésimes toujours retrouvable |
| Corriger un lot déjà mis/livré | Blocage ou correction explicite des dépendances ; pas d'édition silencieuse |
| Recherche traçabilité depuis livraison | Mise, sources et origines retrouvées |
| Coûts partiels | Marge non calculable ou explicitement partielle, pas faussement nulle |
| Document commercial démo | Mention sans valeur comptable/réglementaire visible |

Exécuter aussi les cas du fixture ERP : `python3 .agents/skills/prepare-domaine-demo/scripts/validate_fixture.py`. Ce script vérifie le scénario et quelques cas négatifs avec un modèle de référence, pas le code de l'app. Porter ces cas dans Vitest/intégration/E2E puis les exécuter sur l'implémentation réelle.
