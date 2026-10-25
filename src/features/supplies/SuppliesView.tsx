import React, { useState } from 'react';
import { useStore } from '../../app/store-context';

export const SuppliesView: React.FC = () => {
  const { state, dispatch } = useStore();

  // PO Modal
  const [showPoModal, setShowPoModal] = useState(false);
  const [supplier, setSupplier] = useState('Verrerie Exemple — fictif');
  const [poGoodId, setPoGoodId] = useState('bottle-750');
  const [poQuantity, setPoQuantity] = useState('1000');
  const [poCostEur, setPoCostEur] = useState('0.28');

  // Receive Modal
  const [showReceiveModal, setShowReceiveModal] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');

  // Inventory Modal
  const [showInvModal, setShowInvModal] = useState<string | null>(null);
  const [invCounted, setInvCounted] = useState('');
  const [invReason, setInvReason] = useState('Inventaire périodique de cave');

  if (!state) return null;

  const dryGoods = Object.values(state.dryGoods);
  const purchaseOrders = Object.values(state.purchaseOrders);

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(poQuantity, 10);
    const costCents = Math.round(parseFloat(poCostEur) * 100);
    try {
      await dispatch({
        type: 'purchase.create',
        payload: {
          supplier,
          expectedAt: '2026-11-15',
          lines: [{ dryGoodId: poGoodId, ordered: qty, unitCostCents: costCents }],
        },
      });
      setShowPoModal(false);
    } catch {
      // Handled
    }
  };

  const handleReceivePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReceiveModal) return;
    const po = state.purchaseOrders[showReceiveModal];
    if (!po) return;
    const line = po.lines[0];
    if (!line) return;
    const qty = parseInt(receiveQty, 10);
    try {
      await dispatch({
        type: 'purchase.receive',
        payload: {
          purchaseOrderId: po.id,
          lines: [{ dryGoodId: line.dryGoodId, quantity: qty, supplierLot: 'LOT-FURN-01' }],
        },
      });
      setShowReceiveModal(null);
    } catch {
      // Handled
    }
  };

  const handleInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showInvModal) return;
    const counted = parseInt(invCounted, 10);
    try {
      await dispatch({
        type: 'inventory.count',
        payload: {
          dryGoodId: showInvModal,
          counted,
          reason: invReason,
        },
      });
      setShowInvModal(null);
    } catch {
      // Handled
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-forest)' }}>
            Matières sèches & Achats
          </h1>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '14px' }}>
            Approvisionnements de bouteilles, bouchons, étiquettes, réceptions et écarts d’inventaire.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowPoModal(true)}>
          + Commander des matières sèches
        </button>
      </div>

      {/* Dry Goods Inventory */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Stocks de matières sèches actuels</h2>
          <span className="badge badge-green">{dryGoods.length} articles</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Stock physique</th>
                <th>Seuil d’alerte</th>
                <th>Coût moyen connu</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dryGoods.map((g) => {
                const isLow = g.onHand <= g.reorderPoint;
                return (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.name}</td>
                    <td className="tabular" style={{ fontWeight: 700, fontSize: '15px' }}>
                      {g.onHand} {g.unit}s {isLow && <span className="badge badge-amber" style={{ marginLeft: '6px' }}>Seuil bas</span>}
                    </td>
                    <td className="tabular">{g.reorderPoint}</td>
                    <td className="tabular">
                      {g.unitCostCents !== null ? `${(g.unitCostCents / 100).toFixed(2)} €` : 'Inconnu'}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setShowInvModal(g.id);
                          setInvCounted(String(g.onHand));
                        }}
                      >
                        Ajuster inventaire
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase Orders */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Commandes fournisseurs</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              Une commande fournisseur n’augmente le stock physique qu’à la réception effective.
            </div>
          </div>
          <span className="badge badge-muted">{purchaseOrders.length} commande(s)</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Réf</th>
                <th>Fournisseur</th>
                <th>Date d’effet</th>
                <th>Lignes</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td style={{ fontWeight: 700 }}>{po.code}</td>
                  <td>{po.supplier}</td>
                  <td>Commandé le {po.orderedAt} (attendu le {po.expectedAt})</td>
                  <td>
                    {po.lines.map((l) => (
                      <div key={l.dryGoodId} className="tabular" style={{ fontSize: '13px' }}>
                        {state.dryGoods[l.dryGoodId]?.name} : {l.received} / {l.ordered} reçus
                      </div>
                    ))}
                  </td>
                  <td>
                    <span className={`badge ${po.status === 'received' ? 'badge-green' : po.status === 'partially_received' ? 'badge-amber' : 'badge-muted'}`}>
                      {po.status === 'received' ? 'Reçue' : po.status === 'partially_received' ? 'Partielle' : 'Ouverte'}
                    </span>
                  </td>
                  <td>
                    {po.status !== 'received' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setShowReceiveModal(po.id);
                          const remaining = (po.lines[0]?.ordered ?? 0) - (po.lines[0]?.received ?? 0);
                          setReceiveQty(String(remaining));
                        }}
                      >
                        Réceptionner
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Créer PO */}
      {showPoModal && (
        <div className="modal-backdrop" onClick={() => setShowPoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Nouvelle commande fournisseur
            </h2>
            <form onSubmit={handleCreatePo}>
              <div className="form-group">
                <label className="form-label">Fournisseur</label>
                <input
                  type="text"
                  className="form-input"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Fourniture commandée</label>
                <select
                  className="form-select"
                  value={poGoodId}
                  onChange={(e) => setPoGoodId(e.target.value)}
                >
                  {dryGoods.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Quantité commandée</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={poQuantity}
                    onChange={(e) => setPoQuantity(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Prix unitaire (€ HT)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={poCostEur}
                    onChange={(e) => setPoCostEur(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPoModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer la commande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Réception PO */}
      {showReceiveModal && (
        <div className="modal-backdrop" onClick={() => setShowReceiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Réceptionner la commande {state.purchaseOrders[showReceiveModal]?.code}
            </h2>
            <form onSubmit={handleReceivePo}>
              <div className="form-group">
                <label className="form-label">Quantité reçue</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={receiveQty}
                  onChange={(e) => setReceiveQty(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceiveModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider la réception
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Inventaire */}
      {showInvModal && (
        <div className="modal-backdrop" onClick={() => setShowInvModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Comptage d’inventaire — {state.dryGoods[showInvModal]?.name}
            </h2>
            <form onSubmit={handleInventory}>
              <div className="form-group">
                <label className="form-label">Quantité physique réellement constatée</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={invCounted}
                  onChange={(e) => setInvCounted(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Motif / Contexte de l’écart</label>
                <input
                  type="text"
                  className="form-input"
                  value={invReason}
                  onChange={(e) => setInvReason(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowInvModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-accent">
                  Enregistrer le comptage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
