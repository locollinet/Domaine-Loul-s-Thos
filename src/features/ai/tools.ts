import { bottlingRequirements, PARAMETERS, previewBlend } from '../../domain/commands/cellar';
import { canRun } from '../../domain/commands/index';
import {
  ancestors,
  batchPosition,
  containerFreeMl,
  descendants,
  invoiceBalance,
  lotOccupancies,
  lotVolumeMl,
} from '../../domain/selectors';
import type {
  BottlingBatch,
  MeasurementParameter,
  Parcel,
  RoleId,
  WineLot,
} from '../../domain/types';
import { sanitizeForRole } from './permissions';
import type {
  AssistantPrefillPayload,
  AssistantTabId,
  AssistantToolContext,
  AssistantToolName,
  ResultCard,
  ResultCardItem,
} from './types';

interface ToolDefinition<I = Record<string, unknown>, O = Record<string, unknown>> {
  name: AssistantToolName;
  roles: readonly RoleId[];
  needsCosts?: boolean;
  needsFinance?: boolean;
  isModuleEnabled?: (ctx: Pick<AssistantToolContext, 'enabledMainModules'>) => boolean;
  run: (ctx: AssistantToolContext, input: I) => O;
  toCards: (output: O, ctx: AssistantToolContext) => ResultCard[];
}

const ALL_ROLES: readonly RoleId[] = [
  'direction',
  'cellar_master',
  'vineyard_manager',
  'sales',
  'accounting',
];

function clampLimit(limit: unknown, fallback = 10, max = 20): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(limit)));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchesQuery(
  query: unknown,
  ...candidates: Array<string | number | null | undefined>
): boolean {
  if (typeof query !== 'string' || !query.trim()) return true;
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = candidates
    .filter((c) => c !== null && c !== undefined)
    .map((c) => normalizeText(String(c)))
    .join(' ');
  return tokens.every((tok) => haystack.includes(tok));
}

function fmtLitres(ml: number): string {
  return `${(ml / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} L`;
}

function fmtHl(ml: number): string {
  return `${(ml / 100000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} hL`;
}

function fmtKg(grams: number): string {
  return `${(grams / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`;
}

function fmtEur(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function fmtArea(areaM2: Parcel['areaM2']): string {
  if (!areaM2) return 'Surface inconnue (en cours d’arpentage)';
  const ha = (areaM2.value / 10000).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return `${ha} ha (${areaM2.status === 'measured' ? 'mesurée' : 'estimée'})`;
}

function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const fromMs = Date.parse(fromIso.slice(0, 10));
  const toMs = Date.parse(toIso.slice(0, 10));
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
  return Math.max(0, Math.round((toMs - fromMs) / 86_400_000));
}

// ------------------------------------------------------------------ 1. Vineyard

interface InspectVineyardInput {
  query?: string;
  missionStatus?: string;
  includePendingCounts?: boolean;
  limit?: number;
}

function runInspectVineyard(
  ctx: AssistantToolContext,
  input: InspectVineyardInput
): Record<string, unknown> {
  const { state } = ctx;
  const limit = clampLimit(input.limit, 12, 20);

  const allParcels = Object.values(state.parcels);
  const parcels = allParcels.filter((p) =>
    matchesQuery(input.query, p.id, p.code, p.name, p.grape, p.color)
  );
  const unknownAreaParcels = allParcels.filter((p) => p.areaM2 === null);

  const allMissions = Object.values(state.missions);
  const missions = allMissions.filter((m) => {
    if (input.missionStatus && m.status !== input.missionStatus) return false;
    const parcel = state.parcels[m.parcelId];
    return matchesQuery(input.query, m.id, m.title, m.operation, parcel?.name, parcel?.code);
  });

  const pendingCounts = Object.values(state.harvestCounts).filter((c) => c.transportId === null);
  const pendingCratesTotal = pendingCounts.reduce((sum, c) => sum + c.quantity, 0);

  const receptions = Object.values(state.receptions).map((r) => ({
    id: r.id,
    ticket: r.ticket,
    transportId: r.transportId,
    grossKg: r.grossG / 1000,
    tareKg: r.tareG / 1000,
    netKg: r.netG / 1000,
    destinationLotCode: state.lots[r.destinationLotId]?.code ?? r.destinationLotId,
    weighedAt: r.weighedAt.slice(0, 10),
  }));

  const knownAreaHaTotal =
    allParcels.reduce((sum, p) => sum + (p.areaM2 ? p.areaM2.value : 0), 0) / 10000;

  return {
    domainInvariant:
      'Les poids de vendange (kg) et volumes de vin (L/hL) sont mesurés indépendamment : aucun rendement en litres n’est dérivé des kg. Inconnu ≠ zéro pour les surfaces.',
    phytoTesaEnabled: Boolean(ctx.enabledAddons.phyto_tesa),
    totalParcelsCount: allParcels.length,
    knownAreaHaTotal: Number(knownAreaHaTotal.toFixed(2)),
    unknownAreaParcelsCount: unknownAreaParcels.length,
    unknownAreaParcels: unknownAreaParcels.map((p) => ({ id: p.id, code: p.code, name: p.name })),
    parcels: parcels.slice(0, limit).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      grape: p.grape,
      color: p.color,
      areaM2: p.areaM2 ? p.areaM2.value : null,
      areaStatus: p.areaM2?.status ?? null,
      areaLabel: fmtArea(p.areaM2),
    })),
    missionsTotalCount: allMissions.length,
    missions: missions.slice(0, limit).map((m) => ({
      id: m.id,
      title: m.title,
      operation: m.operation,
      status: m.status,
      parcelId: m.parcelId,
      parcelName: state.parcels[m.parcelId]?.name ?? m.parcelId,
      plannedStart: m.plannedStart,
      plannedEnd: m.plannedEnd,
    })),
    pendingCountsTotalCrates: pendingCratesTotal,
    pendingCounts:
      input.includePendingCounts !== false
        ? pendingCounts.slice(0, limit).map((c) => ({
            id: c.id,
            parcelCode: state.parcels[c.parcelId]?.code ?? c.parcelId,
            parcelName: state.parcels[c.parcelId]?.name ?? c.parcelId,
            quantity: c.quantity,
            crateType: c.crateType,
            countedAt: c.countedAt.slice(0, 10),
          }))
        : [],
    receptions: receptions.slice(0, limit),
    truncated: parcels.length > limit || missions.length > limit,
  };
}

