import express, { type Router } from 'express';
import {
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentConfig,
  type Part,
} from '@google/genai';
import {
  ASSISTANT_ANSWER_SCHEMA,
  ASSISTANT_TOOL_NAMES,
  getToolDeclarations,
  type AssistantToolName,
} from '../src/features/ai/schema';
import type {
  AssistantFinalAnswer,
  AssistantScope,
  CopilotContent,
  CopilotServerResponse,
  CopilotToolCallRequest,
} from '../src/features/ai/types';

export const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
export const FALLBACK_MODEL = 'gemini-4-hydrogen';
export const PRIMARY_TIMEOUT_MS = 10_000;
export const REQUEST_TIMEOUT_MS = 18_000;
export const MAX_TOOL_ROUNDS = 4;
export const MAX_HISTORY_TURNS = 16;
export const MAX_PAYLOAD_BYTES = 200 * 1024;
export const QUESTION_TTL_MS = 120_000;
export const MAX_CALLS_PER_QUESTION = 5;

export interface GenerateContentResultLike {
  text?: string;
  functionCalls?: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>;
  candidates?: Array<{ content?: Content }>;
}

export interface AiClientLike {
  models: {
    generateContent(params: {
      model: string;
      contents: Content[];
      config?: GenerateContentConfig;
    }): Promise<GenerateContentResultLike>;
    generateContentStream?(params: {
      model: string;
      contents: Content[];
      config?: GenerateContentConfig;
    }): Promise<AsyncIterable<GenerateContentResultLike>>;
  };
}

type AiClientFactory = (apiKey: string) => AiClientLike;

let testClientFactory: AiClientFactory | null = null;
const aiClientCache = new Map<string, AiClientLike>();

export function setCopilotClientFactoryForTests(factory: AiClientFactory | null): void {
  testClientFactory = factory;
}

function getAiClient(apiKey: string): AiClientLike {
  if (testClientFactory) {
    return testClientFactory(apiKey);
  }
  const cached = aiClientCache.get(apiKey);
  if (cached) {
    return cached;
  }
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  aiClientCache.set(apiKey, client);
  return client;
}

export function isGemini3Or4Model(model: string): boolean {
  return (
    model.startsWith('gemini-3') ||
    model.startsWith('gemini-4') ||
    model === 'gemini-flash-latest'
  );
}

/**
 * Picks the lowest safe ThinkingLevel per Gemini model family:
 * - `gemini-3.1-flash-lite`: `MINIMAL` (lowest latency, default for Flash-Lite)
 * - `gemini-4-*`, other `gemini-3-*`: `LOW` (`MINIMAL` is not supported on Gemini 4)
 */
export function thinkingLevelForModel(model: string): ThinkingLevel | undefined {
  if (!isGemini3Or4Model(model)) {
    return undefined;
  }
  if (model.startsWith('gemini-3.1-flash-lite')) {
    return ThinkingLevel.MINIMAL;
  }
  return ThinkingLevel.LOW;
}

export function copilotModelList(lockedModel?: string): string[] {
  if (lockedModel && lockedModel.trim().length > 0) {
    return [lockedModel.trim()];
  }
  const configured = process.env.GEMINI_COPILOT_MODEL?.trim();
  const candidates = [configured, PRIMARY_MODEL, FALLBACK_MODEL].filter(
    (m): m is string => Boolean(m && m.length > 0)
  );
  return [...new Set(candidates)].slice(0, 2);
}

// ------------------------------------------------------------------ Question Turn Quotas

interface QuestionTurnBucket {
  count: number;
  expiresAt: number;
}

const questionTurns = new Map<string, QuestionTurnBucket>();

export function resetQuestionTurnTrackerForTests(): void {
  questionTurns.clear();
}

export function checkQuestionTurn(
  questionId: string,
  ownerKey: string,
  now = Date.now()
): { allowed: boolean; turnCount: number } {
  for (const [key, bucket] of questionTurns.entries()) {
    if (bucket.expiresAt <= now) {
      questionTurns.delete(key);
    }
  }
  const key = `${ownerKey}::${questionId}`;
  const current = questionTurns.get(key);
  if (!current || current.expiresAt <= now) {
    questionTurns.set(key, { count: 1, expiresAt: now + QUESTION_TTL_MS });
    return { allowed: true, turnCount: 1 };
  }
  current.count += 1;
  current.expiresAt = now + QUESTION_TTL_MS;
  return {
    allowed: current.count <= MAX_CALLS_PER_QUESTION,
    turnCount: current.count,
  };
}

