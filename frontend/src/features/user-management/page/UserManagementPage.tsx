import { useState } from "react";

import { useAuth } from "../../../shared/auth/context";
import { UserRole } from "../../../shared/auth/role";
import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { Loading } from "../../../shared/components/feedback/Loading";
import { PaginationControls } from "../../../shared/components/layout/PaginationControls";
import { Modal } from "../../../shared/components/layout/Modal";
import { UserManagementRow } from "../dto/user-management.dto";
import { useUserManagement } from "../hook/useUserManagement";

interface CreateUserFormState {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export function UserManagementPage() {
  const { user } = useAuth();
  const { rows, page, limit, total, totalPages, setPage, setLimit, loading, error, patchRole, patchStatus, createUser } = useUserManagement();
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState<CreateUserFormState>({
    email: "",
    name: "",
    password: "",
    role: "user",
  });

  if (user?.role !== "admin") {
    return <ErrorState message="Access denied: admin only." />;
  }

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

  const handleBlock = async (row: UserManagementRow) => {
    setBusyUserId(row.id);
    await patchStatus({ id: row.id, status: "block" });
    setBusyUserId(null);
  };

  const handlePromote = async (row: UserManagementRow) => {
    setBusyUserId(row.id);
    await patchRole({ id: row.id, role: "admin" });
    setBusyUserId(null);
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateLoading(true);
    const ok = await createUser(form);
    setCreateLoading(false);
    if (ok) {
      setCreateOpen(false);
      setForm({ email: "", name: "", password: "", role: "user" });
    }
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>User Management (Admin)</h3>
        <button type="button" onClick={() => setCreateOpen(true)}>
          Create new
        </button>
      </div>
      {loading && <Loading label="Loading users..." />}
      {error && <ErrorState message={error} />}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">Name</th>
              <th align="left">Email</th>
              <th align="left">Role</th>
              <th align="left">Status</th>
              <th align="left">Created At</th>
              <th align="left">Updated At</th>
              <th align="left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowBusy = busyUserId === row.id;
              return (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.role}</td>
                  <td>{row.status}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{formatDateTime(row.updated_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => void handleBlock(row)}
                        disabled={rowBusy || row.status === "block" || row.id === user.id}
                      >
                        Block
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePromote(row)}
                        disabled={rowBusy || row.role !== "user"}
                      >
                        Admin
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="small">
                  No users found.
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

      <Modal open={createOpen} ariaLabel="Create new user">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ margin: 0 }}>Create New User</h4>
          <button type="button" onClick={() => setCreateOpen(false)} disabled={createLoading}>
            Close
          </button>
        </div>

        <form onSubmit={handleCreateUser} style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </label>

          <label>
            Name
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              minLength={6}
              required
            />
          </label>

          <label>
            Role
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as "user" | "admin" }))}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              Cancel
            </button>
            <button type="submit" disabled={createLoading}>
              {createLoading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
