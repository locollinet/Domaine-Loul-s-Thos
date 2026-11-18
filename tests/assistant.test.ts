import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { ThinkingLevel, type Content } from '@google/genai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCopilotRouter,
  extractStreamingReadableText,
  FALLBACK_MODEL,
  MAX_CALLS_PER_QUESTION,
  PRIMARY_MODEL,
  resetQuestionTurnTrackerForTests,
  setCopilotClientFactoryForTests,
} from '../server/copilot';
import type { RoleId } from '../src/domain/types';
import {
  askAssistant,
  MAX_TOOL_ROUNDS,
  trimHistorySafely,
} from '../src/features/ai/client';
import {
  runOfflineDeterministicFallback,
  getContextualSuggestions,
} from '../src/features/ai/helpContent';
import {
  buildAssistantScope,
  canRoleSeeCosts,
  canRoleSeeFinance,
  SENSITIVE_COST_KEYS,
} from '../src/features/ai/permissions';
import { availableTools, executeAssistantTool } from '../src/features/ai/tools';
import {
  ASSISTANT_TOOL_NAMES,
  type AssistantTabId,
  type AssistantToolContext,
  type CopilotContent,
} from '../src/features/ai/types';
import { PRESET_CONFIGS } from '../src/features/modules/ModuleConfigContext';
import { createSeedState } from '../src/seed/seed';

interface GoldenCase {
  id: string;
  role: RoleId;
  activeTab: AssistantTabId;
  question: string;
  expectedTool: string | null;
  expectation: string;
}

function makeCtx(
  role: RoleId,
  activeTab: AssistantTabId = 'overview',
  preset: 'full_prestige' | 'harvest_field' = 'full_prestige'
): AssistantToolContext {
  const cfg = PRESET_CONFIGS[preset];
  return {
    state: createSeedState(),
    ...buildAssistantScope(role, activeTab, cfg.enabledMainModules, cfg.enabledAddons),
  };
}

