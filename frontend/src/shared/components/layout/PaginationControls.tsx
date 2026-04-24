interface PaginationControlsProps {
  page: number;
  totalPages: number;
  limit: number;
  totalRows: number;
  rowsOnPage: number;
  loading?: boolean;
  onPageChange: (nextPage: number) => void;
  onLimitChange?: (nextLimit: number) => void;
}

const ROW_OPTIONS = [5, 10, 20, 50, 100] as const;

function buildVisiblePages(page: number, totalPages: number): number[] {
  if (totalPages <= 0) {
    return [1];
  }

  const candidates = [1, page - 1, page, page + 1, totalPages];
  return [...new Set(candidates)].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

export function PaginationControls({
  page,
  totalPages,
  limit,
  totalRows,
  rowsOnPage,
  loading = false,
  onPageChange,
  onLimitChange,
}: PaginationControlsProps) {
  const safePage = Math.max(1, page);
  const safeTotalPages = Math.max(1, totalPages);
  const visiblePages = buildVisiblePages(safePage, safeTotalPages);

  const startRow = totalRows === 0 ? 0 : (safePage - 1) * limit + 1;
  const endRow = totalRows === 0 ? 0 : Math.min((safePage - 1) * limit + rowsOnPage, totalRows);

  return (
    <div className="pagination-wrap">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p className="small" style={{ margin: 0 }}>
          Showing {startRow}-{endRow} of {totalRows} rows
        </p>
        {onLimitChange && (
          <label className="pagination-limit" htmlFor="pagination-limit-select">
            Rows
            <select
              id="pagination-limit-select"
              value={limit}
              disabled={loading}
              onChange={(event) => onLimitChange(Number(event.target.value))}
            >
              {ROW_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="pagination-buttons">
        <button type="button" disabled={loading || safePage <= 1} onClick={() => onPageChange(1)}>
          First
        </button>
        <button type="button" disabled={loading || safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          Previous
        </button>

        {visiblePages.map((p) => (
          <button
            key={p}
            type="button"
            className={p === safePage ? "pagination-page active" : "pagination-page"}
            disabled={loading || p === safePage}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}

        <button type="button" disabled={loading || safePage >= safeTotalPages} onClick={() => onPageChange(safePage + 1)}>
          Next
        </button>
        <button
          type="button"
          disabled={loading || safePage >= safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
        >
          Last
        </button>
      </div>
    </div>
  );
}
