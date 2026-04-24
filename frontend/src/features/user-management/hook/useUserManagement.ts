import { useEffect, useState } from "react";

import { apiEnvelopeRequest } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import { ApiError } from "../../../shared/types/envelope";
import {
  CreateUserPayload,
  UserListEnvelopeData,
  UserManagementRow,
  UserRolePatchPayload,
  UserStatusPatchPayload,
} from "../dto/user-management.dto";

export function useUserManagement() {
  const [rows, setRows] = useState<UserManagementRow[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          limit: String(limit),
          page: String(page),
        }).toString();
        const data = await apiEnvelopeRequest<UserListEnvelopeData>(`${endpoints.user}?${query}`);
        if (mounted) {
          setRows(data.items ?? []);
          setTotal(data.total ?? 0);
          setTotalPages(Math.max(1, data.total_pages ?? 1));
        }
      } catch (err) {
        if (mounted) {
          setError((err as ApiError).detail ?? "Failed to load users");
          setRows([]);
          setTotal(0);
          setTotalPages(1);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [limit, page]);

  const patchRole = async (payload: UserRolePatchPayload) => {
    setError(null);
    try {
      const updated = await apiEnvelopeRequest<UserManagementRow>(endpoints.profile, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setRows((prev) => prev.map((row) => (row.id === payload.id ? { ...row, ...updated } : row)));
      return true;
    } catch (err) {
      setError((err as ApiError).detail ?? "Failed to update role");
      return false;
    }
  };

  const patchStatus = async (payload: UserStatusPatchPayload) => {
    setError(null);
    try {
      const updated = await apiEnvelopeRequest<UserManagementRow>(endpoints.profile, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setRows((prev) => prev.map((row) => (row.id === payload.id ? { ...row, ...updated } : row)));
      return true;
    } catch (err) {
      setError((err as ApiError).detail ?? "Failed to update status");
      return false;
    }
  };

  const createUser = async (payload: CreateUserPayload) => {
    setError(null);
    try {
      const created = await apiEnvelopeRequest<UserManagementRow>(endpoints.signup, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setRows((prev) => [created, ...prev]);
      return true;
    } catch (err) {
      setError((err as ApiError).detail ?? "Failed to create user");
      return false;
    }
  };

  const updateLimit = (nextLimit: number) => {
    setPage(1);
    setLimit(nextLimit);
  };

  return {
    rows,
    setRows,
    page,
    limit,
    total,
    totalPages,
    setPage,
    setLimit: updateLimit,
    loading,
    error,
    patchRole,
    patchStatus,
    createUser,
  };
}
