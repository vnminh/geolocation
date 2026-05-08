import { createPortal } from "react-dom";

type ActionStatusVariant = "success" | "error";

interface ActionStatusModalProps {
  open: boolean;
  title: string;
  message: string;
  variant: ActionStatusVariant;
  closeLabel?: string;
  onClose: () => void;
}

export function ActionStatusModal({
  open,
  title,
  message,
  variant,
  closeLabel = "Close",
  onClose,
}: ActionStatusModalProps) {
  if (!open) {
    return null;
  }

  const borderColor = variant === "success" ? "#12b76a" : "#d92d20";
  const backgroundColor = variant === "success" ? "#ecfdf3" : "#fef3f2";
  const color = variant === "success" ? "#027a48" : "#b42318";

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card" style={{ borderColor, background: backgroundColor, color }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h4 style={{ margin: 0, color }}>{title}</h4>
          <button type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        <p style={{ margin: "12px 0 0", whiteSpace: "pre-wrap" }}>{message}</p>
      </div>
    </div>,
    document.body,
  );
}