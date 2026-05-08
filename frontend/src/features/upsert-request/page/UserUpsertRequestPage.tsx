import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "../../../shared/auth/context";
import { ActionStatusModal } from "../../../shared/components/feedback/ActionStatusModal";
import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { Loading } from "../../../shared/components/feedback/Loading";
import { PaginationControls } from "../../../shared/components/layout/PaginationControls";
import { CoordinatePickerMap } from "../../../shared/components/map/CoordinatePickerMap";
import { RequestStatus, UpsertRequestRow } from "../dto/upsert-request.dto";
import { useUpdateUpsertRequestStatus } from "../hook/useUpdateUpsertRequestStatus";
import { useUpsertRequestList } from "../hook/useUpsertRequestList";

type FeedbackState = {
  open: boolean;
  title: string;
  message: string;
  variant: "success" | "error";
};

export function UserUpsertRequestPage() {
  const { user } = useAuth();
  const { rows, setRows, page, limit, total, totalPages, setPage, setLimit, loading, error } = useUpsertRequestList();
  const statusUpdate = useUpdateUpsertRequestStatus();
  const [detailSelected, setDetailSelected] = useState<UpsertRequestRow | null>(null);
  const [editSelected, setEditSelected] = useState<UpsertRequestRow | null>(null);
  const [showOrigin, setShowOrigin] = useState(false);
  const [editUpdatedLat, setEditUpdatedLat] = useState("");
  const [editUpdatedLon, setEditUpdatedLon] = useState("");
  const [editUpdatedCot, setEditUpdatedCot] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!editSelected) {
      return;
    }
    setEditUpdatedLat(String(editSelected.updated_lat));
    setEditUpdatedLon(String(editSelected.updated_lon));
    setEditUpdatedCot(editSelected.updated_cot ?? "");
    setEditLocation(editSelected.location ?? "");
    setFormError(null);
    // Lock map center to where this row's coord is — never updated again on marker picks
    setMapCenter({ lat: editSelected.updated_lat, lon: editSelected.updated_lon });
  }, [editSelected]);

  useEffect(() => {
    if (!detailSelected) {
      setShowOrigin(false);
    }
  }, [detailSelected]);

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

  if (user?.role !== "admin") {
    return <ErrorState message="Access denied: admin only." />;
  }

  const replaceRow = (updated: UpsertRequestRow) => {
    setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    if (detailSelected?.id === updated.id) {
      setDetailSelected(updated);
    }
    if (editSelected?.id === updated.id) {
      setEditSelected(updated);
    }
  };

  const showFeedback = (variant: FeedbackState["variant"], title: string, message: string) => {
    setFeedback({ open: true, variant, title, message });
  };

  const hasUnsavedEdits = Boolean(
    editSelected && (
      editUpdatedLat.trim() !== String(editSelected.updated_lat).trim()
      || editUpdatedLon.trim() !== String(editSelected.updated_lon).trim()
      || editUpdatedCot.trim() !== (editSelected.updated_cot ?? "").trim()
      || editLocation.trim() !== (editSelected.location ?? "").trim()
    ),
  );

  const applyStatus = async (requestId: number, status: RequestStatus) => {
    try {
      const updated = await statusUpdate.updateStatus(requestId, {
        status,
        user_id: user.id,
      });

      replaceRow(updated);
      showFeedback("success", "Status Updated", `Request #${updated.id} status changed to ${updated.status}.`);
      return true;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Update failed";
      showFeedback("error", "Status Update Failed", detail);
      return false;
    }
  };

  const handleDecision = async (status: Extract<RequestStatus, "accepted" | "decline">) => {
    if (!editSelected) {
      return;
    }
    if (status === "accepted" && hasUnsavedEdits) {
      showFeedback("error", "Save Required", "You need to save before accept.");
      return;
    }
    await applyStatus(editSelected.id, status);
  };

  const handleSavePatch = async () => {
    if (!editSelected) {
      return;
    }

    setFormError(null);
    const trimmedLat = editUpdatedLat.trim();
    const trimmedLon = editUpdatedLon.trim();
    const trimmedCot = editUpdatedCot.trim();
    const trimmedLocation = editLocation.trim();

    const lat = Number(trimmedLat);
    const lon = Number(trimmedLon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setFormError("Updated latitude and longitude must be valid numbers.");
      return;
    }

    try {
      const updated = await statusUpdate.updateRequest({
        id: editSelected.id,
        updated_lat: lat,
        updated_lon: lon,
        updated_cot: trimmedCot,
        location: trimmedLocation,
      });

      replaceRow(updated);
      showFeedback("success", "Request Updated", `Updated lat, lon, cot, and location for request #${updated.id}.`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Update failed";
      showFeedback("error", "Request Update Failed", detail);
    }
  };

  const handleAutoCorrect = async () => {
    if (!editSelected) {
      return;
    }

    setFormError(null);
    try {
      const updated = await statusUpdate.autoCorrect({
        request_id: editSelected.id,
        user_id: user.id,
      });

      replaceRow(updated);
      showFeedback("success", "Auto-correct Completed", `GPT-4o updated request #${updated.id}.`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Auto-correct failed";
      showFeedback("error", "Auto-correct Failed", detail);
    }
  };

  const renderOriginSection = (row: UpsertRequestRow) => (
    <div className="origin-panel">
      <div className="origin-panel-header">
        <span className="origin-panel-badge">Original Prediction</span>
      </div>
      <div className="origin-panel-body">
        <div className="origin-row">
          <span className="origin-label">Lat</span>
          <span className="origin-value">{row.lat ?? "-"}</span>
        </div>
        <div className="origin-row">
          <span className="origin-label">Lon</span>
          <span className="origin-value">{row.lon ?? "-"}</span>
        </div>
        <div className="origin-row origin-row--cot">
          <span className="origin-label">Cot</span>
          <span className="origin-value origin-value--cot">{row.cot || "-"}</span>
        </div>
      </div>
    </div>
  );

  const renderUpdatedSection = (row: UpsertRequestRow) => (
    <div className="updated-panel">
      <div className="updated-panel-header">
        <span className="updated-panel-badge">Prediction</span>
      </div>
      <div className="updated-panel-body">
        <div className="origin-row">
          <span className="origin-label">Lat</span>
          <span className="origin-value">{row.updated_lat}</span>
        </div>
        <div className="origin-row">
          <span className="origin-label">Lon</span>
          <span className="origin-value">{row.updated_lon}</span>
        </div>
        <div className="origin-row origin-row--cot">
          <span className="origin-label">Cot</span>
          <span className="origin-value origin-value--cot">{row.updated_cot || "-"}</span>
        </div>
        <div className="origin-row">
          <span className="origin-label">Location</span>
          <span className="origin-value">{row.location || "-"}</span>
        </div>
        <div className="origin-row">
          <span className="origin-label">Status</span>
          <span className={`status-chip status-chip--${row.status}`}>{row.status}</span>
        </div>
      </div>
    </div>
  );

  const closeDetailModal = () => {
    setDetailSelected(null);
  };

  const closeEditModal = () => {
    setEditSelected(null);
    setFormError(null);
    setMapCenter(null);
  };

  const closeFeedback = () => {
    setFeedback(null);
  };

  const parsedEditLat = editUpdatedLat.trim() === "" ? null : Number(editUpdatedLat);
  const parsedEditLon = editUpdatedLon.trim() === "" ? null : Number(editUpdatedLon);
  const editValueLat = Number.isFinite(parsedEditLat) ? parsedEditLat : null;
  const editValueLon = Number.isFinite(parsedEditLon) ? parsedEditLon : null;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Upsert Requests (Admin)</h3>
      {loading && <Loading label="Loading request list..." />}
      {error && <ErrorState message={error} />}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">User</th>
              <th align="left">Image URL</th>
              <th align="left">Lat</th>
              <th align="left">Lon</th>
              <th align="left">Updated Lat</th>
              <th align="left">Updated Lon</th>
              <th align="left">Location</th>
              <th align="left">Status</th>
              <th align="left">Created At</th>
              <th align="left">Updated At</th>
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
                <td>{row.updated_lat}</td>
                <td>{row.updated_lon}</td>
                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{row.location || "-"}</td>
                <td>{row.status}</td>
                <td>{formatDateTime(row.created_at)}</td>
                <td>{formatDateTime(row.updated_at)}</td>
                <td>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setDetailSelected(row)} disabled={statusUpdate.loading}>
                      Detail
                    </button>
                    <button type="button" onClick={() => setEditSelected(row)} disabled={statusUpdate.loading || row.status!=="reviewing"}>
                      Update
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={12} className="small">
                  No rows loaded.
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
        loading={loading || statusUpdate.loading}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      {detailSelected &&
        createPortal(
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Request detail">
            <div className="modal-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0 }}>Request #{detailSelected.id}</h4>
                <button type="button" onClick={closeDetailModal} disabled={statusUpdate.loading}>
                  Close
                </button>
              </div>

              <div className="grid" style={{ marginTop: 12 }}>
                <img
                  src={detailSelected.image_url || undefined}
                  alt={`request-${detailSelected.id}`}
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
                  <strong>Status:</strong> {detailSelected.status}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Created At:</strong> {formatDateTime(detailSelected.created_at)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Updated At:</strong> {formatDateTime(detailSelected.updated_at)}
                </p>
                <button
                  type="button"
                  className="origin-toggle-btn"
                  onClick={() => setShowOrigin((current) => !current)}
                  disabled={statusUpdate.loading}
                >
                  <span className="origin-toggle-icon">{showOrigin ? "▲" : "▼"}</span>
                  {showOrigin ? "Hide Origin Prediction" : "Show Origin Prediction"}
                </button>
                {showOrigin && renderOriginSection(detailSelected)}
                {renderUpdatedSection(detailSelected)}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {editSelected &&
        createPortal(
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Request update">
            <div className="modal-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0 }}>Update Request #{editSelected.id}</h4>
                <button type="button" onClick={closeEditModal} disabled={statusUpdate.loading}>
                  Close
                </button>
              </div>

              <div className="grid" style={{ marginTop: 12 }}>
                <img
                  src={editSelected.image_url || undefined}
                  alt={`request-update-${editSelected.id}`}
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
                  <strong>Status:</strong> {editSelected.status}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#1565d8", display: "inline-block" }} />
                    Current updated coord
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#d92d20", display: "inline-block" }} />
                    Chosen coord
                  </span>
                </div>
                <div style={{ height: 360 }}>
                  <CoordinatePickerMap
                    currentLat={editSelected.updated_lat}
                    currentLon={editSelected.updated_lon}
                    centerLat={mapCenter?.lat ?? editSelected.updated_lat}
                    centerLon={mapCenter?.lon ?? editSelected.updated_lon}
                    valueLat={editValueLat}
                    valueLon={editValueLon}
                    onChange={(lat, lon) => {
                      setEditUpdatedLat(lat.toFixed(6));
                      setEditUpdatedLon(lon.toFixed(6));
                    }}
                  />
                </div>
                <div className="field" style={{ display: "grid", gap: 8 }}>
                  <label>
                    Lat
                    <input value={editUpdatedLat} onChange={(e) => setEditUpdatedLat(e.target.value)} disabled={statusUpdate.loading || editSelected.status!=='reviewing'} />
                  </label>
                  <label>
                    Lon
                    <input value={editUpdatedLon} onChange={(e) => setEditUpdatedLon(e.target.value)} disabled={statusUpdate.loading || editSelected.status!=='reviewing'} />
                  </label>
                  <label>
                    Cot
                    <textarea
                      value={editUpdatedCot}
                      onChange={(e) => setEditUpdatedCot(e.target.value)}
                      disabled={statusUpdate.loading || editSelected.status!=='reviewing'}
                      rows={5}
                    />
                  </label>
                  <label>
                    Location
                    <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} disabled={statusUpdate.loading || editSelected.status!=='reviewing'} />
                  </label>
                </div>
              </div>

              {formError && <ErrorState message={formError} />}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" onClick={handleAutoCorrect} disabled={statusUpdate.loading || editSelected.status!=='reviewing'}>
                  Auto Correct (GPT-4o)
                </button>
                <button type="button" onClick={handleSavePatch} disabled={statusUpdate.loading || editSelected.status!=='reviewing'}>
                  Save
                </button>
                <button type="button" onClick={() => handleDecision("decline")} disabled={statusUpdate.loading || editSelected.status!=='reviewing'}>
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision("accepted")}
                  disabled={statusUpdate.loading || editSelected.status !== "reviewing"}
                  aria-disabled={hasUnsavedEdits || statusUpdate.loading || editSelected.status !== "reviewing"}
                  title={hasUnsavedEdits ? "You need to save before accept." : undefined}
                  style={hasUnsavedEdits ? { opacity: 0.58, cursor: "not-allowed", boxShadow: "none" } : undefined}
                >
                  Accept
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <ActionStatusModal
        open={Boolean(feedback?.open)}
        title={feedback?.title ?? ""}
        message={feedback?.message ?? ""}
        variant={feedback?.variant ?? "success"}
        onClose={closeFeedback}
      />
    </div>
  );
}
