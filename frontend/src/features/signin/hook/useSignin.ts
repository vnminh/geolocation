import { useState } from "react";

import { apiEnvelopeRequest } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import { ApiError } from "../../../shared/types/envelope";
import { SigninRequest, SigninResponse } from "../dto/signin.dto";

export function useSignin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signin = async (payload: SigninRequest): Promise<SigninResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      return await apiEnvelopeRequest<SigninResponse>(endpoints.signin, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      setError((err as ApiError).detail ?? "Sign in failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { signin, loading, error };
}