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

    // Navigate to Vignoble & Récolte
    fireEvent.click(screen.getByRole('button', { name: /Vignoble & Récolte/i }));
    expect(screen.getByText(/Carte Satellite Interactive, Cadastre IGN & GPS Terrain/i)).toBeInTheDocument();
    expect(screen.getByText(/À vendanger aujourd’hui/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🗺️ Vue Carte & GPS/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /📖 Vue Livret & Vendanges/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /📅 Planning & Vendanges/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /⚖️ Quai & Pesées/i })).toBeInTheDocument();

    // Toggle Vue Terrain and confirm tabs + sidebar remain stable (no separate window)
    fireEvent.click(screen.getByRole('button', { name: /Vue Terrain/i }));
    expect(screen.getByRole('button', { name: /Vue Terrain Active/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /⚖️ Quai & Pesées/i })).toBeInTheDocument();
    expect(screen.getByText(/Trois Coteaux/i)).toBeInTheDocument();

    // Switch to Planning & Vendanges and check mission counting as vineyard_manager
    const roleSelect = screen.getByLabelText(/Rôle prévisualisé/i);
    fireEvent.change(roleSelect, { target: { value: 'vineyard_manager' } });
    fireEvent.click(screen.getByRole('button', { name: /📅 Planning & Vendanges/i }));
    expect(screen.getByText(/Pilotage des Parcelles à Vendanger/i)).toBeInTheDocument();
    const countMissionBtns = screen.getAllByRole('button', { name: /Compter \(Mission\)/i });
    expect(countMissionBtns.length).toBeGreaterThan(0);
    fireEvent.click(countMissionBtns[0]!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Ajouter un comptage/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fermer la fenêtre/i }));
    fireEvent.change(roleSelect, { target: { value: 'cellar_master' } });

    // Switch to Livret Parcellaire Numérique
    fireEvent.click(screen.getByRole('button', { name: /📖 Vue Livret & Vendanges/i }));
    expect(screen.getByText(/Livret Parcellaire Numérique du Domaine/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Données Dynamiques Vendanges/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Localiser sur Cadastre & GPS/i })[0]).toBeInTheDocument();

    // Cross-navigate back to Cadastre & GPS
    fireEvent.click(screen.getAllByRole('button', { name: /Localiser sur Cadastre & GPS/i })[0]!);
    expect(screen.getByText(/Carte Satellite Interactive, Cadastre IGN & GPS Terrain/i)).toBeInTheDocument();

    // Navigate to Matières sèches & Achats and check upgraded PO modal
    fireEvent.click(screen.getByRole('button', { name: /Matières sèches & Achats/i }));
    const commanderBtns = screen.getAllByRole('button', { name: /\+ Commander/i });
    fireEvent.click(commanderBtns[0]!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Nouvelle commande fournisseur/i)).toBeInTheDocument();
    expect(screen.getByText(/Total estimé/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fermer la fenêtre/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Navigate to Chai & Vinification
    fireEvent.click(screen.getByRole('button', { name: /Chai & Vinification/i }));
    expect(screen.getByText(/Occupation des contenants/i)).toBeInTheDocument();
    expect(screen.getByText(/C-01/i)).toBeInTheDocument();

    // Verify Add Container button is present and opens modal
    const addContainerBtn = screen.getByRole('button', { name: /\+ Ajouter une cuve \/ fût/i });
    expect(addContainerBtn).toBeInTheDocument();
    fireEvent.click(addContainerBtn);
    expect(screen.getByText(/Ajouter un contenant sur-mesure au plan de cuverie/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));

    // Click on empty container C-01 to open action bar & edit modal
    fireEvent.click(screen.getByText('C-01'));
    const editBtn = screen.getByRole('button', { name: /Modifier caractéristiques/i });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(screen.getByText(/Modifier C-01/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));

    // Click on occupied container C-02 to open measurement modal
    fireEvent.click(screen.getByText('C-02'));
    const measBtn = screen.getByRole('button', { name: /\+ Relevé sur C-02/i });
    expect(measBtn).toBeInTheDocument();
    fireEvent.click(measBtn);
    expect(screen.getByText(/Nouveau relevé analytique/i)).toBeInTheDocument();
    expect(screen.getByText(/Unité standard contrainte pour Masse volumique/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /✕ Fermer/i }));

    // Open AI Copilot Drawer & verify contextual scope + offline local execution
    fireEvent.click(screen.getByRole('button', { name: /Copilote IA/i }));
    expect(screen.getByLabelText(/Panneau Copilote IA/i)).toBeInTheDocument();
    expect(screen.getByText(/Maître de chai · Ventes & Commerce · Coûts masqués/i)).toBeInTheDocument();
  });
});