async function withCopilotTestServer<T>(
  run: (baseUrl: string) => Promise<T>
): Promise<T> {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/copilot', createCopilotRouter());

  const server = await new Promise<Server>((resolveServer) => {
    const s = app.listen(0, '127.0.0.1', () => resolveServer(s));
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    server.close();
    throw new Error('Failed to bind test server address');
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
}

describe('Copilote IA Domaine (Outils Déterministes, Non-fuite & Boucle Multi-tours)', () => {
  beforeEach(() => {
    setCopilotClientFactoryForTests(null);
    resetQuestionTurnTrackerForTests();
  });

  afterEach(() => {
    setCopilotClientFactoryForTests(null);
    resetQuestionTurnTrackerForTests();
    vi.restoreAllMocks();
  });

  it('valide golden.json (24 scénarios, rôles, onglets et outils reconnus)', () => {
    const raw = readFileSync(resolve(process.cwd(), 'tests/assistant/golden.json'), 'utf-8');
    const scenarios = JSON.parse(raw) as GoldenCase[];
    const validRoles: RoleId[] = ['direction', 'cellar_master', 'vineyard_manager', 'sales', 'accounting'];

    expect(scenarios.length).toBeGreaterThanOrEqual(24);
    for (const sc of scenarios) {
      expect(validRoles).toContain(sc.role);
      if (sc.expectedTool !== null) {
        expect(ASSISTANT_TOOL_NAMES).toContain(sc.expectedTool);
      }
    }
  });

  it('garantit la non-fuite totale de coûts pour les rôles restreints (cellar_master, vineyard_manager, sales)', () => {
    const restrictedRoles: RoleId[] = ['cellar_master', 'vineyard_manager', 'sales'];
    const sensitiveKeyPatterns = [...SENSITIVE_COST_KEYS];

    for (const role of restrictedRoles) {
      expect(canRoleSeeCosts(role)).toBe(false);
      expect(canRoleSeeFinance(role)).toBe(false);
      const ctx = makeCtx(role);
      ctx.state.lots['lot-2025-a']!.cost.knownCents = 987654;
      ctx.state.dryGoods['bottle-750']!.unitCostCents = 456789;
      ctx.state.forecast['fc-s-2']!.amountCents = 765432;
      const allowed = availableTools(ctx);

      expect(allowed).not.toContain('inspect_finance_and_planning');

      for (const toolName of allowed) {
        const result = executeAssistantTool(ctx, toolName, {});
        const serialized = JSON.stringify({ output: result.output, cards: result.cards });
        for (const key of sensitiveKeyPatterns) {
          expect(serialized).not.toContain(`"${key}":`);
        }
        expect(serialized).not.toContain('987654');
        expect(serialized).not.toContain('456789');
        expect(serialized).not.toContain('765432');
      }

      // Also verify offline deterministic fallback respects cost isolation
      const offline = runOfflineDeterministicFallback('Quels sont les coûts et finances ?', ctx);
      const offlineSerialized = JSON.stringify(offline);
      expect(offlineSerialized).not.toContain('987654');
      expect(offlineSerialized).not.toContain('456789');
      expect(offlineSerialized).not.toContain('765432');
    }

    // Direction and accounting must have full access
    for (const privRole of ['direction', 'accounting'] as RoleId[]) {
      expect(canRoleSeeCosts(privRole)).toBe(true);
      expect(canRoleSeeFinance(privRole)).toBe(true);
      const ctx = makeCtx(privRole);
      expect(availableTools(ctx)).toContain('inspect_finance_and_planning');
      const fin = executeAssistantTool(ctx, 'inspect_finance_and_planning', {});
      expect(fin.output['totalOpenBalanceCents']).toBe(0);
      expect(Array.isArray(fin.output['lotCosts'])).toBe(true);
    }
  });

  it('adapte les outils et suggestions aux Modules à la carte (preset harvest_field)', () => {
    const ctx = makeCtx('direction', 'vineyard', 'harvest_field');
    const allowed = availableTools(ctx);

    expect(allowed).toContain('inspect_vineyard');
    expect(allowed).toContain('search_traceability');
    expect(allowed).not.toContain('inspect_cellar');
    expect(allowed).not.toContain('check_aging_and_bottling');
    expect(allowed).not.toContain('check_commercial_stock');
    expect(allowed).not.toContain('inspect_finance_and_planning');

    const denied = executeAssistantTool(ctx, 'inspect_cellar', {});
    expect(denied.output['error']).toMatch(/non autorisé/i);
  });

  it('calcule exactement les volumes chai, détecte les trous de mesure sans interpoler et respecte kg ≠ L et inconnu ≠ 0', () => {
    const ctx = makeCtx('cellar_master', 'cellar');

    const cellar = executeAssistantTool(ctx, 'inspect_cellar', { includeMeasurements: true });
    expect(cellar.output['totalVolumeLitres']).toBe(1530);
    expect(cellar.output['totalVolumeHl']).toBe(15.3);
    expect(cellar.output['occupiedContainersCount']).toBe(6);
    expect(cellar.output['maintenanceContainersCount']).toBe(1);

    const lots = cellar.output['lots'] as Array<Record<string, unknown>>;
    const red26 = lots.find((l) => l['code'] === 'L26-R-01');
    expect(red26?.['daysSinceLastReading']).toBe(7);
    expect(String(red26?.['measurementGapAlert'])).toContain('2026-10-17');

    const vineyard = executeAssistantTool(ctx, 'inspect_vineyard', { includePendingCounts: true });
    expect(vineyard.output['pendingCountsTotalCrates']).toBe(12);
    expect(vineyard.output['unknownAreaParcelsCount']).toBe(1);
    const parcels = vineyard.output['parcels'] as Array<Record<string, unknown>>;
    const tb = parcels.find((p) => p['code'] === 'TB');
    expect(tb?.['areaM2']).toBeNull();
  });

  it('évalue faisabilité de mise Blanc 2024, stock vendable M23-001 et détection de doublons prepare_action', () => {
    const cellarCtx = makeCtx('cellar_master', 'bottling');
    const bottling = executeAssistantTool(cellarCtx, 'check_aging_and_bottling', {
      vintage: 2024,
      skuQuery: 'Blanc 2024',
      bottles: 120,
      checkBlend2025: true,
    });
    const checks = bottling.output['bottlingChecks'] as Array<Record<string, unknown>>;
    expect(checks[0]?.['feasible']).toBe(false);
    const missing = checks[0]?.['missingDryGoods'] as Array<Record<string, unknown>>;
    expect(missing[0]?.['dryGoodId']).toBe('label-2024-white');
    const openPos = checks[0]?.['openPurchaseOrdersForMissing'] as Array<Record<string, unknown>>;
    expect(openPos[0]?.['code']).toBe('CF-26-H01');

    const salesCtx = makeCtx('sales', 'sales');
    const comm = executeAssistantTool(salesCtx, 'check_commercial_stock', {});
    const totals = comm.output['totals'] as Record<string, number>;
    expect(totals['physical']).toBe(36);
    expect(totals['reserved']).toBe(0);
    expect(totals['availableSellable']).toBe(36);

    const prepOrder = executeAssistantTool(salesCtx, 'prepare_action', {
      actionKind: 'prefill_order',
      customerQuery: 'Table des Coteaux',
      quantity: 12,
    });
    expect(prepOrder.output['allowed']).toBe(true);
    expect(prepOrder.output['requiresHumanValidation']).toBe(true);
    expect(String(prepOrder.output['duplicateWarning'])).toContain('DV-26-H01');

    const vineCtx = makeCtx('vineyard_manager', 'vineyard');
    const deniedOrder = executeAssistantTool(vineCtx, 'prepare_action', {
      actionKind: 'prefill_order',
      quantity: 12,
    });
    expect(deniedOrder.output['allowed']).toBe(false);
  });

  it('trimHistorySafely ne laisse jamais un tour functionResponse ou model orphelin', () => {
    const history: CopilotContent[] = Array.from({ length: 18 }, (_, i) =>
      i % 2 === 0
        ? { role: 'user', parts: [{ text: `Question ${i}` }] }
        : { role: 'model', parts: [{ text: `Réponse ${i}` }] }
    );
    const trimmed = trimHistorySafely(history, 5);
    expect(trimmed[0]?.role).toBe('user');
    expect(trimmed[0]?.parts?.[0]?.text).toBe('Question 14');

    const withToolStart: CopilotContent[] = [
      { role: 'user', parts: [{ text: 'Q0' }] },
      { role: 'model', parts: [{ functionCall: { name: 'inspect_cellar', args: {} } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'inspect_cellar', response: {} } }] },
      { role: 'model', parts: [{ text: 'R0' }] },
      { role: 'user', parts: [{ text: 'Q1' }] },
    ];
    const safeToolTrim = trimHistorySafely(withToolStart, 4);
    expect(safeToolTrim).toEqual([{ role: 'user', parts: [{ text: 'Q1' }] }]);
  });

  it('exécute la boucle HTTP /api/copilot avec ThinkingLevel.MINIMAL sur Flash-Lite, sans temperature, conservation de thoughtSignature et lockedModel', async () => {
    const capturedCalls: Array<{
      model: string;
      contents: Content[];
      hasTools: boolean;
      thinkingLevel?: ThinkingLevel;
      hasTemperature: boolean;
      hasResponseSchema: boolean;
    }> = [];

    let turnIndex = 0;
    setCopilotClientFactoryForTests(() => ({
      models: {
        async generateContent(params) {
          turnIndex += 1;
          capturedCalls.push({
            model: params.model,
            contents: params.contents,
            hasTools: Boolean(params.config?.tools),
            thinkingLevel: params.config?.thinkingConfig?.thinkingLevel,
            hasTemperature: 'temperature' in (params.config ?? {}),
            hasResponseSchema: Boolean(params.config?.responseSchema),
          });

          if (turnIndex === 1) {
            return {
              functionCalls: [
                {
                  id: 'call-1',
                  name: 'inspect_cellar',
                  args: { lotQuery: 'L26-B-01' },
                },
              ],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [
                      {
                        thought: true,
                        text: 'Vérifions le lot L26-B-01 via inspect_cellar.',
                      } as never,
                      {
                        functionCall: {
                          id: 'call-1',
                          name: 'inspect_cellar',
                          args: { lotQuery: 'L26-B-01' },
                        },
                        thoughtSignature: 'sig-opaque-xyz-999',
                      } as never,
                    ],
                  },
                },
              ],
            };
          }

          return {
            text: JSON.stringify({
              text: 'Le lot L26-B-01 totalise 150 L en C-05 avec une densité de 996 g/L au 2026-10-23.',
              citedIds: ['L26-B-01', 'C-05'],
              followUps: ['Voir les relevés du Rouge 2026', 'Préparer un relevé de densité'],
            }),
          };
        },
      },
    }));

    const originalFetch = globalThis.fetch;
    await withCopilotTestServer(async (baseUrl) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;
        return originalFetch(url, init);
      });

      const ctx = makeCtx('cellar_master', 'cellar');
      const steps: string[] = [];
      const res = await askAssistant({
        question: 'Où en est le Blanc 2026 ?',
        history: [],
        ctx,
        onStep: (s) => steps.push(s.toolName),
      });

      expect(res.model).toBe(PRIMARY_MODEL);
      expect(res.answer.text).toContain('L26-B-01');
      expect(res.answer.followUps).toHaveLength(2);
      expect(res.cards.length).toBeGreaterThanOrEqual(1);
      expect(steps).toEqual(['inspect_cellar']);
    });

    expect(capturedCalls).toHaveLength(2);
    expect(capturedCalls[0]?.model).toBe(PRIMARY_MODEL);
    expect(capturedCalls[0]?.thinkingLevel).toBe(ThinkingLevel.MINIMAL);
    expect(capturedCalls[0]?.hasTemperature).toBe(false);
    expect(capturedCalls[0]?.hasTools).toBe(true);
    expect(capturedCalls[0]?.hasResponseSchema).toBe(false);

    // Turn 2 must preserve candidateContent with thoughtSignature verbatim & lock model
    expect(capturedCalls[1]?.model).toBe(PRIMARY_MODEL);
    const modelTurnInHistory = capturedCalls[1]?.contents[1];
    expect(modelTurnInHistory?.role).toBe('model');
    expect(JSON.stringify(modelTurnInHistory)).toContain('sig-opaque-xyz-999');
  });

  it('bascule immédiatement sur FALLBACK_MODEL (gemini-3.8-flash, LOW) si le primaire renvoie 503 et verrouille lockedModel', async () => {
    const modelsCalled: string[] = [];
    const levelsCalled: Array<ThinkingLevel | undefined> = [];
    let firstTurnDone = false;

    setCopilotClientFactoryForTests(() => ({
      models: {
        async generateContent(params) {
          modelsCalled.push(params.model);
          levelsCalled.push(params.config?.thinkingConfig?.thinkingLevel);
          if (params.model === PRIMARY_MODEL) {
            const err = new Error('503 UNAVAILABLE high demand');
            (err as unknown as Record<string, unknown>)['status'] = 503;
            throw err;
          }
          if (!firstTurnDone) {
            firstTurnDone = true;
            return {
              functionCalls: [{ id: 'fb-1', name: 'inspect_cellar', args: {} }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ functionCall: { id: 'fb-1', name: 'inspect_cellar', args: {} } }],
                  },
                },
              ],
            };
          }
          return {
            text: JSON.stringify({
              text: 'Bascule verrouillée : 1530 L au chai.',
              citedIds: ['L25-R-A'],
              followUps: [],
            }),
          };
        },
      },
    }));

    const originalFetch = globalThis.fetch;
    await withCopilotTestServer(async (baseUrl) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;
        return originalFetch(url, init);
      });

      const res = await askAssistant({
        question: 'Quel volume au chai ?',
        history: [],
        ctx: makeCtx('cellar_master', 'cellar'),
      });
      expect(res.model).toBe(FALLBACK_MODEL);
      expect(res.answer.text).toContain('1530 L');
    });

    // Instant failover on primary 503 -> direct fallback to gemini-3.8-flash (LOW); Turn 2 stays locked
    expect(modelsCalled).toEqual([PRIMARY_MODEL, FALLBACK_MODEL, FALLBACK_MODEL]);
    expect(levelsCalled).toEqual([ThinkingLevel.MINIMAL, ThinkingLevel.LOW, ThinkingLevel.LOW]);
  });

  it('bascule immédiatement sur FALLBACK_MODEL en cas de timeout/AbortError au tour 0 et même en cours de question au tour 1', async () => {
    // 1. Round 0 AbortError ("This operation was aborted") -> immediate switch to FALLBACK_MODEL without double primary timeout wait
    const round0Models: string[] = [];
    setCopilotClientFactoryForTests(() => ({
      models: {
        async generateContent(params) {
          round0Models.push(params.model);
          if (params.model === PRIMARY_MODEL) {
            const abortErr = new Error('This operation was aborted');
            abortErr.name = 'AbortError';
            throw abortErr;
          }
          return {
            text: JSON.stringify({
              text: 'Reprise rapide après timeout du modèle principal.',
              citedIds: [],
              followUps: [],
            }),
          };
        },
      },
    }));

    const originalFetch = globalThis.fetch;
    await withCopilotTestServer(async (baseUrl) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;
        return originalFetch(url, init);
      });

      const res = await askAssistant({
        question: 'Bonjour, quel est le stock au chai ?',
        history: [],
        ctx: makeCtx('cellar_master', 'cellar'),
      });
      expect(res.model).toBe(FALLBACK_MODEL);
      expect(res.answer.text).toContain('Reprise rapide');
    });

    expect(round0Models).toEqual([PRIMARY_MODEL, FALLBACK_MODEL]);

    // 2. Round 0 succeeds on PRIMARY_MODEL with functionCall + thoughtSignature, then Round 1 times out on locked PRIMARY_MODEL -> flattens tool history onto FALLBACK_MODEL
    resetQuestionTurnTrackerForTests();
    const round1Calls: Array<{
      model: string;
      contents: Content[];
      hasResponseSchema: boolean;
      hasTools: boolean;
    }> = [];

    setCopilotClientFactoryForTests(() => ({
      models: {
        async generateContent(params) {
          round1Calls.push({
            model: params.model,
            contents: params.contents,
            hasResponseSchema: Boolean(params.config?.responseSchema),
            hasTools: Boolean(params.config?.tools),
          });

          if (params.model === PRIMARY_MODEL && round1Calls.length === 1) {
            return {
              functionCalls: [{ id: 'c-r0', name: 'inspect_cellar', args: {} }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [
                      { thought: true, text: 'Réflexion interne' } as never,
                      {
                        functionCall: { id: 'c-r0', name: 'inspect_cellar', args: {} },
                        thoughtSignature: 'sig-primary-only',
                      } as never,
                    ],
                  },
                },
              ],
            };
          }

          if (params.model === PRIMARY_MODEL) {
            const timeoutErr = new Error('Request timeout after 10000ms');
            timeoutErr.name = 'TimeoutError';
            throw timeoutErr;
          }

          return {
            text: JSON.stringify({
              text: 'Synthèse de secours au tour 1 : 1530 L en cuverie.',
              citedIds: ['L25-R-A'],
              followUps: [],
            }),
          };
        },
      },
    }));

    await withCopilotTestServer(async (baseUrl) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;
        return originalFetch(url, init);
      });

      const res = await askAssistant({
        question: 'Quel est le volume total au chai ?',
        history: [],
        ctx: makeCtx('cellar_master', 'cellar'),
      });
      expect(res.model).toBe(FALLBACK_MODEL);
      expect(res.answer.text).toContain('1530 L');
    });

    expect(round1Calls.map((c) => c.model)).toEqual([
      PRIMARY_MODEL,
      PRIMARY_MODEL,
      FALLBACK_MODEL,
    ]);
    const fallbackCall = round1Calls[2]!;
    expect(fallbackCall.hasResponseSchema).toBe(true);
    expect(fallbackCall.hasTools).toBe(false);
    const serializedFallbackContents = JSON.stringify(fallbackCall.contents);
    expect(serializedFallbackContents).not.toContain('thoughtSignature');
    expect(serializedFallbackContents).not.toContain('functionCall');
    expect(serializedFallbackContents).toContain('inspect_cellar');
    expect(serializedFallbackContents).toContain('1530');
  });

  it('applique responseSchema au dernier tour (MAX_TOOL_ROUNDS) et rejette les outils inconnus + >5 tours sur un questionId', async () => {
    const schemaFlags: boolean[] = [];
    setCopilotClientFactoryForTests(() => ({
      models: {
        async generateContent(params) {
          schemaFlags.push(Boolean(params.config?.responseSchema));
          return {
            text: JSON.stringify({
              text: 'Synthèse finale structurée.',
              citedIds: [],
              followUps: [],
            }),
          };
        },
      },
    }));

    await withCopilotTestServer(async (baseUrl) => {
      // 1. Unknown tool -> 400
      const badToolRes = await fetch(`${baseUrl}/api/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: 'q-bad-tool',
          history: [{ role: 'user', parts: [{ text: 'test' }] }],
          allowedTools: ['hack_database'],
          scope: buildAssistantScope('direction', 'overview'),
          toolRound: 0,
        }),
      });
      expect(badToolRes.status).toBe(400);

      // 2. Final synthesis at MAX_TOOL_ROUNDS enforces responseSchema without tools
      const finalRoundRes = await fetch(`${baseUrl}/api/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: 'q-final-round',
          history: [{ role: 'user', parts: [{ text: 'synthèse' }] }],
          allowedTools: ['inspect_cellar'],
          scope: buildAssistantScope('direction', 'overview'),
          toolRound: MAX_TOOL_ROUNDS,
        }),
      });
      expect(finalRoundRes.status).toBe(200);
      expect(schemaFlags[0]).toBe(true);

      // 3. Per-questionId quota allows 1..5 calls and blocks 6th with 429, while /feedback remains exempt
      for (let i = 1; i <= MAX_CALLS_PER_QUESTION; i += 1) {
        const okRes = await fetch(`${baseUrl}/api/copilot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: 'q-quota-test',
            history: [{ role: 'user', parts: [{ text: `tour ${i}` }] }],
            allowedTools: ['inspect_cellar'],
            scope: buildAssistantScope('direction', 'overview'),
            toolRound: 0,
          }),
        });
        expect(okRes.status).toBe(200);
      }

      const blockedRes = await fetch(`${baseUrl}/api/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: 'q-quota-test',
          history: [{ role: 'user', parts: [{ text: 'tour 6' }] }],
          allowedTools: ['inspect_cellar'],
          scope: buildAssistantScope('direction', 'overview'),
          toolRound: 0,
        }),
      });
      expect(blockedRes.status).toBe(429);

      const feedbackRes = await fetch(`${baseUrl}/api/copilot/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: 'q-quota-test',
          messageId: 'm-1',
          vote: 'up',
          model: PRIMARY_MODEL,
        }),
      });
      expect(feedbackRes.status).toBe(200);
    });

    // Contextual suggestions adapt to role/tab
    expect(getContextualSuggestions(buildAssistantScope('vineyard_manager', 'vineyard'))[0]).toMatch(
      /vendanges|parcelle/i
    );
  });

  it('streame en SSE (generateContentStream) en 1 seul appel via préchargement et masque le JSON brut en mode schema', async () => {
    expect(extractStreamingReadableText('{"te', true)).toBe('');
    expect(extractStreamingReadableText('{"text":"Bonjour\\nChai \\"C-05\\"', true)).toBe(
      'Bonjour\nChai "C-05"'
    );

    const capturedPrompts: string[] = [];
    setCopilotClientFactoryForTests(() => ({
      models: {
        async generateContent() {
          throw new Error('Should use generateContentStream when available');
        },
        async generateContentStream(params) {
          capturedPrompts.push(JSON.stringify(params.contents));
          return (async function* () {
            yield {
              candidates: [{ content: { role: 'model', parts: [{ thought: true, text: 'Réflexion interne' }] } }],
            };
            yield {
              candidates: [{ content: { role: 'model', parts: [{ text: 'Le chai totalise ' }] } }],
            };
            yield {
              candidates: [{ content: { role: 'model', parts: [{ text: '1 530 L (15,3 hL).' }] } }],
            };
          })();
        },
      },
    }));

    const originalFetch = globalThis.fetch;
    await withCopilotTestServer(async (baseUrl) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;
        return originalFetch(url, init);
      });

      const tokens: string[] = [];
      const res = await askAssistant({
        question: 'Fais un bilan des volumes de vin actuellement au chai.',
        history: [],
        ctx: makeCtx('cellar_master', 'overview'),
        onToken: (partial) => tokens.push(partial),
      });

      // Completed in 1 single round thanks to local deterministic prefetch + SSE stream
      expect(capturedPrompts).toHaveLength(1);
      expect(capturedPrompts[0]).toContain('[DONNÉES PRÉCHARGÉES (inspect_cellar)]');
      expect(tokens).toEqual(['Le chai totalise ', 'Le chai totalise 1 530 L (15,3 hL).']);
      expect(res.answer.text).toBe('Le chai totalise 1 530 L (15,3 hL).');
      expect(res.cards.length).toBeGreaterThanOrEqual(1);
      // Persisted history must keep concise question text without the prefetched JSON payload
      expect(res.updatedHistory[0]?.parts?.[0]?.text).toBe(
        'Fais un bilan des volumes de vin actuellement au chai.'
      );
    });
  });
});
