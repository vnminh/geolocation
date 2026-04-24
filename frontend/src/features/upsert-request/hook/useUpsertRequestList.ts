import { useEffect, useState } from "react";

import { apiEnvelopeRequest } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import { ApiError } from "../../../shared/types/envelope";
import { UpsertRequestListEnvelopeData, UpsertRequestRow } from "../dto/upsert-request.dto";

export function useUpsertRequestList() {
  const [rows, setRows] = useState<UpsertRequestRow[]>([]);
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
        const data = await apiEnvelopeRequest<UpsertRequestListEnvelopeData>(`${endpoints.request}?${query}`);

        if (mounted) {
          setRows(data.items ?? []);
          setTotal(data.total ?? 0);
          setTotalPages(Math.max(1, data.total_pages ?? 1));
        }
      } catch (err) {
        if (mounted) {
          setError((err as ApiError).detail ?? "Failed to load requests");
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
  };
}