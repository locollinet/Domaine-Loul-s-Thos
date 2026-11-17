import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  badge?: React.ReactNode;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  maxWidth?: string;
  footer?: React.ReactNode;
  footerNote?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Fenêtre modale standardisée « Haute Bourgogne ».
 * Unifie l'en-tête éditorial, le corps scrollable sur fond parchemin et le pied de validation.
 */
export const Modal: React.FC<ModalProps> = ({
  title,
  subtitle,
  eyebrow,
  badge,
  onClose,
  onSubmit,
  maxWidth = '640px',
  footer,
  footerNote,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    // Focus sans provoquer de défilement brutal de l'arrière-plan sous Safari
    const target = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    if (target && typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
  }, []);

  const bodyAndFooter = (
    <>
      <div className="ds-modal-body">{children}</div>
      {footer && (
        <div className={`ds-modal-footer ${footerNote ? 'has-summary' : ''}`}>
          {footerNote && <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)' }}>{footerNote}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginLeft: footerNote ? undefined : 'auto' }}>
            {footer}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        ref={dialogRef}
        className="modal-content ds-modal"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-modal-header">
          <div style={{ minWidth: 0 }}>
            {(eyebrow || badge) && (
              <div className="ds-modal-eyebrow">
                {eyebrow && <span>{eyebrow}</span>}
                {badge}
              </div>
            )}
            <h2 className="ds-modal-title">{title}</h2>
            {subtitle && <p className="ds-modal-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="ds-modal-close"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            title="Fermer (Échap)"
          >
            <X size={16} />
          </button>
        </div>

        {onSubmit ? (
          <form className="ds-modal-form" onSubmit={onSubmit}>
            {bodyAndFooter}
          </form>
        ) : (
          <div className="ds-modal-form">{bodyAndFooter}</div>
        )}
      </div>
    </div>
  );
};
