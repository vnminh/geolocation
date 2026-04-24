import { useState } from "react";

import { apiEnvelopeRequest } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import { useAuth } from "../../../shared/auth/context";
import { ApiError } from "../../../shared/types/envelope";
import { ProfilePatchRequest, ProfileResponse, ResetPasswordResponse } from "../dto/settings.dto";

export function useUserSettings() {
  const { user, signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const updateProfile = async (payload: Omit<ProfilePatchRequest, "id">) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiEnvelopeRequest<ProfileResponse>(endpoints.profile, {
        method: "PATCH",
        body: JSON.stringify({ id: user.id, ...payload }),
      });
      signIn(result);
      setMessage("Profile updated.");
    } catch (err) {
      setError((err as ApiError).detail ?? "Profile update failed");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiEnvelopeRequest<ResetPasswordResponse>(endpoints.password, {
        method: "POST",
        body: JSON.stringify({ id: user.id }),
      });
      setMessage("Password reset was triggered.");
    } catch (err) {
      setError((err as ApiError).detail ?? "Reset password failed");
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, error, message, updateProfile, resetPassword };
}