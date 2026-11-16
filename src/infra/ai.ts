import { lotVolumeMl, batchPosition } from '../domain/selectors';
import type { DomainState } from '../domain/types';

export interface CopilotHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export interface CopilotResponse {
  text: string;
  model?: string;
}

/**
 * Builds a compact, structured snapshot of the domain state
 * so the server-side Copilot has real-time context of lots, tanks,
 * analytical measurements, bottles, orders and field missions.
 */
export function buildDomainContextSummary(state: DomainState): string {
  const lots = Object.values(state.lots).map((l) => {
    const activeMeasurements = Object.values(state.measurements)
      .filter((m) => m.lotId === l.id && m.supersededBy === null)
      .sort((a, b) => b.sampledAt.localeCompare(a.sampledAt))
      .slice(0, 6)
      .map((m) => ({
        parametre: m.parameter,
        valeur: m.value,
        unite: m.unit,
        date: m.sampledAt.slice(0, 10),
      }));

    const contenants = Object.values(state.occupancies)
      .filter((o) => o.lotId === l.id)
      .map((o) => ({
        code: state.containers[o.containerId]?.code ?? o.containerId,
        type: state.containers[o.containerId]?.kind,
        volumeLitres: o.volumeMl / 1000,
      }));

    return {
      code: l.code,
      nom: l.name,
      millesime: l.vintage,
      couleur: l.color,
      stade: l.stage,
      qualite: l.quality,
      volumeLitres: lotVolumeMl(state, l.id) / 1000,
      coutConnuEuros: l.cost.incomplete ? null : l.cost.knownCents / 100,
      coutPartielEuros: l.cost.incomplete ? l.cost.knownCents / 100 : null,
      contenants,
      relevesActifs: activeMeasurements,
    };
  });

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

  return JSON.stringify(
    {
      domaine: state.organization.name,
      dateDemonstration: state.referenceDate.slice(0, 10),
      lotsAuChai: lots,
      stocksBouteilles: bouteilles,
      commandesEnCours: commandes,
      missionsTerrain: missions,
    },
    null,
    2
  );
}

const CLIENT_TIMEOUT_MS = 45_000;

export async function askGemini(
  prompt: string,
  state: DomainState,
  history: CopilotHistoryTurn[] = [],
  externalSignal?: AbortSignal
): Promise<CopilotResponse> {
  const contextSummary = buildDomainContextSummary(state);

  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort(new Error('Délai d’attente dépassé côté navigateur.'));
  }, CLIENT_TIMEOUT_MS);

  const onExternalAbort = () => {
    timeoutController.abort(externalSignal?.reason ?? new Error('Requête annulée.'));
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const response = await fetch('/api/copilot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        contextSummary,
        history,
      }),
      signal: timeoutController.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    let payload: { text?: string; model?: string; error?: string } | null = null;
    if (contentType.includes('application/json')) {
      payload = (await response.json()) as { text?: string; model?: string; error?: string };
    } else {
      const rawText = await response.text();
      if (!response.ok) {
        throw new Error(rawText || `Erreur serveur (${response.status})`);
      }
    }

    if (!response.ok) {
      throw new Error(payload?.error || `Erreur serveur (${response.status})`);
    }

    return {
      text: payload?.text?.trim() || 'Aucune réponse générée.',
      model: payload?.model,
    };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    if (timeoutController.signal.aborted) {
      const reason = timeoutController.signal.reason;
      if (reason instanceof Error) {
        throw new Error(reason.message, { cause: err });
      }
      throw new Error('La requête a été interrompue ou a expiré.', { cause: err });
    }
    if (err instanceof TypeError) {
      throw new Error('Impossible de joindre le serveur du copilote. Vérifiez que le serveur applicatif est démarré.', {
        cause: err,
      });
    }
    throw err instanceof Error ? err : new Error(String(err), { cause: err });
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}
