import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCopilotDrawer } from '../src/features/ai/AiCopilotDrawer';
import { StoreProvider } from '../src/app/store-context';
import { localDb } from '../src/infra/db';

describe('Copilote IA Viticole', () => {
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

  it('ne demande aucune clé API dans l’interface et envoie les requêtes via /api/copilot', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          text: 'Vous disposez de 420 bouteilles vendables immédiatement.',
          model: 'gemini-4-hydrogen',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(
      <StoreProvider>
        <AiCopilotDrawer isOpen={true} onClose={() => {}} />
      </StoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Copilote IA Viticole/i)).toBeInTheDocument();
    });

    expect(screen.queryByPlaceholderText(/AIzaSy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Clé API Google AI Studio/i)).not.toBeInTheDocument();

    const quickBtn = screen.getByRole('button', {
      name: /Combien de bouteilles puis-je livrer immédiatement/i,
    });
    expect(quickBtn).toBeEnabled();
    fireEvent.click(quickBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Vous disposez de 420 bouteilles vendables immédiatement.')
      ).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/copilot');
  });

  it('affiche l’erreur serveur proprement et permet de réessayer sans rester bloqué', async () => {
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
            text: 'Analyse rétablie : lots 2025 prêts pour assemblage.',
            model: 'gemini-3.1-flash-lite',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    render(
      <StoreProvider>
        <AiCopilotDrawer isOpen={true} onClose={() => {}} />
      </StoreProvider>
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

    expect(
      screen.queryByText(/Analyse des données du domaine en cours/i)
    ).not.toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Réessayer/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Analyse rétablie : lots 2025 prêts pour assemblage.')
      ).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