function vineyardToCards(out: Record<string, unknown>): ResultCard[] {
  const parcels = (out['parcels'] as Array<Record<string, unknown>> | undefined) ?? [];
  const missions = (out['missions'] as Array<Record<string, unknown>> | undefined) ?? [];
  const pendingCrates = Number(out['pendingCountsTotalCrates'] ?? 0);
  const unknownCount = Number(out['unknownAreaParcelsCount'] ?? 0);
  const knownHa = Number(out['knownAreaHaTotal'] ?? 0);
  const totalParcels = Number(out['totalParcelsCount'] ?? parcels.length);
  const phytoTesaEnabled = Boolean(out['phytoTesaEnabled']);

  const items: ResultCardItem[] = [];
  for (const m of missions.slice(0, 4)) {
    const status = String(m['status'] ?? '');
    const parcelId = String(m['parcelId'] ?? '');
    items.push({
      id: String(m['id'] ?? ''),
      title: `${String(m['title'] ?? '')}`,
      subtitle: `${String(m['parcelName'] ?? '')} · ${String(m['plannedStart'] ?? '')}`,
      badge: status,
      tone: status === 'blocked' ? 'bad' : status === 'in_progress' ? 'warn' : 'ok',
      prefill: { tab: 'vineyard', subTab: 'harvest', parcelId },
    });
  }
  for (const p of parcels.slice(0, 4)) {
    const areaLabel = String(p['areaLabel'] ?? '');
    const isUnknown = p['areaM2'] === null;
    items.push({
      id: String(p['id'] ?? ''),
      title: `${String(p['code'] ?? '')} · ${String(p['name'] ?? '')}`,
      subtitle: `${String(p['grape'] ?? '')} · ${areaLabel}`,
      badge: isUnknown ? 'Surface inconnue' : String(p['color'] ?? ''),
      tone: isUnknown ? 'warn' : 'neutral',
      prefill: { tab: 'vineyard', subTab: 'atlas', parcelId: String(p['id'] ?? '') },
    });
  }

  return [
    {
      id: 'card-vineyard',
      title: 'Vignoble, Vendanges & Cadastre',
      metrics: [
        { label: 'Parcelles', value: `${totalParcels} (${knownHa} ha connus)`, tone: 'brand' },
        {
          label: 'Caisses non transportées',
          value: `${pendingCrates} caisses`,
          tone: pendingCrates > 0 ? 'warn' : 'ok',
        },
        {
          label: 'Surfaces inconnues',
          value: `${unknownCount}`,
          tone: unknownCount > 0 ? 'warn' : 'ok',
        },
      ],
      items: items.slice(0, 8),
      note: phytoTesaEnabled
        ? 'Module Phyto 2027/2028 & TESA actif dans Vignoble. Inconnu ≠ zéro, kg ≠ L.'
        : 'Inconnu ≠ zéro pour les surfaces ; kg de vendange ≠ litres de vin.',
      action: {
        label: 'Ouvrir Vignoble & Récolte',
        prefill: { tab: 'vineyard', subTab: pendingCrates > 0 ? 'harvest' : 'atlas' },
      },
    },
  ];
}

// ------------------------------------------------------------------ 2. Cellar

interface InspectCellarInput {
  lotQuery?: string;
  containerQuery?: string;
  onlyMaintenanceContainers?: boolean;
  onlyAvailableContainers?: boolean;
  includeMeasurements?: boolean;
  limit?: number;
}

function runInspectCellar(
  ctx: AssistantToolContext,
  input: InspectCellarInput
): Record<string, unknown> {
  const { state } = ctx;
  const limit = clampLimit(input.limit, 12, 20);
  const refDate = state.referenceDate;

  const allLots = Object.values(state.lots);
  const totalVolumeMl = allLots.reduce((sum, l) => sum + lotVolumeMl(state, l.id), 0);

  const matchingLots = allLots
    .filter((l) =>
      matchesQuery(
        input.lotQuery,
        l.id,
        l.code,
        l.name,
        l.vintage,
        l.color === 'white' ? 'blanc white' : 'rouge red',
        l.stage
      )
    )
    .map((l) => {
      const volMl = lotVolumeMl(state, l.id);
      const occs = lotOccupancies(state, l.id).map((o) => ({
        containerId: o.containerId,
        containerCode: state.containers[o.containerId]?.code ?? o.containerId,
        kind: state.containers[o.containerId]?.kind ?? 'tank',
        volumeMl: o.volumeMl,
        volumeLitres: o.volumeMl / 1000,
      }));

      const activeMeas = Object.values(state.measurements)
        .filter((m) => m.lotId === l.id && m.supersededBy === null)
        .sort((a, b) => a.sampledAt.localeCompare(b.sampledAt));

      const latestByParam: Record<string, { value: number; unit: string; date: string }> = {};
      for (const m of activeMeas) {
        latestByParam[m.parameter] = {
          value: m.value,
          unit: m.unit,
          date: m.sampledAt.slice(0, 10),
        };
      }

      const lastMeas = activeMeas[activeMeas.length - 1] ?? null;
      const daysSinceLastReading = lastMeas ? daysBetweenIso(lastMeas.sampledAt, refDate) : null;
      const measurementGapAlert =
        l.stage === 'fermenting' && (daysSinceLastReading === null || daysSinceLastReading >= 3)
          ? lastMeas
            ? `Aucun relevé depuis le ${lastMeas.sampledAt.slice(0, 10)} (${daysSinceLastReading} jours sans mesure — aucune interpolation).`
            : 'Aucun relevé analytique enregistré pour ce lot en fermentation.'
          : null;

      return {
        id: l.id,
        code: l.code,
        name: l.name,
        vintage: l.vintage,
        color: l.color,
        stage: l.stage,
        quality: l.quality,
        volumeMl: volMl,
        volumeLitres: volMl / 1000,
        volumeHl: Number((volMl / 100000).toFixed(2)),
        grapesReceivedKg: l.grapesReceivedG > 0 ? l.grapesReceivedG / 1000 : null,
        containers: occs,
        latestMeasurements: latestByParam,
        ...(input.includeMeasurements === true
          ? {
              measurementSeries: activeMeas.slice(-8).map((m) => ({
                id: m.id,
                parameter: m.parameter,
                label: PARAMETERS[m.parameter]?.label ?? m.parameter,
                value: m.value,
                unit: m.unit,
                date: m.sampledAt.slice(0, 10),
              })),
            }
          : {}),
        lastMeasurementDate: lastMeas ? lastMeas.sampledAt.slice(0, 10) : null,
        daysSinceLastReading,
        measurementGapAlert,
      };
    });

  const allContainers = Object.values(state.containers);
  const occupiedCount = Object.keys(state.occupancies).length;
  const maintenanceContainers = allContainers.filter((c) => c.state === 'maintenance');
  const availableEmptyContainers = allContainers.filter(
    (c) => c.state === 'available' && !state.occupancies[c.id]
  );

  const containers = allContainers
    .filter((c) => {
      if (input.onlyMaintenanceContainers && c.state !== 'maintenance') return false;
      if (input.onlyAvailableContainers && (c.state !== 'available' || Boolean(state.occupancies[c.id]))) {
        return false;
      }
      return matchesQuery(input.containerQuery, c.id, c.code, c.kind, c.location, c.cooper);
    })
    .map((c) => {
      const occ = state.occupancies[c.id];
      return {
        id: c.id,
        code: c.code,
        kind: c.kind,
        location: c.location,
        state: c.state,
        capacityLitres: c.capacityMl / 1000,
        occupiedLitres: occ ? occ.volumeMl / 1000 : 0,
        freeLitres: containerFreeMl(state, c) / 1000,
        lotCode: occ ? state.lots[occ.lotId]?.code ?? occ.lotId : null,
        cooper: c.cooper ?? null,
      };
    });

  return {
    referenceDate: refDate.slice(0, 10),
    totalVolumeMl,
    totalVolumeLitres: totalVolumeMl / 1000,
    totalVolumeHl: Number((totalVolumeMl / 100000).toFixed(2)),
    occupiedContainersCount: occupiedCount,
    totalContainersCount: allContainers.length,
    maintenanceContainersCount: maintenanceContainers.length,
    availableEmptyContainersCount: availableEmptyContainers.length,
    lots: matchingLots.slice(0, limit),
    containers: containers.slice(0, limit),
    truncated: matchingLots.length > limit || containers.length > limit,
  };
}

