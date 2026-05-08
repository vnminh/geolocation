import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}

export function Modal({ open, ariaLabel = "dialog", children }: ModalProps) {
  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="modal-card">{children}</div>
    </div>,
    document.body,
  );
}

export default Modal;
