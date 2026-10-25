import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../../app/store-context';
import { lotVolumeMl, batchPosition } from '../../domain/selectors';

function normalizeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export interface SearchResultItem {
  id: string;
  entityKind: 'Parcelle' | 'Mission' | 'Lot de vin' | 'Contenant' | 'Lot habillé (Bouteilles)' | 'Client / Commande';
  badgeClass: string;
  title: string;
  subtitle: string;
  metric: string;
  targetTab: string;
}

export const GlobalSearchModal: React.FC<{
  onClose: () => void;
  onNavigate: (tab: string) => void;
}> = ({ onClose, onNavigate }) => {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [filterKind, setFilterKind] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allItems = useMemo<SearchResultItem[]>(() => {
    if (!state) return [];
    const items: SearchResultItem[] = [];

    // 1. Parcelles
    for (const p of Object.values(state.parcels)) {
      items.push({
        id: `parcel-${p.id}`,
        entityKind: 'Parcelle',
        badgeClass: 'badge-green',
        title: `${p.code} — ${p.name}`,
        subtitle: `Cépage : ${p.grape} · Propriétaire : ${p.owner}`,
        metric: p.areaM2 ? `${(p.areaM2.value / 10000).toFixed(2)} ha` : 'Surface inconnue (≠ 0)',
        targetTab: 'vineyard',
      });
    }

    // 2. Missions
    for (const m of Object.values(state.missions)) {
      const parcel = state.parcels[m.parcelId];
      items.push({
        id: `mission-${m.id}`,
        entityKind: 'Mission',
        badgeClass: 'badge-amber',
        title: `${m.title}`,
        subtitle: `Parcelle : ${parcel?.name ?? m.parcelId} · Campagne ${m.campaign}`,
        metric: m.status,
        targetTab: 'vineyard',
      });
    }

    // 3. Lots de vin (Identité distincte du contenant et de la cuvée)
    for (const l of Object.values(state.lots)) {
      const volL = lotVolumeMl(state, l.id) / 1000;
      items.push({
        id: `lot-${l.id}`,
        entityKind: 'Lot de vin',
        badgeClass: l.color === 'red' ? 'badge-grape' : 'badge-amber',
        title: `${l.code} — ${l.name}`,
        subtitle: `Millésime ${l.vintage} · Stade : ${l.stage} · Qualité : ${l.quality === 'released' ? 'Libéré' : 'Bloqué'}`,
        metric: `${volL.toLocaleString('fr-FR')} L`,
        targetTab: l.stage === 'aging' || l.stage === 'ready' ? 'aging' : 'cellar',
      });
    }

    // 4. Contenants (Cuves & Fûts)
    for (const c of Object.values(state.containers)) {
      const occ = state.occupancies[c.id];
      const usedL = (occ?.volumeMl ?? 0) / 1000;
      const capL = c.capacityMl / 1000;
      items.push({
        id: `container-${c.id}`,
        entityKind: 'Contenant',
        badgeClass: 'badge-muted',
        title: `${c.code} — ${c.location}`,
        subtitle: `Type : ${c.kind === 'barrel' ? 'Barrique chêne' : 'Cuve inox/béton'} · État : ${c.state}`,
        metric: `${usedL} / ${capL} L`,
        targetTab: c.kind === 'barrel' ? 'aging' : 'cellar',
      });
    }

    // 5. Lots de bouteilles habillées
    for (const b of Object.values(state.batches)) {
      const pos = batchPosition(state, b);
      const sku = state.skus[b.skuId];
      items.push({
        id: `batch-${b.id}`,
        entityKind: 'Lot habillé (Bouteilles)',
        badgeClass: 'badge-green',
        title: `${b.code} — ${sku?.label ?? b.skuId}`,
        subtitle: `Millésime ${b.vintage} · Lot vrac source : ${b.lotId ?? 'Préchargé'}`,
        metric: `${pos.available} dispo / ${b.physical} phys.`,
        targetTab: 'bottling',
      });
    }

    // 6. Clients & Commandes
    for (const c of Object.values(state.customers)) {
      items.push({
        id: `cust-${c.id}`,
        entityKind: 'Client / Commande',
        badgeClass: 'badge-grape',
        title: `${c.name} (${c.city})`,
        subtitle: `Segment : ${c.kind === 'b2b' ? 'Professionnel B2B' : 'Particulier'} · Délai : ${c.paymentTermsDays}j`,
        metric: 'Client',
        targetTab: 'sales',
      });
    }
    for (const o of Object.values(state.orders)) {
      const cust = state.customers[o.customerId];
      items.push({
        id: `order-${o.id}`,
        entityKind: 'Client / Commande',
        badgeClass: 'badge-grape',
        title: `Commande ${o.code} — ${cust?.name ?? o.customerId}`,
        subtitle: `Créée le ${o.createdAt.slice(0, 10)} · Statut : ${o.status}`,
        metric: `${o.lines.reduce((s, l) => s + l.quantity, 0)} bout.`,
        targetTab: 'sales',
      });
    }

    return items;
  }, [state]);

  const filtered = useMemo(() => {
    const q = normalizeAccents(query.trim());
    return allItems.filter((item) => {
      if (filterKind !== 'all' && item.entityKind !== filterKind) return false;
      if (!q) return true;
      const hay = normalizeAccents(`${item.title} ${item.subtitle} ${item.entityKind} ${item.metric}`);
      return hay.includes(q);
    });
  }, [allItems, query, filterKind]);

  const kinds = ['all', 'Parcelle', 'Lot de vin', 'Contenant', 'Lot habillé (Bouteilles)', 'Client / Commande', 'Mission'];

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Recherche transversale du domaine">
      <div className="modal-content" style={{ maxWidth: '720px', padding: '22px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 700 }}>
              Recherche transversale du Domaine
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              Retrouvez parcelles, lots de vin, contenants, lots de bouteilles et clients sans confondre leurs identités.
            </p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            Fermer (ESC)
          </button>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <input
            ref={inputRef}
            type="search"
            className="form-input"
            placeholder="Ex: Pierres Blanches, LOT-2025, C-01, barrique, Maison Duval, Chardonnay..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ fontSize: '15px', padding: '11px 14px' }}
          />
        </div>

        {/* Filtres par nature d'objet métier */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => setFilterKind(k)}
              className={`badge ${filterKind === k ? 'badge-green' : 'badge-muted'}`}
              style={{ cursor: 'pointer', padding: '5px 10px' }}
            >
              {k === 'all' ? `Tout (${allItems.length})` : k}
            </button>
          ))}
        </div>

        <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
              Aucun objet métier ne correspond à « {query} ».
            </div>
          ) : (
            filtered.slice(0, 25).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.targetTab);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-elevated)',
                  textAlign: 'left',
                  transition: 'all 120ms ease',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className={`badge ${item.badgeClass}`}>{item.entityKind}</span>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)' }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>{item.subtitle}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span className="tabular" style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-forest)' }}>
                    {item.metric}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-ink-light)' }}>Ouvrir →</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
