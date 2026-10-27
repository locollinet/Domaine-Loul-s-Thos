import React, { useState } from 'react';
import {
  Layers,
  ArrowLeftRight,
  Sparkles,
  Wine,
  Droplets,
  Euro,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { previewBlend } from '../../domain/commands/cellar';
import { lotVolumeMl, lotOccupancies } from '../../domain/selectors';

export const AgingView: React.FC = () => {
  const { state, dispatch } = useStore();

  // Blend Modal / Trial state
  const [showBlendModal, setShowBlendModal] = useState(false);
  const [blendName, setBlendName] = useState('Rouge 2025 Assemblage — Démo');
  const [destContainerId, setDestContainerId] = useState('tank-04');
  const [inputA_vol, setInputA_vol] = useState('300'); // Litres
  const [inputB_vol, setInputB_vol] = useState('200'); // Litres

  // Transfer & Topping Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferMode, setTransferMode] = useState<'transfer' | 'topping'>('transfer');
  const [transferLotId, setTransferLotId] = useState('lot-2024-aging');
  const [transferFromCont, setTransferFromCont] = useState('demo-barrel-1');
  const [transferToCont, setTransferToCont] = useState('barrel-03');
  const [transferVolL, setTransferVolL] = useState('50');
  const [transferLossL, setTransferLossL] = useState('1');
  const [transferReason, setTransferReason] = useState('Soutirage d’aération');

  // Bâtonnage Modal
  const [showBatonnageModal, setShowBatonnageModal] = useState(false);
  const [batonnageLotId, setBatonnageLotId] = useState('lot-2024-aging');
  const [batonnageNote, setBatonnageNote] = useState('Bâtonnage doux à la dondaine sur fûts neufs et 1 vin. Remise en suspension des lies fines.');

  if (!state) return null;

  // Compute live blend preview (pure simulation without side-effects)
  let blendPreviewData = null;
  let blendPreviewError = null;

  try {
    const volA_ml = Math.round(parseFloat(inputA_vol || '0') * 1000);
    const volB_ml = Math.round(parseFloat(inputB_vol || '0') * 1000);
    if (volA_ml > 0 && volB_ml > 0) {
      blendPreviewData = previewBlend(state, {
        name: blendName,
        cuveeId: 'cuvee-red',
        destinationContainerId: destContainerId,
        inputs: [
          { lotId: 'lot-2025-a', containerId: 'tank-02', volumeMl: volA_ml },
          { lotId: 'lot-2025-b', containerId: 'tank-03', volumeMl: volB_ml },
        ],
      });
    }
  } catch (err: unknown) {
    blendPreviewError = err instanceof Error ? err.message : 'Erreur de simulation';
  }

  const handleExecuteBlend = async () => {
    const volA_ml = Math.round(parseFloat(inputA_vol) * 1000);
    const volB_ml = Math.round(parseFloat(inputB_vol) * 1000);
    try {
      await dispatch({
        type: 'blend.execute',
        payload: {
          name: blendName,
          cuveeId: 'cuvee-red',
          destinationContainerId: destContainerId,
          inputs: [
            { lotId: 'lot-2025-a', containerId: 'tank-02', volumeMl: volA_ml },
            { lotId: 'lot-2025-b', containerId: 'tank-03', volumeMl: volB_ml },
          ],
        },
      });
      setShowBlendModal(false);
    } catch {
      // Handled
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const volMl = Math.round(parseFloat(transferVolL) * 1000);
    const lossMl = Math.round(parseFloat(transferLossL) * 1000);
    try {
      if (transferMode === 'topping') {
        await dispatch({
          type: 'cellar.topping',
          payload: {
            lotId: transferLotId,
            sourceContainerId: transferFromCont,
            targetContainerId: transferToCont,
            volumeMl: volMl,
          },
        });
      } else {
        await dispatch({
          type: 'cellar.transfer',
          payload: {
            lotId: transferLotId,
            fromContainerId: transferFromCont,
            toContainerId: transferToCont,
            volumeMl: volMl,
            lossMl: lossMl,
            reason: transferReason.trim() || 'Soutirage d’élevage',
          },
        });
      }
      setShowTransferModal(false);
    } catch {
      // Handled
    }
  };

  const handleExecuteBatonnage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch({
        type: 'cellar.note',
        payload: {
          lotId: batonnageLotId,
          label: 'Bâtonnage des lies fines',
          details: batonnageNote.trim() || 'Remise en suspension manuelle des lies fines pour enrichir la texture et protéger le vin contre l’oxydation.',
        },
      });
      setShowBatonnageModal(false);
    } catch {
      // Handled
    }
  };

  const lotsReadyForBlend = Object.values(state.lots).filter(
    (l) => l.stage === 'ready' || l.stage === 'aging'
  );
  const availableContainers = Object.values(state.containers).filter(
    (c) => c.state === 'available' && !state.occupancies[c.id]
  );

  // Calculs pour jauges visuelles
  const totalAgingLitres = Math.round(
    lotsReadyForBlend.reduce((sum, l) => sum + lotVolumeMl(state, l.id), 0) / 1000
  );
  const totalKnownCostEur = Math.round(
    lotsReadyForBlend.reduce((sum, l) => sum + (l.cost.knownCents ?? 0), 0) / 100
  );
  const agingContainers = Object.values(state.containers).filter(
    (c) => c.kind === 'barrel' || c.kind === 'vat'
  );
  const barrelUsedMl = agingContainers.reduce(
    (sum, c) => sum + (state.occupancies[c.id]?.volumeMl ?? 0),
    0
  );
  const barrelCapMl = agingContainers.reduce(
    (sum, c) => sum + c.capacityMl,
    0
  );
  const barrelFillPct = barrelCapMl > 0 ? Math.round((barrelUsedMl / barrelCapMl) * 100) : 0;

  const volANum = Math.max(0, parseFloat(inputA_vol || '0') || 0);
  const volBNum = Math.max(0, parseFloat(inputB_vol || '0') || 0);
  const totalBlendNum = volANum + volBNum;
  const pctA = totalBlendNum > 0 ? Math.round((volANum / totalBlendNum) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <div className="ds-overview">
      {/* 1. BANNIÈRE ATELIER ÉLEVAGE & ASSEMBLAGE */}
      <section className="ds-hero ds-rise">
        <div>
          <div className="ds-eyebrow">
            <span className="ds-pulse" aria-hidden="true" />
            <span>Cave à barriques & Cuverie d’assemblage · Millésimes 2024 & 2025</span>
          </div>
          <h1 className="ds-hero-title">Élevage & Assemblage</h1>
          <p className="ds-hero-sub">
            Suivez le niveau de vos pièces de chêne, soutirez d’un fût à l’autre en traçant la part
            des anges, et testez vos assemblages à blanc avant de les exécuter au chai.
          </p>
        </div>

        <div className="ds-next">
          <div>
            <div className="ds-next-label">Action recommandée au chai</div>
            <div className="ds-next-title">Assembler les deux cuvées Rouges 2025</div>
            <p className="ds-next-desc">
              Les lots <em>Les Hauts Rangs</em> (600 L) et <em>La Combe Claire</em> (400 L) sont
              prêts. Testez votre proportion idéale sans toucher au stock.
            </p>
          </div>
          <button
            type="button"
            className="ds-cta"
            onClick={() => setShowBlendModal(true)}
          >
            <span>Ouvrir le simulateur d’assemblage</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* 2. VERBES D'ACTION RAPIDE (3 GRANDES TUILES TACTILES) */}
      <section className="ds-rise ds-rise-1" aria-label="Gestes courants d’élevage">
        <div className="ds-section-head">
          <h2 className="ds-section-title">Que souhaitez-vous faire en cave ?</h2>
          <span className="ds-section-meta">Opérations garanties sans perte de filiation</span>
        </div>
        <div className="ds-quick-grid-3">
          <button
            type="button"
            className="ds-tile is-recommended"
            onClick={() => setShowBlendModal(true)}
          >
            <span className="ds-tile-badge">Essai gratuit</span>
            <div className="ds-icon-bubble ds-tone-grape">
              <Sparkles size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Composer un assemblage</div>
              <div className="ds-tile-sub">Simuler les volumes et coûts avant de mélanger</div>
            </div>
          </button>

          <button
            type="button"
            className="ds-tile"
            onClick={() => {
              setTransferMode('transfer');
              setShowTransferModal(true);
            }}
          >
            <div className="ds-icon-bubble ds-tone-gold">
              <ArrowLeftRight size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Soutirer ou ouiller</div>
              <div className="ds-tile-sub">Transfert sur lies nettes ou ouillage précis des fûts</div>
            </div>
          </button>

          <button
            type="button"
            className="ds-tile"
            onClick={() => setShowBatonnageModal(true)}
          >
            <div className="ds-icon-bubble ds-tone-forest">
              <Droplets size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Bâtonner les lies</div>
              <div className="ds-tile-sub">Remise en suspension manuelle pour nourrir le vin sous bois</div>
            </div>
          </button>
        </div>
      </section>

      {/* 3. JAUGES VISUELLES D'ÉLEVAGE */}
      <section className="ds-stats ds-rise ds-rise-2" aria-label="Repères d’élevage">
        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-grape">
              <Wine size={16} />
            </span>
            <span>Vin en élevage & prêt</span>
          </div>
          <div className="ds-stat-value">
            {totalAgingLitres.toLocaleString('fr-FR')}
            <span className="ds-stat-unit">L</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: '82%', background: 'var(--color-grape)' }} />
          </div>
          <div className="ds-stat-foot">
            Répartis sur {lotsReadyForBlend.length} lots prêts ou sous bois
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-gold">
              <Droplets size={16} />
            </span>
            <span>Remplissage des fûts de chêne</span>
          </div>
          <div className="ds-stat-value">
            {barrelFillPct}
            <span className="ds-stat-unit">%</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: `${barrelFillPct}%`, background: 'var(--color-gold-dark)' }} />
          </div>
          <div className="ds-stat-foot">
            {barrelUsedMl / 1000} L logés sur {barrelCapMl / 1000} L de fûts 2024
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-forest">
              <Layers size={16} />
            </span>
            <span>Cuves vides prêtes à recevoir</span>
          </div>
          <div className="ds-stat-value">
            {availableContainers.length}
            <span className="ds-stat-unit">contenants</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: '65%', background: 'var(--color-forest)' }} />
          </div>
          <div className="ds-stat-foot">
            Disponibles pour accueillir un assemblage ou un soutirage
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-ink">
              <Euro size={16} />
            </span>
            <span>Coût technique attaché aux lots</span>
          </div>
          <div className="ds-stat-value">
            {totalKnownCostEur.toLocaleString('fr-FR')}
            <span className="ds-stat-unit">€</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: '100%', background: 'var(--color-forest)' }} />
          </div>
          <div className="ds-stat-foot">
            Transféré au prorata exact des litres lors d’un assemblage
          </div>
        </div>
      </section>

      {/* 4. DEUX COLONNES : LOTS EN ÉLEVAGE + PARC À BARRIQUES */}
      <div className="ds-split ds-rise ds-rise-3">
        <div className="ds-panel">
          <div className="ds-section-head">
            <div>
              <h2 className="ds-section-title">Lots actuellement en élevage & prêts</h2>
              <span className="ds-section-meta">
                Chaque lot conserve ses parcelles d’origine et son coût accumulé
              </span>
            </div>
            <span className="badge badge-green">{lotsReadyForBlend.length} lots</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {lotsReadyForBlend.map((l) => {
              const volL = lotVolumeMl(state, l.id) / 1000;
              const occs = lotOccupancies(state, l.id);
              const firstContId = occs[0]?.containerId ?? 'demo-barrel-1';
              const totalCapL = occs.reduce(
                (acc, o) => acc + (state.containers[o.containerId]?.capacityMl ?? o.volumeMl) / 1000,
                0
              );
              const fillPct = totalCapL > 0 ? Math.min(100, Math.round((volL / totalCapL) * 100)) : 80;
              return (
                <div
                  key={l.id}
                  className="ds-clickable-card"
                  onClick={() => {
                    setTransferLotId(l.id);
                    setTransferFromCont(firstContId);
                    setShowTransferModal(true);
                  }}
                  style={{
                    padding: '16px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg)',
                  }}
                  title="Cliquer pour soutirer ou transférer ce lot"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: l.color === 'red' ? 'var(--color-grape)' : '#D4AF37',
                        }}
                      />
                      <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-ink)' }}>
                        {l.name}
                      </span>
                    </div>
                    <span className="badge badge-green">{l.code}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '10px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-forest)' }} className="tabular">
                      {volL.toLocaleString('fr-FR')} L
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                      Coût connu :{' '}
                      <strong>
                        {l.cost.knownCents
                          ? `${(l.cost.knownCents / 100).toLocaleString('fr-FR')} €`
                          : 'Non valorisé'}
                      </strong>
                    </span>
                  </div>

                  <div className="ds-bar" style={{ margin: '8px 0' }} aria-hidden="true">
                    <span
                      style={{
                        width: `${fillPct}%`,
                        background: l.color === 'red' ? 'var(--color-grape)' : 'var(--color-gold-dark)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--color-ink-muted)', flexWrap: 'wrap', gap: '6px' }}>
                    <span>
                      Logé dans :{' '}
                      <strong>
                        {occs
                          .map((o) => `${state.containers[o.containerId]?.code} (${o.volumeMl / 1000} L)`)
                          .join(' + ') || 'Aucun contenant'}
                      </strong>
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="ds-action-chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTransferLotId(l.id);
                          setTransferFromCont(firstContId);
                          setShowTransferModal(true);
                        }}
                      >
                        <ArrowLeftRight size={11} /> Soutirer
                      </button>
                      {l.stage === 'ready' && (
                        <button
                          type="button"
                          className="ds-action-chip"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowBlendModal(true);
                          }}
                        >
                          <Sparkles size={11} /> Assembler
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Focus on 2024 Barrels */}
        <div className="ds-panel">
          <div className="ds-section-head">
            <div>
              <h2 className="ds-section-title">Parc à barriques & foudres (Élevage)</h2>
              <span className="ds-section-meta">Sélectionnez une barrique ou un foudre pour soutirer, ouiller ou consulter la tonnellerie</span>
            </div>
            <span className="badge badge-grape">{agingContainers.length} fûts & foudres</span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
            Suivi individuel par tonnellerie, origine de la forêt et type de chauffe. La somme des fûts correspond au millilitre près au volume des lots sous bois.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
            {agingContainers.map((c) => {
              const occ = state.occupancies[c.id];
              const occLot = occ ? state.lots[occ.lotId] : null;
              const fillPct = occ ? Math.round((occ.volumeMl / (c.capacityMl || 1)) * 100) : 0;
              const capL = Math.round(c.capacityMl / 1000);
              return (
                <div
                  key={c.id}
                  className="ds-barrel-card ds-clickable-card"
                  onClick={() => {
                    if (occ) {
                      setTransferLotId(occ.lotId);
                      setTransferFromCont(c.id);
                      setTransferVolL(String(Math.min(50, occ.volumeMl / 1000)));
                    } else {
                      setTransferToCont(c.id);
                    }
                    setShowTransferModal(true);
                  }}
                  title={occ ? `Cliquer pour soutirer ou ouiller ${c.code}` : `${c.code} (${capL} L) · Prêt à entonner`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--color-ink)' }}>🪵 {c.code}</strong>
                    <span className="badge badge-gold">
                      {c.kind === 'vat' ? `Foudre ${capL} L` : `Fût ${capL} L`}
                    </span>
                  </div>

                  {c.cooper && (
                    <div style={{ fontSize: '11px', color: 'var(--color-gold-dark)', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.cooper} · {c.woodOrigin ?? 'Chêne'} ({c.toast ?? 'Moy.'})
                      {c.barrelAgeYears !== undefined && (
                        <span style={{ color: 'var(--color-ink-muted)', fontWeight: 400, marginLeft: '3px' }}>
                          · {c.barrelAgeYears === 0 ? 'Neuf' : `${c.barrelAgeYears} vin(s)`}
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: '6px' }}>
                    <div
                      style={{ fontSize: '24px', fontWeight: 700, color: occ ? 'var(--color-forest)' : 'var(--color-ink-light)', fontFamily: 'var(--font-serif)' }}
                      className="tabular"
                    >
                      {occ ? occ.volumeMl / 1000 : 0} L
                      <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-ink-muted)', marginLeft: '4px' }}>
                        / {capL} L
                      </span>
                    </div>
                    {occLot ? (
                      <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Logé : <strong>{occLot.code}</strong> ({occLot.name})
                      </div>
                    ) : (
                      <div style={{ fontSize: '11.5px', color: 'var(--color-ink-light)', marginTop: '2px' }}>
                        Disponible pour entonnage
                      </div>
                    )}
                  </div>

                  <div className="ds-bar" aria-hidden="true" style={{ marginTop: '6px' }}>
                    <span style={{ width: `${fillPct}%`, background: occ ? 'var(--color-gold-dark)' : 'var(--color-border)' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                    <span>Remplissage : <strong>{fillPct}%</strong></span>
                    <span className="ds-action-chip">{occ ? 'Soutirer / Ouiller →' : 'Entonner →'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-soft)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)' }}>
              Besoin de soutirer une barrique vers un fût propre ?
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setShowTransferModal(true)}
            >
              Soutirer une barrique →
            </button>
          </div>
        </div>
      </div>

      {/* Modal Assemblage (Essai & Exécution) */}
      {showBlendModal && (
        <div className="modal-backdrop" onClick={() => setShowBlendModal(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
                Assemblage des lots 2025
              </h2>
              <span className="badge badge-green">Simulateur & Exécution atomique</span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '16px' }}>
              Cet écran permet d’abord de <strong>prévisualiser l’essai</strong> sans consommer aucune goutte de stock, puis de déclencher l’opération réelle.
            </p>

            <div className="form-group">
              <label className="form-label">Nom du lot enfant résultant</label>
              <input
                type="text"
                className="form-input"
                value={blendName}
                onChange={(e) => setBlendName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contenant de destination (cuve vide disponible)</label>
              {availableContainers.length <= 1 ? (
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--color-surface-soft)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--color-ink)',
                  }}
                >
                  {availableContainers[0]
                    ? `${availableContainers[0].code} · ${availableContainers[0].location} (Capacité ${availableContainers[0].capacityMl / 1000} L)`
                    : 'Aucune cuve disponible'}
                </div>
              ) : (
                <select
                  className="form-select"
                  value={destContainerId}
                  onChange={(e) => setDestContainerId(e.target.value)}
                >
                  {availableContainers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.location} (Capacité {c.capacityMl / 1000} L)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '16px', background: 'var(--color-surface-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>
                  Proportions de l’assemblage (entrées)
                </span>
                <span className="badge badge-grape tabular">
                  {pctA}% Hauts Rangs · {pctB}% Combe Claire
                </span>
              </div>

              {/* Barre visuelle de répartition entre les 2 cuvées */}
              <div className="ds-bar" style={{ height: '10px', marginBottom: '12px' }} aria-hidden="true">
                <span style={{ width: `${pctA}%`, background: 'var(--color-grape)' }} />
                <span style={{ width: `${pctB}%`, background: 'var(--color-gold-dark)' }} />
              </div>

              <div className="grid-2">
                <div>
                  <label className="form-label">L25-R-A (Hauts Rangs) — en C-02 (600 L dispo)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="600"
                      className="form-input"
                      value={inputA_vol}
                      onChange={(e) => setInputA_vol(e.target.value)}
                    />
                    <span>L</span>
                  </div>
                </div>

                <div>
                  <label className="form-label">L25-R-B (Combe Claire) — en C-03 (400 L dispo)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="400"
                      className="form-input"
                      value={inputB_vol}
                      onChange={(e) => setInputB_vol(e.target.value)}
                    />
                    <span>L</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trial calculation output */}
            {blendPreviewData && (
              <div style={{ border: '1px solid #C2DCC8', borderRadius: 'var(--radius-md)', padding: '12px', background: 'var(--color-forest-soft)', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-forest)', marginBottom: '6px' }}>
                  ✓ Résultat de la simulation d’essai
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                  Volume total assemblé : <strong>{blendPreviewData.totalMl / 1000} L</strong> (dans {state.containers[destContainerId]?.code})
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                  Coût connu alloué au lot enfant : <strong>{(blendPreviewData.cost.knownCents / 100).toLocaleString('fr-FR')} €</strong>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                  Reliquats conservés : L25-R-A aura {300000 / 1000} L (400 €) · L25-R-B aura {200000 / 1000} L (300 €)
                </div>
              </div>
            )}

            {blendPreviewError && (
              <div className="alert alert-error">
                {blendPreviewError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowBlendModal(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!blendPreviewData}
                onClick={handleExecuteBlend}
              >
                Exécuter l’assemblage réel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transfert & Ouillage */}
      {showTransferModal && (
        <div className="modal-backdrop" onClick={() => setShowTransferModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                {transferMode === 'topping' ? 'Ouillage de fût' : 'Transfert de vin / Soutirage'}
              </h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${transferMode === 'transfer' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setTransferMode('transfer');
                    setTransferReason('Soutirage d’aération / Élimination des lies');
                  }}
                >
                  Soutirage
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${transferMode === 'topping' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setTransferMode('topping');
                    setTransferLossL('0');
                    setTransferReason('Ouillage périodique du chai');
                  }}
                >
                  Ouillage
                </button>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              {transferMode === 'topping'
                ? 'L’ouillage compense l’évaporation naturelle (part des anges) en complétant le fût avec le même lot, sans perte matière.'
                : 'Le soutirage permet de décanter le vin propre et d’isoler les lies ou bourbes avec une perte tracée.'}
            </p>

            <form onSubmit={handleExecuteTransfer}>
              <div className="form-group">
                <label className="form-label">Lot concerné</label>
                <select
                  className="form-select"
                  value={transferLotId}
                  onChange={(e) => setTransferLotId(e.target.value)}
                >
                  {Object.values(state.lots).map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Contenant source</label>
                  {(() => {
                    const occs = lotOccupancies(state, transferLotId);
                    if (occs.length <= 1) {
                      const o = occs[0];
                      const cont = o ? state.containers[o.containerId] : null;
                      return (
                        <div
                          style={{
                            padding: '8px 12px',
                            background: 'var(--color-surface-soft)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--color-ink)',
                          }}
                        >
                          {cont && o ? `${cont.code} (${o.volumeMl / 1000} L disponibles)` : 'Aucun contenant source'}
                        </div>
                      );
                    }
                    return (
                      <select
                        className="form-select"
                        value={transferFromCont}
                        onChange={(e) => setTransferFromCont(e.target.value)}
                      >
                        {occs.map((o) => (
                          <option key={o.containerId} value={o.containerId}>
                            {state.containers[o.containerId]?.code} ({o.volumeMl / 1000} L dispo)
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                <div className="form-group">
                  <label className="form-label">Contenant destination</label>
                  {(() => {
                    const destConts = Object.values(state.containers).filter(
                      (c) => c.id !== transferFromCont && c.state === 'available'
                    );
                    if (destConts.length <= 1) {
                      return (
                        <div
                          style={{
                            padding: '8px 12px',
                            background: 'var(--color-surface-soft)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--color-ink)',
                          }}
                        >
                          {destConts[0] ? `${destConts[0].code} (${destConts[0].capacityMl / 1000} L cap.)` : 'Aucun contenant disponible'}
                        </div>
                      );
                    }
                    return (
                      <select
                        className="form-select"
                        value={transferToCont}
                        onChange={(e) => setTransferToCont(e.target.value)}
                      >
                        {destConts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} ({c.capacityMl / 1000} L cap.)
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    {transferMode === 'topping' ? 'Volume d’ouillage (L)' : 'Volume transféré (L)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="form-input"
                    value={transferVolL}
                    onChange={(e) => setTransferVolL(e.target.value)}
                    required
                  />
                </div>

                {transferMode === 'transfer' ? (
                  <div className="form-group">
                    <label className="form-label">Perte explicite tracée (L)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-input"
                      value={transferLossL}
                      onChange={(e) => setTransferLossL(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Perte</label>
                    <div style={{ padding: '9px 12px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--color-forest)', fontWeight: 600 }}>
                      ✓ 0 L (compensation de l’évaporation)
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Motif de l’opération</label>
                <input
                  type="text"
                  className="form-input"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {transferMode === 'topping' ? 'Valider l’ouillage' : 'Valider le transfert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bâtonnage des lies fines */}
      {showBatonnageModal && (
        <div className="modal-backdrop" onClick={() => setShowBatonnageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              Bâtonnage des lies fines
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              Remise en suspension manuelle des lies fines pour nourrir le vin, développer le gras et apporter une protection antioxydante naturelle sans intrant chimique.
            </p>
            <form onSubmit={handleExecuteBatonnage}>
              <div className="form-group">
                <label className="form-label">Lot sous élevage à bâtonner</label>
                <select
                  className="form-select"
                  value={batonnageLotId}
                  onChange={(e) => setBatonnageLotId(e.target.value)}
                >
                  {lotsReadyForBlend.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} · {l.name} ({l.vintage})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Observations & Consigne de chai</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={batonnageNote}
                  onChange={(e) => setBatonnageNote(e.target.value)}
                  placeholder="Ex : Bâtonnage doux à la dondaine sur fûts neufs et 1 vin. Lie fine bien nette, aucune réduction."
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBatonnageModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Consigner le bâtonnage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
