import React, { useState } from 'react';
import { useStore } from '../../app/store-context';

export const TraceabilityView: React.FC = () => {
  const { state } = useStore();
  const [selectedBatchId, setSelectedBatchId] = useState<string>('batch-2023-old');
  const [auditFilter, setAuditFilter] = useState<string>('all');

  if (!state) return null;

  const batches = Object.values(state.batches);
  // Default to newest bottling batch if created, otherwise active selection
  const activeBatch = state.batches[selectedBatchId] || batches[batches.length - 1] || batches[0];

  const isNotNull = <T,>(val: T | null | undefined): val is T => val !== null && val !== undefined;

  // Resolve upstream genealogy
  const wineLot = activeBatch?.lotId ? state.lots[activeBatch.lotId] : null;

  // Resolve ancestors lots if blend
  const ancestorLots = wineLot ? wineLot.parents.map((p) => state.lots[p.lotId]).filter(isNotNull) : [];
  const displayLots = ancestorLots.length > 0 ? ancestorLots : wineLot ? [wineLot] : [];

  // Resolve origins and receptions
  const origins = displayLots.flatMap((l) => l?.origins ?? []);
  const parcels = origins.map((o) => state.parcels[o.parcelId]).filter(isNotNull);
  const allReceptionIds = origins.flatMap((o) => o.receptionIds);
  const receptions = allReceptionIds.map((rId) => state.receptions[rId]).filter(isNotNull);

  // Downstream shipments associated with this batch
  const relatedShipments = Object.values(state.shipments).filter((s) =>
    s.lines.some((l) => l.batchId === activeBatch?.id)
  );

  // Full immutable operations log
  const allOps = Object.values(state.cellarOps).sort((a, b) => b.at.localeCompare(a.at));
  const filteredOps = auditFilter === 'all' ? allOps : allOps.filter((o) => o.type === auditFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ marginBottom: '2px' }}>
        <div>
          <h1 className="page-title">Traçabilité & Généalogie</h1>
          <p className="page-subtitle">
            Arbre de filiation complet Amont ↔ Aval (de la parcelle de vigne jusqu’au client livré) et journal d’audit immuable.
          </p>
        </div>
        <span className="badge badge-green">Conservation stricte des origines</span>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <label className="card-title" htmlFor="batch-select" style={{ display: 'block' }}>
              Arbre Généalogique Visuel (Amont → Aval)
            </label>
            <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              Sélectionnez un lot de bouteilles pour reconstituer toute sa chaîne de filiation
            </span>
          </div>
          <select
            id="batch-select"
            className="form-select"
            style={{ maxWidth: '360px' }}
            value={activeBatch?.id}
            onChange={(e) => setSelectedBatchId(e.target.value)}
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {state.skus[b.skuId]?.label} ({b.vintage})
              </option>
            ))}
          </select>
        </div>

        {activeBatch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Visual Horizontal Lineage Flow */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                padding: '16px',
                background: 'var(--color-bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
              }}
            >
              {/* Node 1: Parcelles */}
              <div style={{ padding: '12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--color-forest)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-forest)' }}>
                  1. Amont · Parcelles ({parcels.length})
                </div>
                {parcels.map((p) => (
                  <div key={p.id} style={{ marginTop: '6px', fontSize: '12.5px' }}>
                    <strong>{p.code} — {p.name}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>{p.grape}</div>
                  </div>
                ))}
              </div>

              {/* Node 2: Réceptions */}
              <div style={{ padding: '12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--color-amber)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-amber)' }}>
                  2. Quai · Réceptions ({receptions.length})
                </div>
                {receptions.length > 0 ? (
                  receptions.map((r) => (
                    <div key={r.id} style={{ marginTop: '6px', fontSize: '12.5px' }} className="tabular">
                      <strong>Ticket {r.ticket}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                        Net {(r.netG / 1000).toLocaleString('fr-FR')} kg
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                    Millésime antérieur préchargé
                  </div>
                )}
              </div>

              {/* Node 3: Lots Vinification / Assemblage */}
              <div style={{ padding: '12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--color-grape)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-grape)' }}>
                  3. Chai · Vin & Assemblage
                </div>
                <div style={{ marginTop: '6px', fontSize: '12.5px' }}>
                  <strong>{wineLot ? `${wineLot.code} (${wineLot.name})` : 'Lot préchargé'}</strong>
                </div>
                {wineLot?.parents.map((p) => (
                  <div key={p.lotId} style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }} className="tabular">
                    ↳ Parent {state.lots[p.lotId]?.code ?? p.lotId} : {p.volumeMl / 1000} L
                  </div>
                ))}
              </div>

              {/* Node 4: Mise en bouteille & Matières sèches */}
              <div style={{ padding: '12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--color-forest)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-forest)' }}>
                  4. Mise · Lot Habillé
                </div>
                <div style={{ marginTop: '6px', fontSize: '12.5px' }} className="tabular">
                  <strong>{activeBatch.code}</strong> ({activeBatch.bottles} blles)
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                    Volume soutiré : {activeBatch.inputVolumeMl / 1000} L (perte {activeBatch.lossMl / 1000} L)
                  </div>
                </div>
              </div>

              {/* Node 5: Expéditions Clients */}
              <div style={{ padding: '12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--color-ink)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ink)' }}>
                  5. Aval · Livraisons ({relatedShipments.length})
                </div>
                {relatedShipments.length > 0 ? (
                  relatedShipments.map((s) => {
                    const order = state.orders[s.orderId];
                    const cust = order ? state.customers[order.customerId] : null;
                    const qty = s.lines.filter((l) => l.batchId === activeBatch.id).reduce((acc, l) => acc + l.quantity, 0);
                    return (
                      <div key={s.id} style={{ marginTop: '6px', fontSize: '12.5px' }} className="tabular">
                        <strong>{s.code} → {cust?.name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--color-forest)', fontWeight: 600 }}>
                          {qty} bouteilles livrées
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                    En cave (aucune expédition)
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Cards */}
            <div className="grid-2">
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px', background: 'var(--color-surface)' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-grape)', marginBottom: '8px' }}>
                  📦 Détail du Conditionnement & Matières Sèches Consommées ({activeBatch.code})
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                  Article : <strong>{state.skus[activeBatch.skuId]?.label}</strong> · Conditionné le {activeBatch.bottledAt.slice(0, 10)}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginTop: '4px' }} className="tabular">
                  Stock physique actuel : <strong>{activeBatch.physical}</strong> blles · Quarantaine retour : <strong>{activeBatch.quarantine}</strong> blles
                </div>
                {activeBatch.dryGoodsUsed.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {activeBatch.dryGoodsUsed.map((dg) => (
                      <span key={dg.dryGoodId} className="badge badge-muted tabular">
                        {state.dryGoods[dg.dryGoodId]?.name ?? dg.dryGoodId} : {dg.quantity} u.
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px', background: 'var(--color-surface)' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-forest)', marginBottom: '8px' }}>
                  🍷 Filiation Vinification & Parcelles d’Origine
                </div>
                {ancestorLots.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginBottom: '6px' }}>
                      Issu d’un assemblage de <strong>{ancestorLots.length} lots sources</strong> :
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {wineLot?.parents.map((p) => {
                        const parentLot = state.lots[p.lotId];
                        return (
                          <div
                            key={p.lotId}
                            style={{
                              padding: '6px 10px',
                              background: 'var(--color-forest-soft)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-forest-border)',
                              fontSize: '12px',
                            }}
                          >
                            <strong>{parentLot?.name ?? p.lotId}</strong> ({p.volumeMl / 1000} L)
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                    Lot source unique : <strong>{wineLot?.name ?? 'Origine historique'}</strong>
                  </div>
                )}

                <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {parcels.map((p) => (
                    <span key={p.id} className="badge badge-green">
                      🍇 {p.name} ({p.code})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Journal d'Audit Immuable */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Journal d’Audit Immuable des Opérations du Domaine</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              Distinction explicite entre historique fictif préchargé (`preloaded`) et opérations réalisées dans la session (`manual`)
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['all', 'blend', 'bottling', 'transfer', 'topping', 'loss', 'quality', 'reception'] as const).map((t) => (
              <button
                key={t}
                className={`badge ${auditFilter === t ? 'badge-green' : 'badge-muted'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setAuditFilter(t)}
              >
                {t === 'all' ? `Tous (${allOps.length})` : t}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Horodatage</th>
                <th>Type</th>
                <th>Lot concerné</th>
                <th>Opération & Détails</th>
                <th>Auteur</th>
                <th>Origine donnée</th>
              </tr>
            </thead>
            <tbody>
              {filteredOps.map((op) => {
                const lot = state.lots[op.lotId];
                return (
                  <tr key={op.id}>
                    <td className="tabular" style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                      {op.at.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td>
                      <span className="badge badge-muted">{op.type}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{lot ? `${lot.code} · ${lot.name}` : op.lotId}</td>
                    <td>
                      <strong>{op.label}</strong> — {op.details}
                    </td>
                    <td style={{ fontSize: '12.5px' }}>{op.actor}</td>
                    <td>
                      <span className={`badge ${op.source === 'manual' ? 'badge-green' : 'badge-muted'}`}>
                        {op.source === 'manual' ? '✓ Saisi en session' : 'Historique seed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