function cellarToCards(out: Record<string, unknown>): ResultCard[] {
  const totalMl = Number(out['totalVolumeMl'] ?? 0);
  const occupied = Number(out['occupiedContainersCount'] ?? 0);
  const totalCont = Number(out['totalContainersCount'] ?? 0);
  const maintCount = Number(out['maintenanceContainersCount'] ?? 0);
  const lots = (out['lots'] as Array<Record<string, unknown>> | undefined) ?? [];

  const items: ResultCardItem[] = lots
    .filter((l) => Number(l['volumeMl'] ?? 0) > 0 || Boolean(l['measurementGapAlert']))
    .slice(0, 8)
    .map((l) => {
      const gap = l['measurementGapAlert'] as string | null;
      const volMl = Number(l['volumeMl'] ?? 0);
      const latest = (l['latestMeasurements'] as Record<string, { value: number; unit: string }> | undefined) ?? {};
      const dens = latest['density'] ? ` · dens. ${latest['density'].value} ${latest['density'].unit}` : '';
      const temp = latest['temperature'] ? ` · ${latest['temperature'].value} ${latest['temperature'].unit}` : '';
      return {
        id: String(l['id'] ?? ''),
        title: `${String(l['code'] ?? '')} · ${String(l['name'] ?? '')}`,
        subtitle: gap
          ? gap
          : `${fmtLitres(volMl)} (${fmtHl(volMl)})${dens}${temp}`,
        badge: gap ? 'Relevé manquant' : String(l['stage'] ?? ''),
        tone: gap ? 'warn' : l['quality'] === 'held' ? 'bad' : 'ok',
        prefill: { tab: 'cellar', lotId: String(l['id'] ?? '') },
      };
    });

  return [
    {
      id: 'card-cellar',
      title: 'Chai, Cuverie & Relevés Analytiques',
      metrics: [
        { label: 'Volume total au chai', value: `${fmtLitres(totalMl)} (${fmtHl(totalMl)})`, tone: 'brand' },
        { label: 'Contenants occupés', value: `${occupied} / ${totalCont}`, tone: 'neutral' },
        {
          label: 'En maintenance',
          value: `${maintCount}`,
          tone: maintCount > 0 ? 'warn' : 'ok',
        },
      ],
      items,
      note: 'Les trous de relevés analytiques sont signalés sans interpolation.',
      action: { label: 'Ouvrir Chai & Vinification', prefill: { tab: 'cellar' } },
    },
  ];
}

// ------------------------------------------------------------------ 3. Aging & Bottling

interface CheckAgingBottlingInput {
  vintage?: number;
  skuQuery?: string;
  bottles?: number;
  checkBlend2025?: boolean;
}

function runCheckAgingAndBottling(
  ctx: AssistantToolContext,
  input: CheckAgingBottlingInput
): Record<string, unknown> {
  const { state } = ctx;

  const readyOrAgingLots = Object.values(state.lots)
    .filter((l) => l.stage === 'aging' || l.stage === 'ready')
    .filter((l) => (typeof input.vintage === 'number' ? l.vintage === input.vintage : true))
    .map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      vintage: l.vintage,
      color: l.color,
      stage: l.stage,
      quality: l.quality,
      volumeMl: lotVolumeMl(state, l.id),
      volumeLitres: lotVolumeMl(state, l.id) / 1000,
      expectedReady: l.expectedReady,
    }));

  // Optional 2025 blend simulation via pure previewBlend
  let blend2025Simulation: Record<string, unknown> | null = null;
  if (
    input.checkBlend2025 ||
    input.vintage === 2025 ||
    (state.lots['lot-2025-a'] && state.lots['lot-2025-b'] && !input.skuQuery)
  ) {
    const lotA = state.lots['lot-2025-a'];
    const lotB = state.lots['lot-2025-b'];
    const occA = lotA ? lotOccupancies(state, lotA.id)[0] : undefined;
    const occB = lotB ? lotOccupancies(state, lotB.id)[0] : undefined;
    const freeDest = Object.values(state.containers).find(
      (c) => c.state === 'available' && !state.occupancies[c.id] && c.capacityMl >= 500000
    );
    if (lotA && lotB && occA && occB && freeDest) {
      try {
        const preview = previewBlend(state, {
          name: 'Simulation Assemblage 2025',
          cuveeId: 'cuvee-red',
          destinationContainerId: freeDest.id,
          inputs: [
            { lotId: lotA.id, containerId: occA.containerId, volumeMl: Math.min(300000, occA.volumeMl) },
            { lotId: lotB.id, containerId: occB.containerId, volumeMl: Math.min(200000, occB.volumeMl) },
          ],
        });
        blend2025Simulation = {
          feasible: true,
          destinationContainerCode: freeDest.code,
          totalAvailableInputsLitres: (occA.volumeMl + occB.volumeMl) / 1000,
          simulatedTotalLitres: preview.totalMl / 1000,
          vintage: preview.vintage,
          color: preview.color,
        };
      } catch (err: unknown) {
        blend2025Simulation = {
          feasible: false,
          reason: err instanceof Error ? err.message : 'Simulation impossible',
        };
      }
    }
  }

  // Evaluate SKU dry goods feasibility
  const skus = Object.values(state.skus).filter((s) =>
    input.skuQuery
      ? matchesQuery(input.skuQuery, s.id, s.label, s.vintage)
      : typeof input.vintage === 'number'
      ? s.vintage === input.vintage
      : true
  );

  const bottlingChecks = skus.map((sku) => {
    const matchingLot = Object.values(state.lots).find(
      (l) => l.cuveeId === sku.cuveeId && l.vintage === sku.vintage && lotVolumeMl(state, l.id) > 0
    );
    const lotVolMl = matchingLot ? lotVolumeMl(state, matchingLot.id) : 0;
    const bottlesTarget =
      typeof input.bottles === 'number' && input.bottles > 0
        ? Math.trunc(input.bottles)
        : Math.max(12, Math.min(240, Math.floor(lotVolMl / sku.sizeMl) || 120));

    const reqs = bottlingRequirements(state, sku.id, bottlesTarget).map((r) => ({
      dryGoodId: r.dryGoodId,
      name: state.dryGoods[r.dryGoodId]?.name ?? r.dryGoodId,
      required: r.required,
      onHand: r.onHand,
      missing: Math.max(0, r.required - r.onHand),
    }));
    const missingItems = reqs.filter((r) => r.missing > 0);
    const openPosForMissing = Object.values(state.purchaseOrders)
      .filter((po) => po.status === 'open' || po.status === 'partially_received')
      .filter((po) => po.lines.some((line) => missingItems.some((m) => m.dryGoodId === line.dryGoodId)))
      .map((po) => ({
        id: po.id,
        code: po.code,
        supplier: po.supplier,
        expectedAt: po.expectedAt,
        status: po.status,
      }));

    return {
      skuId: sku.id,
      skuLabel: sku.label,
      vintage: sku.vintage,
      lotCode: matchingLot?.code ?? null,
      lotVolumeLitres: lotVolMl / 1000,
      lotQuality: matchingLot?.quality ?? null,
      targetBottlesTested: bottlesTarget,
      feasible:
        Boolean(matchingLot) &&
        matchingLot?.quality === 'released' &&
        lotVolMl >= bottlesTarget * sku.sizeMl &&
        missingItems.length === 0,
      missingDryGoods: missingItems,
      openPurchaseOrdersForMissing: openPosForMissing,
    };
  });

  return {
    readyOrAgingLots,
    blend2025Simulation,
    bottlingChecks,
  };
}

