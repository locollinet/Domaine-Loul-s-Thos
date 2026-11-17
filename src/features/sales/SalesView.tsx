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
import type { AssistantPrefillPayload } from '../ai/types';
import { useAssistantPrefill } from '../ai/useAssistantPrefill';
import { SubNav, type SubNavTab } from '../../ui/SubNav';
import { Modal } from '../../ui/Modal';

type SalesTabId = 'orders' | 'allocations';

export const SalesView: React.FC<{
  prefill?: Extract<AssistantPrefillPayload, { tab: 'sales' }>;
}> = ({ prefill }) => {
  const { state, dispatch } = useStore();
  const { isAddonEnabled } = useModuleConfig();
  const [subTab, setSubTab] = useState<SalesTabId>('orders');

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

  useAssistantPrefill(prefill, (p) => {
    if (p.subTab) setSubTab(p.subTab);
    if (p.customerId) setSelectedCustId(p.customerId);
    if (p.batchId) setSelectedBatchId(p.batchId);
    if (typeof p.quantity === 'number') setOrderQty(String(p.quantity));
    if (typeof p.asQuote === 'boolean') setAsQuote(p.asQuote);
    if (p.openModal === 'order') setShowOrderModal(true);
    if (p.openModal === 'ship' && state) {
      const targetOrder =
        (p.orderId ? state.orders[p.orderId] : undefined) ??
        Object.values(state.orders).find(
          (o) => o.status === 'confirmed' || o.status === 'partially_shipped'
        );
      if (targetOrder) {
        setShowShipModal(targetOrder.id);
        setShipLineId(targetOrder.lines[0]?.id ?? '');
        setShipQty(String(targetOrder.lines[0]?.reserved ?? 0));
      }
    }
  });

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
  const effectiveSubTab: SalesTabId = showAllocationsAddon ? subTab : 'orders';

  const handleConvertAllocationToOrder = async (
    customerId: string,
    qty: number,
    unitPriceEur: number
  ) => {
    const requestedQty = Math.min(qty, 24);
    const targetBatch =
      batches.find((b) => batchPosition(state, b).available >= requestedQty) ??
      batches.find((b) => batchPosition(state, b).available > 0) ??
      batches[0];
    if (!targetBatch) return;
    const avail = batchPosition(state, targetBatch).available;
    const finalQty = avail > 0 ? Math.min(requestedQty, avail) : requestedQty;
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
              quantity: finalQty,
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
                : showAllocationsAddon
                  ? 'Créez une nouvelle commande ferme ou gérez vos allocations annuelles.'
                  : 'Créez un devis ou une commande ferme directement sur votre stock disponible vendable.'}
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

      {/* 2. NAVIGATION D'ESPACES COMMERCIAUX + ACTIONS RAPIDES */}
      <SubNav
        id="sales-subnav"
        ariaLabel="Espaces Ventes et Allocations"
        tabs={[
          {
            id: 'orders',
            label: '🛍️ Commandes & Livraisons',
            icon: Award,
            count: ordersToShip.length > 0 ? `${ordersToShip.length} à expédier` : orders.length,
            alert: ordersToShip.length > 0,
            hint: 'Devis, commandes fermes avec réservation de stock, expéditions (BL) et retours',
          },
          ...(showAllocationsAddon
            ? [
                {
                  id: 'allocations' as const,
                  label: '👑 Allocations & Quotas Grands Crus',
                  icon: Crown,
                  hint: 'Répartir les quotas annuels entre restaurateurs, cavistes et importateurs',
                },
              ]
            : []),
        ] satisfies SubNavTab<SalesTabId>[]}
        active={effectiveSubTab}
        onChange={setSubTab}
        trailing={
          <>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setAsQuote(false);
                setShowOrderModal(true);
              }}
            >
              <Plus size={14} />
              <span>Nouvelle commande / devis</span>
            </button>

            {ordersToShip.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  const ord = ordersToShip[0]!;
                  setShowShipModal(ord.id);
                  setShipLineId(ord.lines[0]?.id ?? '');
                  setShipQty(String(ord.lines[0]?.reserved ?? 0));
                }}
              >
                <Truck size={14} />
                <span>Expédier ({ordersToShip.length})</span>
              </button>
            )}

            {shipments.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  const s = shipments[0]!;
                  setShowReturnModal(s.id);
                  setReturnBatchId(s.lines[0]?.batchId ?? '');
                }}
              >
                <RotateCcw size={14} />
                <span>Retour client</span>
              </button>
            )}
          </>
        }
      />

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
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {o.status === 'quote' && (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmOrder(o.id);
                                }}
                              >
                                Confirmer
                              </button>
                            )}
                            {(o.status === 'confirmed' || o.status === 'partially_shipped') && (
                              <button
                                className="btn btn-sm btn-accent"
                                onClick={(e) => {
                                  e.stopPropagation();
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelOrder(o.id);
                                }}
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
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
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
        </>
      )}

      {/* Modal Créer Commande / Devis (accessible depuis tout sous-onglet) */}
      {showOrderModal && (() => {
        const totalHt = (parseFloat(orderQty) || 0) * (parseFloat(orderPriceEur) || 0);
        return (
          <Modal
            eyebrow="Ventes & Réservations"
            title="Créer un devis ou une commande ferme"
            subtitle="Une commande ferme protège immédiatement le stock disponible contre la survente."
            onClose={() => setShowOrderModal(false)}
            onSubmit={handleCreateOrder}
            maxWidth="580px"
            footerNote={
              <span>
                Total estimé : <strong className="tabular" style={{ color: 'var(--color-forest)' }}>{totalHt.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT</strong>
              </span>
            }
            footer={
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOrderModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {asQuote ? 'Créer le devis' : 'Confirmer et réserver le stock'}
                </button>
              </>
            }
          >
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

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Quantité de bouteilles</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="1"
                    className="form-input tabular"
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    required
                  />
                  <span className="input-unit-cap">cols</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Prix unitaire</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input tabular"
                    value={orderPriceEur}
                    onChange={(e) => setOrderPriceEur(e.target.value)}
                    required
                  />
                  <span className="input-unit-cap">€ HT</span>
                </div>
              </div>
            </div>

            <label
              htmlFor="asQuoteCheck"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'var(--color-surface-soft)',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <input
                type="checkbox"
                id="asQuoteCheck"
                checked={asQuote}
                onChange={(e) => setAsQuote(e.target.checked)}
              />
              <span>
                Enregistrer comme <strong>simple devis</strong> (aucune réservation de stock)
              </span>
            </label>
          </Modal>
        );
      })()}

          {/* Modal Livraison */}
          {showShipModal && (() => {
            const shippingOrder = state.orders[showShipModal];
            const shippingLine = shippingOrder?.lines.find((l) => l.id === shipLineId) ?? shippingOrder?.lines[0];
            return (
              <Modal
                eyebrow="Expédition & Logistique"
                title="Expédition & Bon de livraison"
                subtitle="Cette opération déstocke immédiatement le stock physique et solde la réservation correspondante."
                onClose={() => setShowShipModal(null)}
                onSubmit={handleShipOrder}
                maxWidth="540px"
                footer={
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowShipModal(null)}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Valider l’expédition
                    </button>
                  </>
                }
              >
                {ordersToShip.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Commande à expédier</label>
                    <select
                      className="form-select"
                      value={showShipModal}
                      onChange={(e) => {
                        const nextOrd = state.orders[e.target.value];
                        setShowShipModal(e.target.value);
                        const nextLine = nextOrd?.lines.find((l) => l.reserved > 0) ?? nextOrd?.lines[0];
                        setShipLineId(nextLine?.id ?? '');
                        setShipQty(String(nextLine?.reserved ?? 0));
                      }}
                    >
                      {ordersToShip.map((o) => {
                        const cust = state.customers[o.customerId];
                        const rem = o.lines.reduce((s, l) => s + l.reserved, 0);
                        return (
                          <option key={o.id} value={o.id}>
                            {o.code} · {cust?.name ?? o.customerId} ({rem} cols réservés)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
                {shippingOrder && shippingOrder.lines.length > 1 && (
                  <div className="form-group">
                    <label className="form-label">Ligne de commande</label>
                    <select
                      className="form-select"
                      value={shippingLine?.id ?? ''}
                      onChange={(e) => {
                        const nextLine = shippingOrder.lines.find((l) => l.id === e.target.value);
                        setShipLineId(e.target.value);
                        setShipQty(String(nextLine?.reserved ?? 0));
                      }}
                    >
                      {shippingOrder.lines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {state.skus[l.skuId]?.label ?? l.skuId} ({l.reserved} réservés)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Quantité livrée</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      min="1"
                      max={shippingLine?.reserved || undefined}
                      className="form-input tabular"
                      value={shipQty}
                      onChange={(e) => setShipQty(e.target.value)}
                      required
                    />
                    <span className="input-unit-cap">cols</span>
                  </div>
                </div>
              </Modal>
            );
          })()}

          {/* Modal Retour Client */}
          {showReturnModal && (() => {
            const retShipment = state.shipments[showReturnModal];
            return (
              <Modal
                eyebrow="Qualité & Retours"
                title="Enregistrer un retour client en quarantaine"
                subtitle="Les bouteilles retournées sont isolées en quarantaine avant décision de remise en stock ou rebut."
                onClose={() => setShowReturnModal(null)}
                onSubmit={handleReturnReceive}
                maxWidth="540px"
                footer={
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(null)}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-accent">
                      Placer en quarantaine
                    </button>
                  </>
                }
              >
                {shipments.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Bon de livraison concerné</label>
                    <select
                      className="form-select"
                      value={showReturnModal}
                      onChange={(e) => {
                        const nextShip = state.shipments[e.target.value];
                        setShowReturnModal(e.target.value);
                        setReturnBatchId(nextShip?.lines[0]?.batchId ?? '');
                      }}
                    >
                      {shipments.map((s) => {
                        const ord = state.orders[s.orderId];
                        const cust = ord ? state.customers[ord.customerId] : undefined;
                        return (
                          <option key={s.id} value={s.id}>
                            {s.code} · {cust?.name ?? ord?.code ?? s.orderId}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
                {retShipment && retShipment.lines.length > 1 && (
                  <div className="form-group">
                    <label className="form-label">Lot retourné</label>
                    <select
                      className="form-select"
                      value={returnBatchId}
                      onChange={(e) => setReturnBatchId(e.target.value)}
                    >
                      {retShipment.lines.map((l) => {
                        const b = state.batches[l.batchId];
                        return (
                          <option key={l.batchId} value={l.batchId}>
                            {b?.code ?? l.batchId} ({l.quantity} livrés)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Nombre de bouteilles retournées</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      min="1"
                      className="form-input tabular"
                      value={returnQty}
                      onChange={(e) => setReturnQty(e.target.value)}
                      required
                    />
                    <span className="input-unit-cap">cols</span>
                  </div>
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
              </Modal>
            );
          })()}
    </div>
  );
};
