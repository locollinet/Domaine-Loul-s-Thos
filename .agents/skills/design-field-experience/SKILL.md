---
name: design-field-experience
description: Concevoir et coder une interface viticole moderne, accessible et utilisable
  au terrain. Utiliser pour écrans, navigation, formulaires, cartes, design system,
  responsive et amélioration ergonomique.
---

# Concevoir pour la journée de travail
Lire [direction UX](../../../docs/domaine/DESIGN.md) et [produit](../../../docs/domaine/PRODUCT.md). Définir dès le premier lot une direction cohérente, puis conserver les tokens et composants de ce nouveau projet au fil du développement.

1. Décrire le rôle, la décision ou le geste principal, le contexte réseau/appareil et les informations indispensables. Ne pas commencer par une grille de cartes KPI.
2. Proposer une composition concrète : zone principale, navigation, action primaire, secondaire et erreurs. Faire un croquis textuel court si utile ; coder ensuite le parcours demandé.
3. Réutiliser primitives et tokens. Préférer HTML sémantique et composants accessibles éprouvés. Ne pas reconstruire un select, dialogue ou calendrier complexe à partir de divs.
4. Concevoir et implémenter ensemble états normal/vide/erreur/droits/hors ligne/conflit. Ne pas ajouter ces états comme de simples toasts en fin de chantier.
5. Vérifier sur navigateur réel disponible, inspecter captures et console. Corriger avant de conclure.

## Signature visuelle
Fond pierre, encre verte, accent raisin discret, mise en page précise. Carte/liste structurantes ; titres francs, lignes de séparation et tableaux courts quand adaptés. Pas de template SaaS interchangeable, de faux graphiques, de boutons décoratifs ou de dégradés omniprésents. Identité premium obtenue par composition, rythme, densité et qualité des interactions.

## Saisie terrain
Unité visible près du nombre ; clavier numérique adapté ; libellé explicite du bouton ; soumission protégée contre le double clic. Conserver la saisie en cas d'échec. Distinguer « Enregistré sur cet appareil » de « Reçu par le serveur ». Ne pas cacher les saisies en attente dans un menu technique.

Sur desktop, densité utile et actions clavier ; sur mobile, tâches courtes et commandes accessibles au pouce. Filtres, position de liste et zoom conservés si raisonnable. Ne pas rendre la carte obligatoire pour utiliser une mission. Une animation ne doit pas retarder une opération.

## Recette du lot
Tester noms longs, quantité vide/zéro/incorrecte, absence de GPS, aucun résultat, erreur réseau, écran 320 px, zoom 200 %, navigation clavier et retour après dialogue. Donner des preuves visuelles si disponibles, sinon déclarer la vérification manquante. Ne pas revendiquer une certification WCAG à partir d'un audit automatisé.

## Expérience ERP
L'interface couvre aussi chai, analyses, élevage, conditionnement, stocks, commandes et pilotage. Appliquer la section ERP de DESIGN.md. Proposer des compositions métier différentes : plan/table pour le chai, étape contrôlée pour une mise, table de commande, filiation pour la traçabilité, calendrier de disponibilité pour plusieurs millésimes. Ne pas appliquer mécaniquement le même écran de mission à tous les modules.