function agingAndBottlingToCards(out: Record<string, unknown>): ResultCard[] {
  const lots = (out['readyOrAgingLots'] as Array<Record<string, unknown>> | undefined) ?? [];
  const checks = (out['bottlingChecks'] as Array<Record<string, unknown>> | undefined) ?? [];
  const missingAny = checks.some(
    (c) => ((c['missingDryGoods'] as Array<unknown> | undefined)?.length ?? 0) > 0
  );

  const items: ResultCardItem[] = [
    ...lots.slice(0, 4).map((l) => ({
      id: String(l['id'] ?? ''),
      title: `${String(l['code'] ?? '')} · ${String(l['name'] ?? '')}`,
      subtitle: `${fmtLitres(Number(l['volumeMl'] ?? 0))} · stade ${String(l['stage'] ?? '')}`,
      badge: l['quality'] === 'released' ? 'Libéré' : 'Bloqué qualité',
      tone: (l['quality'] === 'released' ? 'ok' : 'bad') as 'ok' | 'bad',
      prefill: { tab: 'aging' } as AssistantPrefillPayload,
    })),
    ...checks.slice(0, 4).map((c) => {
      const missing = (c['missingDryGoods'] as Array<Record<string, unknown>> | undefined) ?? [];
      const pos = (c['openPurchaseOrdersForMissing'] as Array<Record<string, unknown>> | undefined) ?? [];
      const feasible = Boolean(c['feasible']);
      const missingLabel =
        missing.length > 0
          ? `Manque : ${missing.map((m) => `${String(m['name'])} (stock ${String(m['onHand'])})`).join(', ')}${
              pos[0] ? ` · Cde ${String(pos[0]['code'])} attendue le ${String(pos[0]['expectedAt'])}` : ''
            }`
          : `${String(c['targetBottlesTested'] ?? '')} bt prêtes (${String(c['lotCode'] ?? '—')})`;
      return {
        id: String(c['skuId'] ?? ''),
        title: String(c['skuLabel'] ?? ''),
        subtitle: missingLabel,
        badge: feasible ? 'Mise possible' : 'Bloquée / Incomplète',
        tone: (feasible ? 'ok' : 'warn') as 'ok' | 'warn',
        prefill: (missing.length > 0 ? { tab: 'supplies' } : { tab: 'bottling' }) as AssistantPrefillPayload,
      };
    }),
  ];

  return [
    {
      id: 'card-aging-bottling',
      title: 'Élevage, Assemblages & Faisabilité Mise',
      metrics: [
        { label: 'Lots élevage / prêts', value: `${lots.length}`, tone: 'brand' },
        {
          label: 'Matières sèches',
          value: missingAny ? 'Rupture détectée' : 'Complètes',
          tone: missingAny ? 'warn' : 'ok',
        },
      ],
      items: items.slice(0, 8),
      action: missingAny
        ? { label: 'Voir Matières sèches & Achats', prefill: { tab: 'supplies' } }
        : { label: 'Ouvrir Élevage & Assemblage', prefill: { tab: 'aging' } },
    },
  ];
}

// ------------------------------------------------------------------ 4. Commercial Stock

interface CheckCommercialStockInput {
  batchQuery?: string;
  customerQuery?: string;
  orderStatus?: string;
  limit?: number;
}

function runCheckCommercialStock(
  ctx: AssistantToolContext,
  input: CheckCommercialStockInput
): Record<string, unknown> {
  const { state } = ctx;
  const limit = clampLimit(input.limit, 12, 20);

  const batches = Object.values(state.batches)
    .filter((b) =>
      matchesQuery(
        input.batchQuery,
        b.id,
        b.code,
        b.vintage,
        state.skus[b.skuId]?.label
      )
    )
    .map((b: BottlingBatch) => {
      const pos = batchPosition(state, b);
      return {
        id: b.id,
        code: b.code,
        vintage: b.vintage,
        skuId: b.skuId,
        skuLabel: state.skus[b.skuId]?.label ?? b.skuId,
        quality: b.quality,
        physical: pos.physical,
        reserved: pos.reserved,
        blocked: pos.blocked,
        quarantine: pos.quarantine,
        availableSellable: pos.available,
      };
    });

  const totals = batches.reduce(
    (acc, b) => ({
      physical: acc.physical + b.physical,
      reserved: acc.reserved + b.reserved,
      blocked: acc.blocked + b.blocked,
      quarantine: acc.quarantine + b.quarantine,
      availableSellable: acc.availableSellable + b.availableSellable,
    }),
    { physical: 0, reserved: 0, blocked: 0, quarantine: 0, availableSellable: 0 }
  );

  const orders = Object.values(state.orders)
    .filter((o) => (input.orderStatus ? o.status === input.orderStatus : true))
    .filter((o) => {
      const cust = state.customers[o.customerId];
      return matchesQuery(input.customerQuery, o.id, o.code, cust?.name, cust?.city);
    })
    .map((o) => ({
      id: o.id,
      code: o.code,
      customerId: o.customerId,
      customerName: state.customers[o.customerId]?.name ?? o.customerId,
      status: o.status,
      createdAt: o.createdAt.slice(0, 10),
      totalBottles: o.lines.reduce((s, l) => s + l.quantity, 0),
      totalReserved: o.lines.reduce((s, l) => s + l.reserved, 0),
      totalShipped: o.lines.reduce((s, l) => s + l.shipped, 0),
    }));

  const shipments = Object.values(state.shipments).map((s) => ({
    id: s.id,
    code: s.code,
    orderId: s.orderId,
    shippedAt: s.shippedAt.slice(0, 10),
    invoiced: Boolean(s.invoiceId),
  }));

  return {
    invariant: 'Stock physique ≠ Réservé ≠ Bloqué qualité ≠ Quarantaine ≠ Disponible vendable.',
    totals,
    batches: batches.slice(0, limit),
    orders: orders.slice(0, limit),
    shipments: shipments.slice(0, limit),
    truncated: batches.length > limit || orders.length > limit,
  };
}

function commercialToCards(out: Record<string, unknown>): ResultCard[] {
  const totals = (out['totals'] as Record<string, number> | undefined) ?? {};
  const batches = (out['batches'] as Array<Record<string, unknown>> | undefined) ?? [];
  const orders = (out['orders'] as Array<Record<string, unknown>> | undefined) ?? [];

  const items: ResultCardItem[] = [
    ...batches.slice(0, 4).map((b) => ({
      id: String(b['id'] ?? ''),
      title: `${String(b['code'] ?? '')} · ${String(b['skuLabel'] ?? '')}`,
      subtitle: `Physique ${String(b['physical'] ?? 0)} · Réservé ${String(b['reserved'] ?? 0)} · Quarantaine ${String(b['quarantine'] ?? 0)}`,
      badge: `${String(b['availableSellable'] ?? 0)} vendables`,
      tone: (Number(b['availableSellable'] ?? 0) > 0 ? 'ok' : 'warn') as 'ok' | 'warn',
      prefill: { tab: 'sales', subTab: 'orders' } as AssistantPrefillPayload,
    })),
    ...orders.slice(0, 4).map((o) => ({
      id: String(o['id'] ?? ''),
      title: `${String(o['code'] ?? '')} · ${String(o['customerName'] ?? '')}`,
      subtitle: `${String(o['totalBottles'] ?? 0)} bt demandées · ${String(o['totalShipped'] ?? 0)} expédiées`,
      badge: String(o['status'] ?? ''),
      tone: (o['status'] === 'quote' ? 'brand' : 'neutral') as 'brand' | 'neutral',
      prefill: { tab: 'sales', subTab: 'orders' } as AssistantPrefillPayload,
    })),
  ];

  return [
    {
      id: 'card-commercial',
      title: 'Stocks bouteilles & commandes',
      metrics: [
        { label: 'Disponible vendable', value: `${totals['availableSellable'] ?? 0} bt`, tone: 'ok' },
        { label: 'Physique / Réservé', value: `${totals['physical'] ?? 0} / ${totals['reserved'] ?? 0}`, tone: 'neutral' },
        {
          label: 'Bloqué / Quarantaine',
          value: `${totals['blocked'] ?? 0} / ${totals['quarantine'] ?? 0}`,
          tone: (totals['blocked'] ?? 0) + (totals['quarantine'] ?? 0) > 0 ? 'warn' : 'neutral',
        },
      ],
      items: items.slice(0, 8),
      note: 'Distinction stricte : Physique ≠ Réservé ≠ Bloqué qualité ≠ Quarantaine ≠ Disponible vendable.',
      action: { label: 'Ouvrir Ventes & Commerce', prefill: { tab: 'sales' } },
    },
  ];
}

