import { useState } from "react";

import { apiEnvelopeRequest } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import {
  AutoCorrectUpsertRequestPayload,
  UpdateUpsertRequestEntityPayload,
  UpdateUpsertRequestStatusPayload,
  UpsertRequestRow,
} from "../dto/upsert-request.dto";

export function useUpdateUpsertRequestStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = async (requestId: number, payload: UpdateUpsertRequestStatusPayload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiEnvelopeRequest<UpsertRequestRow>(`${endpoints.request}`, {
        method: "PATCH",
        body: JSON.stringify({
          id: requestId,
          ...payload,
        }),
      });
      return result;
    } catch (err) {
      const detail = err && typeof err === "object" && "detail" in err ? String((err as { detail: string }).detail) : "Update failed";
      setError(detail);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateRequest = async (payload: UpdateUpsertRequestEntityPayload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiEnvelopeRequest<UpsertRequestRow>(`${endpoints.request}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return result;
    } catch (err) {
      const detail = err && typeof err === "object" && "detail" in err ? String((err as { detail: string }).detail) : "Update failed";
      setError(detail);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const autoCorrect = async (payload: AutoCorrectUpsertRequestPayload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiEnvelopeRequest<UpsertRequestRow>(`${endpoints.request}/auto-correct/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return result;
    } catch (err) {
      const detail = err && typeof err === "object" && "detail" in err ? String((err as { detail: string }).detail) : "Update failed";
      setError(detail);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { updateStatus, updateRequest, autoCorrect, loading, error };
}