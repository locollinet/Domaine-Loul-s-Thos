# Invariants métier

## Objets et frontières
- Organization : domaine client. Membership : utilisateur, domaine, rôle et état actif. Campaign : campagne et timezone métier.
- CadastralParcel : référence foncière éventuelle. CulturalUnit : unité de culture. WorkUnit : partie opérationnelle, éventuellement rangs inclus/exclus. AccessPoint : accès validé distinct du centre géométrique. Ne pas assimiler ces objets.
- Mission : campagne, unité de travail, opération, équipe, consignes, fenêtre prévue, statut. Un changement de plan n'efface pas le réalisé.
- Observation : auteur, date, unité, mesure éventuelle, pièces, source et statut de validation.
- HarvestCount : quantité et unité, origine, mission, horodatages et auteur.
- Transport : identification logistique et lignes d'origine. Plusieurs origines possibles sans mélange silencieux.
- Reception : transport, ticket, poids brut/tare/net, unité, destination, contrôle et validation.
- Correction : opération reliée à l'original, motif, droits et précondition de version.

Un lot de récolte, une origine parcellaire, un transport et un lot de vin ne sont pas la même entité. Le produit couvre aussi vinification, élevage, mise, commerce et finance illustrative : appliquer les règles complémentaires d'ERP-MODEL.md dès le schéma initial.

## Quantités
Associer chaque quantité à une unité et à un statut `measured | estimated`. Stocker une précision documentée : entiers en unité minimale ou décimal exact côté serveur ; pas de calcul financier ou de rapprochement fondé sur des flottants non maîtrisés.

Zéro connu ≠ valeur inconnue. Aucun cumul entre kg et caisses. Deux types de caisses distincts ne sont cumulés que si le regroupement a un sens validé. Une tare ne peut pas dépasser le brut ; un net ne peut pas être négatif.

Une estimation de kg par caisse doit être datée, sourcée et paramétrée ; ne pas en faire un poids mesuré. Pourcentages : préciser unité, population, total prévu, reste et données manquantes. Ne pas prendre la moyenne des pourcentages des parcelles comme avancement global sans pondération justifiée.

## Événements fiables
Enveloppe minimale cible : `eventId`, `organizationId`, `campaignId`, `aggregateId`, `type`, `schemaVersion`, `occurredAt`, `recordedAt`, `actorId`, `deviceId`, `idempotencyKey`, `payload`. Distinguer les identifiants et dates fournis par l'app des valeurs d'acteur et de réception dérivées par le serveur. Un identifiant envoyé par le client ne constitue pas une autorisation.

L'autorité serveur valide domaine, appartenance active, rôle, schéma, unité et règles métier avant acceptation. Une même clé d'idempotence, dans son périmètre documenté, renvoie le même résultat ; même clé avec payload différent → conflit explicite. Protéger unicité et effets métier dans une même transaction ou mécanisme équivalent démontré.

Ne pas construire un framework d'event sourcing : journal append-only pour les opérations critiques, projections simples et reconstructibles. Modifications ordinaires de fiches possibles avec audit adapté.

## Corrections
Ne jamais modifier ou supprimer silencieusement un comptage accepté. Cible simple : `CountCorrected` référence l'événement original, conserve avant/après et motif, contrôle sa version, remplace sa contribution dans la projection. Une seule version courante ; les changements concurrents provoquent un conflit. Une correction n'est pas additionnée comme un nouveau comptage. Si le dépôt utilise déjà contre-écriture + remplacement, conserver cette convention et tester l'atomicité ; ne pas mélanger les deux modèles.

## Statuts séparés
Mission : `planned | in_progress | blocked | completed | cancelled`. Clôturer après validation de l'avancement, jamais à partir du seul comptage. Un blocage conserve le réalisé.
Synchronisation : `local_pending | sending | acknowledged | retryable_error | rejected | conflict`.
Validation métier : `draft | submitted | validated | disputed` si le pilote en a besoin. Ne pas ajouter ces statuts partout sans besoin.

## Données géographiques
Conserver source, précision, validation et date. Une position absente reste absente. Séparer lien de navigation approuvé et coordonnées de visualisation. Ne jamais reconstruire un lien officiel du domaine s'il doit être préservé. Vérifier les protocoles des liens externes et refuser les schémas dangereux. Même lieu-dit ou même point GPS ≠ même identité. Une surface incertaine ne donne pas un rendement fiable.

## Temps
Stocker les instants en UTC, présenter dans la timezone configurée du domaine (démo : Europe/Paris). Conserver date métier si elle diffère de l'enregistrement. Tester changement d'heure, saisie tardive et fermeture de campagne. Le serveur ne fait pas confiance à l'horloge de l'appareil pour autoriser une opération.

## Autorité en démo locale
Les règles d'autorité serveur ci-dessus s'appliquent au mode partagé futur. Pour la démo hors service externe, un service applicatif local centralise validation, idempotence et transaction IndexedDB. Toutes les vues utilisent ce service et la même projection. Le local ne prouve pas de sécurité multi-utilisateurs ; ne pas bloquer la démo pour installer un serveur.

## Périmètre ERP
Lire ERP-MODEL.md pour matières sèches, contenants, transformations, commandes, allocations, règlements, retours et coûts. Ne jamais déduire une conformité d'appellation d'un lieu-dit ou d'un pourcentage générique. Les statuts réglementaires de démo restent des informations fictives à valider, pas un moteur juridique.
