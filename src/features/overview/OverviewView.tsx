import React from 'react';
import {
  Wine,
  Package,
  Truck,
  ShieldCheck,
  ShieldAlert,
  Grape,
  ArrowRight,
  Sparkles,
  Layers,
  AlertTriangle,
  Wrench,
  GitBranch,
  Navigation,
  ChevronRight,
  CheckCircle2,
  Check,
  Thermometer,
  ShoppingBag,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { lotVolumeMl, batchPosition, ROLE_LABELS } from '../../domain/selectors';
import type { RoleId } from '../../domain/types';

type Tone = 'forest' | 'grape' | 'gold' | 'amber' | 'ink' | 'crimson';
type StepStatus = 'done' | 'active' | 'next' | 'upcoming';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Actions mises en avant selon le métier de la personne connectée. */
const ROLE_RECOMMENDED_ACTIONS: Record<RoleId, string[]> = {
  direction: ['aging', 'sales', 'traceability'],
  cellar_master: ['cellar', 'aging', 'bottling'],
  vineyard_manager: ['vineyard', 'field'],
  sales: ['sales', 'bottling'],
  accounting: ['sales', 'traceability'],
};

export const OverviewView: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { state, role } = useStore();

  if (!state) return null;

  // ------------------------------------------------------------------ Données réelles du store
  const refDate = new Date(state.referenceDate);
  const lots = Object.values(state.lots);
  const containers = Object.values(state.containers);

  const totalWineInCellarL =
    lots
      .filter((l) => l.stage !== 'bottled' && l.stage !== 'empty')
      .reduce((acc, l) => acc + lotVolumeMl(state, l.id), 0) / 1000;
  const cellarCapacityL =
    containers.filter((c) => c.state === 'available').reduce((acc, c) => acc + c.capacityMl, 0) / 1000;
  const cellarFillPct = cellarCapacityL > 0 ? Math.min(100, (totalWineInCellarL / cellarCapacityL) * 100) : 0;

  const batches = Object.values(state.batches);
  const totalPhysicalBottles = batches.reduce((acc, b) => acc + b.physical, 0);
  const totalReservedBottles = batches.reduce((acc, b) => acc + batchPosition(state, b).reserved, 0);
  const totalAvailableBottles = batches.reduce((acc, b) => acc + batchPosition(state, b).available, 0);
  const reservedPct = totalPhysicalBottles > 0 ? (totalReservedBottles / totalPhysicalBottles) * 100 : 0;
  const availablePct = totalPhysicalBottles > 0 ? (totalAvailableBottles / totalPhysicalBottles) * 100 : 0;

  const pendingOrders = Object.values(state.orders).filter(
    (o) => o.status === 'confirmed' || o.status === 'partially_shipped'
  );
  const heldLots = lots.filter((l) => l.quality === 'held');
  const maintenanceContainers = containers.filter((c) => c.state === 'maintenance');
  const cratesWaiting = Object.values(state.harvestCounts)
    .filter((c) => c.transportId === null && c.quantity > 0)
    .reduce((acc, c) => acc + c.quantity, 0);

  // Lots en fermentation sans relevé de densité récent (aucune valeur inventée)
  const staleFermentations = lots
    .filter((l) => l.stage === 'fermenting')
    .map((l) => {
      const last = Object.values(state.measurements)
        .filter((m) => m.lotId === l.id && m.parameter === 'density' && m.supersededBy === null)
        .sort((a, b) => b.sampledAt.localeCompare(a.sampledAt))[0];
      const days = last ? Math.floor((refDate.getTime() - new Date(last.sampledAt).getTime()) / DAY_MS) : null;
      return { lot: l, days };
    })
    .filter((x) => x.days === null || x.days >= 2);

  const hasAssembled2025 = lots.some((l) => l.createdBy === 'blend');
  const hasBottled2025 = batches.some((b) => b.source === 'bottling');
  const hasShippedOrder = Object.keys(state.shipments).length > 0;

  // ------------------------------------------------------------------ Accueil personnalisé
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const dateLabel = refDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });

  const roleNextAction: Record<RoleId, { title: string; desc: string; tab: string; btn: string }> = {
    direction: {
      title: hasAssembled2025 ? 'Valider la mise du Rouge 2025' : 'Arbitrer l’assemblage du Rouge 2025',
      desc: hasAssembled2025
        ? 'L’assemblage est fait. Prochaine étape : lancer la mise en bouteilles et suivre les matières sèches.'
        : 'Deux lots 2025 sont prêts. Une décision de coupe débloque la mise et les allocations de l’année.',
      tab: hasAssembled2025 ? 'bottling' : 'aging',
      btn: hasAssembled2025 ? 'Préparer la mise' : 'Voir l’assemblage',
    },
    cellar_master: {
      title:
        staleFermentations.length > 0
          ? `Relevé à faire sur ${staleFermentations[0]?.lot.name.replace(' — fictif', '') ?? 'une cuve'}`
          : 'Tour de cuverie du jour',
      desc:
        staleFermentations.length > 0
          ? 'Aucune densité saisie récemment sur ce lot en fermentation. Un relevé suffit pour remettre la courbe à jour.'
          : 'Toutes les fermentations ont un relevé récent. Vous pouvez avancer sur l’élevage.',
      tab: 'cellar',
      btn: 'Ouvrir la cuverie',
    },
    vineyard_manager: {
      title: 'Vendange : Le Clos du Puits',
      desc:
        cratesWaiting > 0
          ? `${cratesWaiting} caisses comptées attendent leur départ vers le chai. Préparez le transport.`
          : 'Ouvrez la carte du jour pour guider les équipes et compter les caisses au rang.',
      tab: 'vineyard',
      btn: 'Ouvrir la carte du jour',
    },
    sales: {
      title: `${totalAvailableBottles.toLocaleString('fr-FR')} bouteilles prêtes à vendre`,
      desc:
        pendingOrders.length > 0
          ? `${pendingOrders.length} commande(s) confirmée(s) à expédier. Le stock réservé est déjà protégé.`
          : 'Aucune commande en attente d’expédition. Le stock disponible peut être proposé sans risque de survente.',
      tab: 'sales',
      btn: 'Voir les commandes',
    },
    accounting: {
      title: 'Point matières sèches & encaissements',
      desc: 'Vérifiez bouchons et étiquettes avant la prochaine mise, puis le suivi des règlements clients.',
      tab: 'supplies',
      btn: 'Ouvrir les achats',
    },
  };
  const next = roleNextAction[role] ?? roleNextAction.direction;

  // ------------------------------------------------------------------ Actions rapides (verbes)
  const recommended = ROLE_RECOMMENDED_ACTIONS[role] ?? [];
  const quickActions: { id: string; tab: string; label: string; sub: string; icon: React.ElementType; tone: Tone }[] = [
    { id: 'vineyard', tab: 'vineyard', label: 'Compter la vendange', sub: 'Caisses, kg, hL', icon: Grape, tone: 'forest' },
    { id: 'cellar', tab: 'cellar', label: 'Saisir un relevé', sub: 'Densité, température', icon: Thermometer, tone: 'amber' },
    { id: 'aging', tab: 'aging', label: 'Ouiller ou assembler', sub: 'Fûts & cuves', icon: Layers, tone: 'grape' },
    { id: 'bottling', tab: 'bottling', label: 'Lancer une mise', sub: 'Bouteilles & habillage', icon: Package, tone: 'gold' },
    { id: 'sales', tab: 'sales', label: 'Préparer une commande', sub: 'Réserver, expédier', icon: ShoppingBag, tone: 'ink' },
    { id: 'traceability', tab: 'traceability', label: 'Retrouver un lot', sub: 'De la bouteille à la parcelle', icon: GitBranch, tone: 'forest' },
  ];

  // ------------------------------------------------------------------ Parcours de la vigne au verre
  const firstOpen = [!hasAssembled2025, !hasBottled2025, !hasShippedOrder].indexOf(true);
  const laterStatus = (idx: number, done: boolean): StepStatus =>
    done ? 'done' : firstOpen === idx ? 'next' : 'upcoming';

  const journey: { tab: string; label: string; state: string; icon: React.ElementType; status: StepStatus }[] = [
    { tab: 'vineyard', label: 'Vigne', state: 'Vendange rentrée', icon: Grape, status: 'done' },
    { tab: 'cellar', label: 'Cuverie', state: 'Fermentations en cours', icon: Wine, status: 'active' },
    {
      tab: 'aging',
      label: 'Élevage',
      state: hasAssembled2025 ? 'Assemblage fait' : 'Assemblage à faire',
      icon: Layers,
      status: laterStatus(0, hasAssembled2025),
    },
    {
      tab: 'bottling',
      label: 'Mise',
      state: hasBottled2025 ? 'Bouteilles tirées' : 'En attente',
      icon: Package,
      status: laterStatus(1, hasBottled2025),
    },
    {
      tab: 'sales',
      label: 'Clients',
      state: hasShippedOrder ? 'Livraison partie' : 'À expédier',
      icon: Truck,
      status: laterStatus(2, hasShippedOrder),
    },
  ];

  // ------------------------------------------------------------------ Millésimes actifs
  const vintages: { year: number; name: string; stage: string; detail: string; tab: string; strip: string }[] = [
    {
      year: 2026,
      name: 'Millésime 2026',
      stage: 'Vendange & fermentations',
      detail: '150 L de blanc et 180 L de rouge en cuve',
      tab: 'cellar',
      strip: 'ds-strip-mixed',
    },
    {
      year: 2025,
      name: 'Millésime 2025',
      stage: hasBottled2025 ? 'Mis en bouteille' : hasAssembled2025 ? 'Assemblé' : 'Prêt à assembler',
      detail: hasAssembled2025 ? 'Lot assemblé, filiation conservée' : 'Deux lots rouges élevés, prêts pour la coupe',
      tab: hasAssembled2025 ? 'bottling' : 'aging',
      strip: 'ds-strip-red',
    },
    {
      year: 2024,
      name: 'Millésime 2024',
      stage: 'Élevage en fûts',
      detail: '200 L de blanc en pièces bourguignonnes',
      tab: 'aging',
      strip: 'ds-strip-white',
    },
    {
      year: 2023,
      name: 'Millésime 2023',
      stage: 'En cave, prêt à vendre',
      detail: '36 bouteilles à écouler en priorité',
      tab: 'bottling',
      strip: 'ds-strip-red',
    },
    {
      year: 2027,
      name: 'Horizon 2027',
      stage: 'Renouvellement de vigne',
      detail: 'Scénario de replantation à simuler',
      tab: 'finance',
      strip: 'ds-strip-future',
    },
  ];

  // ------------------------------------------------------------------ À traiter aujourd'hui (calculé)
  const todos: { key: string; title: string; sub: string; tab: string; icon: React.ElementType; tone: Tone }[] = [];
  staleFermentations.forEach(({ lot, days }) => {
    todos.push({
      key: `stale-${lot.id}`,
      title: `Relevé de densité · ${lot.name.replace(' — fictif', '')}`,
      sub: days === null ? 'Aucun relevé enregistré' : `Dernier relevé il y a ${days} jours`,
      tab: 'cellar',
      icon: AlertTriangle,
      tone: 'amber',
    });
  });
  if (cratesWaiting > 0) {
    todos.push({
      key: 'crates',
      title: `${cratesWaiting} caisses à acheminer au chai`,
      sub: 'Comptées au rang, pas encore parties',
      tab: 'vineyard',
      icon: Grape,
      tone: 'forest',
    });
  }
  if (pendingOrders.length > 0) {
    todos.push({
      key: 'orders',
      title: `${pendingOrders.length} commande(s) à expédier`,
      sub: 'Stock déjà réservé pour ces clients',
      tab: 'sales',
      icon: Truck,
      tone: 'gold',
    });
  }
  heldLots.forEach((l) => {
    todos.push({
      key: `held-${l.id}`,
      title: `Lot bloqué en qualité · ${l.name.replace(' — fictif', '')}`,
      sub: 'Ne peut pas être mis ni vendu tant qu’il n’est pas libéré',
      tab: 'cellar',
      icon: ShieldAlert,
      tone: 'crimson',
    });
  });
  maintenanceContainers.forEach((c) => {
    todos.push({
      key: `maint-${c.id}`,
      title: `Contenant ${c.code} en maintenance`,
      sub: 'Aucun transfert possible vers ce contenant',
      tab: 'cellar',
      icon: Wrench,
      tone: 'ink',
    });
  });

  // ------------------------------------------------------------------ Rendu
  return (
    <div className="ds-page">
      {/* 1. Accueil : où j'en suis + ma priorité */}
      <section className="ds-hero ds-rise" aria-label="Accueil du domaine">
        <div>
          <h1 className="ds-eyebrow">
            <Sparkles size={12} /> Vue d’ensemble · {state.organization.name.replace(' — fictif', '')}
          </h1>
          <div className="ds-hero-title">
            {greeting}, {ROLE_LABELS[role]}.
          </div>
          <p className="ds-hero-sub">
            Voici l’essentiel du domaine aujourd’hui. Touchez une carte pour agir directement, sans chercher dans les menus.
          </p>
          <div className="ds-hero-meta">
            <span className="ds-chip" style={{ textTransform: 'capitalize' }}>{dateLabel}</span>
            <span className="ds-chip" style={{ color: 'var(--color-grape)' }}>
              <span className="ds-chip-dot" /> Campagne 2026
            </span>
            <span className="ds-chip" style={{ color: 'var(--color-forest)' }}>
              <span className="ds-chip-dot" /> 5 millésimes suivis
            </span>
          </div>
        </div>

        <div className="ds-next">
          <div>
            <span className="ds-eyebrow" style={{ color: '#E2C799' }}>
              Votre priorité maintenant
            </span>
            <div className="ds-next-title">{next.title}</div>
            <p className="ds-next-desc">{next.desc}</p>
          </div>
          <button type="button" className="ds-cta" onClick={() => onNavigate(next.tab)}>
            {next.btn} <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* 2. Que voulez-vous faire ? (verbes d'action, grandes cibles) */}
      <section className="ds-rise ds-rise-1" aria-label="Actions rapides">
        <div className="ds-section-head">
          <h2 className="ds-section-title">Que voulez-vous faire&nbsp;?</h2>
          <span className="ds-section-hint">Les actions dorées correspondent à votre métier</span>
        </div>
        <div className="ds-quick-grid">
          {quickActions.map((a) => {
            const Icon = a.icon;
            const isReco = recommended.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                className={`ds-tile ${isReco ? 'is-recommended' : ''}`}
                onClick={() => onNavigate(a.tab)}
              >
                {isReco && <span className="ds-tile-badge">Pour vous</span>}
                <span className={`ds-icon-bubble ds-tone-${a.tone}`}>
                  <Icon size={20} strokeWidth={1.9} />
                </span>
                <span>
                  <span className="ds-tile-label" style={{ display: 'block' }}>{a.label}</span>
                  <span className="ds-tile-sub" style={{ display: 'block' }}>{a.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
        {role === 'vineyard_manager' && (
          <button
            type="button"
            className="ds-row"
            style={{ marginTop: '10px', width: '100%' }}
            onClick={() => onNavigate('vineyard')}
          >
            <span className="ds-icon-bubble ds-tone-amber" style={{ width: 36, height: 36 }}>
              <Navigation size={17} />
            </span>
            <span className="ds-row-main">
              <span className="ds-row-title" style={{ display: 'block' }}>Guider les équipes à 5h</span>
              <span className="ds-row-sub" style={{ display: 'block' }}>Carte GPS simplifiée pour vendangeurs et chauffeurs</span>
            </span>
            <span className="ds-go"><ChevronRight size={16} /></span>
          </button>
        )}
      </section>

      {/* 3. Chiffres clés, lisibles d'un coup d'œil */}
      <section className="ds-stats ds-rise ds-rise-2" aria-label="Chiffres clés">
        <button type="button" className="ds-stat" onClick={() => onNavigate('cellar')}>
          <span className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-forest"><Wine size={16} /></span>
            Vin en cuves et fûts
          </span>
          <span className="ds-stat-value">
            {totalWineInCellarL.toLocaleString('fr-FR')}
            <span className="ds-stat-unit">litres</span>
          </span>
          <span className="ds-bar" aria-hidden="true">
            <span style={{ width: `${cellarFillPct}%`, background: 'var(--color-forest)' }} />
          </span>
          <span className="ds-stat-foot">Chai rempli à {Math.round(cellarFillPct)} %</span>
        </button>

        <button type="button" className="ds-stat" onClick={() => onNavigate('bottling')}>
          <span className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-grape"><Package size={16} /></span>
            Bouteilles en cave
          </span>
          <span className="ds-stat-value">{totalPhysicalBottles.toLocaleString('fr-FR')}</span>
          <span className="ds-bar" aria-hidden="true">
            <span style={{ width: `${reservedPct}%`, background: 'var(--color-gold)' }} />
            <span style={{ width: `${availablePct}%`, background: 'var(--color-forest)' }} />
          </span>
          <span className="ds-stat-foot">
            <strong style={{ color: 'var(--color-forest)' }}>{totalAvailableBottles}</strong> à vendre ·{' '}
            {totalReservedBottles} réservées
          </span>
        </button>

        <button type="button" className="ds-stat" onClick={() => onNavigate('sales')}>
          <span className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-gold"><Truck size={16} /></span>
            Commandes à expédier
          </span>
          <span className="ds-stat-value">{pendingOrders.length}</span>
          <span className="ds-stat-foot">
            {pendingOrders.length === 0 ? 'Tout est parti' : 'Stock déjà réservé'}
          </span>
        </button>

        <button type="button" className="ds-stat" onClick={() => onNavigate('cellar')}>
          <span className="ds-stat-top">
            <span className={`ds-icon-bubble ${heldLots.length > 0 ? 'ds-tone-crimson' : 'ds-tone-forest'}`}>
              {heldLots.length > 0 ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
            </span>
            Qualité
          </span>
          <span
            className="ds-stat-value"
            style={{ color: heldLots.length > 0 ? 'var(--color-crimson)' : 'var(--color-forest)' }}
          >
            {heldLots.length}
          </span>
          <span className="ds-stat-foot">
            {heldLots.length === 0 ? 'Aucun lot bloqué' : 'lot(s) bloqué(s) à examiner'}
          </span>
        </button>
      </section>

      {/* 4. Le parcours de la vigne au verre */}
      <section className="ds-rise ds-rise-3" aria-label="Parcours de la vigne au verre">
        <div className="ds-section-head">
          <h2 className="ds-section-title">De la vigne au verre</h2>
          <span className="ds-section-hint">L’étape dorée est la prochaine à faire</span>
        </div>
        <div className="ds-journey">
          {journey.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.tab}
                type="button"
                className={`ds-step is-${s.status}`}
                onClick={() => onNavigate(s.tab)}
                aria-label={`${s.label} : ${s.state}`}
              >
                <span className="ds-step-node">
                  {s.status === 'done' ? <Check size={20} strokeWidth={2.6} /> : <Icon size={19} />}
                </span>
                <span className="ds-step-label">{s.label}</span>
                <span className="ds-step-state">{s.state}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Millésimes + À traiter */}
      <div className="ds-split ds-rise ds-rise-4">
        <section className="ds-panel" aria-label="Millésimes suivis">
          <div className="ds-section-head">
            <h2 className="ds-section-title">Vos millésimes</h2>
            <span className="ds-section-hint">Du plus jeune au plus ancien</span>
          </div>
          <div className="ds-vintages">
            {vintages.map((v) => (
              <button key={v.year} type="button" className="ds-vintage" onClick={() => onNavigate(v.tab)}>
                <span className={`ds-vintage-strip ${v.strip}`} />
                <span className="ds-vintage-year">{v.year}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="ds-vintage-name" style={{ display: 'block' }}>{v.name}</span>
                  <span className="ds-vintage-stage" style={{ display: 'block' }}>{v.stage}</span>
                  <span className="ds-vintage-detail" style={{ display: 'block' }}>{v.detail}</span>
                </span>
                <span className="ds-go"><ChevronRight size={16} /></span>
              </button>
            ))}
          </div>
        </section>

        <section className="ds-panel" aria-label="À traiter aujourd’hui">
          <div className="ds-section-head">
            <h2 className="ds-section-title">À traiter</h2>
            <span className="ds-section-hint">{todos.length} point(s)</span>
          </div>
          {todos.length === 0 ? (
            <div className="ds-empty">
              <CheckCircle2 size={18} /> Rien d’urgent aujourd’hui. Bonne journée au domaine.
            </div>
          ) : (
            <div className="ds-rows">
              {todos.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.key} type="button" className="ds-row" onClick={() => onNavigate(t.tab)}>
                    <span className={`ds-icon-bubble ds-tone-${t.tone}`} style={{ width: 36, height: 36 }}>
                      <Icon size={17} />
                    </span>
                    <span className="ds-row-main">
                      <span className="ds-row-title" style={{ display: 'block' }}>{t.title}</span>
                      <span className="ds-row-sub" style={{ display: 'block' }}>{t.sub}</span>
                    </span>
                    <span className="ds-go"><ChevronRight size={16} /></span>
                  </button>
                );
              })}
            </div>
          )}
          <p style={{ fontSize: '11px', color: 'var(--color-ink-light)', marginTop: '12px' }}>
            Calculé à partir des données du domaine. Aucune valeur n’est estimée ni inventée.
          </p>
        </section>
      </div>
    </div>
  );
};
