import React, { useState } from 'react';
import {
  Wine,
  Activity,
  ListChecks,
  MessageSquare,
  Plus,
  ShieldAlert,
  CheckCircle2,
  LayoutGrid,
  Table as TableIcon,
  Thermometer,
  Droplets,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { PARAMETERS } from '../../domain/commands/cellar';
import { lotVolumeMl, lotOccupancies } from '../../domain/selectors';
import type { Container, ContainerKind, Measurement, MeasurementParameter } from '../../domain/types';

const CUSTOM_CONTAINERS_KEY = 'domaine-erp-custom-containers-v1';
const CONTAINER_OVERRIDES_KEY = 'domaine-erp-container-overrides-v1';

const STAGE_LABELS_FR: Record<string, string> = {
  fermenting: 'En fermentation',
  aging: 'En élevage',
  ready: 'Prêt pour mise',
  blended: 'Assemblé',
  bottled: 'Mis en bouteilles',
};

export const CellarView: React.FC = () => {
  const { state, dispatch } = useStore();
  const [selectedLotId, setSelectedLotId] = useState<string>('lot-2026-white');
  const [selectedContainerId, setSelectedContainerId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'plan' | 'table'>('plan');
  // Progressive disclosure inside the Lot Inspector to eliminate vertical clutter
  const [lotTab, setLotTab] = useState<'analytics' | 'itinerary' | 'journal'>('analytics');

  // Measurement Modal
  const [showMeasModal, setShowMeasModal] = useState(false);
  const [paramKey, setParamKey] = useState<MeasurementParameter>('density');
  const [paramVal, setParamVal] = useState('1010');
  const [paramUnit, setParamUnit] = useState('g/L');
  const [sampledDate, setSampledDate] = useState('2026-10-24');

  // Measurement Correction Modal
  const [showCorrectMeas, setShowCorrectMeas] = useState<Measurement | null>(null);
  const [correctMeasVal, setCorrectMeasVal] = useState('');
  const [correctMeasReason, setCorrectMeasReason] = useState('');

  // Declare Volume Modal (Grapes kg -> Wine L explicit measurement)
  const [showDeclareVolModal, setShowDeclareVolModal] = useState(false);
  const [declareContainerId, setDeclareContainerId] = useState('c-04');
  const [declareLitres, setDeclareLitres] = useState('160');

  // Tasting Modal
  const [showTastingModal, setShowTastingModal] = useState(false);
  const [tastingNote, setTastingNote] = useState('');

  // Quality hold/release
  const [showQualityModal, setShowQualityModal] = useState<'hold' | 'release' | null>(null);
  const [qualityReason, setQualityReason] = useState('');

  // Custom Container Configuration Modal (Adaptable to any winery structure)
  const [showAddContainerModal, setShowAddContainerModal] = useState(false);
  const [newContainerCode, setNewContainerCode] = useState('OEUF-01');
  const [newContainerKind, setNewContainerKind] = useState<ContainerKind>('vat');
  const [newContainerCapHl, setNewContainerCapHl] = useState('16');
  const [newContainerLocation, setNewContainerLocation] = useState('Chai Blancs · Travée Œufs Béton');
  const [customContainers, setCustomContainers] = useState<Container[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_CONTAINERS_KEY);
      return raw ? (JSON.parse(raw) as Container[]) : [];
    } catch {
      return [];
    }
  });
  const [containerOverrides, setContainerOverrides] = useState<Record<string, Partial<Container>>>(() => {
    try {
      const raw = localStorage.getItem(CONTAINER_OVERRIDES_KEY);
      return raw ? (JSON.parse(raw) as Record<string, Partial<Container>>) : {};
    } catch {
      return {};
    }
  });

  if (!state) return null;

  const lots = Object.values(state.lots);
  const baseContainers = Object.values(state.containers);
  const rawContainers: Container[] = [
    ...baseContainers,
    ...customContainers.filter((cc) => !state.containers[cc.id]),
  ];
  const containers: Container[] = rawContainers.map((c) => ({
    ...c,
    ...(containerOverrides[c.id] ?? {}),
  }));
  const selectedLot = state.lots[selectedLotId] || lots[0];
  const selectedContainer = selectedContainerId
    ? containers.find((c) => c.id === selectedContainerId) ?? null
    : null;

  const updateContainerOverride = (containerId: string, patch: Partial<Container>) => {
    setContainerOverrides((prev) => {
      const next = {
        ...prev,
        [containerId]: {
          ...(prev[containerId] ?? {}),
          ...patch,
        },
      };
      try {
        localStorage.setItem(CONTAINER_OVERRIDES_KEY, JSON.stringify(next));
      } catch {
        // Ignore quota
      }
      return next;
    });
  };

  const lotMeas = Object.values(state.measurements)
    .filter((m) => m.lotId === selectedLot?.id && m.supersededBy === null)
    .sort((a, b) => a.sampledAt.localeCompare(b.sampledAt));

  const lotTastings = Object.values(state.tastings)
    .filter((t) => t.lotId === selectedLot?.id)
    .sort((a, b) => b.tastedAt.localeCompare(a.tastedAt));

  const lotOps = Object.values(state.cellarOps)
    .filter((o) => o.lotId === selectedLot?.id)
    .sort((a, b) => b.at.localeCompare(a.at));

  const densityPoints = lotMeas.filter((m) => m.parameter === 'density');

  const handleAddMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    try {
      await dispatch({
        type: 'measurement.add',
        payload: {
          lotId: selectedLot.id,
          containerId: null,
          parameter: paramKey,
          value: parseFloat(paramVal),
          unit: paramUnit,
          sampledAt: `${sampledDate}T08:00:00.000Z`,
        },
      });
      setShowMeasModal(false);
    } catch {
      // Handled
    }
  };

  const handleCorrectMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCorrectMeas) return;
    try {
      await dispatch({
        type: 'measurement.correct',
        payload: {
          measurementId: showCorrectMeas.id,
          value: parseFloat(correctMeasVal),
          reason: correctMeasReason,
        },
      });
      setShowCorrectMeas(null);
      setCorrectMeasReason('');
    } catch {
      // Handled
    }
  };

  const handleDeclareVolume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    try {
      await dispatch({
        type: 'lot.declareVolume',
        payload: {
          lotId: selectedLot.id,
          containerId: declareContainerId,
          volumeMl: Math.round(parseFloat(declareLitres) * 1000),
          note: 'Entonnage / écoulage mesuré après pressurage',
        },
      });
      setShowDeclareVolModal(false);
    } catch {
      // Handled
    }
  };

  const handleSetStage = async (nextStage: 'fermenting' | 'aging' | 'ready') => {
    if (!selectedLot) return;
    try {
      await dispatch({
        type: 'lot.setStage',
        payload: {
          lotId: selectedLot.id,
          stage: nextStage,
          reason: 'Évolution du stade œnologique validée au chai',
        },
      });
    } catch {
      // Handled
    }
  };

  const handleAddTasting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    try {
      await dispatch({
        type: 'tasting.add',
        payload: {
          lotId: selectedLot.id,
          notes: tastingNote,
        },
      });
      setShowTastingModal(false);
      setTastingNote('');
    } catch {
      // Handled
    }
  };

  const handleQualityChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot || !showQualityModal) return;
    try {
      if (showQualityModal === 'hold') {
        await dispatch({
          type: 'quality.hold',
          payload: { target: 'lot', id: selectedLot.id, reason: qualityReason },
        });
      } else {
        await dispatch({
          type: 'quality.release',
          payload: { target: 'lot', id: selectedLot.id, reason: qualityReason },
        });
      }
      setShowQualityModal(null);
      setQualityReason('');
    } catch {
      // Handled
    }
  };

  const handleItineraryStep = async (stepKey: string, currentStatus: string) => {
    if (!selectedLot) return;
    const nextStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await dispatch({
        type: 'itinerary.setStep',
        payload: {
          lotId: selectedLot.id,
          key: stepKey,
          status: nextStatus,
          note: null,
        },
      });
    } catch {
      // Handled
    }
  };

  const handleAddCustomContainer = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newContainerCode.trim().toUpperCase() || `C-${containers.length + 1}`;
    const capHl = parseFloat(newContainerCapHl || '10') || 10;
    const item: Container = {
      id: `custom-cont-${code.toLowerCase()}-${Date.now()}`,
      code,
      kind: newContainerKind,
      capacityMl: Math.round(capHl * 100_000),
      location: newContainerLocation.trim() || 'Chai Principal',
      state: 'available',
      plan: { row: 2, col: (containers.length % 4) + 1 },
    };
    const next = [...customContainers, item];
    setCustomContainers(next);
    try {
      localStorage.setItem(CUSTOM_CONTAINERS_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota
    }
    setShowAddContainerModal(false);
  };

  // Synthèse du chai pour jauges visuelles
  const totalWineLitres = Math.round(
    lots.reduce((sum, l) => sum + lotVolumeMl(state, l.id), 0) / 1000
  );
  const totalCapacityLitres = Math.round(
    containers
      .filter((c) => c.state === 'available')
      .reduce((sum, c) => sum + c.capacityMl, 0) / 1000
  );
  const cellarFillPct =
    totalCapacityLitres > 0 ? Math.min(100, Math.round((totalWineLitres / totalCapacityLitres) * 100)) : 0;
  const occupiedCount = Object.values(state.occupancies).filter((o) => o.volumeMl > 0).length;
  const fermentingCount = lots.filter((l) => l.stage === 'fermenting').length;
  const totalMeasCount = Object.values(state.measurements).filter((m) => m.supersededBy === null).length;

  return (
    <div className="ds-overview">
      {/* 1. BANNIÈRE CHAI & VINIFICATION */}
      <section className="ds-hero ds-rise">
        <div>
          <div className="ds-eyebrow">
            <span className="ds-pulse" aria-hidden="true" />
            <span>Cuverie Inox & Pièces Bourguignonnes · {containers.length} contenants configurés</span>
          </div>
          <h1 className="ds-hero-title">Chai & Vinification</h1>
          <p className="ds-hero-sub">
            Visualisez le niveau réel de chaque cuve ou barrique, saisissez vos relevés quotidiens
            de densité et température, et cochez les étapes de vinification sans aucun jargon.
          </p>
        </div>

        <div className="ds-next">
          <div>
            <div className="ds-next-label">Action recommandée sur {selectedLot?.code ?? 'la cuve'}</div>
            <div className="ds-next-title">
              {selectedLot && selectedLot.grapesReceivedG > 0 && lotVolumeMl(state, selectedLot.id) === 0
                ? `Déclarer le jus écoulé après pressurage (${selectedLot.name})`
                : `Saisir le relevé quotidien sur ${selectedLot?.name ?? 'le lot actif'}`}
            </div>
            <p className="ds-next-desc">
              {selectedLot && selectedLot.grapesReceivedG > 0 && lotVolumeMl(state, selectedLot.id) === 0
                ? `${(selectedLot.grapesReceivedG / 1000).toLocaleString('fr-FR')} kg de raisin reçus : indiquez le volume réel en litres mesuré à l’entonnage.`
                : 'Enregistrez la densité (g/L) et la température (°C) pour tracer la courbe de fermentation.'}
            </p>
          </div>
          {selectedLot && selectedLot.grapesReceivedG > 0 && lotVolumeMl(state, selectedLot.id) === 0 ? (
            <button
              type="button"
              className="ds-cta"
              onClick={() => setShowDeclareVolModal(true)}
            >
              <span>Déclarer le volume en litres</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="ds-cta"
              onClick={() => setShowMeasModal(true)}
            >
              <span>+ Nouveau relevé densité / T°</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>

      {/* 2. GESTES QUOTIDIENS DU MAÎTRE DE CHAI (4 TUILES TACTILES) */}
      <section className="ds-rise ds-rise-1" aria-label="Gestes rapides au chai">
        <div className="ds-section-head">
          <h2 className="ds-section-title">Que souhaitez-vous faire au chai ?</h2>
          <div className="segmented-control">
            <button
              className={`segmented-btn ${viewMode === 'plan' ? 'active' : ''}`}
              onClick={() => setViewMode('plan')}
            >
              <LayoutGrid size={14} /> Plan de cave visuel
            </button>
            <button
              className={`segmented-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <TableIcon size={14} /> Table des contenants
            </button>
          </div>
        </div>

        <div className="ds-quick-grid-4">
          <button
            type="button"
            className="ds-tile is-recommended"
            onClick={() => setShowMeasModal(true)}
          >
            <span className="ds-tile-badge">Quotidien</span>
            <div className="ds-icon-bubble ds-tone-grape">
              <Thermometer size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Saisir densité ou T°</div>
              <div className="ds-tile-sub">
                Ajouter une mesure sur {selectedLot?.code ?? 'la cuve active'}
              </div>
            </div>
          </button>

          <button
            type="button"
            className="ds-tile"
            onClick={() => setShowDeclareVolModal(true)}
          >
            <div className="ds-icon-bubble ds-tone-forest">
              <Droplets size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Déclarer le jus écoulé</div>
              <div className="ds-tile-sub">
                Entonner en litres après pressurage ou décuvage
              </div>
            </div>
          </button>

          <button
            type="button"
            className="ds-tile"
            onClick={() => {
              setLotTab('journal');
              setShowTastingModal(true);
            }}
          >
            <div className="ds-icon-bubble ds-tone-gold">
              <MessageSquare size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">Noter une dégustation</div>
              <div className="ds-tile-sub">
                Consigner le nez, la bouche et l’évolution du lot
              </div>
            </div>
          </button>

          <button
            type="button"
            className="ds-tile"
            onClick={() => setShowAddContainerModal(true)}
          >
            <div className="ds-icon-bubble ds-tone-ink">
              <Plus size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">+ Ajouter cuve ou fût</div>
              <div className="ds-tile-sub">
                Cuve inox, œuf béton, foudre, demi-muid ou pièce 228 L
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* 3. JAUGES VISUELLES DE CUVERIE */}
      <section className="ds-stats ds-rise ds-rise-2" aria-label="Repères de cuverie">
        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-grape">
              <Wine size={16} />
            </span>
            <span>Volume logé au chai</span>
          </div>
          <div className="ds-stat-value">
            {totalWineLitres.toLocaleString('fr-FR')}
            <span className="ds-stat-unit">L</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: `${cellarFillPct}%`, background: 'var(--color-grape)' }} />
          </div>
          <div className="ds-stat-foot">
            {cellarFillPct}% de la capacité disponible ({totalCapacityLitres.toLocaleString('fr-FR')} L)
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-gold">
              <LayoutGrid size={16} />
            </span>
            <span>Contenants en service</span>
          </div>
          <div className="ds-stat-value">
            {occupiedCount}
            <span className="ds-stat-unit">/ {containers.length}</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span
              style={{
                width: `${containers.length > 0 ? Math.round((occupiedCount / containers.length) * 100) : 0}%`,
                background: 'var(--color-gold-dark)',
              }}
            />
          </div>
          <div className="ds-stat-foot">
            1 lot unique par contenant (aucun mélange accidentel)
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-amber">
              <Activity size={16} />
            </span>
            <span>Lots en fermentation active</span>
          </div>
          <div className="ds-stat-value">
            {fermentingCount}
            <span className="ds-stat-unit">cuvée(s)</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: fermentingCount > 0 ? '65%' : '100%', background: 'var(--color-amber)' }} />
          </div>
          <div className="ds-stat-foot">
            Surveillance quotidienne densité & température
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-forest">
              <CheckCircle2 size={16} />
            </span>
            <span>Mesures analytiques tracées</span>
          </div>
          <div className="ds-stat-value">
            {totalMeasCount}
            <span className="ds-stat-unit">relevés</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: '100%', background: 'var(--color-forest)' }} />
          </div>
          <div className="ds-stat-foot">
            Courbes réelles sans interpolation ni conseil de dose
          </div>
        </div>
      </section>

      {/* Plan de cave visuel avec jauges cylindriques ou Table alternative */}
      <div className="ds-panel ds-rise ds-rise-3">
        <div className="ds-section-head">
          <div>
            <h2 className="ds-section-title">Occupation des contenants</h2>
            <span className="ds-section-meta">
              Cliquez sur une cuve inox ou une pièce bourguignonne occupée pour inspecter son lot
            </span>
          </div>
          <span className="badge badge-muted">
            Lot ≠ Contenant · 1 lot actif par contenant
          </span>
        </div>

        {viewMode === 'plan' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '12px' }}>
            {containers.map((c) => {
              const occ = state.occupancies[c.id];
              const lot = occ ? state.lots[occ.lotId] : null;
              const fillPct = occ ? Math.min(100, Math.round((occ.volumeMl / c.capacityMl) * 100)) : 0;
              const isSelected = c.id === selectedContainer?.id || (lot && lot.id === selectedLot?.id && selectedContainer?.id === c.id);

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedContainerId(c.id);
                    if (lot) {
                      setSelectedLotId(lot.id);
                    }
                    setTimeout(() => {
                      const el = document.getElementById(lot ? 'cellar-lot-inspector' : 'cellar-container-action-bar');
                      if (el && typeof el.scrollIntoView === 'function') {
                        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
                    }, 40);
                  }}
                  className="vessel-visual-card ds-clickable-card"
                  style={{
                    border: isSelected ? '2px solid var(--color-forest)' : '1px solid var(--color-border)',
                    background: c.state === 'maintenance' ? '#F6F0F0' : isSelected ? 'var(--color-forest-soft)' : 'var(--color-surface)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{c.code}</span>
                    <span className={`badge ${c.state === 'maintenance' ? 'badge-crimson' : c.kind === 'barrel' ? 'badge-gold' : 'badge-muted'}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                      {c.state === 'maintenance' ? 'Maint.' : c.kind === 'barrel' ? 'Pièce 228L' : 'Cuve Inox'}
                    </span>
                  </div>

                  {/* Jauge visuelle de cuve / fût */}
                  <div className="vessel-tank-cylinder">
                    {occ && lot ? (
                      <div
                        className={`vessel-liquid ${lot.color === 'red' ? 'wine-red' : 'wine-white'}`}
                        style={{ height: `${Math.max(12, fillPct)}%` }}
                      />
                    ) : null}
                    <div
                      className="tabular"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: occ && fillPct > 45 && lot?.color === 'red' ? '#FFFFFF' : 'var(--color-ink)',
                        textShadow: occ && fillPct > 45 && lot?.color === 'red' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                      }}
                    >
                      {occ ? (
                        <>
                          <span>{occ.volumeMl / 1000} L</span>
                          <span style={{ fontSize: '10px', opacity: 0.85 }}>{fillPct}% plein</span>
                        </>
                      ) : c.state === 'maintenance' ? (
                        <span style={{ color: 'var(--color-crimson)', fontSize: '11px' }}>🔧 Maintenance</span>
                      ) : (
                        <span style={{ color: 'var(--color-ink-light)', fontSize: '11px' }}>Vide · Prêt</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }} className="tabular">
                      Capacité : {c.capacityMl / 1000} L
                    </div>
                    {lot ? (
                      <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-forest)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lot.code} · {lot.name}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11.5px', color: 'var(--color-ink-light)', marginTop: '2px' }}>
                        {c.state === 'maintenance' ? 'Cliquer pour réactiver' : 'Cliquer pour entonner'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type & Emplacement</th>
                  <th>Capacité</th>
                  <th>Occupation</th>
                  <th>Lot affecté</th>
                  <th>État & Action rapide</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => {
                  const occ = state.occupancies[c.id];
                  const lot = occ ? state.lots[occ.lotId] : null;
                  return (
                    <tr
                      key={c.id}
                      className="ds-clickable-row"
                      onClick={() => {
                        setSelectedContainerId(c.id);
                        if (lot) setSelectedLotId(lot.id);
                      }}
                    >
                      <td style={{ fontWeight: 700 }}>{c.code}</td>
                      <td>{c.kind === 'barrel' ? 'Barrique chêne' : 'Cuve'} · {c.location}</td>
                      <td className="tabular">{c.capacityMl / 1000} L</td>
                      <td className="tabular" style={{ fontWeight: 600 }}>
                        {occ ? `${occ.volumeMl / 1000} L (${Math.round((occ.volumeMl / c.capacityMl) * 100)}%)` : 'Vide'}
                      </td>
                      <td>
                        {lot ? (
                          <button
                            style={{ color: 'var(--color-forest)', textDecoration: 'underline', fontWeight: 600 }}
                            onClick={() => setSelectedLotId(lot.id)}
                          >
                            {lot.code} · {lot.name}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {c.state === 'maintenance' ? (
                            <span className="badge badge-crimson">Maintenance</span>
                          ) : (
                            <span className="badge badge-green">Disponible</span>
                          )}
                          {!occ && c.state === 'available' && (
                            <button
                              type="button"
                              className="ds-action-chip"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeclareContainerId(c.id);
                                setShowDeclareVolModal(true);
                              }}
                            >
                              + Entonner ici
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
        )}

        {/* Bandeau de Manipulation Directe du Contenant Sélectionné (Plein, Vide ou en Maintenance) */}
        {selectedContainer && (() => {
          const selOcc = state.occupancies[selectedContainer.id];
          const selLot = selOcc ? state.lots[selOcc.lotId] : null;
          return (
            <div id="cellar-container-action-bar" className="ds-direct-bar">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--color-ink)' }}>
                    Contenant sélectionné : {selectedContainer.code}
                  </span>
                  <span className="badge badge-muted">
                    {selectedContainer.kind === 'barrel' ? 'Pièce 228 L' : 'Cuve Inox'} · Capacité {selectedContainer.capacityMl / 1000} L · {selectedContainer.location}
                  </span>
                  <span className={`badge ${selectedContainer.state === 'maintenance' ? 'badge-crimson' : 'badge-green'}`}>
                    {selectedContainer.state === 'maintenance' ? '🔧 En maintenance' : '✓ En service'}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginTop: '3px' }}>
                  {selLot && selOcc
                    ? `Occupe actuellement ${selOcc.volumeMl / 1000} L du lot ${selLot.code} (${selLot.name}).`
                    : selectedContainer.state === 'maintenance'
                    ? 'Ce contenant est isolé pour nettoyage/maintenance. Vous pouvez le remettre en service en 1 clic.'
                    : 'Ce contenant est vide et propre : vous pouvez y entonner un lot ou le placer en maintenance.'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selLot ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setSelectedLotId(selLot.id);
                        setShowMeasModal(true);
                      }}
                    >
                      <Thermometer size={13} /> + Relevé sur {selectedContainer.code}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setSelectedLotId(selLot.id);
                        setShowTastingModal(true);
                      }}
                    >
                      <MessageSquare size={13} /> + Dégustation
                    </button>
                  </>
                ) : selectedContainer.state === 'available' ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setDeclareContainerId(selectedContainer.id);
                        setShowDeclareVolModal(true);
                      }}
                    >
                      <Droplets size={13} /> Entonner un lot dans {selectedContainer.code}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => updateContainerOverride(selectedContainer.id, { state: 'maintenance' })}
                    >
                      🔧 Passer en maintenance
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => updateContainerOverride(selectedContainer.id, { state: 'available' })}
                  >
                    <CheckCircle2 size={13} /> Remettre {selectedContainer.code} en service
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Lot selector and Progressive Disclosure Winemaking Inspector */}
      <div className="grid-2">
        {/* Left: Lots list */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Lots de vinification</h2>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                Sélectionnez une cuvée en cours pour inspecter ses analyses ou son itinéraire
              </div>
            </div>
            <span className="badge badge-gold">{lots.length} lots actifs</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lots.map((l) => {
              const volL = lotVolumeMl(state, l.id) / 1000;
              const isSelected = l.id === selectedLot?.id;
              return (
                <div
                  key={l.id}
                  onClick={() => setSelectedLotId(l.id)}
                  style={{
                    padding: '12px 14px',
                    border: isSelected ? '2px solid var(--color-forest)' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'var(--color-forest-soft)' : 'var(--color-surface)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="serif-display" style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Wine size={15} color={l.color === 'red' ? 'var(--color-grape)' : '#B89551'} />
                      {l.name}
                    </span>
                    <span className={`badge ${l.quality === 'held' ? 'badge-amber' : 'badge-green'}`}>
                      {l.quality === 'held' ? '🔒 Retenue' : '✓ Libéré'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '3px' }}>
                    <code>{l.code}</code> · Millésime {l.vintage} · {l.color === 'white' ? 'Blanc' : 'Rouge'}
                    {l.grapesReceivedG > 0 && ` · Vendange : ${(l.grapesReceivedG / 1000).toLocaleString('fr-FR')} kg`}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-forest)' }} className="tabular">
                      Volume : {volL} L
                    </span>
                    <span className="badge badge-muted" style={{ fontSize: '10.5px' }}>
                      {STAGE_LABELS_FR[l.stage] ?? l.stage}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected lot details with 3 clean sub-tabs */}
        {selectedLot && (
          <div id="cellar-lot-inspector" className="card">
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div>
                <h2 className="serif-display" style={{ fontSize: '21px', fontWeight: 700 }}>
                  {selectedLot.name} ({selectedLot.code})
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Millésime {selectedLot.vintage} · {selectedLot.color === 'white' ? 'Vin blanc tranquille' : 'Vin rouge tranquille'} · {selectedLot.mention}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {selectedLot.grapesReceivedG > 0 && lotVolumeMl(state, selectedLot.id) === 0 && (
                  <button
                    className="btn btn-sm btn-accent"
                    onClick={() => setShowDeclareVolModal(true)}
                  >
                    <Plus size={13} /> Déclarer volume écoulé (L)
                  </button>
                )}
                {selectedLot.quality === 'held' ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setShowQualityModal('release');
                      setQualityReason('Analyses et dégustation conformes pour mise ou commercialisation');
                    }}
                  >
                    <CheckCircle2 size={13} /> Libérer le lot
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setShowQualityModal('hold');
                      setQualityReason('Mise en retenue préventive pour contrôle analytique');
                    }}
                  >
                    <ShieldAlert size={13} /> Bloquer qualité
                  </button>
                )}
              </div>
            </div>

            {/* Compact Stage & Vessel Summary Pill Bar */}
            <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>
                  Contenant(s) :
                </span>
                {lotOccupancies(state, selectedLot.id).map((o) => (
                  <span key={o.containerId} className="badge badge-gold tabular">
                    {state.containers[o.containerId]?.code ?? o.containerId} · {o.volumeMl / 1000} L
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)', marginRight: '4px' }}>Stade :</span>
                {(['fermenting', 'aging', 'ready'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`badge ${selectedLot.stage === st ? 'badge-green' : 'badge-muted'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSetStage(st)}
                  >
                    {STAGE_LABELS_FR[st] ?? st}
                  </button>
                ))}
              </div>
            </div>

            {/* 3-Tab Sub-Navigation inside the Lot Inspector to prevent vertical wall of text */}
            <div className="segmented-control" style={{ width: '100%', marginBottom: '16px', display: 'flex' }}>
              <button
                type="button"
                className={`segmented-btn ${lotTab === 'analytics' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setLotTab('analytics')}
              >
                <Activity size={13} /> Analyses ({lotMeas.length})
              </button>
              <button
                type="button"
                className={`segmented-btn ${lotTab === 'itinerary' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setLotTab('itinerary')}
              >
                <ListChecks size={13} /> Itinéraire ({selectedLot.itinerary.length})
              </button>
              <button
                type="button"
                className={`segmented-btn ${lotTab === 'journal' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setLotTab('journal')}
              >
                <MessageSquare size={13} /> Dégustations ({lotTastings.length})
              </button>
            </div>

            {/* TAB 1: ANALYSES & CINETIQUE */}
            {lotTab === 'analytics' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>
                    Suivi des mesures réelles ({lotMeas.length})
                  </span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowMeasModal(true)}
                  >
                    <Plus size={13} /> Nouveau relevé
                  </button>
                </div>

                {/* Pure SVG Density Curve */}
                {densityPoints.length > 1 && (
                  <div style={{ background: '#FAF8F5', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-ink)' }}>
                        Cinétique fermentaire réelle — Densité (g/L)
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                        Sans interpolation artificielle
                      </span>
                    </div>
                    <svg width="100%" height="100" viewBox="0 0 320 90">
                      {(() => {
                        const minD = 990;
                        const maxD = 1100;
                        const pts = densityPoints.map((p, idx) => {
                          const x = 28 + (idx / (densityPoints.length - 1)) * 264;
                          const y = 74 - ((p.value - minD) / (maxD - minD)) * 56;
                          return { x, y, val: p.value, date: p.sampledAt.slice(5, 10) };
                        });
                        const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
                        return (
                          <>
                            <line x1="24" y1="74" x2="300" y2="74" stroke="#D5D2C8" strokeWidth="1" />
                            <line x1="24" y1="18" x2="300" y2="18" stroke="#D5D2C8" strokeWidth="1" strokeDasharray="3" />
                            <polyline fill="none" stroke="var(--color-forest)" strokeWidth="2.5" points={polyline} />
                            {pts.map((p, i) => (
                              <g key={i}>
                                <circle cx={p.x} cy={p.y} r="4" fill="var(--color-forest)" />
                                <text x={p.x} y={p.y - 7} fontSize="9.5" fontWeight="700" textAnchor="middle" fill="var(--color-ink)">
                                  {p.val}
                                </text>
                                <text x={p.x} y={86} fontSize="8.5" textAnchor="middle" fill="var(--color-ink-muted)">
                                  {p.date}
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}

                <div className="table-wrap" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  <table style={{ fontSize: '12.5px' }}>
                    <thead>
                      <tr>
                        <th>Paramètre</th>
                        <th>Valeur</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lotMeas.slice(-8).map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>{PARAMETERS[m.parameter]?.label ?? m.parameter}</td>
                          <td className="tabular" style={{ fontWeight: 700, color: 'var(--color-forest)' }}>
                            {m.value} {m.unit}
                          </td>
                          <td className="tabular">{m.sampledAt.slice(0, 10)}</td>
                          <td>
                            <button
                              className="badge badge-muted"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setShowCorrectMeas(m);
                                setCorrectMeasVal(String(m.value));
                              }}
                            >
                              Corriger
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: ITINERAIRE OENOLOGIQUE */}
            {lotTab === 'itinerary' && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-ink-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Itinéraire œnologique (Sans conseil de dose ni décision automatique)
                </div>
                {selectedLot.itinerary.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedLot.itinerary.map((step) => (
                      <div
                        key={step.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: step.status === 'done' ? 'var(--color-forest-soft)' : 'var(--color-surface-soft)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '13px',
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600 }}>{step.label}</span>
                          {step.doneAt && (
                            <span style={{ color: 'var(--color-ink-muted)', marginLeft: '6px', fontSize: '11.5px' }}>
                              (validé le {step.doneAt})
                            </span>
                          )}
                        </div>
                        <button
                          className={`badge ${step.status === 'done' ? 'badge-green' : 'badge-muted'}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleItineraryStep(step.key, step.status)}
                        >
                          {step.status === 'done' ? '✓ Fait' : 'Marquer fait'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)' }}>
                    Aucun itinéraire spécifique défini pour ce lot.
                  </p>
                )}
              </div>
            )}

            {/* TAB 3: DEGUSTATIONS & JOURNAL */}
            {lotTab === 'journal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>
                      Notes de dégustation ({lotTastings.length})
                    </span>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setShowTastingModal(true)}
                    >
                      <Plus size={13} /> Dégustation
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {lotTastings.map((t) => (
                      <div key={t.id} style={{ padding: '10px 12px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-sm)', fontSize: '12.5px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{t.notes}</div>
                        <div style={{ color: 'var(--color-ink-light)', marginTop: '2px', fontSize: '11px' }}>
                          {t.tastedAt.slice(0, 10)} · {t.author}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-ink-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Journal des opérations du lot ({lotOps.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '160px', overflowY: 'auto' }}>
                    {lotOps.map((op) => (
                      <div key={op.id} style={{ padding: '8px 10px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600 }}>{op.label}</span> — {op.details}
                        <span style={{ color: 'var(--color-ink-light)', marginLeft: '6px' }}>({op.at.slice(0, 10)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Relevé */}
      {showMeasModal && (
        <div className="modal-backdrop" onClick={() => setShowMeasModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '14px' }}>
              Nouveau relevé analytique — {selectedLot?.name}
            </h2>
            <form onSubmit={handleAddMeasurement}>
              <div className="form-group">
                <label className="form-label">Paramètre mesuré</label>
                <select
                  className="form-select"
                  value={paramKey}
                  onChange={(e) => {
                    const k = e.target.value as MeasurementParameter;
                    setParamKey(k);
                    setParamUnit(PARAMETERS[k].units[0]!);
                  }}
                >
                  {Object.entries(PARAMETERS).map(([k, def]) => (
                    <option key={k} value={k}>{def.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Valeur mesurée</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={paramVal}
                    onChange={(e) => setParamVal(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unité</label>
                  <select
                    className="form-select"
                    value={paramUnit}
                    onChange={(e) => setParamUnit(e.target.value)}
                  >
                    {PARAMETERS[paramKey].units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Date du prélèvement</label>
                <input
                  type="date"
                  className="form-input"
                  value={sampledDate}
                  onChange={(e) => setSampledDate(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMeasModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer la mesure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Correction de mesure */}
      {showCorrectMeas && (
        <div className="modal-backdrop" onClick={() => setShowCorrectMeas(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
              Corriger le relevé ({PARAMETERS[showCorrectMeas.parameter]?.label})
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginBottom: '12px' }}>
              L’ancienne mesure ({showCorrectMeas.value} {showCorrectMeas.unit}) reste conservée dans l’historique (`supersededBy`).
            </p>
            <form onSubmit={handleCorrectMeasurement}>
              <div className="form-group">
                <label className="form-label">Nouvelle valeur corrigée ({showCorrectMeas.unit})</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={correctMeasVal}
                  onChange={(e) => setCorrectMeasVal(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Motif de correction (obligatoire)</label>
                <input
                  type="text"
                  className="form-input"
                  value={correctMeasReason}
                  onChange={(e) => setCorrectMeasReason(e.target.value)}
                  placeholder="Ex : Correction de lecture hydromètre à 20°C"
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCorrectMeas(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-accent">
                  Valider la correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Déclaration volume écoulé */}
      {showDeclareVolModal && (
        <div className="modal-backdrop" onClick={() => setShowDeclareVolModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
              Déclarer le volume de moût / vin écoulé — {selectedLot?.name}
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              Les kilogrammes de raisin ({((selectedLot?.grapesReceivedG ?? 0) / 1000).toLocaleString('fr-FR')} kg) ne sont jamais convertis automatiquement en litres. Saisissez le volume réel entonné.
            </p>
            <form onSubmit={handleDeclareVolume}>
              <div className="form-group">
                <label className="form-label">Contenant de destination</label>
                <select
                  className="form-select"
                  value={declareContainerId}
                  onChange={(e) => setDeclareContainerId(e.target.value)}
                >
                  {containers
                    .filter((c) => c.state === 'available' && !state.occupancies[c.id])
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} ({c.capacityMl / 1000} L)
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Volume réel mesuré (Litres)</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={declareLitres}
                  onChange={(e) => setDeclareLitres(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeclareVolModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Déclarer le volume
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dégustation */}
      {showTastingModal && (
        <div className="modal-backdrop" onClick={() => setShowTastingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Note de dégustation — {selectedLot?.name}
            </h2>
            <form onSubmit={handleAddTasting}>
              <div className="form-group">
                <label className="form-label">Commentaire humain / impressions</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={tastingNote}
                  onChange={(e) => setTastingNote(e.target.value)}
                  placeholder="Ex : Équilibre frais, fin de fermentation alcoolique à surveiller"
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTastingModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Qualité (Hold/Release) */}
      {showQualityModal && (
        <div className="modal-backdrop" onClick={() => setShowQualityModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              {showQualityModal === 'hold' ? 'Bloquer la commercialisation' : 'Libérer le lot'} — {selectedLot?.name}
            </h2>
            <form onSubmit={handleQualityChange}>
              <div className="form-group">
                <label className="form-label">Motif (décision humaine auditée)</label>
                <textarea
                  className="form-textarea"
                  value={qualityReason}
                  onChange={(e) => setQualityReason(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowQualityModal(null)}>
                  Annuler
                </button>
                <button type="submit" className={showQualityModal === 'hold' ? 'btn btn-danger' : 'btn btn-primary'}>
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajout Contenant sur-mesure (Cuve, Foudre, Œuf béton, Demi-muid, Pièce 228L) */}
      {showAddContainerModal && (
        <div className="modal-backdrop" onClick={() => setShowAddContainerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '8px' }}>
              Ajouter un contenant sur-mesure au plan de cuverie
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              Adaptez la cuverie à la structure exacte du domaine (Cuve inox thermorégulée, Œuf béton, Foudre chêne, Demi-muid 600 L, Pièce bourguignonne 228 L).
            </p>
            <form onSubmit={handleAddCustomContainer}>
              <div className="form-group">
                <label className="form-label">Code du contenant (ex: OEUF-01, FOUDRE-02, F-18)</label>
                <input
                  type="text"
                  className="form-input"
                  value={newContainerCode}
                  onChange={(e) => setNewContainerCode(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Famille de contenant</label>
                <select
                  className="form-select"
                  value={newContainerKind}
                  onChange={(e) => setNewContainerKind(e.target.value as ContainerKind)}
                >
                  <option value="tank">Cuve Inox / Béton (tank)</option>
                  <option value="vat">Foudre Bois / Œuf Béton / Amphore (vat)</option>
                  <option value="barrel">Pièce 228 L / Barrique 225 L / Demi-muid 600 L (barrel)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Capacité nominale en hectolitres (hL) — ex: 2,28 pour une pièce de 228 L</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input tabular"
                  value={newContainerCapHl}
                  onChange={(e) => setNewContainerCapHl(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Localisation / Salle de chai</label>
                <input
                  type="text"
                  className="form-input"
                  value={newContainerLocation}
                  onChange={(e) => setNewContainerLocation(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddContainerModal(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Ajouter au plan de cave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
