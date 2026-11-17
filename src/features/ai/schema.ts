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
      'Parcelles (surfaces connues ou null), missions vendanges, caisses non transportées, réceptions en kg net (jamais converties en L) et module Phyto/TESA.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Nom ou code parcelle/climat/mission.',
        },
        missionStatus: {
          type: Type.STRING,
          description: 'planned, in_progress, blocked, completed, cancelled.',
        },
        includePendingCounts: {
          type: Type.BOOLEAN,
          description: 'Inclure comptages en attente de transport.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Plafond résultats (max 20).',
        },
      },
    },
  },
  inspect_cellar: {
    name: 'inspect_cellar',
    description:
      'Lots au chai (volumes L/hL, stades, qualité), contenants (cuves, foudres, barriques, maintenance), dernières mesures et trous de relevés sans interpolation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        lotQuery: {
          type: Type.STRING,
          description: 'Code, nom, millésime ou couleur (ex: "L26-B-01", "Blanc 2026").',
        },
        containerQuery: {
          type: Type.STRING,
          description: 'Code ou emplacement (ex: "C-07", "F-01").',
        },
        onlyMaintenanceContainers: {
          type: Type.BOOLEAN,
          description: 'Uniquement les contenants en maintenance.',
        },
        onlyAvailableContainers: {
          type: Type.BOOLEAN,
          description: 'Uniquement les contenants vides disponibles.',
        },
        includeMeasurements: {
          type: Type.BOOLEAN,
          description: 'Mettre à true uniquement pour la série chronologique complète des relevés.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Plafond résultats (max 20).',
        },
      },
    },
  },
  check_aging_and_bottling: {
    name: 'check_aging_and_bottling',
    description:
      'Lots prêts pour assemblage (simulation previewBlend), faisabilité de mise (matières sèches requises vs stock et commandes ouvertes comme CF-26-H01).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        vintage: {
          type: Type.INTEGER,
          description: 'Millésime (ex: 2024, 2025).',
        },
        skuQuery: {
          type: Type.STRING,
          description: 'Libellé/cuvée (ex: "Blanc 2024").',
        },
        bottles: {
          type: Type.INTEGER,
          description: 'Nombre de bouteilles à tester.',
        },
        checkBlend2025: {
          type: Type.BOOLEAN,
          description: 'Simuler assemblage Rouge 2025.',
        },
      },
    },
  },
  check_commercial_stock: {
    name: 'check_commercial_stock',
    description:
      'Stocks bouteilles (Physique ≠ Réservé ≠ Bloqué ≠ Quarantaine ≠ Disponible vendable), commandes, devis et expéditions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        batchQuery: {
          type: Type.STRING,
          description: 'Code lot de mise ou cuvée (ex: "M23-001").',
        },
        customerQuery: {
          type: Type.STRING,
          description: 'Nom ou ville client.',
        },
        orderStatus: {
          type: Type.STRING,
          description: 'quote, confirmed, partially_shipped, shipped, cancelled.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Plafond résultats (max 20).',
        },
      },
    },
  },
  inspect_finance_and_planning: {
    name: 'inspect_finance_and_planning',
    description:
      'Factures, règlements, prévisions par certitude (certain, engaged, estimated), coûts connus/incomplets et scénario 2027 (rôles autorisés uniquement).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        certainty: {
          type: Type.STRING,
          description: 'certain, engaged, estimated.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Plafond résultats (max 20).',
        },
      },
    },
  },
  search_traceability: {
    name: 'search_traceability',
    description:
      'Généalogie amont/aval d’un lot ou lot de mise (parcelles, pesées, assemblages, expéditions) et journal d’audit.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Code lot, mise ou mot-clé (ex: "M23-001", "L26-B-01").',
        },
        opType: {
          type: Type.STRING,
          description: 'reception, transfer, topping, loss, blend, bottling, quality, note, itinerary.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Plafond opérations (max 20).',
        },
      },
    },
  },
  prepare_action: {
    name: 'prepare_action',
    description:
      'Prépare un écran/formulaire pré-rempli sans écrire en base (vérifie droits, doublons, stock) pour validation humaine.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        actionKind: {
          type: Type.STRING,
          description:
            'prefill_measurement, prefill_order, prefill_bottling, prefill_purchase, prefill_harvest_count, navigate.',
        },
        lotQuery: {
          type: Type.STRING,
          description: 'Lot cible.',
        },
        parameter: {
          type: Type.STRING,
          description: 'density, temperature, sugar, tav, ph, ta, va, free_so2, malic.',
        },
        value: {
          type: Type.NUMBER,
          description: 'Valeur mesurée.',
        },
        batchQuery: {
          type: Type.STRING,
          description: 'Lot de mise pour commande/devis.',
        },
        customerQuery: {
          type: Type.STRING,
          description: 'Client cible.',
        },
        dryGoodQuery: {
          type: Type.STRING,
          description: 'Matière sèche.',
        },
        quantity: {
          type: Type.INTEGER,
          description: 'Quantité.',
        },
        asQuote: {
          type: Type.BOOLEAN,
          description: 'Créer en devis sans réservation.',
        },
        targetTab: {
          type: Type.STRING,
          description: 'overview, vineyard, cellar, aging, bottling, supplies, sales, finance, traceability.',
        },
        subTab: {
          type: Type.STRING,
          description: 'phyto_tesa, drm, elabel, cellar_map, allocations, harvest, reception.',
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
