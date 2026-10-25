# Domaine — ERP démo / nouveau projet

## Ce que contient ce dépôt
Un pack de construction pour démarrer DEPUIS ZÉRO un ERP viticole générique de démonstration. Les fichiers sont des instructions, références métier/UX, données fictives et script de recette ; ils ne sont pas l'application. Aucune app précédente, base héritée ou migration n'est présumée. Aucun domaine client n'est nécessaire pour commencer.

## Démarrage avec Antigravity
1. Créer un dossier local (par exemple `domaine-erp-demo`) OU cloner un nouveau dépôt GitHub dans un dossier local.
2. Décompresser le CONTENU de l'archive à la racine : AGENTS.md, .agents, docs et DEMARRER-ICI.md doivent être directement dans ce dossier, pas sous un sous-dossier d'emballage.
3. Ouvrir ce dossier comme projet dans Antigravity. Les dossiers commençant par un point peuvent être masqués dans l'explorateur de fichiers.
4. Copier le prompt de DEMARRER-ICI.md dans le chat. Il demande explicitement de lire les instructions et de construire l'application, pas d'auditer une app inexistante.
5. L'agent initialise le projet et les dépendances avec les permissions nécessaires. Pas besoin de créer auparavant l'app, un backend, une base ou des comptes externes.

Un dépôt GitHub peut stocker exactement ces fichiers. Le cloner donne accès au contenu ; cela ne garantit pas à lui seul que les instructions seront chargées. La lecture explicite demandée par le prompt évite cette ambiguïté. Pas de push ni déploiement implicites.

## Compatibilité des outils
- Instructions communes : `AGENTS.md` à la racine.
- Skills : `.agents/skills/<nom>/SKILL.md`, dossiers complets avec références et scripts. Cet emplacement est pris en charge dans les documentations Antigravity et Copilot consultées.
- `.github/copilot-instructions.md` est un simple renvoi vers AGENTS.md pour Copilot ; ne pas y maintenir une deuxième copie contradictoire.
- `.github/prompts` contient cinq prompts optionnels pour les sessions VS Code compatibles. Antigravity n'a pas besoin de les exécuter : utiliser DEMARRER-ICI.md. Si un autre outil ne les découvre pas, copier leur corps et joindre les fichiers référencés.
- Aucun modèle ou compte particulier n'est imposé. Choisir le modèle réellement disponible.

## Cible fonctionnelle
Vignoble → récolte → vinification → élevage/assemblage → conditionnement → stocks/achats → commandes/livraisons → finance illustrative et pilotage. Vin blanc et rouge tranquilles. Plusieurs millésimes coexistent : ancien stock, élevage, lot à mettre, récolte en élaboration et projet futur de renouvellement.

Les dates historiques du seed sont fictives pour simuler la vie d'un domaine ; elles ne désignent pas d'anciennes versions du logiciel. L'application elle-même se construit depuis zéro.

## Les 13 skills
| Skill | Mission |
| --- | --- |
| plan-domaine-delivery | Initialisation, stack et développement complet |
| model-vineyard-operations | Origines, missions et règles amont |
| design-field-experience | UX moderne, accessible et métier |
| build-harvest-workflow | Récolte, comptage et réception |
| manage-winemaking | Vinification, opérations et analyses |
| manage-aging-and-blends | Élevage, transferts et assemblages |
| manage-bottling-and-supplies | Matières sèches, mise et habillage |
| manage-sales-and-stock | Commandes, réservations, livraisons et documents démo |
| manage-multiyear-planning | Coûts, capacités et prévisions |
| prepare-domaine-demo | Données fictives et scénario |
| implement-offline-sync | Stockage, file durable et synchronisation éventuelle |
| secure-domaine-access | Limites locales et sécurité avant usage partagé |
| verify-domaine-release | Tests, navigateur et recette |

## Documents métier
PRODUCT.md : périmètre et lots. DOMAIN.md / ERP-MODEL.md : invariants. DESIGN.md : direction artistique et ergonomie. DEMO-SCENARIO.md : visite transverse. QUALITY.md : critères et preuves. SOURCES.md : références et limites. Tous dans docs/domaine.

Premier flux codé : assemblage → mise → réservation/livraison avec historique fictif. Puis construction de l'amont, du chai, des achats et du pilotage. Les lots servent à maîtriser le développement, pas à limiter le produit aux vendanges. Initialiser à la racine en préservant ce pack ; si un générateur refuse un dossier non vide, utiliser une initialisation manuelle ou temporaire sans conflit.

## Validation et limites
Le script suivant est autonome (Python standard) :

```bash
python3 .agents/skills/prepare-domaine-demo/scripts/validate_fixture.py
```

Il vérifie un scénario et un modèle de référence : volumes, filiations, coûts, fournitures, réservations/livraisons, facture/règlement illustratifs, refus et idempotence. Il ne teste PAS l'application que l'agent créera ; porter ces cas dans ses tests unitaires/intégration/E2E.

Pack contrôlé : structure, frontmatters, chemins, cohérence des instructions de démarrage, scénario de référence et archive. Non testé : exécution dans Antigravity/Copilot, génération et fonctionnement d'une application, navigateur ou production.

Démo locale avec données fictives, persistance et règles cohérentes. Pas de télétransmission, comptabilité générale/paie, commande d'automates ou prescription œnologique. Documents commerciaux sans valeur légale, rôles prévisualisés sans prétendre à une authentification réelle. Futur usage réel : adaptation métier, sécurité serveur, droits, sauvegarde/restauration et conformité à valider séparément.
