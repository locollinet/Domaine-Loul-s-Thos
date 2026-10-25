---
name: build-harvest-workflow
description: Implémenter une tranche complète de vendange depuis la mission terrain
  jusqu’au comptage, transport et réception. Utiliser pour coder le cœur opérationnel
  et sa réutilisation sur les travaux annuels.
---

# Livrer un parcours plutôt qu'un catalogue
Lire [produit](../../../docs/domaine/PRODUCT.md), [métier](../../../docs/domaine/DOMAIN.md) et [qualité](../../../docs/domaine/QUALITY.md). Choisir une seule tranche par exécution.

## Tranches disponibles
A. Ouvrir mission → voir consigne/accès → commencer → partiel/bloqué/terminé.
B. Saisir comptage → vérifier unité → persister événement → afficher état local/serveur → corriger avec motif.
C. Préparer transport → conserver ses lignes d'origine → réceptionner → calculer net depuis brut et tare compatibles → rapprocher.
D. Clore journée → isoler données manquantes/en attente → confirmer le bilan → préparer le lendemain.
E. Réutiliser les missions sur relevage ou taille sans copier le module vendanges.

## Procédure
1. Vérifier modèles, endpoints et composants réutilisables. Ne pas créer une seconde source de vérité.
2. Définir commande et résultat, droits, transitions, validations et reprise d'erreur.
3. Implémenter fonction métier, persistance et tests ; puis brancher l'écran. Démo locale : utiliser un adaptateur explicite ; ne pas faire croire à une API réelle.
4. Relier tous les boutons du parcours. Si une action reste hors périmètre, la retirer ou la nommer clairement indisponible ; pas de clic sans effet.
5. Écrire un test E2E du chemin principal et un cas d'échec significatif. Faire vérifier l'état persistant après rechargement.

## Pièges
Ne pas confondre transport terminé et récolte terminée. Ne pas considérer un comptage élevé comme un avancement de rangs. Une pesée nette ne doit pas être ventilée arbitrairement entre plusieurs origines. Si ventilation estimée, conserver règle, auteur et statut estimatif. Un poids révisé ne modifie pas silencieusement un bilan validé.

La vinification et le commerce font partie de l'ERP ; relier réception et lots via les services communs, puis poursuivre les lots spécialisés. Éviter seulement le développement non planifié à l'intérieur d'une commande. La paie et les téléprocédures réelles restent hors démo.

## Livrable
Un scénario réellement navigable, les invariants testés, les données fictives nécessaires et un guide de recette de moins d'une page. Indiquer précisément quel segment du parcours est opérationnel, local seulement ou simulé.