// ------------------------------------------------------------------ 5. Finance & Planning

interface InspectFinanceInput {
  certainty?: 'certain' | 'engaged' | 'estimated';
  limit?: number;
}

function runInspectFinanceAndPlanning(
  ctx: AssistantToolContext,
  input: InspectFinanceInput
): Record<string, unknown> {
  const { state } = ctx;
  const limit = clampLimit(input.limit, 10, 20);

  const invoices = Object.values(state.invoices).map((inv) => {
    const bal = invoiceBalance(state, inv.id);
    return {
      id: inv.id,
      code: inv.code,
      customerName: state.customers[inv.customerId]?.name ?? inv.customerId,
      issuedAt: inv.issuedAt,
      dueAt: inv.dueAt,
      htCents: inv.htCents,
      ttcCents: inv.ttcCents,
      paidCents: bal.paid,
      creditedCents: bal.credited,
      balanceCents: bal.balance,
    };
  });

  const unInvoicedShipments = Object.values(state.shipments)
    .filter((s) => s.invoiceId === null)
    .map((s) => ({ id: s.id, code: s.code, shippedAt: s.shippedAt.slice(0, 10) }));

  const forecastLines = Object.values(state.forecast)
    .filter((f) => (input.certainty ? f.certainty === input.certainty : true))
    .map((f) => ({
      id: f.id,
      date: f.date,
      label: f.label,
      amountCents: f.amountCents,
      certainty: f.certainty,
      direction: f.direction,
      source: f.source,
    }));

  const byCertainty = {
    certain: { inCents: 0, outCents: 0 },
    engaged: { inCents: 0, outCents: 0 },
    estimated: { inCents: 0, outCents: 0 },
  };
  for (const f of Object.values(state.forecast)) {
    const bucket = byCertainty[f.certainty];
    if (f.direction === 'in') bucket.inCents += f.amountCents;
    else bucket.outCents += f.amountCents;
  }

  const lotCosts = Object.values(state.lots).map((l) => ({
    lotId: l.id,
    code: l.code,
    name: l.name,
    knownCents: l.cost.knownCents,
    incomplete: l.cost.incomplete,
    label: l.cost.incomplete
      ? l.cost.knownCents > 0
        ? `${fmtEur(l.cost.knownCents)} (partiel — contributions inconnues)`
        : 'Inconnu (inconnu ≠ 0 €)'
      : fmtEur(l.cost.knownCents),
  }));

  const projects = Object.values(state.projects).map((pr) => ({
    id: pr.id,
    name: pr.name,
    year: pr.year,
    status: pr.status,
    authorization: pr.authorization,
    budgetTotalCents: pr.budgetLines.reduce((s, b) => s + b.amountCents, 0),
    budgetLines: pr.budgetLines,
    assumptions: pr.assumptions,
  }));

  return {
    disclaimer:
      'Documents, factures, règlements et prévisions illustratifs de démo — aucune valeur comptable, bancaire ou fiscale.',
    drmAddonEnabled: Boolean(ctx.enabledAddons.drm_douanes),
    invoicesCount: invoices.length,
    totalInvoicedTtcCents: invoices.reduce((s, i) => s + i.ttcCents, 0),
    totalOpenBalanceCents: invoices.reduce((s, i) => s + i.balanceCents, 0),
    unInvoicedShipments,
    invoices: invoices.slice(0, limit),
    forecastByCertainty: byCertainty,
    forecast: forecastLines.slice(0, limit),
    lotCosts: lotCosts.slice(0, limit),
    projects,
  };
}

function financeToCards(out: Record<string, unknown>): ResultCard[] {
  const openBalance = Number(out['totalOpenBalanceCents'] ?? 0);
  const invoicedTtc = Number(out['totalInvoicedTtcCents'] ?? 0);
  const byCert =
    (out['forecastByCertainty'] as Record<string, { inCents: number; outCents: number }> | undefined) ??
    {};
  const engagedOut = byCert['engaged']?.outCents ?? 0;
  const estIn = byCert['estimated']?.inCents ?? 0;
  const estOut = byCert['estimated']?.outCents ?? 0;
  const forecast = (out['forecast'] as Array<Record<string, unknown>> | undefined) ?? [];
  const projects = (out['projects'] as Array<Record<string, unknown>> | undefined) ?? [];

  const items: ResultCardItem[] = forecast.slice(0, 5).map((f) => {
    const dir = f['direction'] === 'in' ? '+' : '−';
    const amt = Number(f['amountCents'] ?? 0);
    return {
      id: String(f['id'] ?? ''),
      title: String(f['label'] ?? ''),
      subtitle: `${String(f['date'] ?? '')} · ${String(f['source'] ?? '')}`,
      badge: `${dir}${fmtEur(amt)} (${String(f['certainty'] ?? '')})`,
      tone: f['certainty'] === 'certain' ? 'ok' : f['certainty'] === 'engaged' ? 'brand' : 'warn',
      prefill: { tab: 'finance', subTab: 'finance' },
    };
  });

  for (const pr of projects.slice(0, 2)) {
    const total = Number(pr['budgetTotalCents'] ?? 0);
    items.push({
      id: String(pr['id'] ?? ''),
      title: String(pr['name'] ?? ''),
      subtitle: `Statut : ${String(pr['status'] ?? '')} · Autorisation : ${String(pr['authorization'] ?? '')}`,
      badge: `Budget estimé ${fmtEur(total)}`,
      tone: 'warn',
      prefill: { tab: 'finance', subTab: 'finance' },
    });
  }

  return [
    {
      id: 'card-finance',
      title: 'Pilotage Financier & Trésorerie (Démo)',
      metrics: [
        { label: 'Facturé TTC / Solde dû', value: `${fmtEur(invoicedTtc)} / ${fmtEur(openBalance)}`, tone: 'neutral' },
        { label: 'Engagé (sorties)', value: fmtEur(engagedOut), tone: 'brand' },
        { label: 'Estimé (+ / −)', value: `+${fmtEur(estIn)} / −${fmtEur(estOut)}`, tone: 'warn' },
      ],
      items: items.slice(0, 8),
      note: 'Séparation stricte Certain ≠ Engagé ≠ Estimé. Inconnu ≠ 0 €.',
      action: { label: 'Ouvrir Pilotage & Finance', prefill: { tab: 'finance' } },
    },
  ];
}

