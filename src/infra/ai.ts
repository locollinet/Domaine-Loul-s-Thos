import { GoogleGenAI } from '@google/genai';
import { lotVolumeMl, batchPosition } from '../domain/selectors';
import type { DomainState } from '../domain/types';

export function getGeminiApiKey(): string | null {
  const fromEnv = (import.meta.env['VITE_GEMINI_API_KEY'] as string | undefined)?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const fromStorage = localStorage.getItem('domaine_gemini_api_key')?.trim();
  return fromStorage && fromStorage.length > 0 ? fromStorage : null;
}

export function setGeminiApiKey(key: string): void {
  if (!key.trim()) {
    localStorage.removeItem('domaine_gemini_api_key');
  } else {
    localStorage.setItem('domaine_gemini_api_key', key.trim());
  }
}

/**
 * Builds a compact, structured snapshot of the domain state
 * so Gemini has real-time context of lots, tanks, bottles and missions.
 */
export function buildDomainContextSummary(state: DomainState): string {
  const lots = Object.values(state.lots).map((l) => ({
    code: l.code,
    nom: l.name,
    millesime: l.vintage,
    couleur: l.color,
    stade: l.stage,
    qualite: l.quality,
    volumeLitres: lotVolumeMl(state, l.id) / 1000,
    coutConnuEuros: l.cost.knownCents ? l.cost.knownCents / 100 : null,
  }));

  const bouteilles = Object.values(state.batches).map((b) => {
    const pos = batchPosition(state, b);
    return {
      lotMise: b.code,
      millesime: b.vintage,
      article: state.skus[b.skuId]?.label,
      physique: pos.physical,
      reserve: pos.reserved,
      bloqueQualite: pos.blocked,
      quarantaine: pos.quarantine,
      disponibleVendable: pos.available,
    };
  });

  const commandes = Object.values(state.orders).map((o) => ({
    code: o.code,
    client: state.customers[o.customerId]?.name,
    statut: o.status,
    totalBouteilles: o.lines.reduce((a, l) => a + l.quantity, 0),
    totalLivrees: o.lines.reduce((a, l) => a + l.shipped, 0),
  }));

  const missions = Object.values(state.missions).map((m) => ({
    titre: m.title,
    parcelle: state.parcels[m.parcelId]?.name,
    statut: m.status,
    operation: m.operation,
  }));

  return JSON.stringify({
    domaine: state.organization.name,
    dateDemonstration: state.referenceDate.slice(0, 10),
    lotsAuChai: lots,
    stocksBouteilles: bouteilles,
    commandesEnCours: commandes,
    missionsTerrain: missions,
  }, null, 2);
}

export async function askGemini(
  prompt: string,
  state: DomainState,
  history: { role: 'user' | 'model'; text: string }[] = []
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Aucune clé API Gemini configurée. Veuillez renseigner votre clé Google AI Studio (VITE_GEMINI_API_KEY ou dans l’interface).'
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const contextSummary = buildDomainContextSummary(state);

  const systemInstruction = `Tu es le Copilote IA officiel du Domaine des Trois Coteaux (domaine viticole de démonstration).
Tu assistes le maître de chai, le chef de culture et la direction.
Tu as accès à l'état complet en temps réel du domaine (ci-dessous au format JSON).

RÈGLES IMPORTANTES DU DOMAINE :
1. Réponds toujours en français, avec clarté, concision et professionnalisme.
2. Tu t'appuies STRICTEMENT sur les données fournies dans le contexte ci-dessous.
3. Distinction stricte : Stock physique ≠ Réservé ≠ Bloqué qualité ≠ Disponible vendable.
4. Aucun traitement œnologique ou chimique n'est prescrit de façon autonome : tu fournis des analyses et alertes pour assister la décision humaine.
5. Inconnu ≠ zéro pour les coûts et surfaces.

ÉTAT EN DIRECT DU DOMAINE :
${contextSummary}
`;

  try {
    const contents = [
      ...history.map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      })),
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    return response.text || 'Aucune réponse générée.';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('API_KEY_INVALID') || msg.includes('403')) {
      throw new Error('Clé API Google AI Studio invalide ou permissions insuffisantes.', { cause: err });
    }
    throw new Error(`Erreur Gemini AI Studio : ${msg}`, { cause: err });
  }
}
