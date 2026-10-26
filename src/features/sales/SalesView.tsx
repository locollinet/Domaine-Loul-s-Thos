import React, { useState } from 'react';
import {
  Award,
  Crown,
  Plus,
  Truck,
  FileText,
  Euro,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { batchPosition } from '../../domain/selectors';
import { useModuleConfig } from '../modules/ModuleConfigContext';
import { AllocationsAndPrimeursPanel } from './AllocationsAndPrimeursPanel';

export const SalesView: React.FC = () => {
  const { state, dispatch } = useStore();
  const { isAddonEnabled } = useModuleConfig();
  const [subTab, setSubTab] = useState<'orders' | 'allocations'>('orders');

  // Create Order Modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [asQuote, setAsQuote] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState('cust-resto');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [orderQty, setOrderQty] = useState('120');
  const [orderPriceEur, setOrderPriceEur] = useState('20');

  // Shipment Modal
  const [showShipModal, setShowShipModal] = useState<string | null>(null); // orderId
  const [shipLineId, setShipLineId] = useState('');
  const [shipQty, setShipQty] = useState('72');

  // Return Modal
  const [showReturnModal, setShowReturnModal] = useState<string | null>(null); // shipmentId
  const [returnBatchId, setReturnBatchId] = useState('');
  const [returnQty, setReturnQty] = useState('6');
  const [returnReason, setReturnReason] = useState('Bouteilles couleuses lors du transport');

  if (!state) return null;

  const orders = Object.values(state.orders);
  const shipments = Object.values(state.shipments);
  const batches = Object.values(state.batches);

  const activeBatchId = selectedBatchId || batches[0]?.id || '';
  const activeBatch = state.batches[activeBatchId];
  const activeSku = activeBatch ? state.skus[activeBatch.skuId] : null;

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch || !activeSku) return;
    const qty = parseInt(orderQty, 10);
    const priceCents = Math.round(parseFloat(orderPriceEur) * 100);

    try {
      await dispatch({
        type: 'order.create',
        payload: {
          customerId: selectedCustId,
          asQuote,
          lines: [{ skuId: activeSku.id, batchId: activeBatch.id, quantity: qty, unitPriceHtCents: priceCents }],
        },
      });
      setShowOrderModal(false);
    } catch {
      // Handled
    }
  };

  const handleShipOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showShipModal) return;
    const qty = parseInt(shipQty, 10);
    try {
      await dispatch({
        type: 'shipment.create',
        payload: {
          orderId: showShipModal,
          lines: [{ orderLineId: shipLineId, quantity: qty }],
        },
      });
      setShowShipModal(null);
    } catch {
      // Handled
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    try {
      await dispatch({
        type: 'order.confirm',
        payload: { orderId },
      });
    } catch {
      // Handled
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await dispatch({
        type: 'order.cancel',
        payload: { orderId, reason: 'Annulation demandée par le client' },
      });
    } catch {
      // Handled
    }
  };

  const handleReturnReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReturnModal) return;
    const qty = parseInt(returnQty, 10);
    try {
      await dispatch({
        type: 'return.receive',
        payload: {
          shipmentId: showReturnModal,
          batchId: returnBatchId,
          quantity: qty,
          reason: returnReason,
        },
      });
      setShowReturnModal(null);
    } catch {
      // Handled
    }
  };

  const showAllocationsAddon = isAddonEnabled('allocations');
  const effectiveSubTab = showAllocationsAddon ? subTab : 'orders';

  const handleConvertAllocationToOrder = async (
    customerId: string,
    qty: number,
    unitPriceEur: number
  ) => {
    const targetBatch = batches[0];
    if (!targetBatch) return;
    try {
      await dispatch({
        type: 'order.create',
        payload: {
          customerId,
          asQuote: false,
          lines: [
            {
              skuId: targetBatch.skuId,
              batchId: targetBatch.id,
              quantity: Math.min(qty, 24),
              unitPriceHtCents: Math.round(unitPriceEur * 100),
            },
          ],
        },
      });
    } catch {
      // Handled
    }
  };

  // Synthèse commerciale pour jauges
  const ordersToShip = orders.filter(
    (o) => o.status === 'confirmed' || o.status === 'partially_shipped'
  );
  const quotesPending = orders.filter((o) => o.status === 'quote');
  const totalOrderedHtEur = Math.round(
    orders
      .filter((o) => o.status !== 'cancelled')
      .reduce(
        (sum, o) => sum + o.lines.reduce((a, l) => a + l.quantity * l.unitPriceHtCents, 0),
        0
      ) / 100
  );
  const totalColsOrdered = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.lines.reduce((a, l) => a + l.quantity, 0), 0);
  const totalColsShipped = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.lines.reduce((a, l) => a + l.shipped, 0), 0);
  const shippedPct = totalColsOrdered > 0 ? Math.round((totalColsShipped / totalColsOrdered) * 100) : 0;

  return (
    <div className="ds-overview">
      {/* 1. BANNIÈRE VENTES & ALLOCATIONS */}
      <section className="ds-hero ds-rise">
        <div>
          <div className="ds-eyebrow">
            <span className="ds-pulse" aria-hidden="true" />
            <span>Commerce & Allocations Domaine · Cavistes, Tables étoilées & Particuliers</span>
          </div>
          <h1 className="ds-hero-title">Ventes, Allocations Grands Crus & Commerce</h1>
          <p className="ds-hero-sub">
            Créez un devis ou une commande ferme qui réserve instantanément les bouteilles en cave,
            éditez vos bons de livraison sans jamais vendre deux fois le même col, et pilotez vos quotas annuels.
          </p>
        </div>

        <div className="ds-next">
          <div>
            <div className="ds-next-label">Priorité expéditions & clients</div>
            <div className="ds-next-title">
              {ordersToShip.length > 0
                ? `${ordersToShip.length} commande(s) confirmée(s) prête(s) à expédier`
                : quotesPending.length > 0
                  ? `${quotesPending.length} devis en attente de confirmation`
                  : 'Toutes les commandes confirmées sont expédiées'}
            </div>
            <p className="ds-next-desc">
              {ordersToShip.length > 0
                ? `Dossier ${ordersToShip[0]!.code} (${state.customers[ordersToShip[0]!.customerId]?.name}) : les bouteilles sont réservées et prêtes sur palette.`
                : 'Créez une nouvelle commande ferme ou préparez vos allocations annuelles.'}
            </p>
          </div>
          {ordersToShip.length > 0 ? (
            <button
              type="button"
              className="ds-cta"
              onClick={() => {
                const ord = ordersToShip[0]!;
                setShowShipModal(ord.id);
                setShipLineId(ord.lines[0]?.id ?? '');
                setShipQty(String(ord.lines[0]?.reserved ?? 0));
              }}
            >
              <span>Préparer la livraison {ordersToShip[0]!.code}</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="ds-cta"
              onClick={() => setShowOrderModal(true)}
            >
              <span>+ Nouvelle commande ou devis</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>

      {/* 2. GESTES COMMERCIAUX RAPIDES */}
      <section className="ds-rise ds-rise-1" aria-label="Gestes commerciaux">
        <div className="ds-section-head">
          <h2 className="ds-section-title">Que souhaitez-vous faire ?</h2>
          {showAllocationsAddon && (
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${effectiveSubTab === 'orders' ? 'active' : ''}`}
                onClick={() => setSubTab('orders')}
              >
                <Award size={14} />
                <span>1. Commandes & Livraisons ({orders.length})</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${effectiveSubTab === 'allocations' ? 'active' : ''}`}
                onClick={() => setSubTab('allocations')}
              >
                <Crown size={14} />
                <span>2. Allocations & Quotas Grands Crus</span>
              </button>
            </div>
          )}
        </div>

        <div className="ds-quick-grid-3">
          <button
            type="button"
            className="ds-tile is-recommended"
            onClick={() => {
              setAsQuote(false);
              setShowOrderModal(true);
            }}
          >
            <span className="ds-tile-badge">Réservation auto</span>
            <div className="ds-icon-bubble ds-tone-forest">
              <Plus size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">+ Nouvelle commande ou devis</div>
              <div className="ds-tile-sub">
                Bloque les bouteilles sur le stock disponible vendable
              </div>
            </div>
          </button>

          <button
            type="button"
            className="ds-tile"
            onClick={() => {
              if (ordersToShip[0]) {
                const ord = ordersToShip[0];
                setShowShipModal(ord.id);
                setShipLineId(ord.lines[0]?.id ?? '');
                setShipQty(String(ord.lines[0]?.reserved ?? 0));
              } else {
                setSubTab('orders');
              }
            }}
          >
            <div className="ds-icon-bubble ds-tone-gold">
              <Truck size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Expédier une commande (BL)</div>
              <div className="ds-tile-sub">
                {ordersToShip.length > 0
                  ? `${ordersToShip.length} commande(s) prête(s) au départ`
                  : 'Sortie physique de cave & bon de livraison'}
              </div>
            </div>
          </button>

          {showAllocationsAddon ? (
            <button
              type="button"
              className={`ds-tile ${effectiveSubTab === 'allocations' ? 'is-recommended' : ''}`}
              onClick={() => setSubTab(effectiveSubTab === 'allocations' ? 'orders' : 'allocations')}
            >
              <span className="ds-tile-badge">Cuvées rares</span>
              <div className="ds-icon-bubble ds-tone-grape">
                <Crown size={20} strokeWidth={1.9} />
              </div>
              <div>
                <div className="ds-tile-label">Gérer les allocations Grands Crus</div>
                <div className="ds-tile-sub">
                  Répartir vos quotas annuels entre restaurateurs et importateurs
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              className="ds-tile"
              onClick={() => {
                if (shipments[0]) {
                  setShowReturnModal(shipments[0].id);
                  setReturnBatchId(shipments[0].lines[0]?.batchId ?? '');
                }
              }}
            >
              <div className="ds-icon-bubble ds-tone-amber">
                <RotateCcw size={20} strokeWidth={1.9} />
              </div>
              <div>
                <div className="ds-tile-label">Enregistrer un retour client</div>
                <div className="ds-tile-sub">
                  Isoler automatiquement les bouteilles retournées en quarantaine
                </div>
              </div>
            </button>
          )}
        </div>
      </section>

      {effectiveSubTab === 'allocations' && showAllocationsAddon ? (
        <AllocationsAndPrimeursPanel
          customers={state.customers}
          batches={batches}
          skus={state.skus}
          onConvertAllocationToOrder={handleConvertAllocationToOrder}
        />
      ) : (
        <>
          {/* 3. JAUGES VISUELLES COMMERCIALES */}
          <section className="ds-stats ds-rise ds-rise-2" aria-label="Repères commerciaux">
            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-forest">
                  <Euro size={16} />
                </span>
                <span>Portefeuille commandes HT</span>
              </div>
              <div className="ds-stat-value">
                {totalOrderedHtEur.toLocaleString('fr-FR')}
                <span className="ds-stat-unit">€</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span style={{ width: '85%', background: 'var(--color-forest)' }} />
              </div>
              <div className="ds-stat-foot">
                Sur {orders.filter((o) => o.status !== 'cancelled').length} dossier(s) actifs
              </div>
            </div>

            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-gold">
                  <Truck size={16} />
                </span>
                <span>Avancement des livraisons</span>
              </div>
              <div className="ds-stat-value">
                {shippedPct}
                <span className="ds-stat-unit">%</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span style={{ width: `${shippedPct}%`, background: 'var(--color-gold-dark)' }} />
              </div>
              <div className="ds-stat-foot">
                {totalColsShipped} bouteilles livrées sur {totalColsOrdered} commandées
              </div>
            </div>

            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-amber">
                  <FileText size={16} />
                </span>
                <span>Commandes à expédier</span>
              </div>
              <div className="ds-stat-value">
                {ordersToShip.length}
                <span className="ds-stat-unit">dossier(s)</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span
                  style={{
                    width: ordersToShip.length > 0 ? '60%' : '100%',
                    background: ordersToShip.length > 0 ? 'var(--color-amber)' : 'var(--color-forest)',
                  }}
                />
              </div>
              <div className="ds-stat-foot">
                Stock déjà réservé en cave, prêt pour départ transporteur
              </div>
            </div>

            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-grape">
                  <Award size={16} />
                </span>
                <span>Bons de livraison émis</span>
              </div>
              <div className="ds-stat-value">
                {shipments.length}
                <span className="ds-stat-unit">BL</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span style={{ width: '100%', background: 'var(--color-grape)' }} />
              </div>
              <div className="ds-stat-foot">
                Reliés à la facturation et à la généalogie aval des lots
              </div>
            </div>
          </section>

          {/* 4. TABLEAU DES COMMANDES & DEVIS */}
          <div className="ds-panel ds-rise ds-rise-3">
            <div className="ds-section-head">
              <div>
                <h2 className="ds-section-title">Commandes & Devis</h2>
                <span className="ds-section-meta">
                  Parcours simple : 1. Devis (sans blocage) → 2. Confirmée (stock réservé) → 3. Livrée (stock sorti)
                </span>
              </div>
              <span className="badge badge-green">{orders.length} dossier(s)</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Réf</th>
                    <th>Client</th>
                    <th>Lignes & Avancement d’expédition</th>
                    <th>Montant HT</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const cust = state.customers[o.customerId];
                    const totalHt = o.lines.reduce((a, l) => a + l.quantity * l.unitPriceHtCents, 0);
                    return (
                      <tr
                        key={o.id}
                        className={o.status !== 'shipped' && o.status !== 'cancelled' ? 'ds-clickable-row' : undefined}
                        onClick={() => {
                          if (o.status === 'confirmed' || o.status === 'partially_shipped') {
                            setShowShipModal(o.id);
                            setShipLineId(o.lines[0]?.id ?? '');
                            setShipQty(String(o.lines[0]?.reserved ?? 0));
                          } else if (o.status === 'quote') {
                            void handleConfirmOrder(o.id);
                          }
                        }}
                      >
                        <td style={{ fontWeight: 700 }}>{o.code}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{cust?.name ?? o.customerId}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }}>
                            {cust?.city} · {cust?.kind === 'b2b' ? 'Professionnel' : 'Particulier'}
                          </div>
                        </td>
                        <td>
                          {o.lines.map((l) => {
                            const batch = state.batches[l.batchId];
                            const linePct = l.quantity > 0 ? Math.round((l.shipped / l.quantity) * 100) : 0;
                            return (
                              <div key={l.id} style={{ minWidth: '210px', marginBottom: '4px' }}>
                                <div className="tabular" style={{ fontSize: '13px' }}>
                                  <strong>{l.quantity} cols</strong> ({batch?.code}) ·{' '}
                                  <span style={{ color: 'var(--color-forest)', fontWeight: 700 }}>
                                    {l.shipped} livrées
                                  </span>{' '}
                                  · {l.reserved} réservées
                                </div>
                                <div className="ds-bar" style={{ height: '5px', marginTop: '4px' }}>
                                  <span style={{ width: `${linePct}%`, background: 'var(--color-forest)' }} />
                                </div>
                              </div>
                            );
                          })}
                        </td>
                        <td className="tabular" style={{ fontWeight: 700, fontSize: '15px' }}>
                          {(totalHt / 100).toLocaleString('fr-FR')} €
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              o.status === 'shipped'
                                ? 'badge-muted'
                                : o.status === 'partially_shipped'
                                  ? 'badge-amber'
                                  : o.status === 'confirmed'
                                    ? 'badge-green'
                                    : o.status === 'quote'
                                      ? 'badge-grape'
                                      : 'badge-crimson'
                            }`}
                          >
                            {o.status === 'shipped'
                              ? 'Livrée'
                              : o.status === 'partially_shipped'
                                ? 'Partielle'
                                : o.status === 'confirmed'
                                  ? 'Confirmée'
                                  : o.status === 'quote'
                                    ? 'Devis'
                                    : 'Annulée'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {o.status === 'quote' && (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleConfirmOrder(o.id)}
                              >
                                Confirmer
                              </button>
                            )}
                            {(o.status === 'confirmed' || o.status === 'partially_shipped') && (
                              <button
                                className="btn btn-sm btn-accent"
                                onClick={() => {
                                  setShowShipModal(o.id);
                                  setShipLineId(o.lines[0]?.id ?? '');
                                  const rem = o.lines[0]?.reserved ?? 0;
                                  setShipQty(String(rem));
                                }}
                              >
                                Livrer
                              </button>
                            )}
                            {(o.status === 'quote' || o.status === 'confirmed') && (
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleCancelOrder(o.id)}
                              >
                                Annuler
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. BONS DE LIVRAISON (EXPÉDITIONS) */}
          <div className="ds-panel ds-rise ds-rise-4">
            <div className="ds-section-head">
              <div>
                <h2 className="ds-section-title">Bons de livraison (Expéditions)</h2>
                <span className="ds-section-meta">
                  La livraison déstocke physiquement la cave et consomme la réservation correspondante
                </span>
              </div>
              <span className="badge badge-green">{shipments.length} livraison(s)</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>BL</th>
                    <th>Commande</th>
                    <th>Quantité livrée</th>
                    <th>Date d’expédition</th>
                    <th>Facturation</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s) => {
                    const totalShipped = s.lines.reduce((a, l) => a + l.quantity, 0);
                    const order = state.orders[s.orderId];
                    return (
                      <tr
                        key={s.id}
                        className="ds-clickable-row"
                        onClick={() => {
                          setShowReturnModal(s.id);
                          setReturnBatchId(s.lines[0]?.batchId ?? '');
                        }}
                      >
                        <td style={{ fontWeight: 700 }}>{s.code}</td>
                        <td>{order?.code ?? s.orderId}</td>
                        <td className="tabular" style={{ fontWeight: 600 }}>{totalShipped} bouteilles</td>
                        <td>{s.shippedAt.slice(0, 16).replace('T', ' ')}</td>
                        <td>
                          {s.invoiceId ? (
                            <span className="badge badge-green">
                              Facturée ({state.invoices[s.invoiceId]?.code})
                            </span>
                          ) : (
                            <span className="badge badge-amber">À facturer</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setShowReturnModal(s.id);
                              setReturnBatchId(s.lines[0]?.batchId ?? '');
                            }}
                          >
                            Enregistrer retour
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Créer Commande / Devis */}
          {showOrderModal && (
            <div className="modal-backdrop" onClick={() => setShowOrderModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
                  Créer un devis ou une commande ferme
                </h2>
                <form onSubmit={handleCreateOrder}>
                  <div className="form-group">
                    <label className="form-label">Client</label>
                    <select
                      className="form-select"
                      value={selectedCustId}
                      onChange={(e) => setSelectedCustId(e.target.value)}
                    >
                      {Object.values(state.customers).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.kind === 'b2b' ? 'B2B' : 'Particulier'}) — {c.city}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Lot de bouteilles commandé</label>
                    <select
                      className="form-select"
                      value={activeBatchId}
                      onChange={(e) => {
                        setSelectedBatchId(e.target.value);
                        const b = state.batches[e.target.value];
                        if (b) {
                          const price = state.priceList[b.skuId] ?? 2000;
                          setOrderPriceEur(String(price / 100));
                        }
                      }}
                    >
                      {batches.map((b) => {
                        const pos = batchPosition(state, b);
                        return (
                          <option key={b.id} value={b.id}>
                            {b.code} · {state.skus[b.skuId]?.label} ({pos.available} dispo)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Quantité de bouteilles</label>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={orderQty}
                        onChange={(e) => setOrderQty(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Prix unitaire HT (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={orderPriceEur}
                        onChange={(e) => setOrderPriceEur(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="asQuoteCheck"
                      checked={asQuote}
                      onChange={(e) => setAsQuote(e.target.checked)}
                    />
                    <label htmlFor="asQuoteCheck" style={{ fontSize: '13px' }}>
                      Enregistrer comme <strong>simple devis</strong> (aucune réservation de stock)
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowOrderModal(false)}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {asQuote ? 'Créer le devis' : 'Confirmer et réserver le stock'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Livraison */}
          {showShipModal && (
            <div className="modal-backdrop" onClick={() => setShowShipModal(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
                  Expédition & Bon de livraison
                </h2>
                <form onSubmit={handleShipOrder}>
                  <div className="form-group">
                    <label className="form-label">Quantité livrée</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={shipQty}
                      onChange={(e) => setShipQty(e.target.value)}
                      required
                    />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginBottom: '16px' }}>
                    Cette opération déstocke immédiatement le stock physique et solde la réservation correspondante.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowShipModal(null)}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Valider l’expédition
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Retour Client */}
          {showReturnModal && (
            <div className="modal-backdrop" onClick={() => setShowReturnModal(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
                  Enregistrer un retour client en quarantaine
                </h2>
                <form onSubmit={handleReturnReceive}>
                  <div className="form-group">
                    <label className="form-label">Nombre de bouteilles retournées</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={returnQty}
                      onChange={(e) => setReturnQty(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Motif du retour</label>
                    <textarea
                      className="form-textarea"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(null)}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-accent">
                      Placer en quarantaine
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
