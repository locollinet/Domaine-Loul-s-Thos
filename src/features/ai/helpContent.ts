import { executeAssistantTool, availableTools } from './tools';
import type {
  AssistantFinalAnswer,
  AssistantScope,
  AssistantTabId,
  AssistantToolContext,
  AssistantToolName,
  ResultCard,
} from './types';

export interface HelpArticle {
  id: string;
  title: string;
  keywords: string[];
  summary: string;
  targetTab: AssistantTabId;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'help-kg-vs-litres',
    title: 'Vendanges (kg) vs Volumes de vin (L / hL)',
    keywords: ['vendange', 'kg', 'litre', 'hl', 'poids', 'rendement', 'reception'],
    summary:
      'Les poids de raisin (kg net) et les volumes de vin encuvés (L ou hL) sont deux grandeurs mesurées indépendamment : aucun volume n’est jamais estimé depuis les kg.',
    targetTab: 'vineyard',
  },
  {
    id: 'help-missing-measurements',
    title: 'Trous de relevés analytiques & corrections',
    keywords: ['releve', 'mesure', 'densite', 'temperature', 'manquant', 'fermentation', 'so2'],
    summary:
      'Une absence de relevé (ex: L26-R-01 depuis le 17/10) est signalée explicitement comme un trou de mesure sans interpolation. Les corrections conservent la mesure d’origine.',
    targetTab: 'cellar',
  },
  {
    id: 'help-bottling-drygoods',
    title: 'Faisabilité mise en bouteilles & matières sèches',
    keywords: ['mise', 'bouteille', 'etiquette', 'bouchon', 'carton', 'matiere', 'commande'],
    summary:
      'Avant toute mise, le stock exact de matières sèches (BOM) est vérifié : si un article manque (ex: Étiquette blanc 2024 à 0), la mise est bloquée sans consommer de vin.',
    targetTab: 'bottling',
  },
  {
    id: 'help-stock-distinction',
    title: 'Stock physique ≠ Réservé ≠ Bloqué ≠ Quarantaine ≠ Vendable',
    keywords: ['stock', 'vendable', 'reserve', 'bloque', 'quarantaine', 'livrer', 'commande'],
    summary:
      'Le disponible vendable correspond aux bouteilles physiquement libérées moins les réservations actives. Les lots bloqués qualité ou en quarantaine retour ne sont pas vendables.',
    targetTab: 'sales',
  },
  {
    id: 'help-drm-douanes',
    title: 'DRM Mensuelle Douanes (CIEL) en hL',
    keywords: ['drm', 'douane', 'ciel', 'crd', 'capsule', 'stock juillet'],
    summary:
      'La déclaration récapitulative mensuelle (DRM) agrège les stocks et sorties en hectolitres (hL) par appellation dans Pilotage & Finance > DRM Douanes.',
    targetTab: 'finance',
  },
  {
    id: 'help-phyto-tesa',
    title: 'Registre Phytosanitaire 2027/2028 & TESA',
    keywords: ['phyto', 'traitement', 'cuivre', 'soufre', 'dar', 'znt', 'tesa', 'saisonnier'],
    summary:
      'Le registre phytosanitaire numérique (cuivre métal kg/ha, DAR, ZNT) et le suivi TESA vendangeurs sont disponibles dans Vignoble & Récolte > Phyto & TESA.',
    targetTab: 'vineyard',
  },
  {
    id: 'help-unknown-not-zero',
    title: 'Inconnu ≠ Zéro (surfaces, coûts, prévisions)',
    keywords: ['cout', 'surface', 'inconnu', 'budget', 'prevision', 'certain', 'estime'],
    summary:
      'Une surface en cours d’arpentage (TB) ou un coût incomplet n’est jamais assimilé à zéro. Les prévisions distinguent toujours Certain, Engagé et Estimé.',
    targetTab: 'finance',
  },
  {
    id: 'help-role-permissions',
    title: 'Périmètre des droits & protection des coûts',
    keywords: ['role', 'droit', 'cout', 'prix', 'acces', 'permission'],
    summary:
      'Seuls les profils Direction et Gestion / Comptabilité consultent les coûts de revient, factures et prévisions financières. Les autres rôles ont ces champs masqués automatiquement.',
    targetTab: 'overview',
  },
];

