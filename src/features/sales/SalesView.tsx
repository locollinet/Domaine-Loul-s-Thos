import React, { useState } from 'react';
import { useStore } from '../../app/store-context';
import { batchPosition } from '../../domain/selectors';

export const SalesView: React.FC = () => {
  const { state, dispatch } = useStore();

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
  const [returnReason, setReturnReason] = useState('Bouteilles couleuses lors du transport (fictif)');

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-forest)' }}>
            Ventes & Commerce
          </h1>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '14px' }}>
            Devis, commandes fermes avec réservations, expéditions partielles et gestion des retours.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowOrderModal(true)}>
          + Nouvelle commande ou devis
        </button>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Commandes & Devis</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              La réservation s’effectue sur le stock disponible vendable (aucun double déstockage).
            </div>
          </div>
          <span className="badge badge-green">{orders.length} dossier(s)</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Réf</th>
                <th>Client</th>
                <th>Lignes & Quantités</th>
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
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700 }}>{o.code}</td>
                    <td>{cust?.name ?? o.customerId}</td>
                    <td>
                      {o.lines.map((l) => {
                        const batch = state.batches[l.batchId];
                        return (
                          <div key={l.id} className="tabular" style={{ fontSize: '13px' }}>
                            {l.quantity} blles ({batch?.code}) · <strong>{l.shipped} livrées</strong> · {l.reserved} réservées
                          </div>
                        );
                      })}
                    </td>
                    <td className="tabular" style={{ fontWeight: 600 }}>
                      {(totalHt / 100).toLocaleString('fr-FR')} €
                    </td>
                    <td>
                      <span className={`badge ${
                        o.status === 'shipped' ? 'badge-muted' :
                        o.status === 'partially_shipped' ? 'badge-amber' :
                        o.status === 'confirmed' ? 'badge-green' :
                        o.status === 'quote' ? 'badge-grape' : 'badge-crimson'
                      }`}>
                        {o.status === 'shipped' ? 'Livrée' :
                         o.status === 'partially_shipped' ? 'Partielle' :
                         o.status === 'confirmed' ? 'Confirmée' :
                         o.status === 'quote' ? 'Devis' : 'Annulée'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
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
                              const rem = (o.lines[0]?.reserved ?? 0);
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

      {/* Shipments Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Bons de livraison (Expéditions)</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              La livraison déstocke physiquement et consomme le reliquat réservé correspondant.
            </div>
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
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>{s.code}</td>
                    <td>{order?.code ?? s.orderId}</td>
                    <td className="tabular" style={{ fontWeight: 600 }}>{totalShipped} bouteilles</td>
                    <td>{s.shippedAt.slice(0, 16).replace('T', ' ')}</td>
                    <td>
                      {s.invoiceId ? (
                        <span className="badge badge-green">Facturée ({state.invoices[s.invoiceId]?.code})</span>
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
    </div>
  );
};
