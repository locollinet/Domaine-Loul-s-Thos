import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { StoreProvider } from '../src/app/store-context';
import { localDb } from '../src/infra/db';

describe('App & UI Navigation (L0 - L7)', () => {
  beforeEach(async () => {
    await localDb.resetToSeed();
  });

  it('renders overview with multi-vintages and navigates between modules', async () => {
    render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

    // Wait for store to be ready and main view to be rendered
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Vue d’ensemble/i })).toBeInTheDocument();
    });

    // Check presence of multi-vintages
    expect(screen.getByText(/Millésime 2023/i)).toBeInTheDocument();
    expect(screen.getByText(/Millésime 2024/i)).toBeInTheDocument();
    expect(screen.getByText(/Millésime 2025/i)).toBeInTheDocument();
    expect(screen.getByText(/Millésime 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Horizon 2027/i)).toBeInTheDocument();

    // Navigate to Chai & Vinification
    fireEvent.click(screen.getByRole('button', { name: /Chai & Vinification/i }));
    expect(screen.getByText(/Occupation des contenants/i)).toBeInTheDocument();
    expect(screen.getByText(/C-01/i)).toBeInTheDocument();

    // Navigate to Élevage & Assemblage
    fireEvent.click(screen.getByRole('button', { name: /Élevage & Assemblage/i }));
    expect(screen.getByText(/Parc à barriques/i)).toBeInTheDocument();

    // Navigate to Conditionnement & Stocks
    fireEvent.click(screen.getByRole('button', { name: /Conditionnement & Stocks/i }));
    expect(screen.getByText(/Lots de bouteilles en stock/i)).toBeInTheDocument();

    // Navigate to Ventes & Commerce
    fireEvent.click(screen.getByRole('button', { name: /Ventes & Commerce/i }));
    expect(screen.getByText(/Commandes & Devis/i)).toBeInTheDocument();

    // Open Guided Demo Modal
    fireEvent.click(screen.getByRole('button', { name: /Scénario Démo/i }));
    expect(screen.getByText(/Visite guidée du scénario de démo/i)).toBeInTheDocument();
  });
});
