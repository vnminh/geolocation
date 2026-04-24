import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "../../../shared/auth/context";
import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { Loading } from "../../../shared/components/feedback/Loading";
import { PaginationControls } from "../../../shared/components/layout/PaginationControls";
import { RequestStatus, UpsertRequestRow } from "../dto/upsert-request.dto";
import { useUpdateUpsertRequestStatus } from "../hook/useUpdateUpsertRequestStatus";
import { useUpsertRequestList } from "../hook/useUpsertRequestList";

export function UserUpsertRequestPage() {
  const { user } = useAuth();
  const { rows, setRows, page, limit, total, totalPages, setPage, setLimit, loading, error } = useUpsertRequestList();
  const statusUpdate = useUpdateUpsertRequestStatus();
  const [selected, setSelected] = useState<UpsertRequestRow | null>(null);
  const [editUpdatedLat, setEditUpdatedLat] = useState("");
  const [editUpdatedLon, setEditUpdatedLon] = useState("");
  const [editUpdatedCot, setEditUpdatedCot] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setEditUpdatedLat(String(selected.updated_lat));
    setEditUpdatedLon(String(selected.updated_lon));
    setEditUpdatedCot(selected.updated_cot ?? "");
    setEditLocation(selected.location ?? "");
    setFormError(null);
  }, [selected]);

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
    if (selected?.id === updated.id) {
      setSelected(updated);
    }
  };

  const applyStatus = async (requestId: number, status: RequestStatus) => {
    const updated = await statusUpdate.updateStatus(requestId, {
      status,
      user_id: user.id,
    });

    if (!updated) {
      return false;
    }

    replaceRow(updated);
    return true;
  };

  const handleDecision = async (status: Extract<RequestStatus, "accepted" | "decline">) => {
    if (!selected) {
      return;
    }
    const ok = await applyStatus(selected.id, status);
    if (ok) {
      setSelected(null);
    }
  };

  const handleSavePatch = async () => {
    if (!selected) {
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

    const updated = await statusUpdate.updateRequest({
      id: selected.id,
      updated_lat: lat,
      updated_lon: lon,
      updated_cot: trimmedCot,
      location: trimmedLocation,
    });

    if (!updated) {
      return;
    }
    replaceRow(updated);
  };

  const handleAutoCorrect = async () => {
    if (!selected) {
      return;
    }

    setFormError(null);
    const updated = await statusUpdate.autoCorrect({
      request_id: selected.id,
      user_id: user.id,
    });
    if (!updated) {
      return;
    }
    replaceRow(updated);
  };

  const isDisabledEdit = (loading:boolean, selected: UpsertRequestRow | null) =>{
    return loading || selected?.status !== "reviewing";
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Upsert Requests (Admin)</h3>
      {loading && <Loading label="Loading request list..." />}
      {error && <ErrorState message={error} />}
      {statusUpdate.error && <ErrorState message={statusUpdate.error} />}

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
                  <button type="button" onClick={() => setSelected(row)} disabled={statusUpdate.loading}>
                    Detail
                  </button>
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
        loading={loading || isDisabledEdit(statusUpdate.loading,selected)}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      {selected &&
        createPortal(
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Request detail">
            <div className="modal-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0 }}>Request #{selected.id}</h4>
                <button type="button" onClick={() => setSelected(null)} disabled={statusUpdate.loading}>
                  Close
                </button>
              </div>

              <div className="grid" style={{ marginTop: 12 }}>
                <img
                  src={selected.image_url || undefined}
                  alt={`request-${selected.id}`}
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
                  <strong>Status:</strong> {selected.status}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Created At:</strong> {formatDateTime(selected.created_at)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Updated At:</strong> {formatDateTime(selected.updated_at)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Location:</strong> {selected.location || "-"}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Original Latitude:</strong> {selected.lat}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Original Longitude:</strong> {selected.lon}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Updated Latitude:</strong> {selected.updated_lat}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Updated Longitude:</strong> {selected.updated_lon}
                </p>
                <div>
                  <strong>COT:</strong>
                  <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{selected.cot || "-"}</p>
                </div>
                <div>
                  <strong>Updated COT:</strong>
                  <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{selected.updated_cot || "-"}</p>
                </div>
                <div className="field" style={{ display: "grid", gap: 8 }}>
                  <label>
                    Updated Latitude
                    <input value={editUpdatedLat} onChange={(e) => setEditUpdatedLat(e.target.value)} disabled={isDisabledEdit(statusUpdate.loading,selected)} />
                  </label>
                  <label>
                    Updated Longitude
                    <input value={editUpdatedLon} onChange={(e) => setEditUpdatedLon(e.target.value)} disabled={isDisabledEdit(statusUpdate.loading,selected)} />
                  </label>
                  <label>
                    Updated COT
                    <textarea
                      value={editUpdatedCot}
                      onChange={(e) => setEditUpdatedCot(e.target.value)}
                      disabled={isDisabledEdit(statusUpdate.loading,selected)}
                      rows={5}
                    />
                  </label>
                  <label>
                    Location (comma separated)
                    <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} disabled={isDisabledEdit(statusUpdate.loading,selected)} />
                  </label>
                </div>
              </div>

              {formError && <ErrorState message={formError} />}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" onClick={handleAutoCorrect} disabled={isDisabledEdit(statusUpdate.loading,selected)}>
                  Auto Correct (GPT-4o)
                </button>
                <button type="button" onClick={handleSavePatch} disabled={isDisabledEdit(statusUpdate.loading,selected)}>
                  Save Request Update
                </button>
                <button type="button" onClick={() => handleDecision("decline")} disabled={isDisabledEdit(statusUpdate.loading,selected)}>
                  Decline
                </button>
                <button type="button" onClick={() => handleDecision("accepted")} disabled={isDisabledEdit(statusUpdate.loading,selected)}>
                  Accept
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}