export function searchHelpArticles(query: string): HelpArticle[] {
  const q = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return [];
  return HELP_ARTICLES.filter((article) => {
    const haystack = `${article.title} ${article.summary} ${article.keywords.join(' ')}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return tokens.some((tok) => haystack.includes(tok));
  }).slice(0, 3);
}

export function getContextualSuggestions(scope: AssistantScope): string[] {
  const { activeTab, role, canSeeFinance, enabledMainModules } = scope;

  if (activeTab === 'vineyard' && enabledMainModules.vineyard) {
    return [
      'Quelles caisses de vendanges attendent encore le transport ?',
      'Quelles parcelles ont une surface inconnue ?',
      'Où en sont les missions de vendanges et observations ?',
    ];
  }

  if (activeTab === 'cellar' && enabledMainModules.cellar) {
    return [
      'Fais un bilan des volumes de vin actuellement au chai.',
      'Où en est la cinétique de fermentation du Blanc 2026 ?',
      'Le Rouge 2026 a-t-il des relevés manquants ?',
    ];
  }

  if (activeTab === 'aging' && enabledMainModules.aging) {
    return [
      'Quels lots sont prêts pour l’assemblage 2025 ?',
      'Quelles cuves ou barriques sont disponibles ou en maintenance ?',
      'Quel est l’état du Blanc 2024 en barriques ?',
    ];
  }

  if (activeTab === 'bottling' && enabledMainModules.bottling) {
    return [
      'Pouvons-nous mettre en bouteilles le Blanc 2024 aujourd’hui ?',
      'Combien de bouteilles puis-je livrer immédiatement ?',
      'Préparer un réapprovisionnement en étiquettes blanc 2024',
    ];
  }

  if (activeTab === 'supplies' && enabledMainModules.supplies) {
    return [
      'Quelles matières sèches sont en alerte ou en rupture ?',
      'Y a-t-il une commande fournisseur en cours pour les étiquettes ?',
      'Préparer un réapprovisionnement en matières sèches',
    ];
  }

  if (activeTab === 'sales' && enabledMainModules.sales) {
    return [
      'Combien de bouteilles puis-je livrer immédiatement ?',
      'Préparer une commande de 12 bouteilles pour Table des Coteaux',
      'Quelles commandes ou devis sont en attente ?',
    ];
  }

  if (activeTab === 'finance' && canSeeFinance && enabledMainModules.finance) {
    return [
      'Quel est l’état de la trésorerie par niveau de certitude ?',
      'Quels sont les coûts connus vs incomplets des lots ?',
      'Résume le scénario de renouvellement parcellaire 2027.',
    ];
  }

  if (activeTab === 'traceability' && enabledMainModules.traceability) {
    return [
      'Retrace l’origine complète du lot de mise M23-001.',
      'Quelles sont les dernières opérations consignées au chai ?',
      'D’où provient le lot Blanc 2026 L26-B-01 ?',
    ];
  }

  if (role === 'vineyard_manager') {
    return [
      'Quelles caisses de vendanges attendent encore le transport ?',
      'Quelles parcelles ont une surface inconnue ?',
      'Où en sont les missions de vendanges ?',
    ];
  }

  if (role === 'sales') {
    return [
      'Combien de bouteilles puis-je livrer immédiatement ?',
      'Quelles commandes ou devis sont en cours ?',
      'Préparer une commande de 12 bouteilles pour Table des Coteaux',
    ];
  }

  if (role === 'accounting' && canSeeFinance) {
    return [
      'Quel est l’état de la trésorerie par niveau de certitude ?',
      'Quelles commandes fournisseurs sont ouvertes ?',
      'Combien de bouteilles puis-je livrer immédiatement ?',
    ];
  }

  return [
    'Fais un bilan des volumes de vin actuellement au chai.',
    'Quels lots sont prêts pour l’assemblage 2025 ?',
    'Où en est la cinétique de fermentation du Blanc 2026 ?',
    'Combien de bouteilles puis-je livrer immédiatement ?',
  ];
}

export function getStepDescription(toolName: AssistantToolName): string {
  switch (toolName) {
    case 'inspect_vineyard':
      return 'Consultation du vignoble, des missions et des pesées…';
    case 'inspect_cellar':
      return 'Analyse des cuves, fûts, volumes et relevés…';
    case 'check_aging_and_bottling':
      return 'Vérification des lots prêts, assemblages et matières sèches…';
    case 'check_commercial_stock':
      return 'Contrôle des stocks vendables, réservations et commandes…';
    case 'inspect_finance_and_planning':
      return 'Consolidation trésorerie, coûts connus et facturation…';
    case 'search_traceability':
      return 'Reconstitution de la filiation et du journal immuable…';
    case 'prepare_action':
      return 'Contrôle des droits, doublons et préparation du formulaire…';
  }
}

/**
 * Deterministic local/offline fallback executing authorized TypeScript tools
 * directly in the browser without calling Gemini or any remote endpoint.
 */
export function runOfflineDeterministicFallback(
  question: string,
  ctx: AssistantToolContext
): { answer: AssistantFinalAnswer; cards: ResultCard[] } {
  const q = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const allowed = availableTools(ctx);

  const selectedTools: Array<{ name: AssistantToolName; args: Record<string, unknown> }> = [];

  if (q.includes('preparer') || q.includes('pre-remplir') || q.includes('creer')) {
    if (q.includes('commande') || q.includes('devis')) {
      selectedTools.push({
        name: 'prepare_action',
        args: { actionKind: 'prefill_order', quantity: 12, customerQuery: 'Table des Coteaux' },
      });
    } else if (q.includes('releve') || q.includes('densite')) {
      selectedTools.push({
        name: 'prepare_action',
        args: { actionKind: 'prefill_measurement', parameter: 'density' },
      });
    } else if (q.includes('reappro') || q.includes('etiquette') || q.includes('fournisseur')) {
      selectedTools.push({
        name: 'prepare_action',
        args: { actionKind: 'prefill_purchase', dryGoodQuery: 'Étiquette blanc 2024' },
      });
    }
  }

  if (q.includes('parcelle') || q.includes('vendange') || q.includes('caisse') || q.includes('phyto') || q.includes('surface')) {
    selectedTools.push({ name: 'inspect_vineyard', args: { includePendingCounts: true } });
  }
  if (q.includes('assemblage') || q.includes('mise') || q.includes('etiquette') || q.includes('blanc 2024')) {
    selectedTools.push({
      name: 'check_aging_and_bottling',
      args: {
        checkBlend2025: q.includes('2025') || q.includes('assemblage'),
        skuQuery: q.includes('2024') ? 'Blanc 2024' : undefined,
      },
    });
  }
  if (q.includes('bouteille') || q.includes('livrer') || q.includes('vendable') || q.includes('commande') || q.includes('client') || q.includes('stock')) {
    selectedTools.push({ name: 'check_commercial_stock', args: {} });
  }
  if (q.includes('cout') || q.includes('tresorerie') || q.includes('finance') || q.includes('facture') || q.includes('budget') || q.includes('2027')) {
    selectedTools.push({ name: 'inspect_finance_and_planning', args: {} });
  }
  if (q.includes('origine') || q.includes('filiation') || q.includes('tracabilite') || q.includes('m23')) {
    selectedTools.push({ name: 'search_traceability', args: { query: q.includes('m23') ? 'M23-001' : undefined } });
  }
  if (
    selectedTools.length === 0 ||
    q.includes('chai') ||
    q.includes('cuve') ||
    q.includes('fermentation') ||
    q.includes('releve') ||
    q.includes('maintenance') ||
    q.includes('blanc 2026') ||
    q.includes('rouge 2026')
  ) {
    if (allowed.includes('inspect_cellar')) {
      selectedTools.push({ name: 'inspect_cellar', args: { includeMeasurements: true } });
    } else if (allowed[0] && selectedTools.length === 0) {
      selectedTools.push({ name: allowed[0], args: {} });
    }
  }

  const cards: ResultCard[] = [];
  const usedTools: AssistantToolName[] = [];
  const citedIds = new Set<string>();
  const summaryLines: string[] = [];

  for (const req of selectedTools.slice(0, 2)) {
    const res = executeAssistantTool(ctx, req.name, req.args);
    usedTools.push(req.name);
    cards.push(...res.cards);
    res.knownIds.slice(0, 8).forEach((id) => citedIds.add(id));

    if (res.output['error']) {
      summaryLines.push(String(res.output['error']));
    } else {
      for (const card of res.cards) {
        const metricsText = (card.metrics ?? [])
          .map((m) => `${m.label} : ${m.value}`)
          .join(' · ');
        summaryLines.push(`• ${card.title}${metricsText ? ` (${metricsText})` : ''}`);
        if (card.warning) {
          summaryLines.push(`  ⚠ ${card.warning}`);
        }
      }
    }
  }

  const helpHits = searchHelpArticles(question);
  if (helpHits[0]) {
    summaryLines.push(`• Repère métier : ${helpHits[0].summary}`);
  }

  return {
    answer: {
      text:
        summaryLines.length > 0
          ? `Mode local déterministe (sans appel Gemini) — synthèse directe des données du domaine :\n\n${summaryLines.join('\n')}`
          : 'Mode local déterministe actif : consultez les suggestions contextuelles ci-dessous.',
      citedIds: [...citedIds],
      followUps: getContextualSuggestions(ctx).slice(0, 3),
      usedTools,
    },
    cards,
  };
}
