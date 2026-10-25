# Direction UX — précision terrain, calme visuel

## Parti pris
Donner l'impression d'un outil de travail premium, pas d'un tableau de bord SaaS générique ni d'un site de château. La carte, la mission et les quantités structurent l'interface. Une couleur accent ne remplace pas une composition.

Palette proposée, à contrôler en contraste : fond pierre clair #F6F5F0, encre #172820, vert forêt #235443, accent raisin #694456, ocre pour vigilance. Surfaces sobres, bordures fines ; pas de gradient violet/bleu, de glassmorphism ou d'empilement de cartes décoratives. Utiliser une police système soignée par défaut ; pas de dépendance réseau nécessaire pour lire l'interface. Typographie tabulaire pour les quantités. Photos seulement pour aider à reconnaître un accès ou une zone.

## Hiérarchie
- Aujourd'hui : une journée datée, une action principale, les prochaines missions et les exceptions ; pas une rangée de KPI vides.
- Parcelles : carte et liste synchronisées ; liste utilisable sans carte. Recherche tolérante aux accents, filtres utiles, résultat sélectionné visible.
- Mission : nom lisible, secteur, équipe, consigne, accès, état ; action principale dans la zone du pouce.
- Saisie : unité toujours visible, grand pavé numérique, récapitulatif avant soumission si risque, retour explicite local/serveur.
- Réception : le rapprochement et les écarts passent avant les graphiques.
- Bilan : dénominateurs, fraîcheur et saisies en attente visibles près des chiffres.

## Terrain et accessibilité
Viser WCAG 2.2 AA : contraste texte normal ≥ 4,5:1, grand texte ≥ 3:1, composants/focus pertinents ≥ 3:1. Ne pas encoder un statut seulement par couleur. Cibles terrain de préférence ≥ 48 × 48 px, espacement suffisant ; texte courant mobile 16 px minimum pour les tâches essentielles. Pas d'informations nécessaires au seul survol.

Clavier complet, focus visible et restauré après dialogue ; noms accessibles, erreurs associées aux champs, annonces sobres pour résultat de saisie. Respecter `prefers-reduced-motion`. Ne pas voler le focus lors d'une synchronisation. Tester à 200 % de zoom et en largeur mobile ; éviter le scroll horizontal global.

Navigation mobile courte, barres compatibles safe areas et clavier virtuel. Ne pas masquer une erreur sous un toast fugitif. Préserver les entrées après erreur ; prévenir les doubles soumissions ; rendre explicites les actions destructives. Confirmer selon le risque, pas chaque clic.

## États à dessiner avant le parcours idéal
Vide sans données ; aucun résultat ; chargement ; erreur récupérable ; données périmées ; permission refusée ; hors ligne ; synchronisation en attente ; conflit ; validation refusée. Ne pas afficher un skeleton indéfiniment. Ne pas remplacer un écran déjà lisible par un chargement plein écran pendant un rafraîchissement.

## Performance et pragmatisme
Objectifs de conception, à mesurer et non à promettre : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 sur appareil/réseau représentatifs. Le labo n'est pas une mesure terrain. Charger les cartes et médias à la demande ; dimensionner les images ; éviter d'embarquer une grosse bibliothèque pour un simple tableau. Virtualiser seulement si la mesure le justifie.

Animations courtes et utiles (environ 120–180 ms), sans retarder une saisie. Mode sombre seulement après validation du mode clair ; priorité à la lisibilité au soleil. Ne pas construire un panneau complet de personnalisation pour la démo.

## Recette visuelle
Capturer et examiner réellement les vues à 390 × 844 et 1440 × 900, plus un écran étroit 320 px. Tester clavier et zoom, erreur de saisie, mission avec nom long, beaucoup de missions, et quantité élevée. Documenter ce qui a été vu et sur quel navigateur. Si aucun navigateur disponible, ne pas dire « ergonomie validée ».

## ERP — expérience de bout en bout
Navigation desktop : Vue d'ensemble / Vignoble / Récolte / Chai / Conditionnement / Stocks & achats / Ventes / Pilotage. Réunir sous-pages et vues par métier ; ne pas imposer 12 entrées au terrain. Mobile : Ma journée / Saisir / Rechercher / Plus, avec accès contextuel au lot ou à la commande.

Vue d'ensemble : millésimes coexistants, lots à surveiller, mises et livraisons proches, disponibilité matières ; chaque chiffre mène à sa source. Filtres contextuels, portées visibles, pas d'année globale qui masque les vins anciens. Une recherche transversale retrouve parcelle, cuvée, contenant, lot et client sans fusionner leurs identités.

Chai : plan de cave simple + table alternative ; occupation, volume et état qualité. Fiche lot : identité, contenu actuel, opérations, analyses, dégustations, coûts connus et filiation. Afficher chronologie et tableau de mesures ; graphique réel seulement avec mesures cohérentes. Pas d'illustration aléatoire de fermentation.
Conditionnement : préparation → contrôles → validation et bilan de consommation. Commerce : commande, réservation, livraison et règlement lisibles séparément. Traçabilité : amont/aval, quantités et dates ; arbre/diagramme simple, plus liste accessible, sans animation gadget.
Pilotage : capacités, stocks par stade/millésime, engagements et coûts ; distinguer prévu/réalisé et données incomplètes. Expliquer les écarts ; pas de pourcentage décoratif ou de « santé du domaine » inventé. Style premium sobre commun aux modules, densité adaptée aux tâches.
