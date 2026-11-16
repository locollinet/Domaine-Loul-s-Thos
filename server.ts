import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile();
  }
} catch {
  // Ignore missing or unreadable .env in container/runtime environments
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const REQUEST_TIMEOUT_MS = 25_000;

interface HistoryTurn {
  role: 'user' | 'model';
  text: string;
}

interface CopilotRequestBody {
  prompt?: unknown;
  contextSummary?: unknown;
  history?: unknown;
}

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

function isTransientError(err: unknown): boolean {
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
    msg.includes('fetch failed') ||
    msg.includes('timeout')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithTimeout(
  ai: GoogleGenAI,
  model: string,
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  systemInstruction: string
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Request timeout')), REQUEST_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        abortSignal: controller.signal,
      },
    });
    return (response.text ?? '').trim() || 'Aucune réponse générée.';
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiWithFallback(
  ai: GoogleGenAI,
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  systemInstruction: string
): Promise<{ text: string; modelUsed: string }> {
  const attempts: Array<{ model: string; delayBeforeMs: number }> = [
    { model: PRIMARY_MODEL, delayBeforeMs: 0 },
    { model: PRIMARY_MODEL, delayBeforeMs: 900 },
    { model: FALLBACK_MODEL, delayBeforeMs: 250 },
    { model: FALLBACK_MODEL, delayBeforeMs: 1200 },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    if (attempt.delayBeforeMs > 0) {
      await sleep(attempt.delayBeforeMs);
    }

    try {
      const text = await generateWithTimeout(ai, attempt.model, contents, systemInstruction);
      return { text, modelUsed: attempt.model };
    } catch (err: unknown) {
      lastError = err;
      const status = getErrorStatus(err);
      if (status === 400 || status === 403) {
        // Key or request syntax error: fail fast instead of retrying all fallbacks
        throw err;
      }
      if (!isTransientError(err) && status !== 404) {
        throw err;
      }
      console.warn(`[Copilot] Attempt failed on ${attempt.model} (status=${status ?? 'unknown'}):`, err instanceof Error ? err.message : String(err));
    }
  }

  throw lastError;
}

function sanitizeHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const valid: HistoryTurn[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      ((item as Record<string, unknown>)['role'] === 'user' || (item as Record<string, unknown>)['role'] === 'model') &&
      typeof (item as Record<string, unknown>)['text'] === 'string'
    ) {
      const text = ((item as Record<string, unknown>)['text'] as string).trim();
      if (text.length > 0) {
        valid.push({
          role: (item as Record<string, unknown>)['role'] as 'user' | 'model',
          text: text.slice(0, 4000),
        });
      }
    }
  }
  // Drop any leading synthetic model greeting so contents always starts with a user turn
  while (valid.length > 0 && valid[0]?.role === 'model') {
    valid.shift();
  }
  return valid.slice(-10);
}

function formatUserFacingError(err: unknown): { status: number; message: string; code: string } {
  const status = getErrorStatus(err);
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (status === 400 && rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      code: 'API_KEY_INVALID',
      message: 'La clé API Gemini configurée côté serveur est invalide. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
    };
  }
  if (status === 403 || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      code: 'PERMISSION_DENIED',
      message: 'Permissions insuffisantes sur la clé API Gemini serveur. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
    };
  }
  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message: 'Le quota de requêtes Gemini est momentanément saturé. Patientez quelques secondes avant de réessayer.',
    };
  }
  if (status === 503 || rawMessage.includes('UNAVAILABLE') || rawMessage.includes('high demand')) {
    return {
      status: 503,
      code: 'UNAVAILABLE',
      message: 'Le service Gemini connaît actuellement une forte affluence malgré la bascule de secours. Veuillez réessayer dans un instant.',
    };
  }
  if (rawMessage.includes('timeout') || rawMessage.includes('aborted')) {
    return {
      status: 504,
      code: 'TIMEOUT',
      message: 'Le délai d’attente de la réponse IA a été dépassé. Veuillez réessayer avec une question plus ciblée.',
    };
  }

  return {
    status: 502,
    code: 'UPSTREAM_ERROR',
    message: `Erreur du service IA : ${rawMessage}`,
  };
}

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, copilotConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()) });
  });

  app.post('/api/copilot', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        error: 'Clé API Gemini serveur non configurée. Ajoutez GEMINI_API_KEY dans les paramètres (Settings > Secrets).',
      });
      return;
    }

    const body = (req.body ?? {}) as CopilotRequestBody;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const contextSummary = typeof body.contextSummary === 'string' ? body.contextSummary.trim() : '{}';

    if (!prompt) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'La question posée au copilote est vide.',
      });
      return;
    }

    const history = sanitizeHistory(body.history);

    const systemInstruction = `Tu es le Copilote IA officiel du Domaine des Trois Coteaux (domaine viticole de démonstration).
Tu assistes le maître de chai, le chef de culture et la direction.
Tu as accès à l'état complet en temps réel du domaine (ci-dessous au format JSON).

RÈGLES IMPORTANTES DU DOMAINE :
1. Réponds toujours en français, avec clarté, concision et professionnalisme (listes à puces courtes si utile).
2. Tu t'appuies STRICTEMENT sur les données fournies dans le contexte ci-dessous. Ne invente jamais de chiffre, parcelle, lot ou client absent du contexte.
3. Distinction stricte : Stock physique ≠ Réservé ≠ Bloqué qualité ≠ Quarantaine ≠ Disponible vendable.
4. Aucun traitement œnologique ou chimique (dose, intrant, sulfite) n'est prescrit de façon autonome : tu fournis des analyses factuelles et des points de vigilance pour assister la décision humaine.
5. Inconnu ≠ zéro pour les coûts, surfaces et données manquantes.

ÉTAT EN DIRECT DU DOMAINE :
${contextSummary}`;

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [
      ...history.map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      })),
      {
        role: 'user',
        parts: [{ text: prompt.slice(0, 4000) }],
      },
    ];

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    try {
      const result = await callGeminiWithFallback(ai, contents, systemInstruction);
      res.json({
        text: result.text,
        model: result.modelUsed,
      });
    } catch (err: unknown) {
      const mapped = formatUserFacingError(err);
      res.status(mapped.status).json({
        code: mapped.code,
        error: mapped.message,
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Domaine server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