// ------------------------------------------------------------------ 6. Traceability

interface SearchTraceabilityInput {
  query?: string;
  opType?: string;
  limit?: number;
}

function runSearchTraceability(
  ctx: AssistantToolContext,
  input: SearchTraceabilityInput
): Record<string, unknown> {
  const { state } = ctx;
  const limit = clampLimit(input.limit, 12, 20);

  const matchedBatch = Object.values(state.batches).find((b) =>
    matchesQuery(input.query, b.id, b.code, state.skus[b.skuId]?.label)
  );
  const matchedLot =
    (matchedBatch?.lotId ? state.lots[matchedBatch.lotId] : undefined) ??
    Object.values(state.lots).find((l) => matchesQuery(input.query, l.id, l.code, l.name));

  let genealogy: Record<string, unknown> | null = null;
  if (matchedLot) {
    const ancIds = ancestors(state, matchedLot.id);
    const descIds = descendants(state, matchedLot.id);
    const originParcelNames = matchedLot.origins.map(
      (o) => state.parcels[o.parcelId]?.name ?? o.parcelId
    );
    const receptionTickets = matchedLot.origins.flatMap((o) =>
      o.receptionIds.map((rId) => {
        const rec = state.receptions[rId];
        return rec ? `${rec.ticket} (${fmtKg(rec.netG)})` : rId;
      })
    );
    const relatedShipments = matchedBatch
      ? Object.values(state.shipments)
          .filter((s) => s.lines.some((l) => l.batchId === matchedBatch.id))
          .map((s) => ({
            id: s.id,
            code: s.code,
            shippedAt: s.shippedAt.slice(0, 10),
            customer:
              state.customers[state.orders[s.orderId]?.customerId ?? '']?.name ?? s.orderId,
          }))
      : [];

    genealogy = {
      lotId: matchedLot.id,
      lotCode: matchedLot.code,
      lotName: matchedLot.name,
      batchId: matchedBatch?.id ?? null,
      batchCode: matchedBatch?.code ?? null,
      originParcels: originParcelNames,
      receptionTickets,
      ancestorLotCodes: ancIds.map((id) => state.lots[id]?.code ?? id),
      descendantLotCodes: descIds.map((id) => state.lots[id]?.code ?? id),
      relatedShipments,
    };
  }

  const ops = Object.values(state.cellarOps)
    .filter((op) => (input.opType ? op.type === input.opType : true))
    .filter((op) => {
      if (!input.query) return true;
      if (matchedLot && op.lotId === matchedLot.id) return true;
      return matchesQuery(input.query, op.id, op.label, op.details, state.lots[op.lotId]?.code);
    })
    .sort((a, b) => b.at.localeCompare(a.at));

  return {
    genealogy,
    operationsTotalCount: ops.length,
    operations: ops.slice(0, limit).map((o) => ({
      id: o.id,
      at: o.at.slice(0, 10),
      type: o.type,
      lotCode: state.lots[o.lotId]?.code ?? o.lotId,
      label: o.label,
      details: o.details,
    })),
    truncated: ops.length > limit,
  };
}

function traceabilityToCards(out: Record<string, unknown>): ResultCard[] {
  const gen = out['genealogy'] as Record<string, unknown> | null;
  const ops = (out['operations'] as Array<Record<string, unknown>> | undefined) ?? [];

  const items: ResultCardItem[] = ops.slice(0, 6).map((o) => ({
    id: String(o['id'] ?? ''),
    title: `${String(o['lotCode'] ?? '')} · ${String(o['label'] ?? '')}`,
    subtitle: `${String(o['at'] ?? '')} — ${String(o['details'] ?? '')}`,
    badge: String(o['type'] ?? ''),
    tone: 'neutral',
    prefill: {
      tab: 'traceability',
      batchId: gen?.['batchId'] ? String(gen['batchId']) : undefined,
      auditFilter: String(o['type'] ?? 'all'),
    },
  }));

  return [
    {
      id: 'card-traceability',
      title: gen
        ? `Traçabilité · ${String(gen['lotCode'] ?? '')}${gen['batchCode'] ? ` (${String(gen['batchCode'])})` : ''}`
        : 'Journal de Traçabilité & Filiation',
      metrics: [
        { label: 'Opérations trouvées', value: `${Number(out['operationsTotalCount'] ?? ops.length)}`, tone: 'brand' },
        {
          label: 'Parcelles d’origine',
          value: gen ? `${((gen['originParcels'] as string[] | undefined) ?? []).length}` : '—',
          tone: 'ok',
        },
      ],
      items,
      note: 'Journal immuable des opérations (source préchargée ou manuelle).',
      action: {
        label: 'Ouvrir Traçabilité',
        prefill: {
          tab: 'traceability',
          batchId: gen?.['batchId'] ? String(gen['batchId']) : undefined,
        },
      },
    },
  ];
}

// ------------------------------------------------------------------ 7. Prepare Action

interface PrepareActionInput {
  actionKind:
    | 'prefill_measurement'
    | 'prefill_order'
    | 'prefill_bottling'
    | 'prefill_purchase'
    | 'prefill_harvest_count'
    | 'navigate';
  lotQuery?: string;
  parameter?: MeasurementParameter;
  value?: number;
  batchQuery?: string;
  customerQuery?: string;
  dryGoodQuery?: string;
  quantity?: number;
  asQuote?: boolean;
  targetTab?: AssistantTabId;
  subTab?: string;
}

function resolveLot(ctx: AssistantToolContext, query?: string): WineLot | undefined {
  const lots = Object.values(ctx.state.lots);
  if (query) {
    const hit = lots.find((l) => matchesQuery(query, l.id, l.code, l.name, l.vintage));
    if (hit) return hit;
  }
  return lots.find((l) => l.stage === 'fermenting') ?? lots[0];
}

