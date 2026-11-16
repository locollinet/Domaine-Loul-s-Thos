import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCopilotDrawer } from '../src/features/ai/AiCopilotDrawer';
import { StoreProvider } from '../src/app/store-context';
import { ModuleConfigProvider } from '../src/features/modules/ModuleConfigContext';
import { localDb } from '../src/infra/db';

describe('Copilote IA Viticole (UI & Protocole)', () => {
  beforeEach(async () => {
    await localDb.resetToSeed();
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    } else {
      vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('affiche le périmètre sans clé API client, exécute la boucle multi-tours /api/copilot, affiche ResultCard, followUps et feedback', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            kind: 'tool_calls',
            questionId: 'q-ui-1',
            model: 'gemini-4-hydrogen',
            lockedModel: 'gemini-4-hydrogen',
            modelContent: {
              role: 'model',
              parts: [
                {
                  functionCall: { id: 'c1', name: 'check_commercial_stock', args: {} },
                  thoughtSignature: 'sig-ui-1',
                },
              ],
            },
            calls: [{ id: 'c1', name: 'check_commercial_stock', args: {} }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            kind: 'answer',
            questionId: 'q-ui-1',
            model: 'gemini-4-hydrogen',
            lockedModel: 'gemini-4-hydrogen',
            answer: {
              text: 'Vous disposez de 36 bouteilles vendables immédiatement (M23-001).',
              citedIds: ['M23-001'],
              followUps: ['Préparer une commande client'],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const onNavigatePrefill = vi.fn();

    render(
      <ModuleConfigProvider>
        <StoreProvider>
          <AiCopilotDrawer
            isOpen={true}
            onClose={() => {}}
            activeTab="overview"
            onNavigatePrefill={onNavigatePrefill}
          />
        </StoreProvider>
      </ModuleConfigProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Copilote IA Viticole/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Maître de chai · Vue d’ensemble · Coûts masqués/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/AIzaSy/i)).not.toBeInTheDocument();

    const quickBtn = screen.getByRole('button', {
      name: /Combien de bouteilles puis-je livrer immédiatement/i,
    });
    fireEvent.click(quickBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Vous disposez de 36 bouteilles vendables immédiatement (M23-001).')
      ).toBeInTheDocument();
    });

    // ResultCard + action button + followUp chip
    expect(screen.getByText(/Stocks bouteilles & commandes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Préparer une commande client/i })).toBeInTheDocument();

    // Vote 👍 calls /api/copilot/feedback
    fireEvent.click(screen.getByRole('button', { name: /Réponse utile/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/copilot');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/copilot/feedback');

    // Click card navigation triggers onNavigatePrefill
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir Ventes & Commerce/i }));
    expect(onNavigatePrefill).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'sales' })
    );
  });

  it('affiche l’erreur serveur proprement, permet de réessayer et propose le mode local déterministe', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'UNAVAILABLE',
            error: 'Le service Gemini connaît actuellement une forte affluence.',
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            kind: 'answer',
            questionId: 'q-retry',
            model: 'gemini-3.1-flash-lite',
            lockedModel: 'gemini-3.1-flash-lite',
            answer: {
              text: 'Analyse rétablie : lots 2025 prêts pour assemblage.',
              citedIds: ['L25-R-A', 'L25-R-B'],
              followUps: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    render(
      <ModuleConfigProvider>
        <StoreProvider>
          <AiCopilotDrawer isOpen={true} onClose={() => {}} />
        </StoreProvider>
      </ModuleConfigProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Copilote IA Viticole/i)).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Quels lots sont prêts pour l’assemblage 2025/i })
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/forte affluence/i);
    });

    expect(screen.getByRole('button', { name: /Répondre en mode local/i })).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Réessayer/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Analyse rétablie : lots 2025 prêts pour assemblage.')
      ).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bascule automatiquement en mode hors-ligne déterministe sans appel serveur quand navigator.onLine est faux', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    try {
      render(
        <ModuleConfigProvider>
          <StoreProvider>
            <AiCopilotDrawer isOpen={true} onClose={() => {}} activeTab="cellar" />
          </StoreProvider>
        </ModuleConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Mode hors-ligne \(chai \/ cave\)/i)).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', { name: /Fais un bilan des volumes de vin actuellement au chai/i })
      );

      await waitFor(() => {
        expect(screen.getByText(/Mode local déterministe \(sans appel Gemini\)/i)).toBeInTheDocument();
      });
      expect(screen.getAllByText(/Chai, Cuverie & Relevés Analytiques/i).length).toBeGreaterThanOrEqual(1);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnLine });
    }
  });
});