// ------------------------------------------------------------------ Error & Retry Helpers

function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const record = err as Record<string, unknown>;
  if (typeof record['status'] === 'number') return record['status'];
  if (typeof record['code'] === 'number') return record['code'];
  const message = record['message'];
  if (typeof message === 'string') {
    if (message.includes('503') || message.includes('UNAVAILABLE')) return 503;
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) return 429;
    if (message.includes('404') || message.includes('NOT_FOUND')) return 404;
    if (message.includes('403') || message.includes('PERMISSION_DENIED')) return 403;
    if (message.includes('400') || message.includes('API_KEY_INVALID')) return 400;
  }
  return undefined;
}

function isTimeoutLikeError(err: unknown): boolean {
  if (!err) return false;
  const name = err instanceof Error ? err.name : '';
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('aborted')
  );
}

function isTransientError(err: unknown): boolean {
  if (isTimeoutLikeError(err)) {
    return true;
  }
  const status = getErrorStatus(err);
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes('fetch failed')
  );
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0 || process.env.VITEST || process.env.NODE_ENV === 'test') {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatUserFacingError(err: unknown): { status: number; message: string; code: string } {
  const status = getErrorStatus(err);
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (status === 400 && rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      code: 'API_KEY_INVALID',
      message:
        'La clé API Gemini configurée côté serveur est invalide. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
    };
  }
  if (status === 403 || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      code: 'PERMISSION_DENIED',
      message:
        'Permissions insuffisantes sur la clé API Gemini serveur. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
    };
  }
  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message:
        'Le quota de requêtes Gemini est momentanément saturé. Patientez quelques secondes avant de réessayer.',
    };
  }
  if (status === 503 || rawMessage.includes('UNAVAILABLE') || rawMessage.includes('high demand')) {
    return {
      status: 503,
      code: 'UNAVAILABLE',
      message:
        'Le service Gemini connaît actuellement une forte affluence malgré la bascule de secours. Veuillez réessayer dans un instant.',
    };
  }
  if (isTimeoutLikeError(err)) {
    return {
      status: 504,
      code: 'TIMEOUT',
      message:
        'Le délai d’attente de la réponse IA a été dépassé. Veuillez réessayer avec une question plus ciblée.',
    };
  }

  return {
    status: 502,
    code: 'UPSTREAM_ERROR',
    message: `Erreur du service IA : ${rawMessage}`,
  };
}

// ------------------------------------------------------------------ Parsing & System Prompt

function buildSystemInstruction(scope: AssistantScope | undefined): string {
  const roleLabel = scope?.roleLabel ?? 'Maître de chai';
  const activeTab = scope?.activeTab ?? 'overview';
  const costAccess =
    scope?.canSeeCosts && scope?.canSeeFinance
      ? 'Coûts et prévisions financières autorisés.'
      : 'Coûts internes, prix et finances STRICTEMENT MASQUÉS (ne jamais inventer ni estimer).';

  return `Tu es le Copilote IA Viticole du Domaine des Trois Coteaux.
Profil : ${roleLabel} | Écran : ${activeTab} | Droits : ${costAccess}

RÈGLES MÉTIER IMPÉRATIVES :
1. Réponds en français, de façon claire, concise et factuelle.
2. Appuie-toi STRICTEMENT sur le bloc [DONNÉES PRÉCHARGÉES] (s’il est fourni dans le message utilisateur) ou sur les outils typés. N’invente jamais aucun lot, parcelle, contenant, client, volume ou chiffre.
3. Si [DONNÉES PRÉCHARGÉES] répond déjà complètement à la question, rédige directement la réponse finale en français sans rappeler le même outil. N’appelle un outil que s’il manque une donnée ou pour \`prepare_action\`.
4. Donnée absente : signale-le sans interpoler (Inconnu ≠ zéro ; kg de vendange ≠ litres de vin).
5. Stocks bouteilles : Physique ≠ Réservé ≠ Bloqué qualité ≠ Quarantaine ≠ Disponible vendable.
6. Ne prescris jamais de traitement œnologique/chimique autonome. Pour toute saisie ou navigation, utilise \`prepare_action\` (validation humaine requise).`;
}

