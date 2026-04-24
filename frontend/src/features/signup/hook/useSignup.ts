import { useState } from "react";

import { apiEnvelopeRequest } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import { ApiError } from "../../../shared/types/envelope";
import { SignupRequest, SignupResponse } from "../dto/signup.dto";

export function useSignup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = async (payload: SignupRequest): Promise<SignupResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      return await apiEnvelopeRequest<SignupResponse>(endpoints.signup, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      setError((err as ApiError).detail ?? "Sign up failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { signup, loading, error };
}