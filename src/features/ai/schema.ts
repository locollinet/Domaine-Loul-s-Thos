import { Type, type FunctionDeclaration, type Schema } from '@google/genai';
import { ASSISTANT_TOOL_NAMES, type AssistantToolName } from './types';

export { ASSISTANT_TOOL_NAMES, type AssistantToolName };

/**
 * Declarations of deterministic tools exposed to Gemini via Function Calling.
 * SERVER-ONLY: never import this file from browser runtime code.
 */
export const TOOL_DECLARATIONS: Record<AssistantToolName, FunctionDeclaration> = {
  inspect_vineyard: {
    name: 'inspect_vineyard',
    description:
      'Consulte les parcelles (surfaces m²/ha ou inconnues), missions vendanges/taille/observation, comptages de caisses non transportés, réceptions pesées en kg net (jamais converties en litres) et disponibilité du cahier Phyto & TESA.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Nom ou code de parcelle/climat/mission (optionnel).',
        },
        missionStatus: {
          type: Type.STRING,
          description: 'Filtrer par statut de mission : planned, in_progress, blocked, completed, cancelled.',
        },
        includePendingCounts: {
          type: Type.BOOLEAN,
          description: 'Inclure les comptages de vendange en attente de transport.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Nombre maximum d’éléments détaillés (max 20).',
        },
      },
    },
  },
  inspect_cellar: {
    name: 'inspect_cellar',
    description:
      'Consulte les lots de vin au chai (volumes exacts en L et hL, stades, blocage qualité), les contenants (cuves, foudres, barriques, maintenance, tonnellerie), les relevés analytiques actifs (densité, température, SO2, TAV) et détecte explicitement les absences de mesure sans interpoler.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        lotQuery: {
          type: Type.STRING,
          description: 'Code, nom, millésime ou couleur de lot (ex: "L26-B-01", "Blanc 2026", "2025").',
        },
        containerQuery: {
          type: Type.STRING,
          description: 'Code ou emplacement de contenant (ex: "C-07", "F-01", "barrique").',
        },
        onlyMaintenanceContainers: {
          type: Type.BOOLEAN,
          description: 'Ne lister que les contenants en maintenance.',
        },
        onlyAvailableContainers: {
          type: Type.BOOLEAN,
          description: 'Ne lister que les contenants disponibles et vides.',
        },
        includeMeasurements: {
          type: Type.BOOLEAN,
          description: 'Inclure les séries de relevés analytiques et alertes de trous de mesure.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Plafond d’éléments retournés (max 20).',
        },
      },
    },
  },
  check_aging_and_bottling: {
    name: 'check_aging_and_bottling',
    description:
      'Évalue les lots prêts pour assemblage (simulation pure previewBlend), la faisabilité de mise en bouteilles (matières sèches requises vs stock physique et commandes fournisseurs en attente comme CF-26-H01).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        vintage: {
          type: Type.INTEGER,
          description: 'Millésime ciblé (ex: 2024, 2025).',
        },
        skuQuery: {
          type: Type.STRING,
          description: 'Libellé ou identifiant d’article/cuvée (ex: "Blanc 2024", "Rouge 2025").',
        },
        bottles: {
          type: Type.INTEGER,
          description: 'Nombre de bouteilles envisagé pour vérifier les matières sèches.',
        },
        checkBlend2025: {
          type: Type.BOOLEAN,
          description: 'Simuler l’assemblage des lots Rouge 2025 prêts.',
        },
      },
    },
  },
  check_commercial_stock: {
    name: 'check_commercial_stock',
    description:
      'Consulte les stocks bouteilles avec distinction stricte Physique ≠ Réservé ≠ Bloqué qualité ≠ Quarantaine ≠ Disponible vendable, ainsi que les commandes/devis et expéditions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        batchQuery: {
          type: Type.STRING,
          description: 'Code lot de mise ou cuvée (ex: "M23-001", "Rouge 2023").',
        },
        customerQuery: {
          type: Type.STRING,
          description: 'Nom ou ville d’un client (ex: "Table des Coteaux", "Beaune").',
        },
        orderStatus: {
          type: Type.STRING,
          description: 'Statut de commande : quote, confirmed, partially_shipped, shipped, cancelled.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Plafond d’éléments (max 20).',
        },
      },
    },
  },
  inspect_finance_and_planning: {
    name: 'inspect_finance_and_planning',
    description:
      'Consulte les factures, avoirs, règlements, expéditions non facturées, prévisions de trésorerie par niveau de certitude (certain, engagé, estimé), coûts connus/incomplets des lots et scénario de renouvellement 2027. Réservé aux rôles autorisés.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        certainty: {
          type: Type.STRING,
          description: 'Filtrer les prévisions par certitude : certain, engaged, estimated.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Plafond d’éléments (max 20).',
        },
      },
    },
  },
  search_traceability: {
    name: 'search_traceability',
    description:
      'Retrace la généalogie ascendante/descendante d’un lot ou lot de mise (parcelles d’origine, tickets de pesée, assemblages, matières sèches, expéditions clients) et le journal immuable des opérations.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Code lot, code lot de mise ou mot-clé d’opération (ex: "M23-001", "L26-B-01", "ouillage").',
        },
        opType: {
          type: Type.STRING,
          description: 'Type d’opération : reception, transfer, topping, loss, blend, bottling, quality, note, itinerary.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Plafond d’opérations retournées (max 20).',
        },
      },
    },
  },
  prepare_action: {
    name: 'prepare_action',
    description:
      'Prépare un écran ou formulaire pré-rempli sans jamais écrire en base. Vérifie les permissions du rôle, détecte les doublons ou ruptures de stock, et fournit un lien d’ouverture nécessitant validation humaine.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        actionKind: {
          type: Type.STRING,
          description:
            'Type d’action : prefill_measurement, prefill_order, prefill_bottling, prefill_purchase, prefill_harvest_count, navigate.',
        },
        lotQuery: {
          type: Type.STRING,
          description: 'Lot cible pour relevé ou mise en bouteilles.',
        },
        parameter: {
          type: Type.STRING,
          description: 'Paramètre analytique (density, temperature, sugar, tav, ph, ta, va, free_so2, malic).',
        },
        value: {
          type: Type.NUMBER,
          description: 'Valeur mesurée proposée pour pré-remplissage.',
        },
        batchQuery: {
          type: Type.STRING,
          description: 'Lot de mise pour une commande/devis.',
        },
        customerQuery: {
          type: Type.STRING,
          description: 'Client cible pour une commande/devis.',
        },
        dryGoodQuery: {
          type: Type.STRING,
          description: 'Matière sèche pour une commande fournisseur.',
        },
        quantity: {
          type: Type.INTEGER,
          description: 'Quantité proposée (bouteilles, caisses ou unités).',
        },
        asQuote: {
          type: Type.BOOLEAN,
          description: 'Créer en devis (sans réservation) plutôt qu’en commande ferme.',
        },
        targetTab: {
          type: Type.STRING,
          description: 'Onglet cible pour navigate (overview, vineyard, cellar, aging, bottling, supplies, sales, finance, traceability).',
        },
        subTab: {
          type: Type.STRING,
          description: 'Sous-onglet cible (ex: phyto_tesa, drm, elabel, cellar_map, allocations, harvest, reception).',
        },
      },
      required: ['actionKind'],
    },
  },
};

export function getToolDeclarations(allowedTools: AssistantToolName[]): FunctionDeclaration[] {
  return allowedTools
    .filter((name): name is AssistantToolName => ASSISTANT_TOOL_NAMES.includes(name))
    .map((name) => TOOL_DECLARATIONS[name]);
}

/**
 * Structured final JSON response schema enforced when tool calling completes.
 */
export const ASSISTANT_ANSWER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description:
        'Réponse concise et factuelle en français basée uniquement sur les résultats des outils exécutés.',
    },
    citedIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Liste exacte des identifiants ou codes cités provenant des sorties d’outils.',
    },
    followUps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 à 3 suggestions courtes de questions ou d’actions suivantes pertinentes.',
    },
  },
  required: ['text', 'citedIds', 'followUps'],
};