export function parseFinalAnswerJson(rawText: string): AssistantFinalAnswer {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { text: 'Aucune réponse générée.', citedIds: [], followUps: [] };
  }

  const unfenced = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (unfenced.startsWith('{')) {
    try {
      const parsed = JSON.parse(unfenced) as Record<string, unknown>;
      if (typeof parsed['text'] === 'string' && parsed['text'].trim().length > 0) {
        const citedIds = Array.isArray(parsed['citedIds'])
          ? parsed['citedIds'].filter((x): x is string => typeof x === 'string' && x.length > 0)
          : [];
        const followUps = Array.isArray(parsed['followUps'])
          ? parsed['followUps']
              .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              .slice(0, 3)
          : [];
        return {
          text: parsed['text'].trim(),
          citedIds,
          followUps,
        };
      }
    } catch {
      // Fallback to raw text
    }
  }

  return {
    text: trimmed,
    citedIds: [],
    followUps: [],
  };
}

interface ParsedCopilotRequest {
  questionId: string;
  history: Content[];
  allowedTools: AssistantToolName[];
  scope?: AssistantScope;
  toolRound: number;
  lockedModel?: string;
}

function parseAndValidateRequest(
  rawBody: unknown
): { ok: true; data: ParsedCopilotRequest } | { ok: false; status: number; code: string; error: string } {
  if (!rawBody || typeof rawBody !== 'object') {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', error: 'Corps de requête invalide.' };
  }

  const body = rawBody as Record<string, unknown>;
  const rawJsonBytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (rawJsonBytes > MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      error: 'Requête trop volumineuse (limite 200 Ko).',
    };
  }

  const questionId = typeof body['questionId'] === 'string' ? body['questionId'].trim() : '';
  if (!questionId) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
      error: 'Identifiant de question (questionId) manquant.',
    };
  }

  if (!Array.isArray(body['history']) || body['history'].length === 0) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
      error: 'Historique de conversation vide.',
    };
  }
  if (body['history'].length > MAX_HISTORY_TURNS + MAX_TOOL_ROUNDS * 2 + 2) {
    return {
      ok: false,
      status: 400,
      code: 'HISTORY_TOO_LONG',
      error: 'Historique de conversation trop long.',
    };
  }

  const history: Content[] = [];
  for (const item of body['history']) {
    if (!item || typeof item !== 'object') {
      return { ok: false, status: 400, code: 'INVALID_REQUEST', error: 'Tour d’historique invalide.' };
    }
    const turn = item as CopilotContent;
    if ((turn.role !== 'user' && turn.role !== 'model') || !Array.isArray(turn.parts) || turn.parts.length === 0) {
      return { ok: false, status: 400, code: 'INVALID_REQUEST', error: 'Format de tour invalide.' };
    }
    history.push({
      role: turn.role,
      parts: turn.parts as Part[],
    });
  }

  if (!Array.isArray(body['allowedTools'])) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
      error: 'Liste allowedTools invalide.',
    };
  }

  const allowedTools: AssistantToolName[] = [];
  for (const rawTool of body['allowedTools']) {
    if (
      typeof rawTool !== 'string' ||
      !(ASSISTANT_TOOL_NAMES as readonly string[]).includes(rawTool)
    ) {
      return {
        ok: false,
        status: 400,
        code: 'UNKNOWN_TOOL',
        error: `Outil inconnu ou non autorisé : ${String(rawTool)}`,
      };
    }
    allowedTools.push(rawTool as AssistantToolName);
  }

  const rawRound = body['toolRound'];
  const toolRound =
    typeof rawRound === 'number' && Number.isInteger(rawRound) ? rawRound : 0;
  if (toolRound < 0 || toolRound > MAX_TOOL_ROUNDS) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_TOOL_ROUND',
      error: 'Numéro de tour d’outil hors limites.',
    };
  }

  const lockedModel =
    typeof body['lockedModel'] === 'string' && body['lockedModel'].trim().length > 0
      ? body['lockedModel'].trim()
      : undefined;

  const scope =
    body['scope'] && typeof body['scope'] === 'object'
      ? (body['scope'] as AssistantScope)
      : undefined;

  return {
    ok: true,
    data: {
      questionId,
      history,
      allowedTools,
      scope,
      toolRound,
      lockedModel,
    },
  };
}

