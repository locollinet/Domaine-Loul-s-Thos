import { useEffect, useRef } from 'react';
import type { AssistantPrefillPayload } from './types';

/**
 * Triggers `onApply` once per distinct `prefill.nonce` (or reference change)
 * so navigating with pre-filled values opens the target modal/subtab safely
 * without re-triggering on unrelated re-renders.
 */
export function useAssistantPrefill<T extends AssistantPrefillPayload>(
  prefill: T | undefined,
  onApply: (payload: T) => void
): void {
  const lastAppliedKeyRef = useRef<string | null>(null);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  useEffect(() => {
    if (!prefill) return;
    const key = `${prefill.tab}:${prefill.nonce ?? JSON.stringify(prefill)}`;
    if (lastAppliedKeyRef.current === key) return;
    lastAppliedKeyRef.current = key;
    onApplyRef.current(prefill);
  }, [prefill]);
}
