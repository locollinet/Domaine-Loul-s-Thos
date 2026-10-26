import React, { useState } from 'react';
import {
  ShoppingBag,
  PackageCheck,
  AlertTriangle,
  ClipboardCheck,
  Plus,
  ArrowRight,
  Truck,
} from 'lucide-react';
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
  const lowGoods = dryGoods.filter((g) => g.onHand <= g.reorderPoint);
  const openPos = purchaseOrders.filter((po) => po.status !== 'received');

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
    <div className="ds-overview">
      {/* 1. BANNIÈRE MATIÈRES SÈCHES & ACHATS */}
      <section className="ds-hero ds-rise">
        <div>
          <div className="ds-eyebrow">
            <span className="ds-pulse" aria-hidden="true" />
            <span>Approvisionnement d’habillage · Bouteilles, Bouchons, Étiquettes & Cartons</span>
          </div>
          <h1 className="ds-hero-title">Matières sèches & Achats</h1>
          <p className="ds-hero-sub">
            Anticipez vos besoins avant chaque mise en bouteilles : suivez vos stocks réels en
            entrepôt, réceptionnez vos commandes fournisseurs et tracez vos comptages d’inventaire.
          </p>
        </div>

        <div className="ds-next">
          <div>
            <div className="ds-next-label">Priorité approvisionnement</div>
            <div className="ds-next-title">
              {openPos.length > 0
                ? `${openPos.length} livraison(s) fournisseur en attente de réception`
                : lowGoods.length > 0
                  ? `${lowGoods.length} fourniture(s) sous le seuil d’alerte`
                  : 'Tous les stocks d’habillage sont au-dessus du seuil'}
            </div>
            <p className="ds-next-desc">
              {openPos.length > 0
                ? `La commande ${openPos[0]!.code} (${openPos[0]!.supplier}) peut être réceptionnée dès l’arrivée du camion.`
                : 'Une commande fournisseur n’augmente le stock utilisable qu’à la réception physique.'}
            </p>
          </div>
          {openPos.length > 0 ? (
            <button
              type="button"
              className="ds-cta"
              onClick={() => {
                const po = openPos[0]!;
                setShowReceiveModal(po.id);
                const remaining = (po.lines[0]?.ordered ?? 0) - (po.lines[0]?.received ?? 0);
                setReceiveQty(String(remaining));
              }}
            >
              <span>Réceptionner {openPos[0]!.code}</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="ds-cta"
              onClick={() => setShowPoModal(true)}
            >
              <span>+ Commander des fournitures</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>

      {/* 2. GESTES RAPIDES (3 TUILES VERBES) */}
      <section className="ds-rise ds-rise-1" aria-label="Actions matières sèches">
        <div className="ds-section-head">
          <h2 className="ds-section-title">Que souhaitez-vous enregistrer ?</h2>
          <span className="ds-section-meta">Mise à jour immédiate du coût moyen pondéré</span>
        </div>
        <div className="ds-quick-grid-3">
          <button
            type="button"
            className="ds-tile is-recommended"
            onClick={() => setShowPoModal(true)}
          >
            <span className="ds-tile-badge">Verrier / Imprimeur</span>
            <div className="ds-icon-bubble ds-tone-forest">
              <Plus size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">+ Commander des matières sèches</div>
              <div className="ds-tile-sub">Bouteilles 75 cl, bouchons liège, étiquettes, cartons</div>
            </div>
          </button>

          <button
            type="button"
            className="ds-tile"
            onClick={() => {
              if (openPos[0]) {
                const po = openPos[0];
                setShowReceiveModal(po.id);
                const remaining = (po.lines[0]?.ordered ?? 0) - (po.lines[0]?.received ?? 0);
                setReceiveQty(String(remaining));
              } else {
                setShowPoModal(true);
              }
            }}
          >
            <div className="ds-icon-bubble ds-tone-gold">
              <Truck size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Réceptionner une palette</div>
              <div className="ds-tile-sub">
                {openPos.length > 0
                  ? `${openPos.length} commande(s) ouverte(s) à valider`
                  : 'Aucune commande en attente'}
              </div>
            </div>
          </button>

          <button
            type="button"
            className="ds-tile"
            onClick={() => {
              if (dryGoods[0]) {
                setShowInvModal(dryGoods[0].id);
                setInvCounted(String(dryGoods[0].onHand));
              }
            }}
          >
            <div className="ds-icon-bubble ds-tone-amber">
              <ClipboardCheck size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Corriger un stock (Inventaire)</div>
              <div className="ds-tile-sub">Déclarer le stock réellement compté en magasin</div>
            </div>
          </button>
        </div>
      </section>

      {/* 3. JAUGES VISUELLES D'APPROVISIONNEMENT */}
      <section className="ds-stats ds-rise ds-rise-2" aria-label="Repères matières sèches">
        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-forest">
              <ShoppingBag size={16} />
            </span>
            <span>Références d’habillage suivies</span>
          </div>
          <div className="ds-stat-value">
            {dryGoods.length}
            <span className="ds-stat-unit">articles</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: '100%', background: 'var(--color-forest)' }} />
          </div>
          <div className="ds-stat-foot">
            Contrôlés automatiquement lors de chaque ordre de mise
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-amber">
              <AlertTriangle size={16} />
            </span>
            <span>Articles sous le seuil d’alerte</span>
          </div>
          <div className="ds-stat-value">
            {lowGoods.length}
            <span className="ds-stat-unit">alerte(s)</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span
              style={{
                width: `${dryGoods.length > 0 ? Math.round(((dryGoods.length - lowGoods.length) / dryGoods.length) * 100) : 100}%`,
                background: lowGoods.length > 0 ? 'var(--color-amber)' : 'var(--color-forest)',
              }}
            />
          </div>
          <div className="ds-stat-foot">
            {lowGoods.length > 0
              ? lowGoods.map((g) => g.name).join(', ')
              : 'Tous les stocks sont confortables'}
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-gold">
              <Truck size={16} />
            </span>
            <span>Commandes fournisseurs en cours</span>
          </div>
          <div className="ds-stat-value">
            {openPos.length}
            <span className="ds-stat-unit">en attente</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: openPos.length > 0 ? '60%' : '100%', background: 'var(--color-gold-dark)' }} />
          </div>
          <div className="ds-stat-foot">
            Sur {purchaseOrders.length} commande(s) passée(s)
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-ink">
              <PackageCheck size={16} />
            </span>
            <span>Capacité de tirage immédiate</span>
          </div>
          <div className="ds-stat-value">
            {Math.min(
              state.dryGoods['bottle-750']?.onHand ?? 0,
              state.dryGoods['cork-natural']?.onHand ?? 0
            ).toLocaleString('fr-FR')}
            <span className="ds-stat-unit">cols max</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: '78%', background: 'var(--color-forest)' }} />
          </div>
          <div className="ds-stat-foot">
            Limité par le composant le moins abondant en magasin
          </div>
        </div>
      </section>

      {/* 4. TABLEAU DES STOCKS AVEC JAUGES VISUELLES */}
      <div className="ds-panel ds-rise ds-rise-3">
        <div className="ds-section-head">
          <div>
            <h2 className="ds-section-title">Stocks de matières sèches actuels</h2>
            <span className="ds-section-meta">
              Jauge verte = stock supérieur au seuil d’alerte · Jauge ambre = réapprovisionnement conseillé
            </span>
          </div>
          <span className="badge badge-green">{dryGoods.length} articles</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Niveau par rapport au seuil</th>
                <th>Stock physique</th>
                <th>Seuil d’alerte</th>
                <th>Coût moyen connu</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dryGoods.map((g) => {
                const isLow = g.onHand <= g.reorderPoint;
                const gaugePct = Math.min(
                  100,
                  Math.round((g.onHand / Math.max(1, g.reorderPoint * 2)) * 100)
                );
                return (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 700 }}>{g.name}</td>
                    <td style={{ minWidth: '150px' }}>
                      <div className="ds-bar">
                        <span
                          style={{
                            width: `${gaugePct}%`,
                            background: isLow ? 'var(--color-amber)' : 'var(--color-forest)',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', marginTop: '3px' }}>
                        {isLow ? '⚠️ Sous le seuil de sécurité' : '✓ Niveau confortable'}
                      </div>
                    </td>
                    <td className="tabular" style={{ fontWeight: 700, fontSize: '15px' }}>
                      {g.onHand.toLocaleString('fr-FR')} {g.unit}s{' '}
                      {isLow && (
                        <span className="badge badge-amber" style={{ marginLeft: '6px' }}>
                          Seuil bas
                        </span>
                      )}
                    </td>
                    <td className="tabular">{g.reorderPoint.toLocaleString('fr-FR')}</td>
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

      {/* 5. COMMANDES FOURNISSEURS */}
      <div className="ds-panel ds-rise ds-rise-4">
        <div className="ds-section-head">
          <div>
            <h2 className="ds-section-title">Commandes fournisseurs</h2>
            <span className="ds-section-meta">
              Une commande fournisseur n’augmente le stock physique qu’à la réception effective
            </span>
          </div>
          <span className="badge badge-muted">{purchaseOrders.length} commande(s)</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Réf</th>
                <th>Fournisseur</th>
                <th>Dates</th>
                <th>Avancement de réception</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td style={{ fontWeight: 700 }}>{po.code}</td>
                  <td style={{ fontWeight: 600 }}>{po.supplier}</td>
                  <td style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)' }}>
                    Commandé le {po.orderedAt} · Attendu le {po.expectedAt}
                  </td>
                  <td>
                    {po.lines.map((l) => {
                      const pct = l.ordered > 0 ? Math.min(100, Math.round((l.received / l.ordered) * 100)) : 0;
                      return (
                        <div key={l.dryGoodId} style={{ minWidth: '170px' }}>
                          <div className="tabular" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '3px' }}>
                            {state.dryGoods[l.dryGoodId]?.name} : {l.received} / {l.ordered} reçus
                          </div>
                          <div className="ds-bar" style={{ height: '5px' }}>
                            <span style={{ width: `${pct}%`, background: 'var(--color-forest)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        po.status === 'received'
                          ? 'badge-green'
                          : po.status === 'partially_received'
                            ? 'badge-amber'
                            : 'badge-muted'
                      }`}
                    >
                      {po.status === 'received'
                        ? 'Reçue'
                        : po.status === 'partially_received'
                          ? 'Partielle'
                          : 'Ouverte'}
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
                    <option key={g.id} value={g.id}>
                      {g.name} (en stock : {g.onHand})
                    </option>
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