// ------------------------------------------------------------------ Streaming Helpers

/**
 * Extracts progressive human-readable answer text while streaming either plain text
 * or `ASSISTANT_ANSWER_SCHEMA` JSON (`{"text":"..."}`) so UI never flashes raw JSON syntax.
 */
export function extractStreamingReadableText(rawText: string, expectsJson: boolean): string {
  const trimmedStart = rawText.trimStart();
  if (!trimmedStart) return '';

  if (!expectsJson && !trimmedStart.startsWith('{')) {
    return rawText;
  }

  const keyMatch = /"text"\s*:\s*"/.exec(trimmedStart);
  if (!keyMatch || keyMatch.index === undefined) {
    return '';
  }

  let i = keyMatch.index + keyMatch[0].length;
  let out = '';

  while (i < trimmedStart.length) {
    const ch = trimmedStart[i]!;
    if (ch === '"') {
      break;
    }
    if (ch === '\\') {
      if (i + 1 >= trimmedStart.length) {
        break;
      }
      const next = trimmedStart[i + 1]!;
      switch (next) {
        case 'n':
          out += '\n';
          i += 2;
          break;
        case 'r':
          out += '\r';
          i += 2;
          break;
        case 't':
          out += '\t';
          i += 2;
          break;
        case '"':
          out += '"';
          i += 2;
          break;
        case '\\':
          out += '\\';
          i += 2;
          break;
        case '/':
          out += '/';
          i += 2;
          break;
        case 'u': {
          if (i + 6 > trimmedStart.length) {
            return out;
          }
          const hex = trimmedStart.slice(i + 2, i + 6);
          const code = Number.parseInt(hex, 16);
          if (!Number.isNaN(code)) {
            out += String.fromCharCode(code);
          }
          i += 6;
          break;
        }
        default:
          out += next;
          i += 2;
          break;
      }
      continue;
    }
    out += ch;
    i += 1;
  }

  return out;
}

function sendSseEvent(res: express.Response, event: string, data: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ------------------------------------------------------------------ Gemini Call with Retry & Lock

/**
 * When falling back mid-conversation from a locked primary model to another model,
 * strips model-specific `functionCall` / `thoughtSignature` parts and summarizes
 * already-executed `functionResponse` payloads as plain user text so Gemini never
 * rejects the history with `missing thought_signature`.
 */
export function flattenToolHistoryForModelSwitch(contents: Content[]): Content[] {
  const normalized: Content[] = [];

  const pushMerged = (role: 'user' | 'model', text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === role && Array.isArray(prev.parts)) {
      prev.parts.push({ text: clean });
    } else {
      normalized.push({ role, parts: [{ text: clean }] });
    }
  };

  for (const turn of contents) {
    const parts = Array.isArray(turn.parts) ? turn.parts : [];
    const textChunks: string[] = [];
    const toolSummaries: string[] = [];

    for (const part of parts) {
      const p = part as Record<string, unknown>;
      if (p['thought'] === true) continue;
      if (typeof p['text'] === 'string' && p['text'].trim().length > 0) {
        textChunks.push(p['text'].trim());
      }
      if (p['functionResponse'] && typeof p['functionResponse'] === 'object') {
        const fr = p['functionResponse'] as { name?: string; response?: unknown };
        const fnName = typeof fr.name === 'string' ? fr.name : 'outil';
        toolSummaries.push(`- ${fnName}: ${JSON.stringify(fr.response ?? {})}`);
      }
    }

    if (textChunks.length > 0) {
      pushMerged(turn.role === 'model' ? 'model' : 'user', textChunks.join('\n'));
    }
    if (toolSummaries.length > 0) {
      pushMerged(
        'user',
        `Données retournées par les outils métier déjà exécutés :\n${toolSummaries.join('\n')}\n\nBase ta réponse uniquement sur ces résultats (sans réinventer ni modifier les chiffres).`
      );
    }
  }

  return normalized;
}

