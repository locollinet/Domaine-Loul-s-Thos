import React, { useState } from 'react';
import {
  Grape,
  Scale,
  Wine,
  Package,
  Truck,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useStore } from '../../app/store-context';

const OP_TYPE_LABELS: Record<string, string> = {
  all: 'Toutes les opérations',
  blend: 'Assemblages',
  bottling: 'Mises en bouteilles',
  transfer: 'Soutirages & Transferts',
  topping: 'Ouillages',
  loss: 'Pertes & Part des anges',
  quality: 'Décisions qualité',
  reception: 'Réceptions vendange',
};

export const TraceabilityView: React.FC = () => {
  const { state } = useStore();
  const [selectedBatchId, setSelectedBatchId] = useState<string>('batch-2023-old');
  const [auditFilter, setAuditFilter] = useState<string>('all');

  if (!state) return null;

  const batches = Object.values(state.batches);
  const activeBatch = state.batches[selectedBatchId] || batches[batches.length - 1] || batches[0];

  const isNotNull = <T,>(val: T | null | undefined): val is T => val !== null && val !== undefined;

  // Resolve upstream genealogy
  const wineLot = activeBatch?.lotId ? state.lots[activeBatch.lotId] : null;

  // Resolve ancestors lots if blend
  const ancestorLots = wineLot
    ? wineLot.parents.map((p) => state.lots[p.lotId]).filter(isNotNull)
    : [];
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
  const filteredOps =
    auditFilter === 'all' ? allOps : allOps.filter((o) => o.type === auditFilter);

  return (
    <div className="ds-overview">
      {/* 1. BANNIÈRE TRAÇABILITÉ & GÉNÉALOGIE */}
      <section className="ds-hero ds-rise">
        <div>
          <div className="ds-eyebrow">
            <span className="ds-pulse" aria-hidden="true" />
            <span>Filiation ascendante & descendante · Du cep de vigne jusqu’à la table du client</span>
          </div>
          <h1 className="ds-hero-title">Traçabilité & Généalogie</h1>
          <p className="ds-hero-sub">
            Sélectionnez n’importe quel lot de bouteilles pour retrouver instantanément ses
            parcelles d’origine, ses tickets de pesée, ses assemblages au chai, ses fournitures
            d’habillage et les clients livrés.
          </p>
        </div>

        <div className="ds-next">
          <div>
            <div className="ds-next-label">Lot actuellement inspecté</div>
            <div className="ds-next-title">
              {activeBatch
                ? `${activeBatch.code} · ${state.skus[activeBatch.skuId]?.label ?? activeBatch.skuId}`
                : 'Aucun lot sélectionné'}
            </div>
            <p className="ds-next-desc">
              {parcels.length} parcelle(s) d’origine identifiée(s) · {activeBatch?.bottles ?? 0} cols
              produits · {relatedShipments.length} expédition(s) client rattachée(s).
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#E5C89E', fontSize: '12.5px', fontWeight: 700 }}>
            <ShieldCheck size={18} />
            <span>Journal immuable vérifié ({allOps.length} écritures)</span>
          </div>
        </div>
      </section>

      {/* 2. SÉLECTEUR TACTILE DE LOT DE BOUTEILLES */}
      <section className="ds-panel ds-rise ds-rise-1">
        <div className="ds-section-head">
          <div>
            <label className="ds-section-title" htmlFor="batch-select" style={{ display: 'block' }}>
              Arbre Généalogique Visuel (Amont → Aval)
            </label>
            <span className="ds-section-meta">
              Cliquez sur une mise en bouteilles pour dérouler toute son histoire
            </span>
          </div>
          <select
            id="batch-select"
            className="form-select"
            style={{ maxWidth: '340px' }}
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

        {/* Cartes de sélection rapide des lots de mise */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '10px',
            marginBottom: '18px',
          }}
        >
          {batches.map((b) => {
            const isSel = b.id === activeBatch?.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBatchId(b.id)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: isSel ? '2px solid var(--color-forest)' : '1px solid var(--color-border)',
                  background: isSel ? 'var(--color-forest-soft)' : 'var(--color-bg)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--color-ink)' }}>{b.code}</strong>
                  <span className="badge badge-gold">Millésime {b.vintage}</span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                  {state.skus[b.skuId]?.label} · <strong>{b.bottles} cols</strong>
                </div>
              </button>
            );
          })}
        </div>

        {activeBatch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Stepper généalogique 5 étapes */}
            <div className="ds-journey">
              <div className="ds-step is-done">
                <div className="ds-step-node">
                  <Grape size={18} />
                </div>
                <div className="ds-step-label">1. Parcelles ({parcels.length})</div>
                <div className="ds-step-state">
                  {parcels.map((p) => p.name).join(', ') || 'Origine domaine'}
                </div>
              </div>

              <div className="ds-step is-done">
                <div className="ds-step-node">
                  <Scale size={18} />
                </div>
                <div className="ds-step-label">2. Quai & Pesées ({receptions.length})</div>
                <div className="ds-step-state">
                  {receptions.length > 0
                    ? `${receptions.map((r) => r.ticket).join(', ')}`
                    : 'Millésime antérieur'}
                </div>
              </div>

              <div className="ds-step is-done">
                <div className="ds-step-node">
                  <Wine size={18} />
                </div>
                <div className="ds-step-label">3. Vin & Assemblage</div>
                <div className="ds-step-state">
                  {wineLot ? `${wineLot.code} (${wineLot.name})` : 'Lot historique'}
                </div>
              </div>

              <div className="ds-step is-next">
                <div className="ds-step-node">
                  <Package size={18} />
                </div>
                <div className="ds-step-label">4. Lot Habillé</div>
                <div className="ds-step-state">
                  {activeBatch.code} · {activeBatch.bottles} cols
                </div>
              </div>

              <div className={`ds-step ${relatedShipments.length > 0 ? 'is-done' : 'is-active'}`}>
                <div className="ds-step-node">
                  <Truck size={18} />
                </div>
                <div className="ds-step-label">5. Clients ({relatedShipments.length})</div>
                <div className="ds-step-state">
                  {relatedShipments.length > 0
                    ? `${relatedShipments.length} expédition(s)`
                    : 'En garde au domaine'}
                </div>
              </div>
            </div>

            {/* Detailed 5 Nodes Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Node 1: Parcelles */}
              <div style={{ padding: '14px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', borderTop: '3px solid var(--color-forest)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-forest)' }}>
                  1. Amont · Parcelles ({parcels.length})
                </div>
                {parcels.map((p) => (
                  <div key={p.id} style={{ marginTop: '8px', fontSize: '13px' }}>
                    <strong>{p.code} — {p.name}</strong>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }}>
                      {p.grape} · {p.areaM2 ? `${(p.areaM2.value / 10000).toFixed(2)} ha` : 'Surface NC'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Node 2: Réceptions */}
              <div style={{ padding: '14px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', borderTop: '3px solid var(--color-amber)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-amber)' }}>
                  2. Quai · Réceptions ({receptions.length})
                </div>
                {receptions.length > 0 ? (
                  receptions.map((r) => (
                    <div key={r.id} style={{ marginTop: '8px', fontSize: '13px' }} className="tabular">
                      <strong>Ticket {r.ticket}</strong>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }}>
                        Net {(r.netG / 1000).toLocaleString('fr-FR')} kg
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                    Millésime antérieur préchargé
                  </div>
                )}
              </div>

              {/* Node 3: Lots Vinification / Assemblage */}
              <div style={{ padding: '14px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', borderTop: '3px solid var(--color-grape)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-grape)' }}>
                  3. Chai · Vin & Assemblage
                </div>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <strong>{wineLot ? `${wineLot.code} (${wineLot.name})` : 'Lot préchargé'}</strong>
                </div>
                {wineLot?.parents.map((p) => (
                  <div key={p.lotId} style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)', marginTop: '3px' }} className="tabular">
                    ↳ Parent {state.lots[p.lotId]?.code ?? p.lotId} : {p.volumeMl / 1000} L
                  </div>
                ))}
              </div>

              {/* Node 4: Mise en bouteille & Matières sèches */}
              <div style={{ padding: '14px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', borderTop: '3px solid var(--color-forest)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-forest)' }}>
                  4. Mise · Lot Habillé
                </div>
                <div style={{ marginTop: '8px', fontSize: '13px' }} className="tabular">
                  <strong>{activeBatch.code}</strong> ({activeBatch.bottles} blles)
                  <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }}>
                    Volume soutiré : {activeBatch.inputVolumeMl / 1000} L (perte {activeBatch.lossMl / 1000} L)
                  </div>
                </div>
              </div>

              {/* Node 5: Expéditions Clients */}
              <div style={{ padding: '14px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', borderTop: '3px solid var(--color-ink)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ink)' }}>
                  5. Aval · Livraisons ({relatedShipments.length})
                </div>
                {relatedShipments.length > 0 ? (
                  relatedShipments.map((s) => {
                    const order = state.orders[s.orderId];
                    const cust = order ? state.customers[order.customerId] : null;
                    const qty = s.lines
                      .filter((l) => l.batchId === activeBatch.id)
                      .reduce((acc, l) => acc + l.quantity, 0);
                    return (
                      <div key={s.id} style={{ marginTop: '8px', fontSize: '13px' }} className="tabular">
                        <strong>{s.code} → {cust?.name}</strong>
                        <div style={{ fontSize: '11.5px', color: 'var(--color-forest)', fontWeight: 600 }}>
                          {qty} bouteilles livrées
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                    En cave (aucune expédition)
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Cards */}
            <div className="grid-2">
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px', background: 'var(--color-bg)' }}>
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

              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px', background: 'var(--color-bg)' }}>
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
      </section>

      {/* 3. JOURNAL D'AUDIT IMMUABLE EN FRANÇAIS CLAIR */}
      <section className="ds-panel ds-rise ds-rise-2">
        <div className="ds-section-head">
          <div>
            <h2 className="ds-section-title">Journal d’Audit Immuable des Opérations du Domaine</h2>
            <span className="ds-section-meta">
              Distinction explicite entre historique préchargé et opérations saisies pendant votre session
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['all', 'blend', 'bottling', 'transfer', 'topping', 'loss', 'quality', 'reception'] as const).map((t) => (
              <button
                key={t}
                className={`badge ${auditFilter === t ? 'badge-green' : 'badge-muted'}`}
                style={{ cursor: 'pointer', padding: '5px 10px' }}
                onClick={() => setAuditFilter(t)}
              >
                {t === 'all' ? `Tout voir (${allOps.length})` : OP_TYPE_LABELS[t] ?? t}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date & Heure</th>
                <th>Nature de l’opération</th>
                <th>Cuvée / Lot concerné</th>
                <th>Détail de l’intervention</th>
                <th>Opérateur</th>
                <th>Origine</th>
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
                      <span className="badge badge-gold">{OP_TYPE_LABELS[op.type] ?? op.type}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{lot ? `${lot.code} · ${lot.name}` : op.lotId}</td>
                    <td>
                      <strong>{op.label}</strong> — {op.details}
                    </td>
                    <td style={{ fontSize: '12.5px' }}>{op.actor}</td>
                    <td>
                      <span className={`badge ${op.source === 'manual' ? 'badge-green' : 'badge-muted'}`}>
                        {op.source === 'manual' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={11} /> Saisi en session
                          </span>
                        ) : (
                          'Historique domaine'
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