function runPrepareAction(
  ctx: AssistantToolContext,
  input: PrepareActionInput
): Record<string, unknown> {
  const { state, role } = ctx;

  if (input.actionKind === 'prefill_measurement') {
    if (!canRun('measurement.add', role)) {
      return {
        allowed: false,
        actionKind: input.actionKind,
        reason: `Le rôle « ${ctx.roleLabel} » n’est pas autorisé à saisir des relevés de chai.`,
      };
    }
    const lot = resolveLot(ctx, input.lotQuery);
    const param: MeasurementParameter =
      input.parameter && input.parameter in PARAMETERS ? input.parameter : 'density';
    const paramDef = PARAMETERS[param];
    const today = state.referenceDate.slice(0, 10);
    const sameDayExisting = lot
      ? Object.values(state.measurements).find(
          (m) =>
            m.lotId === lot.id &&
            m.parameter === param &&
            m.supersededBy === null &&
            m.sampledAt.slice(0, 10) === today
        )
      : undefined;
    const occ = lot ? lotOccupancies(state, lot.id)[0] : undefined;

    return {
      allowed: true,
      requiresHumanValidation: true,
      actionKind: input.actionKind,
      prefill: {
        tab: 'cellar',
        lotId: lot?.id,
        containerId: occ?.containerId,
        openModal: 'measurement',
        parameter: param,
        value: typeof input.value === 'number' ? String(input.value) : undefined,
        unit: paramDef.units[0],
      } satisfies AssistantPrefillPayload,
      targetLabel: lot ? `${lot.code} · ${paramDef.label} (${paramDef.units[0]})` : 'Chai',
      duplicateWarning: sameDayExisting
        ? `Un relevé ${paramDef.label} (${sameDayExisting.value} ${sameDayExisting.unit}) existe déjà aujourd’hui (${today}) sur ${lot?.code}.`
        : null,
    };
  }

  if (input.actionKind === 'prefill_order') {
    if (!canRun('order.create', role)) {
      return {
        allowed: false,
        actionKind: input.actionKind,
        reason: `Le rôle « ${ctx.roleLabel} » n’est pas autorisé à créer des commandes ou devis.`,
      };
    }
    const batch =
      Object.values(state.batches).find((b) =>
        matchesQuery(input.batchQuery, b.id, b.code, state.skus[b.skuId]?.label)
      ) ??
      Object.values(state.batches).find((b) => batchPosition(state, b).available > 0) ??
      Object.values(state.batches)[0];
    const cust =
      Object.values(state.customers).find((c) => matchesQuery(input.customerQuery, c.id, c.name)) ??
      Object.values(state.customers)[0];
    const pos = batch ? batchPosition(state, batch) : null;
    const requestedQty =
      typeof input.quantity === 'number' && input.quantity > 0 ? Math.trunc(input.quantity) : 12;

    const existingQuote = cust
      ? Object.values(state.orders).find(
          (o) => o.customerId === cust.id && (o.status === 'quote' || o.status === 'confirmed')
        )
      : undefined;

    return {
      allowed: true,
      requiresHumanValidation: true,
      actionKind: input.actionKind,
      prefill: {
        tab: 'sales',
        subTab: 'orders',
        openModal: 'order',
        customerId: cust?.id,
        batchId: batch?.id,
        quantity: requestedQty,
        asQuote: Boolean(input.asQuote),
      } satisfies AssistantPrefillPayload,
      targetLabel: batch
        ? `${batch.code} (${pos?.available ?? 0} bt vendables) → ${cust?.name ?? ''}`
        : 'Ventes',
      duplicateWarning:
        pos && requestedQty > pos.available
          ? `Stock vendable insuffisant (${pos.available} disponibles vs ${requestedQty} demandées) : enregistrer plutôt en devis ou ajuster la quantité.`
          : existingQuote
          ? `Un document en cours (${existingQuote.code}, statut ${existingQuote.status}) existe déjà pour ${cust?.name}.`
          : null,
    };
  }

  if (input.actionKind === 'prefill_bottling') {
    if (!canRun('bottling.execute', role)) {
      return {
        allowed: false,
        actionKind: input.actionKind,
        reason: `Le rôle « ${ctx.roleLabel} » n’est pas autorisé à lancer une mise en bouteilles.`,
      };
    }
    const lot =
      Object.values(state.lots).find((l) =>
        matchesQuery(input.lotQuery, l.id, l.code, l.name, l.vintage)
      ) ?? Object.values(state.lots).find((l) => l.quality === 'released' && lotVolumeMl(state, l.id) > 0);
    const sku =
      Object.values(state.skus).find((s) =>
        lot ? s.cuveeId === lot.cuveeId && s.vintage === lot.vintage : true
      ) ?? Object.values(state.skus)[0];
    const bottles =
      typeof input.quantity === 'number' && input.quantity > 0 ? Math.trunc(input.quantity) : 120;
    const missing = sku
      ? bottlingRequirements(state, sku.id, bottles).filter((r) => r.required > r.onHand)
      : [];

    return {
      allowed: true,
      requiresHumanValidation: true,
      actionKind: input.actionKind,
      prefill: {
        tab: 'bottling',
        subTab: 'stocks',
        lotId: lot?.id,
        skuId: sku?.id,
        openModal: 'bottling',
        bottles,
      } satisfies AssistantPrefillPayload,
      targetLabel: `${lot?.code ?? 'Lot'} → ${sku?.label ?? 'Article'} (${bottles} bt)`,
      duplicateWarning:
        missing.length > 0
          ? `Matières sèches insuffisantes (${missing
              .map((m) => `${state.dryGoods[m.dryGoodId]?.name ?? m.dryGoodId} ${m.onHand}/${m.required}`)
              .join(', ')}).`
          : null,
    };
  }

  if (input.actionKind === 'prefill_purchase') {
    if (!canRun('purchase.create', role)) {
      return {
        allowed: false,
        actionKind: input.actionKind,
        reason: `Le rôle « ${ctx.roleLabel} » n’est pas autorisé à créer une commande fournisseur.`,
      };
    }
    const dryGood =
      Object.values(state.dryGoods).find((g) =>
        matchesQuery(input.dryGoodQuery, g.id, g.name)
      ) ??
      Object.values(state.dryGoods).find((g) => g.onHand <= g.reorderPoint) ??
      Object.values(state.dryGoods)[0];

    const existingPo = dryGood
      ? Object.values(state.purchaseOrders).find(
          (po) =>
            (po.status === 'open' || po.status === 'partially_received') &&
            po.lines.some((l) => l.dryGoodId === dryGood.id)
        )
      : undefined;

    return {
      allowed: true,
      requiresHumanValidation: true,
      actionKind: input.actionKind,
      prefill: {
        tab: 'supplies',
        openModal: 'po',
        dryGoodId: dryGood?.id,
        quantity: typeof input.quantity === 'number' && input.quantity > 0 ? Math.trunc(input.quantity) : 300,
        supplier: existingPo?.supplier,
      } satisfies AssistantPrefillPayload,
      targetLabel: dryGood ? `${dryGood.name} (stock ${dryGood.onHand})` : 'Achats matières sèches',
      duplicateWarning: existingPo
        ? `Une commande ouverte (${existingPo.code} chez ${existingPo.supplier}, prévue le ${existingPo.expectedAt}) inclut déjà ${dryGood?.name}.`
        : null,
    };
  }

  if (input.actionKind === 'prefill_harvest_count') {
    if (!canRun('harvest.count', role)) {
      return {
        allowed: false,
        actionKind: input.actionKind,
        reason: `Le rôle « ${ctx.roleLabel} » n’est pas autorisé à enregistrer un comptage de vendanges.`,
      };
    }
    const mission =
      Object.values(state.missions).find(
        (m) => m.operation === 'harvest' && m.status === 'in_progress'
      ) ?? Object.values(state.missions).find((m) => m.operation === 'harvest');

    const pendingOnMission = mission
      ? Object.values(state.harvestCounts).filter(
          (c) => c.missionId === mission.id && c.transportId === null
        )
      : [];

    return {
      allowed: true,
      requiresHumanValidation: true,
      actionKind: input.actionKind,
      prefill: {
        tab: 'vineyard',
        subTab: 'harvest',
        parcelId: mission?.parcelId,
        openModal: 'count',
        missionId: mission?.id,
        quantity: typeof input.quantity === 'number' && input.quantity > 0 ? Math.trunc(input.quantity) : 6,
      } satisfies AssistantPrefillPayload,
      targetLabel: mission ? `${mission.title}` : 'Vendanges',
      duplicateWarning:
        pendingOnMission.length > 0
          ? `${pendingOnMission.length} comptage(s) non transporté(s) existent déjà sur cette mission.`
          : null,
    };
  }

  // Navigate action
  const targetTab = input.targetTab ?? 'overview';
  if (!ctx.enabledMainModules[targetTab]) {
    return {
      allowed: false,
      actionKind: 'navigate',
      reason: `Le module « ${targetTab} » est désactivé dans la configuration Modules à la carte.`,
    };
  }
  const prefill = buildNavigatePrefill(targetTab, input.subTab);
  return {
    allowed: true,
    requiresHumanValidation: false,
    actionKind: 'navigate',
    prefill,
    targetLabel: `Onglet ${targetTab}${input.subTab ? ` (${input.subTab})` : ''}`,
    duplicateWarning: null,
  };
}

