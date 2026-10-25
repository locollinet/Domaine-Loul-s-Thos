import React, { useState } from 'react';
import { useStore } from '../../app/store-context';
import { localDb } from '../../infra/db';

export const DemoGuideModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}> = ({ isOpen, onClose, onNavigate }) => {
  const { state, dispatch } = useStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [executing, setExecuting] = useState(false);

  if (!isOpen || !state) return null;

  const steps = [
    {
      num: 1,
      title: 'Vue d’ensemble & 5 horizons millésimes',
      tab: 'overview',
      desc: 'Constater la coexistence de 2023 (vieux stock), 2024 (élevage barriques), 2025 (prêt à assembler), 2026 (en cuve) et 2027 (projet futur).',
    },
    {
      num: 2,
      title: 'Vignoble & Parcelles sans GPS inventé',
      tab: 'vineyard',
      desc: 'Examiner le schéma parcellaire, les accès réels décrits et les missions de terrain.',
    },
    {
      num: 3,
      title: 'Comptages de récolte & Pesées nettes',
      tab: 'vineyard',
      desc: 'Constater que les caisses de récolte ne deviennent pas automatiquement des litres. Pesée brute − tare = net.',
    },
    {
      num: 4,
      title: 'Chai & Cinétique de fermentation 2026',
      tab: 'cellar',
      desc: 'Consulter la courbe de densité réelle sans interpolation mensongère (trou visible après le 17 octobre).',
    },
    {
      num: 5,
      title: 'Élevage 2024 en barriques',
      tab: 'aging',
      desc: 'Vérifier la conservation des volumes dans le parc à fûts F-01 (120 L) et F-02 (80 L).',
    },
    {
      num: 6,
      title: 'Assemblage 2025 (Essai puis Exécution)',
      tab: 'aging',
      desc: 'Prévisualiser l’essai sans consommer de vin, puis exécuter 300 L de A + 200 L de B vers le lot enfant de 500 L.',
      actionLabel: 'Exécuter l’assemblage 2025',
      action: async () => {
        // Run blend if not already run
        const existingBlend = Object.values(state.lots).find((l) => l.parents.length >= 2);
        if (existingBlend) return;
        await dispatch({
          type: 'blend.execute',
          payload: {
            name: 'Rouge 2025 Assemblage — Démo',
            cuveeId: 'cuvee-red',
            destinationContainerId: 'tank-04',
            inputs: [
              { lotId: 'lot-2025-a', containerId: 'tank-02', volumeMl: 300000 },
              { lotId: 'lot-2025-b', containerId: 'tank-03', volumeMl: 200000 },
            ],
          },
        });
      },
    },
    {
      num: 7,
      title: 'Mise en bouteilles & BOM matières sèches',
      tab: 'bottling',
      desc: 'Consommer 500 L de vin, 660 bouteilles, bouchons et étiquettes, 110 cartons de 6, et tracer 5 L de perte déclarée.',
      actionLabel: 'Exécuter la mise de 660 bouteilles',
      action: async () => {
        const blendLot = Object.values(state.lots).find((l) => l.parents.length >= 2);
        if (!blendLot) {
          throw new Error('Veuillez d’abord réaliser l’étape 6 (Assemblage).');
        }
        const existingBatch = Object.values(state.batches).find((b) => b.vintage === 2025);
        if (existingBatch) return;
        await dispatch({
          type: 'bottling.execute',
          payload: {
            lotId: blendLot.id,
            containerId: 'tank-04',
            skuId: 'sku-red-2025-750',
            inputVolumeMl: 500000,
            bottles: 660,
            lossMl: 5000,
            serviceCostCents: 33000,
          },
        });
      },
    },
    {
      num: 8,
      title: 'Vente, Réservation & Expédition',
      tab: 'sales',
      desc: 'Commander 120 bouteilles, expédier 72. Constater : physique 588, réservé 48, disponible 540.',
      actionLabel: 'Commander 120 & livrer 72',
      action: async () => {
        const freshState0 = await localDb.loadOrCreateState();
        const batch2025 = Object.values(freshState0.batches).find((b) => b.vintage === 2025);
        if (!batch2025) throw new Error('Veuillez d’abord conditionner le millésime 2025 (Étape 7).');

        let orderId = Object.values(freshState0.orders).find((o) => o.lines.some((l) => l.batchId === batch2025.id))?.id;
        if (!orderId) {
          const res = await dispatch({
            type: 'order.create',
            payload: {
              customerId: 'cust-resto',
              asQuote: false,
              lines: [{ skuId: 'sku-red-2025-750', batchId: batch2025.id, quantity: 120, unitPriceHtCents: 2000 }],
            },
          });
          orderId = res.createdIds[0]!;
        }

        const freshState = await localDb.loadOrCreateState();
        const freshOrder = freshState.orders[orderId]!;
        const shipment = Object.values(freshState.shipments).find((s) => s.lines.some((l) => l.batchId === batch2025.id));
        if (!shipment && freshOrder) {
          const line = freshOrder.lines[0]!;
          await dispatch({
            type: 'shipment.create',
            payload: {
              orderId: freshOrder.id,
              lines: [{ orderLineId: line.id, quantity: 72 }],
            },
          });
        }
      },
    },
    {
      num: 9,
      title: 'Facture démo & Encaissement simulé',
      tab: 'finance',
      desc: 'Facturer les 72 bouteilles à 20 € HT (1 440 € HT + 288 € TVA = 1 728 € TTC), encaisser 1 000 €, solde 728 €.',
      actionLabel: 'Émettre facture & paiement 1000 €',
      action: async () => {
        const freshState0 = await localDb.loadOrCreateState();
        const batch2025 = Object.values(freshState0.batches).find((b) => b.vintage === 2025);
        const shipment = Object.values(freshState0.shipments).find((s) => s.lines.some((l) => l.batchId === batch2025?.id));
        if (!shipment) throw new Error('Veuillez d’abord réaliser l’étape 8 (Livraison).');

        let invoiceId = shipment.invoiceId;
        if (!invoiceId) {
          const invRes = await dispatch({
            type: 'invoice.create',
            payload: { shipmentId: shipment.id },
          });
          invoiceId = invRes.createdIds[0]!;
        }

        const freshStateAfterInv = await localDb.loadOrCreateState();
        const payments = Object.values(freshStateAfterInv.payments).filter((p) => p.invoiceId === invoiceId);
        if (payments.length === 0) {
          await dispatch({
            type: 'payment.record',
            payload: { invoiceId, amountCents: 100000, method: 'virement-simulé' },
          });
        }
      },
    },
    {
      num: 10,
      title: 'Traçabilité complète & Fin du scénario',
      tab: 'traceability',
      desc: 'Depuis la livraison, remonter à la mise M25, aux lots 2025 A et B, puis aux parcelles des Hauts Rangs et de la Combe Claire.',
    },
  ];

  const active = steps[currentStep - 1]!;

  const handleStepAction = async () => {
    if (!active.action) return;
    setExecuting(true);
    try {
      await active.action();
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
              Visite guidée du scénario de démo (10 min)
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              Étape {currentStep} sur 10 : {active.title}
            </div>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            ✕ Fermer
          </button>
        </div>

        {/* Stepper progress */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '18px' }}>
          {steps.map((s) => (
            <button
              key={s.num}
              onClick={() => {
                setCurrentStep(s.num);
                onNavigate(s.tab);
              }}
              style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                background: s.num === currentStep ? 'var(--color-forest)' : s.num < currentStep ? '#98BDB0' : '#E0DDD3',
                cursor: 'pointer',
              }}
              title={`Étape ${s.num}: ${s.title}`}
            />
          ))}
        </div>

        {/* Step description */}
        <div style={{ background: 'var(--color-surface-soft)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '18px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-forest)', marginBottom: '6px' }}>
            {active.num}. {active.title}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-ink)', lineHeight: '1.6' }}>
            {active.desc}
          </p>
        </div>

        {/* Step action if executable */}
        {active.action && (
          <div style={{ marginBottom: '18px', padding: '12px', background: 'var(--color-forest-soft)', border: '1px solid #C2DCC8', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>Action automatique pour cette étape :</div>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>Exécute réellement la transaction métier persistante dans IndexedDB.</div>
            </div>
            <button
              className="btn btn-sm btn-primary"
              disabled={executing}
              onClick={handleStepAction}
            >
              {executing ? 'Exécution...' : active.actionLabel}
            </button>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            disabled={currentStep === 1}
            onClick={() => {
              const prev = currentStep - 1;
              setCurrentStep(prev);
              onNavigate(steps[prev - 1]!.tab);
            }}
          >
            ← Étape précédente
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => onNavigate(active.tab)}
          >
            Aller au module ({active.tab})
          </button>

          <button
            className="btn btn-primary"
            disabled={currentStep === steps.length}
            onClick={() => {
              const next = currentStep + 1;
              setCurrentStep(next);
              onNavigate(steps[next - 1]!.tab);
            }}
          >
            Étape suivante →
          </button>
        </div>
      </div>
    </div>
  );
};
