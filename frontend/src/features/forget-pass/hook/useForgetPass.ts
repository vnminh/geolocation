import { useState } from "react";

import { apiEnvelopeRequest } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import { ApiError } from "../../../shared/types/envelope";
import { ForgetPassRequest, ForgetPassResponse } from "../dto/forget-pass.dto";

export function useForgetPass() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forgetPass = async (payload: ForgetPassRequest): Promise<ForgetPassResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      return await apiEnvelopeRequest<ForgetPassResponse>(endpoints.forgetPass, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      setError((err as ApiError).detail ?? "Failed to send temporary password");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { forgetPass, loading, error };
}