function buildNavigatePrefill(tab: AssistantTabId, subTab?: string): AssistantPrefillPayload {
  switch (tab) {
    case 'vineyard':
      return {
        tab: 'vineyard',
        subTab:
          subTab === 'harvest' || subTab === 'reception' || subTab === 'phyto_tesa'
            ? subTab
            : 'atlas',
      };
    case 'bottling':
      return {
        tab: 'bottling',
        subTab: subTab === 'cellar_map' || subTab === 'elabel' ? subTab : 'stocks',
      };
    case 'sales':
      return {
        tab: 'sales',
        subTab: subTab === 'allocations' ? 'allocations' : 'orders',
      };
    case 'finance':
      return {
        tab: 'finance',
        subTab: subTab === 'drm' ? 'drm' : 'finance',
      };
    case 'cellar':
      return { tab: 'cellar' };
    case 'aging':
      return { tab: 'aging' };
    case 'supplies':
      return { tab: 'supplies' };
    case 'traceability':
      return { tab: 'traceability' };
    default:
      return { tab: 'overview' };
  }
}

function prepareActionToCards(out: Record<string, unknown>): ResultCard[] {
  const allowed = Boolean(out['allowed']);
  if (!allowed) {
    return [
      {
        id: 'card-action-denied',
        title: 'Action non autorisée pour ce rôle / module',
        warning: String(out['reason'] ?? 'Droits insuffisants.'),
      },
    ];
  }

  const prefill = out['prefill'] as AssistantPrefillPayload | undefined;
  const dup = (out['duplicateWarning'] as string | null | undefined) ?? null;
  const targetLabel = String(out['targetLabel'] ?? 'Écran cible');
  const requiresHumanValidation = Boolean(out['requiresHumanValidation']);

  return [
    {
      id: 'card-prepare-action',
      title: requiresHumanValidation
        ? `Aide à la saisie préparée · ${targetLabel}`
        : `Navigation prête · ${targetLabel}`,
      warning: dup ?? undefined,
      requiresHumanValidation,
      note: requiresHumanValidation
        ? 'Aucune donnée n’a été modifiée : vérifiez le formulaire pré-rempli puis validez manuellement.'
        : undefined,
      action: prefill
        ? {
            label: requiresHumanValidation
              ? `Ouvrir & pré-remplir (${targetLabel})`
              : `Ouvrir ${targetLabel}`,
            prefill,
          }
        : undefined,
    },
  ];
}

// ------------------------------------------------------------------ Registry

export const ASSISTANT_TOOLS: Record<AssistantToolName, ToolDefinition<never, Record<string, unknown>>> = {
  inspect_vineyard: {
    name: 'inspect_vineyard',
    roles: ALL_ROLES,
    isModuleEnabled: (ctx) => ctx.enabledMainModules.vineyard !== false,
    run: runInspectVineyard as (ctx: AssistantToolContext, input: never) => Record<string, unknown>,
    toCards: vineyardToCards,
  },
  inspect_cellar: {
    name: 'inspect_cellar',
    roles: ALL_ROLES,
    isModuleEnabled: (ctx) => ctx.enabledMainModules.cellar !== false,
    run: runInspectCellar as (ctx: AssistantToolContext, input: never) => Record<string, unknown>,
    toCards: cellarToCards,
  },
  check_aging_and_bottling: {
    name: 'check_aging_and_bottling',
    roles: ['direction', 'cellar_master', 'sales', 'accounting'],
    isModuleEnabled: (ctx) =>
      ctx.enabledMainModules.aging !== false || ctx.enabledMainModules.bottling !== false,
    run: runCheckAgingAndBottling as (ctx: AssistantToolContext, input: never) => Record<string, unknown>,
    toCards: agingAndBottlingToCards,
  },
  check_commercial_stock: {
    name: 'check_commercial_stock',
    roles: ['direction', 'cellar_master', 'sales', 'accounting'],
    isModuleEnabled: (ctx) =>
      ctx.enabledMainModules.bottling !== false || ctx.enabledMainModules.sales !== false,
    run: runCheckCommercialStock as (ctx: AssistantToolContext, input: never) => Record<string, unknown>,
    toCards: commercialToCards,
  },
  inspect_finance_and_planning: {
    name: 'inspect_finance_and_planning',
    roles: ['direction', 'accounting'],
    needsCosts: true,
    needsFinance: true,
    isModuleEnabled: (ctx) => ctx.enabledMainModules.finance !== false,
    run: runInspectFinanceAndPlanning as (ctx: AssistantToolContext, input: never) => Record<string, unknown>,
    toCards: financeToCards,
  },
  search_traceability: {
    name: 'search_traceability',
    roles: ALL_ROLES,
    isModuleEnabled: (ctx) => ctx.enabledMainModules.traceability !== false,
    run: runSearchTraceability as (ctx: AssistantToolContext, input: never) => Record<string, unknown>,
    toCards: traceabilityToCards,
  },
  prepare_action: {
    name: 'prepare_action',
    roles: ALL_ROLES,
    run: runPrepareAction as (ctx: AssistantToolContext, input: never) => Record<string, unknown>,
    toCards: prepareActionToCards,
  },
};

export function availableTools(
  ctx: Pick<
    AssistantToolContext,
    'role' | 'canSeeCosts' | 'canSeeFinance' | 'enabledMainModules'
  >
): AssistantToolName[] {
  return (Object.keys(ASSISTANT_TOOLS) as AssistantToolName[]).filter((name) => {
    const tool = ASSISTANT_TOOLS[name];
    if (!tool.roles.includes(ctx.role)) return false;
    if (tool.needsCosts && !ctx.canSeeCosts) return false;
    if (tool.needsFinance && !ctx.canSeeFinance) return false;
    if (tool.isModuleEnabled && !tool.isModuleEnabled(ctx)) return false;
    return true;
  });
}

function collectKnownIds(value: unknown, acc = new Set<string>()): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKnownIds(item, acc);
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (
        typeof v === 'string' &&
        v.length > 0 &&
        (k === 'id' || k === 'code' || k.endsWith('Id') || k.endsWith('Code'))
      ) {
        acc.add(v);
      } else {
        collectKnownIds(v, acc);
      }
    }
  }
  return [...acc];
}

export function executeAssistantTool(
  ctx: AssistantToolContext,
  toolName: AssistantToolName,
  rawArgs: Record<string, unknown>
): { output: Record<string, unknown>; cards: ResultCard[]; knownIds: string[] } {
  const allowed = availableTools(ctx);
  if (!allowed.includes(toolName)) {
    return {
      output: {
        error: `Outil « ${toolName} » non autorisé pour le rôle ${ctx.roleLabel} ou les modules actifs.`,
      },
      cards: [],
      knownIds: [],
    };
  }

  const tool = ASSISTANT_TOOLS[toolName];
  const rawOutput = tool.run(ctx, rawArgs as never);
  const sanitizedOutput = sanitizeForRole(rawOutput, {
    canSeeCosts: ctx.canSeeCosts,
    canSeeFinance: ctx.canSeeFinance,
  });
  const cards = tool.toCards(sanitizedOutput, ctx);
  const knownIds = collectKnownIds(sanitizedOutput);

  return { output: sanitizedOutput, cards, knownIds };
}
