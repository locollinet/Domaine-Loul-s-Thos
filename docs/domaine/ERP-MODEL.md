# Modèle ERP — conventions minimales

## Objets
WineLot : identité, organisation, origine(s), année(s) d'origine, statut technique, catégorie/mentions déclarées, unité, qualité et filiation. Cuvée : identité commerciale stable, indépendante des millésimes. Container : équipement identifié, capacité et état ; Occupancy : lot, contenant, volume, intervalle. Un lot peut être réparti, un contenant réutilisé dans le temps. La démo peut limiter un contenant à un lot simultanément, en annonçant cette hypothèse.
Operation : ordre préparé, exécuté, annulé ou corrigé, avec entrées/sorties, consommables, temps, pièces et auteur. BottlingBatch : événement de mise identifié ; SKU : cuvée, millésime/mention, volume nominal et présentation. StockPosition : article/lot, lieu, propriétaire et état. DryGoodsLot : fourniture, référence, quantité, unité, lot fournisseur si connu. CustomerOrder, Reservation, Shipment, DemoInvoice, CreditNote et Payment sont distincts.

## Registre et transactions
Journal de mouvements append-only pour flux critiques ; référentiels modifiables avec audit. Pas de framework d'event sourcing obligatoire. Commandes atomiques avec clé d'idempotence : valider tous les prérequis, puis écrire source(s), destination(s), filiation, coût et projection ensemble. Une erreur ne doit consommer ni vin ni emballage. Un retry ne refait pas l'opération.
Corrections : référence et motif, contre-opération ou remplacement versionné, une seule convention par type. Si une opération a des descendants (mise livrée, lot assemblé), interdire l'édition destructive et proposer une correction contrôlée. Pas de stock négatif silencieux, même pour faire fonctionner la démo.

## Identités et chronologie
Campagne ≠ année de récolte ≠ année d'opération ≠ exercice de coût/comptabilité ≠ année de vente. Ne pas enfermer toute l'app sous un filtre de campagne. Les liens interannuels restent actifs et les mouvements traversent les exercices sans recréer le lot. Même nom de cuvée sur 2024 et 2025 ≠ même stock.
Un vin peut avoir plusieurs origines/années dans un modèle général ; la démo utilise des assemblages intramillésime pour ses vins tranquilles. Une revendication de millésime/AOP ne se déduit pas automatiquement d'une généalogie. Garder provenance et mention légale distinctes.

## Mesures et conservation
Stocker volumes en mL entiers pour la démo, masses en g, fournitures et bouteilles en unités entières, monnaie en centimes. Afficher L/hL et kg avec conversions explicites. Pour capacités ou analyses, utiliser précision et unités adaptées ; ne pas convertir mg/L en g/hL sans formule testée. Kg de raisin vers L de vin : mesure/production explicite, jamais facteur automatique présenté comme réel.
Transfert : source − volume déplacé − perte documentée ; destination + volume déplacé. Une perte ne doit pas être déduite deux fois. Ouillage : source diminue, contenant cible augmente, capacité respectée ; aucune création de volume. Assemblage : les entrées sont consommées, la sortie reprend leur filiation et leurs coûts selon la méthode ; division et fusion testées.
Mise : volume consommé = bouteilles × volume nominal + pertes déclarées (+ autres sorties explicites si présentes). Contrôler quantités et capacités avant validation. Casse et échantillons sont des sorties identifiées, pas des ventes.

## Itinéraires et suivi œnologique
Gabarits blanc et rouge, modifiables par lot, pas des recettes prescriptives. Blanc indicatif : réception → pressurage → clarification/débourbage selon méthode → fermentation → élevage/préparation. Rouge indicatif : réception → préparation variable des raisins → macération/fermentation → écoulage/pressurage → élevage. Opérations facultatives ou parallèles autorisées et datées. FML selon choix et suivi, sans obligation artificielle.
Relevé : paramètre, valeur, unité, date du prélèvement, lot/contenant, source, appareil/laboratoire éventuel, validation. Dégustation : observations humaines. Analyse corrigée garde historique. Tout seuil d'alerte est contextualisé, paramétré, versionné et explicitement non prescriptif dans la démo. Aucune dose par défaut ni action automatique sur un équipement.

## Qualité et conditionnement
Séparer état technique, quantité physique, blocage qualité et commercialisation. Un lot bloqué reste physiquement présent, mais non livrable selon le périmètre du blocage. Un descendant potentiellement concerné est signalé ; un test de traçabilité peut le retrouver. Libération enregistrée par rôle autorisé (simulé en local).
Ordre de mise : lot(s), volume, format, nombre prévu, nomenclature des emballages, stocks requis, contrôle et destination. Consommer vrac et fournitures dans une même transaction. Tiré-bouché (bouteilles non habillées) et habillé sont deux états ; un habillage consomme les bonnes fournitures sans créer du vin. Le scénario minimal fournit des bouteilles habillées directement, avec nomenclature complète.
Achats : commande fournisseur ≠ réception ≠ facture ≠ paiement. Réception partielle et solde à recevoir ; pas de stock physique créé à la commande.

## Commerce et retours
Physique ≠ réservé ≠ bloqué ≠ disponible. Définir les réservations éligibles et ne pas soustraire deux fois les mêmes unités lorsque blocage et réservation se chevauchent. Allouer par lot pour la démo. Réserver contre disponibilité vendable, jamais contre un futur volume sans le qualifier comme engagement prévisionnel séparé.
Livraison partielle : diminue physique ET reliquat réservé correspondant ; reste de commande non livré conservé. Facturer ne déstocke pas une deuxième fois. Avoir ne réintègre pas physiquement ; retour contrôlé réintègre éventuellement dans un statut de quarantaine. Définir une limite de crédit/restitution liée à la livraison et aux retours déjà enregistrés.

## Coûts, revenus, trésorerie
Conserver les coûts connus par lot, poste, source et date ; signaler les coûts absents. Méthode démo : allocations proportionnelles au volume consommé pour les flux de vin, avec précision interne et règle de répartition des centimes conservant le total. Ajouter coût de mise/emballages sans le compter à nouveau si déjà affecté. Les achats de fournitures ne sont pas tous une charge du lot avant consommation.
Prix de vente, coût technique, valorisation comptable et valeur potentielle de vente sont distincts. Pas de bénéfice « réalisé » à partir des prix catalogue. Méthode de coût sortie/inventaire à définir avant calcul de marge réalisée. Afficher la méthode et les coûts manquants, ne pas recalculer silencieusement un coût historique clôturé.
Factures et avoirs fictifs avec HT/TVA/TTC en centimes, arrondi documenté ; règlements liés, soldes et échéances. Réservation, livraison, facture et paiement ont des effets distincts. Prévision de trésorerie = scénario daté séparant certain, engagé et estimé ; aucun relevé bancaire simulé présenté comme connexion réelle.
