import { useState } from "react";
import { createPortal } from "react-dom";

import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { Loading } from "../../../shared/components/feedback/Loading";
import { PaginationControls } from "../../../shared/components/layout/PaginationControls";
import { HistoryRow } from "../dto/history.dto";
import { useUserHistory } from "../hook/useUserHistory";

export function UserHistoryPage() {
  const { rows, page, limit, total, totalPages, setPage, setLimit, loading, error, deletePrediction } = useUserHistory();
  const [selected, setSelected] = useState<HistoryRow | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const handleDeleteSelected = async () => {
    if (!selected) {
      return;
    }

    const targetId = selected.id;
    setDeleteError(null);
    setDeletingId(targetId);
    setSelected(null);

    try {
      await deletePrediction(targetId);
    } catch (err) {
      const detail = err && typeof err === "object" && "detail" in err ? String((err as { detail: string }).detail) : "Delete prediction failed";
      setDeleteError(detail);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Prediction History</h3>
      {loading && <Loading label="Loading history..." />}
      {error && <ErrorState message={error} />}
      {deleteError && <ErrorState message={deleteError} />}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Prediction ID</th>
              <th align="left">User</th>
              <th align="left">Image URL</th>
              <th align="left">Lat</th>
              <th align="left">Lon</th>
              <th align="left">Created At</th>
              <th align="left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.user_id}</td>
                <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>{row.image_url}</td>
                <td>{row.lat}</td>
                <td>{row.lon}</td>
                <td>{formatDateTime(row.created_at)}</td>
                <td>
                  <button type="button" onClick={() => setSelected(row)}>
                    Detail
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={7} className="small">
                  No history found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        limit={limit}
        totalRows={total}
        rowsOnPage={rows.length}
        loading={loading}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      {selected &&
        createPortal(
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Prediction detail">
            <div className="modal-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0 }}>Prediction #{selected.id}</h4>
                <button type="button" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>

              <div className="grid" style={{ marginTop: 12 }}>
                <img
                  src={selected.image_url}
                  alt={`prediction-${selected.id}`}
                  style={{
                    width: "100%",
                    maxHeight: 320,
                    objectFit: "contain",
                    borderRadius: 10,
                    border: "1px solid #dbe6ec",
                    background: "#f8fafc",
                  }}
                />
                <p style={{ margin: 0 }}>
                  <strong>Created At:</strong> {formatDateTime(selected.created_at)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Latitude:</strong> {selected.lat}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Longitude:</strong> {selected.lon}
                </p>
                <div>
                  <strong>COT:</strong>
                  <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{selected.cot || "-"}</p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={deletingId === selected.id}
                    style={{
                      background: "#b42318",
                      borderColor: "#b42318",
                      color: "#fff",
                    }}
                  >
                    {deletingId === selected.id ? "Deleting..." : "Delete Prediction"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
