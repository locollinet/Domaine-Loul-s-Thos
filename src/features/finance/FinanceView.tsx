import React, { useState } from 'react';
import { useStore } from '../../app/store-context';
import { invoiceBalance } from '../../domain/selectors';

export const FinanceView: React.FC = () => {
  const { state, dispatch } = useStore();

  // Payment Modal
  const [showPayModal, setShowPayModal] = useState<string | null>(null); // invoiceId
  const [payAmountEur, setPayAmountEur] = useState('1000');
  const [payMethod, setPayMethod] = useState<'virement-simulé' | 'chèque-simulé'>('virement-simulé');

  // Credit Note Modal
  const [showCreditModal, setShowCreditModal] = useState<string | null>(null);
  const [creditHtEur, setCreditHtEur] = useState('50');
  const [creditReason, setCreditReason] = useState('Geste commercial suite incident de transport (fictif)');

  if (!state) return null;

  const invoices = Object.values(state.invoices);
  const shipments = Object.values(state.shipments);
  const unInvoicedShipments = shipments.filter((s) => s.invoiceId === null);
  const forecast = Object.values(state.forecast);
  const project = state.projects['renewal-2027'];

  const handleCreateInvoice = async (shipmentId: string) => {
    try {
      await dispatch({
        type: 'invoice.create',
        payload: { shipmentId },
      });
    } catch {
      // Handled
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayModal) return;
    const amountCents = Math.round(parseFloat(payAmountEur) * 100);
    try {
      await dispatch({
        type: 'payment.record',
        payload: {
          invoiceId: showPayModal,
          amountCents,
          method: payMethod,
        },
      });
      setShowPayModal(null);
    } catch {
      // Handled
    }
  };

  const handleCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCreditModal) return;
    const htCents = Math.round(parseFloat(creditHtEur) * 100);
    try {
      await dispatch({
        type: 'creditNote.create',
        payload: {
          invoiceId: showCreditModal,
          htCents,
          reason: creditReason,
        },
      });
      setShowCreditModal(null);
    } catch {
      // Handled
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-forest)' }}>
          Pilotage, Finance de démo & Scénarios
        </h1>
        <p style={{ color: 'var(--color-ink-muted)', fontSize: '14px' }}>
          Facturation illustrative, prévisions de trésorerie et budget de renouvellement parcellaire 2027.
        </p>
      </div>

      {/* Legal & Demo Disclaimer */}
      <div className="alert alert-warning">
        <div>
          <strong>Document de démonstration :</strong> Les factures, avoirs et prévisions ci-dessous sont générés à titre illustratif dans le cadre du Domaine des Trois Coteaux (fictif). Ils n’ont aucune valeur comptable, bancaire ou fiscale réelle.
        </div>
      </div>

      {/* Invoices List */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Factures de démonstration</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              Émises à partir des bons de livraison effectifs sans double déstockage.
            </div>
          </div>
          <span className="badge badge-green">{invoices.length} facture(s)</span>
        </div>

        {unInvoicedShipments.length > 0 && (
          <div style={{ marginBottom: '14px', padding: '10px', background: 'var(--color-amber-soft)', border: '1px solid #EED7B5', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
              {unInvoicedShipments.length} livraison(s) non encore facturée(s).
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {unInvoicedShipments.map((s) => (
                <button
                  key={s.id}
                  className="btn btn-sm btn-primary"
                  onClick={() => handleCreateInvoice(s.id)}
                >
                  Facturer {s.code}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Client</th>
                <th>Date / Échéance</th>
                <th>Montant HT</th>
                <th>TVA (20% fictive)</th>
                <th>Total TTC</th>
                <th>Règlements reçus</th>
                <th>Solde restant dû</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const cust = state.customers[inv.customerId];
                const bal = invoiceBalance(state, inv.id);
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 700 }}>{inv.code}</td>
                    <td>{cust?.name ?? inv.customerId}</td>
                    <td style={{ fontSize: '12px' }}>
                      Émise le {inv.issuedAt}<br />Échéance : {inv.dueAt}
                    </td>
                    <td className="tabular">{(inv.htCents / 100).toLocaleString('fr-FR')} €</td>
                    <td className="tabular">{(inv.vatCents / 100).toLocaleString('fr-FR')} €</td>
                    <td className="tabular" style={{ fontWeight: 700 }}>
                      {(inv.ttcCents / 100).toLocaleString('fr-FR')} €
                    </td>
                    <td className="tabular" style={{ color: 'var(--color-forest)', fontWeight: 600 }}>
                      {(bal.paid / 100).toLocaleString('fr-FR')} €
                    </td>
                    <td className="tabular" style={{ fontWeight: 700, color: bal.balance > 0 ? 'var(--color-crimson)' : 'var(--color-forest)' }}>
                      {(bal.balance / 100).toLocaleString('fr-FR')} €
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {bal.balance > 0 && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setShowPayModal(inv.id);
                              setPayAmountEur((bal.balance / 100).toFixed(2));
                            }}
                          >
                            Encaisser
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setShowCreditModal(inv.id);
                          }}
                        >
                          Avoir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Flow Forecast & Project Renewal */}
      <div className="grid-2">
        {/* Cash Forecast Schedule */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Échéancier de trésorerie prévisionnelle</h2>
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                Séparation stricte : Certain (facturé) ≠ Engagé (commandé) ≠ Estimé (hypothèse).
              </div>
            </div>
            <span className="badge badge-muted">{forecast.length} flux</span>
          </div>

          <div className="table-wrap">
            <table style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th>Degré de certitude</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((f) => (
                  <tr key={f.id}>
                    <td>{f.date}</td>
                    <td>{f.label}</td>
                    <td>
                      <span className={`badge ${
                        f.certainty === 'certain' ? 'badge-green' :
                        f.certainty === 'engaged' ? 'badge-amber' : 'badge-muted'
                      }`}>
                        {f.certainty === 'certain' ? 'Certain' :
                         f.certainty === 'engaged' ? 'Engagé' : 'Estimé'}
                      </span>
                    </td>
                    <td className="tabular" style={{ fontWeight: 600, color: f.direction === 'in' ? 'var(--color-forest)' : 'var(--color-crimson)' }}>
                      {f.direction === 'in' ? '+' : '-'}{(f.amountCents / 100).toLocaleString('fr-FR')} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2027 Renewal Project */}
        {project && (
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">{project.name}</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Horizon {project.year} · Scénario d’investissement
                </div>
              </div>
              <span className="badge badge-grape">Scénario fictif</span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--color-ink)', marginBottom: '12px' }}>
              <strong>Parcelle visée :</strong> La Vigne du Moulin (vieilles vignes de 1972). Aucune autorisation administrative réelle générée.
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink-muted)', marginBottom: '6px' }}>
                Lignes de budget prévisionnel
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {project.budgetLines.map((l, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: 'var(--color-surface-soft)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                    }}
                  >
                    <span>{l.label}</span>
                    <strong className="tabular">{(l.amountCents / 100).toLocaleString('fr-FR')} €</strong>
                  </div>
                ))}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderTop: '1px solid var(--color-border)',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  <span>Total investissement estimé</span>
                  <span className="tabular" style={{ color: 'var(--color-forest)' }}>
                    {(project.budgetLines.reduce((a, b) => a + b.amountCents, 0) / 100).toLocaleString('fr-FR')} €
                  </span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
              {project.assumptions.map((a, i) => (
                <div key={i}>• {a}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Règlement */}
      {showPayModal && (
        <div className="modal-backdrop" onClick={() => setShowPayModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Enregistrer un règlement reçu
            </h2>
            <form onSubmit={handleRecordPayment}>
              <div className="form-group">
                <label className="form-label">Montant perçu (€ TTC)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  value={payAmountEur}
                  onChange={(e) => setPayAmountEur(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mode de règlement</label>
                <select
                  className="form-select"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as 'virement-simulé' | 'chèque-simulé')}
                >
                  <option value="virement-simulé">Virement bancaire (simulé)</option>
                  <option value="chèque-simulé">Chèque (simulé)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider l’encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Avoir */}
      {showCreditModal && (
        <div className="modal-backdrop" onClick={() => setShowCreditModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Émettre un avoir de démonstration
            </h2>
            <form onSubmit={handleCreditNote}>
              <div className="form-group">
                <label className="form-label">Montant de l’avoir (€ HT)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  value={creditHtEur}
                  onChange={(e) => setCreditHtEur(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Motif commercial de l’avoir</label>
                <textarea
                  className="form-textarea"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  required
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
                Note : L’avoir financier ne réintègre aucun stock physique de bouteilles.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreditModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Créer l’avoir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
