import { useState } from "react";

import { apiEnvelopeRequest } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import { ApiError } from "../../../shared/types/envelope";
import {
  KnowledgeDeleteData,
  KnowledgeIndex,
  KnowledgeResult,
  KnowledgeSearchData,
} from "../dto/knowledge.dto";

const PAGE_SIZE = 10;

export function useKnowledgeSearch(userId: number | undefined) {
  const [rows, setRows] = useState<KnowledgeResult[]>([]);
  const [page, setPageState] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [indexName, setIndexName] = useState<KnowledgeIndex>("dino_emb");

  const search = async (nextPage = 1, nextFile = file, nextIndex = indexName) => {
    if (!userId || !nextFile) {
      setError("Choose an image before searching.");
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", nextFile);
      formData.append("index_name", nextIndex);
      formData.append("page", String(nextPage));

      const data = await apiEnvelopeRequest<KnowledgeSearchData>(endpoints.knowledge, {
        method: "POST",
        body: formData,
      });
      setRows(data.items ?? []);
      setPageState(data.page ?? nextPage);
      setTotal(data.total ?? 0);
      setTotalPages(Math.max(1, data.total_pages ?? 1));
      return true;
    } catch (err) {
      setError((err as ApiError).detail ?? "Failed to search knowledge database");
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const setPage = (nextPage: number) => {
    void search(nextPage);
  };

  const selectFile = (nextFile: File | null) => {
    setFile(nextFile);
    setRows([]);
    setPageState(1);
    setTotal(0);
    setTotalPages(1);
    setError(null);
  };

  const selectIndex = (nextIndex: KnowledgeIndex) => {
    setIndexName(nextIndex);
    setRows([]);
    setPageState(1);
    setTotal(0);
    setTotalPages(1);
  };

  const deletePoint = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await apiEnvelopeRequest<KnowledgeDeleteData>(
        `${endpoints.knowledge}/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      const nextPage = rows.length === 1 && page > 1 ? page - 1 : page;
      await search(nextPage);
      return true;
    } catch (err) {
      setError((err as ApiError).detail ?? "Failed to delete knowledge point");
      return false;
    } finally {
      setDeletingId(null);
    }
  };

  return {
    rows,
    page,
    limit: PAGE_SIZE,
    total,
    totalPages,
    loading,
    deletingId,
    error,
    file,
    indexName,
    search,
    setPage,
    selectFile,
    selectIndex,
    deletePoint,
  };
}