async function callModelOnce(
  ai: AiClientLike,
  model: string,
  contents: Content[],
  config: GenerateContentConfig,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<GenerateContentResultLike> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Request timeout')), timeoutMs);
  const onExternalAbort = () => controller.abort(externalSignal?.reason ?? new Error('Aborted'));

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new Error('aborted');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    return await ai.models.generateContent({
      model,
      contents,
      config: {
        ...config,
        abortSignal: controller.signal,
      },
    });
  } catch (err: unknown) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      const timeoutErr = new Error(`Request timeout after ${timeoutMs}ms`);
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

async function callModelStreamOnce(
  ai: AiClientLike,
  model: string,
  contents: Content[],
  config: GenerateContentConfig,
  timeoutMs: number,
  expectsJson: boolean,
  onDelta: (delta: string) => void,
  externalSignal?: AbortSignal
): Promise<GenerateContentResultLike> {
  if (!ai.models.generateContentStream) {
    return callModelOnce(ai, model, contents, config, timeoutMs, externalSignal);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Request timeout')), timeoutMs);
  const onExternalAbort = () => controller.abort(externalSignal?.reason ?? new Error('Aborted'));

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new Error('aborted');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        ...config,
        abortSignal: controller.signal,
      },
    });

    const assembledParts: Part[] = [];
    const collectedCalls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }> = [];
    let rawText = '';
    let emittedText = '';

    for await (const chunk of stream) {
      const chunkParts = chunk.candidates?.[0]?.content?.parts;
      if (Array.isArray(chunkParts) && chunkParts.length > 0) {
        for (const part of chunkParts) {
          assembledParts.push(part);
          if (part.functionCall) {
            collectedCalls.push({
              ...(part.functionCall.id ? { id: part.functionCall.id } : {}),
              ...(part.functionCall.name ? { name: part.functionCall.name } : {}),
              ...(part.functionCall.args && typeof part.functionCall.args === 'object'
                ? { args: part.functionCall.args }
                : {}),
            });
          } else if (typeof part.text === 'string' && !part.thought) {
            rawText += part.text;
          }
        }
      } else {
        if (Array.isArray(chunk.functionCalls)) {
          collectedCalls.push(...chunk.functionCalls);
        }
        if (typeof chunk.text === 'string' && chunk.text.length > 0) {
          rawText += chunk.text;
          assembledParts.push({ text: chunk.text });
        }
      }

      if (collectedCalls.length === 0 && rawText.length > 0) {
        const readable = extractStreamingReadableText(rawText, expectsJson);
        if (readable.length > emittedText.length) {
          onDelta(readable.slice(emittedText.length));
          emittedText = readable;
        }
      }
    }

    return {
      text: rawText,
      functionCalls: collectedCalls.length > 0 ? collectedCalls : undefined,
      candidates:
        assembledParts.length > 0
          ? [{ content: { role: 'model', parts: assembledParts } }]
          : undefined,
    };
  } catch (err: unknown) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      const timeoutErr = new Error(`Request timeout after ${timeoutMs}ms`);
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

