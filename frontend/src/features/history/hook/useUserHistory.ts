import { useEffect, useState } from "react";

import { useAuth } from "../../../shared/auth/context";
import { apiEnvelopeRequest } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import { HistoryDeleteResponse, HistoryListEnvelopeData, HistoryRow } from "../dto/history.dto";

export function useUserHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }
    const userId = user.id;

    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          user_id: String(userId),
          limit: String(limit),
          page: String(page),
        }).toString();
        const data = await apiEnvelopeRequest<HistoryListEnvelopeData>(`${endpoints.history}?${query}`, {
          method: "GET",
        });

        if (mounted) {
          setRows(data.items ?? []);
          setTotal(data.total ?? 0);
          setTotalPages(Math.max(1, data.total_pages ?? 1));
        }
      } catch (err) {
        if (mounted) {
          const detail = err && typeof err === "object" && "detail" in err ? String((err as { detail: string }).detail) : "Load history failed";
          setError(detail);
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
  }, [user, limit, page]);

  useEffect(() => {
    setPage(1);
  }, [user?.id]);

  const updateLimit = (nextLimit: number) => {
    setPage(1);
    setLimit(nextLimit);
  };

  const deletePrediction = async (predictionId: number) => {
    const previousRows = rows;
    const previousTotal = total;
    const previousTotalPages = totalPages;

    const nextRows = rows.filter((row) => row.id !== predictionId);
    const nextTotal = Math.max(0, total - (rows.length === nextRows.length ? 0 : 1));

    setRows(nextRows);
    setTotal(nextTotal);
    setTotalPages(Math.max(1, Math.ceil(nextTotal / limit)));

    try {
      await apiEnvelopeRequest<HistoryDeleteResponse>(`${endpoints.prediction}/${predictionId}`, {
        method: "DELETE",
      });
    } catch (err) {
      setRows(previousRows);
      setTotal(previousTotal);
      setTotalPages(previousTotalPages);
      throw err;
    }
  };

  return {
    rows,
    page,
    limit,
    total,
    totalPages,
    setPage,
    setLimit: updateLimit,
    loading,
    error,
    setRows,
    deletePrediction,
  };
}
