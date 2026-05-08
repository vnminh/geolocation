export function StageRow({
  status,
  label,
  badge,
  showDots,
}: {
  status: "pending" | "active" | "done";
  label: string;
  badge?: string;
  showDots?: boolean;
}) {
  const icon = {
    pending: <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.5" stroke="#6d83a8" strokeWidth="1.5" fill="none"/></svg>,
    active:  <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" stroke="#1565d8" strokeWidth="1.5" fill="none"/><path d="M5 3v2.2l1.2.8" stroke="#1565d8" strokeWidth="1.2" strokeLinecap="round"/></svg>,
    done:    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 2.5" stroke="#1a7a46" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  }[status];

  return (
    <div className={`stage-row ${status}`}>
      <div className={`stage-icon ${status}`}>{icon}</div>
      <span className={`stage-label ${status === "pending" ? "muted" : ""}`}>
        {status === "active" && showDots ? (
          <span className="shimmer-label">{label}</span>
        ) : label}
        {showDots && (
          <span className="dot-loader">
            <span /><span /><span />
          </span>
        )}
      </span>
      {badge && <span className="stage-badge">{badge}</span>}
    </div>
  );
}