async function callGeminiWithLockAndFallback(
  ai: AiClientLike,
  contents: Content[],
  systemInstruction: string,
  allowedTools: AssistantToolName[],
  toolRound: number,
  lockedModel?: string,
  externalSignal?: AbortSignal,
  onDelta?: (delta: string) => void
) {
  const baseModels = copilotModelList(undefined);
  const primary =
    lockedModel && lockedModel.trim().length > 0
      ? lockedModel.trim()
      : (baseModels[0] ?? PRIMARY_MODEL);
  const secondary =
    lockedModel === FALLBACK_MODEL
      ? undefined
      : (baseModels.find((m) => m !== primary) ?? (primary !== FALLBACK_MODEL ? FALLBACK_MODEL : undefined));

  const attempts: Array<{ model: string; delayBeforeMs: number; timeoutMs: number }> = lockedModel
    ? [
        {
          model: primary,
          delayBeforeMs: 0,
          timeoutMs: secondary ? PRIMARY_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
        },
        ...(secondary
          ? [{ model: secondary, delayBeforeMs: 0, timeoutMs: REQUEST_TIMEOUT_MS }]
          : [{ model: primary, delayBeforeMs: 250, timeoutMs: REQUEST_TIMEOUT_MS }]),
      ]
    : secondary
      ? [
          // Immediate failover on primary error/404/timeout instead of burning retries + sleep
          { model: primary, delayBeforeMs: 0, timeoutMs: PRIMARY_TIMEOUT_MS },
          { model: secondary, delayBeforeMs: 0, timeoutMs: REQUEST_TIMEOUT_MS },
          { model: secondary, delayBeforeMs: 300, timeoutMs: REQUEST_TIMEOUT_MS },
        ]
      : [
          { model: primary, delayBeforeMs: 0, timeoutMs: REQUEST_TIMEOUT_MS },
          { model: primary, delayBeforeMs: 250, timeoutMs: REQUEST_TIMEOUT_MS },
        ];

  const useTools = toolRound < MAX_TOOL_ROUNDS && allowedTools.length > 0;
  const declarations = useTools ? getToolDeclarations(allowedTools) : [];

  let lastError: unknown;
  const unavailableModels = new Set<string>();

  for (const attempt of attempts) {
    if (unavailableModels.has(attempt.model)) {
      continue;
    }
    if (attempt.delayBeforeMs > 0) {
      await sleep(attempt.delayBeforeMs);
    }
    if (externalSignal?.aborted) {
      throw new Error('aborted');
    }

    const switchingMidQuestion = Boolean(lockedModel && attempt.model !== lockedModel);
    const attemptContents = switchingMidQuestion
      ? flattenToolHistoryForModelSwitch(contents)
      : contents;
    const attemptDeclarations = switchingMidQuestion ? [] : declarations;
    const expectsJson = attemptDeclarations.length === 0;

    const thinkingLevel = thinkingLevelForModel(attempt.model);
    const config: GenerateContentConfig = {
      systemInstruction,
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
      ...(attemptDeclarations.length > 0
        ? { tools: [{ functionDeclarations: attemptDeclarations }] }
        : {
            responseMimeType: 'application/json',
            responseSchema: ASSISTANT_ANSWER_SCHEMA,
          }),
    };

    let emittedDeltaOnAttempt = false;
    try {
      const response =
        onDelta && ai.models.generateContentStream
          ? await callModelStreamOnce(
              ai,
              attempt.model,
              attemptContents,
              config,
              attempt.timeoutMs,
              expectsJson,
              (delta) => {
                emittedDeltaOnAttempt = true;
                onDelta(delta);
              },
              externalSignal
            )
          : await callModelOnce(
              ai,
              attempt.model,
              attemptContents,
              config,
              attempt.timeoutMs,
              externalSignal
            );
      return { response, modelUsed: attempt.model };
    } catch (err: unknown) {
      if (externalSignal?.aborted) {
        throw err;
      }
      lastError = err;
      if (emittedDeltaOnAttempt) {
        // Never splice two model responses mid-stream
        throw err;
      }
      const status = getErrorStatus(err);
      if (status === 400 || status === 403) {
        throw err;
      }
      if (status === 404) {
        unavailableModels.add(attempt.model);
      }
      if (!isTransientError(err) && status !== 404) {
        throw err;
      }
      console.warn(
        `[Copilot] Attempt failed on ${attempt.model} (status=${status ?? 'unknown'}):`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  throw lastError;
}

// ------------------------------------------------------------------ Express Router

export function createCopilotRouter(): Router {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const startedAt = Date.now();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey && !testClientFactory) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        error:
          'Clé API Gemini serveur non configurée. Ajoutez GEMINI_API_KEY dans les paramètres (Settings > Secrets).',
      });
      return;
    }

    const parsed = parseAndValidateRequest(req.body);
    if (!parsed.ok) {
      res.status(parsed.status).json({
        code: parsed.code,
        error: parsed.error,
      });
      return;
    }

    const { questionId, history, allowedTools, scope, toolRound, lockedModel } = parsed.data;
    const ownerKey = req.ip || 'local';
    const turnCheck = checkQuestionTurn(questionId, ownerKey);
    if (!turnCheck.allowed) {
      res.status(429).json({
        code: 'TOO_MANY_TURNS',
        error: 'Trop de tours de requêtes pour cette même question. Veuillez reformuler.',
      });
      return;
    }

    const requestAbortController = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) {
        requestAbortController.abort(new Error('Client aborted request'));
      }
    });

    const ai = getAiClient(apiKey || 'test-key');
    const systemInstruction = buildSystemInstruction(scope);
    const wantsStream =
      typeof req.headers.accept === 'string' &&
      req.headers.accept.includes('text/event-stream') &&
      typeof ai.models.generateContentStream === 'function';

    if (wantsStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
    }

    try {
      const { response, modelUsed } = await callGeminiWithLockAndFallback(
        ai,
        history,
        systemInstruction,
        allowedTools,
        toolRound,
        lockedModel,
        requestAbortController.signal,
        wantsStream
          ? (delta) => {
              sendSseEvent(res, 'delta', { text: delta });
            }
          : undefined
      );

      if (res.writableEnded) return;

      const rawCalls = Array.isArray(response.functionCalls) ? response.functionCalls : [];
      const validCalls: CopilotToolCallRequest[] = rawCalls
        .filter(
          (c): c is { id?: string; name: AssistantToolName; args?: Record<string, unknown> } =>
            typeof c.name === 'string' &&
            allowedTools.includes(c.name as AssistantToolName)
        )
        .map((c) => ({
          ...(c.id ? { id: c.id } : {}),
          name: c.name,
          args: c.args && typeof c.args === 'object' ? c.args : {},
        }));

      let payload: CopilotServerResponse;

      if (validCalls.length > 0 && toolRound < MAX_TOOL_ROUNDS) {
        // Keep raw candidateContent verbatim so `thought` & `thoughtSignature` survive intact
        const rawCandidateContent = response.candidates?.[0]?.content;
        const modelContent: CopilotContent = rawCandidateContent
          ? (rawCandidateContent as unknown as CopilotContent)
          : {
              role: 'model',
              parts: validCalls.map((c) => ({
                functionCall: {
                  ...(c.id ? { id: c.id } : {}),
                  name: c.name,
                  args: c.args,
                },
              })),
            };

        payload = {
          kind: 'tool_calls',
          questionId,
          model: modelUsed,
          lockedModel: modelUsed,
          modelContent,
          calls: validCalls,
        };
        console.info(
          `[Copilot] model=${modelUsed} round=${toolRound} calls=${validCalls.map((c) => c.name).join(',')} ms=${Date.now() - startedAt}`
        );
      } else {
        const answer = parseFinalAnswerJson(response.text ?? '');
        payload = {
          kind: 'answer',
          questionId,
          model: modelUsed,
          lockedModel: modelUsed,
          answer,
        };
        console.info(
          `[Copilot] model=${modelUsed} round=${toolRound} status=answer ms=${Date.now() - startedAt}`
        );
      }

      if (wantsStream) {
        sendSseEvent(res, 'done', payload);
        res.end();
      } else {
        res.json(payload);
      }
    } catch (err: unknown) {
      if (res.writableEnded) return;
      const mapped = formatUserFacingError(err);
      console.info(
        `[Copilot] round=${toolRound} error=${mapped.code} ms=${Date.now() - startedAt}`
      );
      if (wantsStream) {
        sendSseEvent(res, 'error', {
          status: mapped.status,
          code: mapped.code,
          error: mapped.message,
        });
        res.end();
      } else {
        res.status(mapped.status).json({
          code: mapped.code,
          error: mapped.message,
        });
      }
    }
  });

  // Feedback route exempted from per-question turn quota
  router.post('/feedback', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const vote = body['vote'] === 'up' || body['vote'] === 'down' ? body['vote'] : null;
    const model = typeof body['model'] === 'string' ? body['model'] : 'unknown';
    if (!vote) {
      res.status(400).json({ code: 'INVALID_FEEDBACK', error: 'Vote invalide.' });
      return;
    }
    console.info(`[Copilot] feedback=${vote} model=${model}`);
    res.json({ ok: true });
  });

  return router;
}
