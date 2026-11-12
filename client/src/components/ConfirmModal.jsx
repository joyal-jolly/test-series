import { useEffect } from 'react';

/**
 * Reusable confirmation dialog for logout, deletions, and critical actions.
 */
export function ConfirmModal({
  isOpen,
  title = 'Are you sure?',
  message = 'Please confirm this action.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary', // 'primary' | 'danger'
  onConfirm,
  onCancel,
  busy = false,
}) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape' && !busy) {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, busy, onCancel]);

  if (!isOpen) return null;

  const isDanger = confirmVariant === 'danger';

  return (
    <div
      className="modal-backdrop confirm-modal-backdrop"
      onClick={() => {
        if (!busy) onCancel();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-card confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '420px',
          padding: '1.5rem',
          borderRadius: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: isDanger ? 'rgba(239, 68, 68, 0.12)' : 'rgba(15, 42, 71, 0.08)',
              color: isDanger ? '#dc2626' : 'var(--accent)',
            }}
          >
            {isDanger ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', fontWeight: 700 }}>
              {title}
            </h3>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.45 }}>
              {message}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.65rem',
            marginTop: '1.5rem',
          }}
        >
          <button
            type="button"
            className="btn ghost"
            onClick={onCancel}
            disabled={busy}
            style={{ minWidth: '78px' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${isDanger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={busy}
            style={{
              minWidth: '84px',
              ...(isDanger
                ? {
                    background: '#dc2626',
                    color: '#fff',
                    borderColor: '#dc2626',
                  }
                : {}),
            }}
          >
            {busy ? 'Processing…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
