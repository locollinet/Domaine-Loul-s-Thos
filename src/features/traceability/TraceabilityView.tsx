import React, { useState } from 'react';
import { useStore } from '../../app/store-context';

export const TraceabilityView: React.FC = () => {
  const { state } = useStore();
  const [selectedBatchId, setSelectedBatchId] = useState<string>('batch-2023-old');

  if (!state) return null;

  const batches = Object.values(state.batches);
  const activeBatch = state.batches[selectedBatchId] || batches[0];

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-forest)' }}>
          Traçabilité & Généalogie
        </h1>
        <p style={{ color: 'var(--color-ink-muted)', fontSize: '14px' }}>
          Remontée intégrale de la bouteille livrée jusqu’au cep de vigne (et recherche descendante).
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <label className="card-title" htmlFor="batch-select">Sélectionner un lot de mise en bouteilles à auditer :</label>
          <select
            id="batch-select"
            className="form-select"
            style={{ maxWidth: '320px' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Step 1: Bottling batch */}
            <div style={{ border: '2px solid var(--color-grape)', borderRadius: 'var(--radius-md)', padding: '14px', background: 'var(--color-grape-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-grape)' }}>
                  📦 Conditionnement : Lot {activeBatch.code}
                </span>
                <span className="badge badge-grape">Bouteilles {activeBatch.vintage}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-ink)', marginTop: '6px' }}>
                Article : <strong>{state.skus[activeBatch.skuId]?.label}</strong> · Conditionné le {activeBatch.bottledAt.slice(0, 10)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }} className="tabular">
                Stock physique actuel : {activeBatch.physical} blles · Quarantaine : {activeBatch.quarantine} blles
              </div>
            </div>

            {/* Downstream: Shipments & Deliveries */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px', background: 'var(--color-surface)' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)', marginBottom: '8px' }}>
                🚚 Expéditions aval (Clients livrés)
              </div>
              {relatedShipments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {relatedShipments.map((s) => {
                    const order = state.orders[s.orderId];
                    const cust = order ? state.customers[order.customerId] : null;
                    return (
                      <div key={s.id} style={{ padding: '8px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                        Livraison <strong>{s.code}</strong> vers <strong>{cust?.name}</strong> · Expédié le {s.shippedAt.slice(0, 10)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--color-ink-muted)' }}>
                  Aucune expédition enregistrée pour ce lot à ce jour.
                </div>
              )}
            </div>

            {/* Upstream: Wine lot(s) */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px', background: 'var(--color-surface)' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-forest)', marginBottom: '8px' }}>
                🍷 Vinification amont : {wineLot ? `${wineLot.name} (${wineLot.code})` : 'Lot historique préchargé'}
              </div>

              {ancestorLots.length > 0 ? (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginBottom: '6px' }}>
                    Ce vin est issu d’un assemblage de <strong>{ancestorLots.length} lots sources</strong> :
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {wineLot?.parents.map((p) => {
                      const parentLot = state.lots[p.lotId];
                      return (
                        <div
                          key={p.lotId}
                          style={{
                            padding: '8px 12px',
                            background: 'var(--color-forest-soft)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid #C2DCC8',
                            fontSize: '12px',
                          }}
                        >
                          <strong>{parentLot?.name ?? p.lotId}</strong>
                          <div className="tabular" style={{ color: 'var(--color-forest)' }}>
                            Quote-part : {p.volumeMl / 1000} L
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                  Lot source unique : {wineLot?.name ?? 'Origine historique'} ({wineLot?.color === 'white' ? 'Vin blanc' : 'Vin rouge'})
                </div>
              )}
            </div>

            {/* Upstream: Receptions & Grapes */}
            {receptions.length > 0 && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px', background: 'var(--color-surface)' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)', marginBottom: '8px' }}>
                  ⚖️ Pesées & Réceptions de vendange à quai
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {receptions.map((r) => (
                    <div key={r.id} style={{ padding: '8px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }} className="tabular">
                      Ticket <strong>{r.ticket}</strong> : Brut {(r.grossG / 1000).toLocaleString('fr-FR')} kg − Tare {(r.tareG / 1000).toLocaleString('fr-FR')} kg = <strong>Net {(r.netG / 1000).toLocaleString('fr-FR')} kg</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upstream: Parcels of origin */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px', background: 'var(--color-surface)' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)', marginBottom: '8px' }}>
                🍇 Parcelles d’origine
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {parcels.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--color-surface-soft)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                    }}
                  >
                    <strong>{p.name} ({p.code})</strong>
                    <div style={{ color: 'var(--color-ink-muted)' }}>
                      {p.grape}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
