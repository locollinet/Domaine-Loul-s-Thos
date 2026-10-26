import React, { useState } from 'react';
import {
  TrendingUp,
  Landmark,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Sprout,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { invoiceBalance } from '../../domain/selectors';
import { useModuleConfig } from '../modules/ModuleConfigContext';
import { CustomsDrmPanel } from './CustomsDrmPanel';

export const FinanceView: React.FC = () => {
  const { state, dispatch } = useStore();
  const { isAddonEnabled } = useModuleConfig();
  const [subTab, setSubTab] = useState<'finance' | 'drm'>('finance');

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

  const showDrmAddon = isAddonEnabled('drm_douanes');
  const effectiveSubTab = showDrmAddon ? subTab : 'finance';

  // Calculs synthétiques pour jauges visuelles
  const financeTotals = invoices.reduce(
    (acc, inv) => {
      const bal = invoiceBalance(state, inv.id);
      acc.ttc += inv.ttcCents;
      acc.paid += bal.paid;
      acc.due += bal.balance;
      return acc;
    },
    { ttc: 0, paid: 0, due: 0 }
  );
  const paidPct = financeTotals.ttc > 0 ? Math.round((financeTotals.paid / financeTotals.ttc) * 100) : 0;
  const unpaidInvoices = invoices.filter((inv) => invoiceBalance(state, inv.id).balance > 0);
  const projectTotalEur = project
    ? Math.round(project.budgetLines.reduce((a, b) => a + b.amountCents, 0) / 100)
    : 0;

  return (
    <div className="ds-overview">
      {/* 1. BANNIÈRE PILOTAGE, DOUANES & FINANCE */}
      <section className="ds-hero ds-rise">
        <div>
          <div className="ds-eyebrow">
            <span className="ds-pulse" aria-hidden="true" />
            <span>Gestion administrative, Douanes CIEL & Prévisions multi-millésimes</span>
          </div>
          <h1 className="ds-hero-title">Pilotage, DRM Douanes (CIEL) & Finance de démo</h1>
          <p className="ds-hero-sub">
            Transformez vos bons de livraison en factures sans ressaisie, pointez vos encaissements,
            contrôlez votre balance mensuelle douanière en hectolitres et préparez le budget 2027.
          </p>
        </div>

        <div className="ds-next">
          <div>
            <div className="ds-next-label">Priorité administrative</div>
            <div className="ds-next-title">
              {unInvoicedShipments.length > 0
                ? `${unInvoicedShipments.length} bon(s) de livraison prêt(s) à facturer`
                : unpaidInvoices.length > 0
                  ? `${unpaidInvoices.length} facture(s) en attente de règlement (${Math.round(financeTotals.due / 100).toLocaleString('fr-FR')} €)`
                  : 'Toutes les livraisons sont facturées et soldées'}
            </div>
            <p className="ds-next-desc">
              {unInvoicedShipments.length > 0
                ? `L’expédition ${unInvoicedShipments[0]!.code} est partie : créez sa facture en 1 clic sans toucher au stock.`
                : 'Pointez un règlement reçu ou vérifiez la balance DRM du mois.'}
            </p>
          </div>
          {unInvoicedShipments.length > 0 ? (
            <button
              type="button"
              className="ds-cta"
              onClick={() => handleCreateInvoice(unInvoicedShipments[0]!.id)}
            >
              <span>Facturer {unInvoicedShipments[0]!.code}</span>
              <ArrowRight size={16} />
            </button>
          ) : unpaidInvoices.length > 0 ? (
            <button
              type="button"
              className="ds-cta"
              onClick={() => {
                const inv = unpaidInvoices[0]!;
                const bal = invoiceBalance(state, inv.id);
                setShowPayModal(inv.id);
                setPayAmountEur((bal.balance / 100).toFixed(2));
              }}
            >
              <span>Encaisser {unpaidInvoices[0]!.code}</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="ds-cta"
              onClick={() => setSubTab(showDrmAddon ? 'drm' : 'finance')}
            >
              <span>Voir la balance DRM</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>

      {/* Mention explicite démo */}
      <div className="alert alert-warning">
        <div>
          <strong>Document de démonstration :</strong> Les factures, avoirs, balances DRM et prévisions ci-dessous sont générés à titre illustratif dans le cadre du Domaine des Trois Coteaux (fictif). Ils n’ont aucune valeur comptable, bancaire, douanière ou fiscale réelle.
        </div>
      </div>

      {/* 2. CHOIX DE L'ATELIER ADMINISTRATIF */}
      <section className="ds-rise ds-rise-1" aria-label="Ateliers administratifs et douaniers">
        <div className="ds-section-head">
          <h2 className="ds-section-title">Que souhaitez-vous consulter ?</h2>
          {showDrmAddon && (
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${effectiveSubTab === 'finance' ? 'active' : ''}`}
                onClick={() => setSubTab('finance')}
              >
                <TrendingUp size={14} />
                <span>1. Facturation, Trésorerie & Budget 2027</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${effectiveSubTab === 'drm' ? 'active' : ''}`}
                onClick={() => setSubTab('drm')}
              >
                <Landmark size={14} />
                <span>2. DRM Douanes (CIEL) & DAE/DSA</span>
              </button>
            </div>
          )}
        </div>

        <div className="ds-quick-grid-3">
          <button
            type="button"
            className={`ds-tile ${effectiveSubTab === 'finance' ? 'is-recommended' : ''}`}
            onClick={() => setSubTab('finance')}
          >
            <span className="ds-tile-badge">Factures & Solde</span>
            <div className="ds-icon-bubble ds-tone-forest">
              <Receipt size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Suivre les factures et règlements</div>
              <div className="ds-tile-sub">
                Émettre une facture depuis un BL, pointer un virement ou créer un avoir
              </div>
            </div>
          </button>

          {showDrmAddon && (
            <button
              type="button"
              className={`ds-tile ${effectiveSubTab === 'drm' ? 'is-recommended' : ''}`}
              onClick={() => setSubTab('drm')}
            >
              <span className="ds-tile-badge">Douanes hL</span>
              <div className="ds-icon-bubble ds-tone-gold">
                <Landmark size={20} strokeWidth={1.9} />
              </div>
              <div>
                <div className="ds-tile-label">Contrôler la DRM mensuelle (CIEL)</div>
                <div className="ds-tile-sub">
                  Balance automatique en hectolitres et registre des capsules CRD
                </div>
              </div>
            </button>
          )}

          <button
            type="button"
            className="ds-tile"
            onClick={() => setSubTab('finance')}
          >
            <div className="ds-icon-bubble ds-tone-grape">
              <Sprout size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Préparer l’horizon 2027</div>
              <div className="ds-tile-sub">
                Échéancier de trésorerie et budget de replantation « Vigne du Moulin »
              </div>
            </div>
          </button>
        </div>
      </section>

      {effectiveSubTab === 'drm' && showDrmAddon ? (
        <CustomsDrmPanel state={state} />
      ) : (
        <>
          {/* 3. JAUGES VISUELLES FINANCIÈRES */}
          <section className="ds-stats ds-rise ds-rise-2" aria-label="Repères financiers">
            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-ink">
                  <Receipt size={16} />
                </span>
                <span>Total facturé TTC</span>
              </div>
              <div className="ds-stat-value">
                {Math.round(financeTotals.ttc / 100).toLocaleString('fr-FR')}
                <span className="ds-stat-unit">€</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span style={{ width: `${paidPct}%`, background: 'var(--color-forest)' }} />
              </div>
              <div className="ds-stat-foot">
                Sur {invoices.length} facture(s) émise(s)
              </div>
            </div>

            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-forest">
                  <CheckCircle2 size={16} />
                </span>
                <span>Déjà encaissé</span>
              </div>
              <div className="ds-stat-value" style={{ color: 'var(--color-forest)' }}>
                {Math.round(financeTotals.paid / 100).toLocaleString('fr-FR')}
                <span className="ds-stat-unit">€</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span style={{ width: `${paidPct}%`, background: 'var(--color-forest)' }} />
              </div>
              <div className="ds-stat-foot">
                {paidPct}% du montant facturé réglé
              </div>
            </div>

            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-amber">
                  <AlertCircle size={16} />
                </span>
                <span>Reste à encaisser</span>
              </div>
              <div className="ds-stat-value">
                {Math.round(financeTotals.due / 100).toLocaleString('fr-FR')}
                <span className="ds-stat-unit">€</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span
                  style={{
                    width: `${100 - paidPct}%`,
                    background: financeTotals.due > 0 ? 'var(--color-amber)' : 'var(--color-forest)',
                  }}
                />
              </div>
              <div className="ds-stat-foot">
                {unpaidInvoices.length} facture(s) ouverte(s)
              </div>
            </div>

            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-grape">
                  <Sprout size={16} />
                </span>
                <span>Budget Plantation 2027</span>
              </div>
              <div className="ds-stat-value">
                {projectTotalEur.toLocaleString('fr-FR')}
                <span className="ds-stat-unit">€</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span style={{ width: '100%', background: 'var(--color-grape)' }} />
              </div>
              <div className="ds-stat-foot">
                Renouvellement Vigne du Moulin (scénario)
              </div>
            </div>
          </section>

          {/* 4. TABLEAU DES FACTURES */}
          <div className="ds-panel ds-rise ds-rise-3">
            <div className="ds-section-head">
              <div>
                <h2 className="ds-section-title">Factures de démonstration</h2>
                <span className="ds-section-meta">
                  Émises à partir des bons de livraison effectifs sans double déstockage
                </span>
              </div>
              <span className="badge badge-green">{invoices.length} facture(s)</span>
            </div>

            {unInvoicedShipments.length > 0 && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '12px 14px',
                  background: 'var(--color-amber-soft)',
                  border: '1px solid #EED7B5',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)' }}>
                  ⚡ {unInvoicedShipments.length} livraison(s) expédiée(s) en attente de facturation :
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
                    <th>Total TTC</th>
                    <th>Progression règlement</th>
                    <th>Règlements reçus</th>
                    <th>Solde restant dû</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const cust = state.customers[inv.customerId];
                    const bal = invoiceBalance(state, inv.id);
                    const invPaidPct = inv.ttcCents > 0 ? Math.min(100, Math.round((bal.paid / inv.ttcCents) * 100)) : 0;
                    return (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 700 }}>{inv.code}</td>
                        <td style={{ fontWeight: 600 }}>{cust?.name ?? inv.customerId}</td>
                        <td style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                          Émise le {inv.issuedAt}
                          <br />
                          Échéance : {inv.dueAt}
                        </td>
                        <td className="tabular" style={{ fontWeight: 700 }}>
                          {(inv.ttcCents / 100).toLocaleString('fr-FR')} €
                          <div style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-ink-muted)' }}>
                            HT : {(inv.htCents / 100).toLocaleString('fr-FR')} €
                          </div>
                        </td>
                        <td style={{ minWidth: '130px' }}>
                          <div className="ds-bar">
                            <span style={{ width: `${invPaidPct}%`, background: 'var(--color-forest)' }} />
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', marginTop: '3px' }}>
                            {invPaidPct}% réglé
                          </div>
                        </td>
                        <td className="tabular" style={{ color: 'var(--color-forest)', fontWeight: 600 }}>
                          {(bal.paid / 100).toLocaleString('fr-FR')} €
                        </td>
                        <td
                          className="tabular"
                          style={{
                            fontWeight: 700,
                            color: bal.balance > 0 ? 'var(--color-crimson)' : 'var(--color-forest)',
                          }}
                        >
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

          {/* 5. TRÉSORERIE PRÉVISIONNELLE & PROJET 2027 */}
          <div className="ds-split ds-rise ds-rise-4">
            {/* Cash Forecast Schedule */}
            <div className="ds-panel">
              <div className="ds-section-head">
                <div>
                  <h2 className="ds-section-title">Échéancier de trésorerie prévisionnelle</h2>
                  <span className="ds-section-meta">
                    Certain (facturé) ≠ Engagé (commandé) ≠ Estimé (hypothèse)
                  </span>
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
                        <td className="tabular">{f.date}</td>
                        <td style={{ fontWeight: 600 }}>{f.label}</td>
                        <td>
                          <span
                            className={`badge ${
                              f.certainty === 'certain'
                                ? 'badge-green'
                                : f.certainty === 'engaged'
                                  ? 'badge-amber'
                                  : 'badge-muted'
                            }`}
                          >
                            {f.certainty === 'certain'
                              ? 'Certain'
                              : f.certainty === 'engaged'
                                ? 'Engagé'
                                : 'Estimé'}
                          </span>
                        </td>
                        <td
                          className="tabular"
                          style={{
                            fontWeight: 700,
                            color: f.direction === 'in' ? 'var(--color-forest)' : 'var(--color-crimson)',
                          }}
                        >
                          {f.direction === 'in' ? '+' : '-'}
                          {(f.amountCents / 100).toLocaleString('fr-FR')} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2027 Renewal Project */}
            {project && (
              <div className="ds-panel">
                <div className="ds-section-head">
                  <div>
                    <h2 className="ds-section-title">{project.name}</h2>
                    <span className="ds-section-meta">
                      Horizon {project.year} · Scénario d’investissement parcellaire
                    </span>
                  </div>
                  <span className="badge badge-grape">Scénario fictif</span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--color-ink)', marginBottom: '14px' }}>
                  <strong>Parcelle visée :</strong> La Vigne du Moulin (vieilles vignes de 1972). Aucune autorisation administrative réelle générée.
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-ink-muted)', marginBottom: '8px' }}>
                    Répartition des postes d’investissement
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {project.budgetLines.map((l, i) => {
                      const totalCents = project.budgetLines.reduce((a, b) => a + b.amountCents, 0);
                      const pct = totalCents > 0 ? Math.round((l.amountCents / totalCents) * 100) : 0;
                      return (
                        <div
                          key={i}
                          style={{
                            padding: '8px 12px',
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12.5px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600 }}>{l.label}</span>
                            <strong className="tabular">{(l.amountCents / 100).toLocaleString('fr-FR')} € ({pct}%)</strong>
                          </div>
                          <div className="ds-bar" style={{ height: '5px' }}>
                            <span style={{ width: `${pct}%`, background: 'var(--color-grape)' }} />
                          </div>
                        </div>
                      );
                    })}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderTop: '1px solid var(--color-border)',
                        fontSize: '14px',
                        fontWeight: 700,
                      }}
                    >
                      <span>Total investissement estimé</span>
                      <span className="tabular" style={{ color: 'var(--color-forest)' }}>
                        {projectTotalEur.toLocaleString('fr-FR')} €
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '11.5px', color: 'var(--color-ink-light)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
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
        </>
      )}
    </div>
  );
};
