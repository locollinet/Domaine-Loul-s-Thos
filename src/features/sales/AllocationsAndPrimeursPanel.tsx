import React, { useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import type { BottlingBatch, Customer, Sku } from '../../domain/types';

interface AllocationRow {
  id: string;
  customerId: string;
  customerName: string;
  channel: 'CHR Étoilé France' | 'Importateur Grand Export' | 'Caviste Historique' | 'Caveau Privé';
  cuveeLabel: string;
  vintage: number;
  formatLabel: 'Bouteille 75 cl' | 'Magnum 150 cl (Édition Rare)' | 'Jéroboam 300 cl (Caisse Bois)';
  allocatedCols: number;
  claimedCols: number;
  unitPriceHtEur: number;
  status: 'Ouvert' | 'Partiel' | 'Soldé';
}

const INITIAL_ALLOCATIONS: AllocationRow[] = [
  {
    id: 'alloc-1',
    customerId: 'cust-resto',
    customerName: 'Table des Coteaux (Restaurant Gastronomique)',
    channel: 'CHR Étoilé France',
    cuveeLabel: 'Bâtard-Montrachet Grand Cru · Le Clos du Puits',
    vintage: 2025,
    formatLabel: 'Bouteille 75 cl',
    allocatedCols: 36,
    claimedCols: 12,
    unitPriceHtEur: 145,
    status: 'Partiel',
  },
  {
    id: 'alloc-2',
    customerId: 'cust-export',
    customerName: 'Comptoir Nordique (Importateur Tokyo / Stockholm)',
    channel: 'Importateur Grand Export',
    cuveeLabel: 'Puligny-Montrachet 1er Cru · Les Hauts Rangs',
    vintage: 2025,
    formatLabel: 'Bouteille 75 cl',
    allocatedCols: 180,
    claimedCols: 120,
    unitPriceHtEur: 58,
    status: 'Partiel',
  },
  {
    id: 'alloc-3',
    customerId: 'cust-cave',
    customerName: 'Cave Saint-Vincent (Allocataire Historique)',
    channel: 'Caviste Historique',
    cuveeLabel: 'Puligny-Montrachet 1er Cru · Les Pierres Plates',
    vintage: 2025,
    formatLabel: 'Magnum 150 cl (Édition Rare)',
    allocatedCols: 18,
    claimedCols: 0,
    unitPriceHtEur: 132,
    status: 'Ouvert',
  },
  {
    id: 'alloc-4',
    customerId: 'cust-resto',
    customerName: 'Table des Coteaux (Restaurant Gastronomique)',
    channel: 'CHR Étoilé France',
    cuveeLabel: 'Bâtard-Montrachet Grand Cru · Le Clos du Puits',
    vintage: 2024,
    formatLabel: 'Jéroboam 300 cl (Caisse Bois)',
    allocatedCols: 3,
    claimedCols: 3,
    unitPriceHtEur: 690,
    status: 'Soldé',
  },
];

interface AllocationsAndPrimeursPanelProps {
  customers: Record<string, Customer>;
  batches: BottlingBatch[];
  skus: Record<string, Sku>;
  onConvertAllocationToOrder: (
    customerId: string,
    qty: number,
    unitPriceEur: number,
    label: string
  ) => Promise<void>;
}

export const AllocationsAndPrimeursPanel: React.FC<AllocationsAndPrimeursPanelProps> = ({
  batches,
  onConvertAllocationToOrder,
}) => {
  const [allocations, setAllocations] = useState<AllocationRow[]>(INITIAL_ALLOCATIONS);
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const filtered = allocations.filter(
    (a) => channelFilter === 'all' || a.channel === channelFilter
  );

  const totalAllocatedValueEur = allocations.reduce(
    (acc, a) => acc + a.allocatedCols * a.unitPriceHtEur,
    0
  );
  const totalRemainingCols = allocations.reduce(
    (acc, a) => acc + Math.max(0, a.allocatedCols - a.claimedCols),
    0
  );

  const handleClaimRemaining = async (row: AllocationRow) => {
    const remaining = Math.max(0, row.allocatedCols - row.claimedCols);
    if (remaining <= 0) return;

    await onConvertAllocationToOrder(
      row.customerId,
      remaining,
      row.unitPriceHtEur,
      `${row.cuveeLabel} (${row.formatLabel})`
    );

    setAllocations((prev) =>
      prev.map((item) =>
        item.id === row.id
          ? { ...item, claimedCols: item.allocatedCols, status: 'Soldé' }
          : item
      )
    );
    setBannerMsg(
      `Allocation convertie en commande ferme : ${remaining} × ${row.formatLabel} (${row.cuveeLabel}) pour ${row.customerName}.`
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* KPIs Allocations & Rareté */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Enveloppe d’Allocations 2025/2026 (Valeur HT)</div>
          <div className="kpi-value tabular">{totalAllocatedValueEur.toLocaleString('fr-FR')} €</div>
          <div className="kpi-sub">
            Répartie sur {allocations.length} quotas nominatifs (CHR Étoilés, Importateurs, Cavistes)
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Quotas Réservés Restant à Prélever</div>
          <div className="kpi-value tabular" style={{ color: 'var(--color-burgundy)' }}>
            {totalRemainingCols} cols
          </div>
          <div className="kpi-sub">
            Protégés contre la survente (Bouteilles 75 cl, Magnums 150 cl & Jéroboams 300 cl)
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Grilles Tarifaires Multi-Canaux Actives</div>
          <div className="kpi-value">4 Canaux</div>
          <div className="kpi-sub">
            Caveau TTC · CHR France HT (-18%) · Caviste (-25%) · Grand Export Ex-Cellars (-38%)
          </div>
        </div>
      </div>

      {bannerMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(26, 94, 66, 0.12)',
            border: '1px solid rgba(26, 94, 66, 0.4)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          ✅ {bannerMsg}
        </div>
      )}

      {/* Tableau des Quotas d'Allocations */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span className="badge badge-gold">GESTION DE LA RARETÉ & PRIMEURS</span>
              <span className="badge badge-grape">Formats : 75 cl · Magnum 150 cl · Jéroboam 300 cl</span>
            </div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>
              Tableau des Allocations Annuelles par Allocataire & Format
            </h3>
          </div>

          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '220px' }}
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
          >
            <option value="all">Tous les canaux de distribution</option>
            <option value="CHR Étoilé France">CHR Étoilé France</option>
            <option value="Importateur Grand Export">Importateur Grand Export</option>
            <option value="Caviste Historique">Caviste Historique</option>
          </select>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Client Allocataire & Canal</th>
              <th>Cuvée & Millésime</th>
              <th>Format de Flacon</th>
              <th>Quota Alloué</th>
              <th>Déjà Prélevé</th>
              <th>Reste à Convertir</th>
              <th>Tarif Canal HT</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const remaining = Math.max(0, row.allocatedCols - row.claimedCols);
              return (
                <tr key={row.id}>
                  <td>
                    <strong>{row.customerName.replace(' — fictif', '')}</strong>
                    <div>
                      <span className="badge badge-gold" style={{ fontSize: '10px' }}>
                        {row.channel}
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong>{row.cuveeLabel}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                      Millésime {row.vintage}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-grape">{row.formatLabel}</span>
                  </td>
                  <td className="tabular" style={{ fontWeight: 700 }}>
                    {row.allocatedCols}
                  </td>
                  <td className="tabular">{row.claimedCols}</td>
                  <td className="tabular" style={{ fontWeight: 700, color: remaining > 0 ? 'var(--color-burgundy)' : '#1A5E42' }}>
                    {remaining} col(s)
                  </td>
                  <td className="tabular">{row.unitPriceHtEur.toFixed(2)} € HT</td>
                  <td>
                    {remaining > 0 && batches.length > 0 ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => void handleClaimRemaining(row)}
                      >
                        <Plus size={13} />
                        <span>Convertir en commande ({remaining})</span>
                      </button>
                    ) : (
                      <span className="badge badge-green">
                        <CheckCircle2 size={11} /> Quota soldé
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
