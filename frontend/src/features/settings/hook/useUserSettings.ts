import { useState } from "react";

import { apiEnvelopeRequest } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import { useAuth } from "../../../shared/auth/context";
import { ApiError } from "../../../shared/types/envelope";
import { ProfilePatchRequest, ProfileResponse, ResetPasswordResponse } from "../dto/settings.dto";

export function useUserSettings() {
  const { user, signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const updateProfile = async (
    payload: Omit<ProfilePatchRequest, "id">,
  ): Promise<{ success: boolean; error?: string } | undefined> => {
    if (!user) return;
    setLoading(true);
    setUpdateLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiEnvelopeRequest<ProfileResponse>(endpoints.profile, {
        method: "PATCH",
        body: JSON.stringify({ id: user.id, ...payload }),
      });
      signIn(result);
      setMessage("Profile updated.");
      return { success: true };
    } catch (err) {
      const e = (err as ApiError).detail ?? "Profile update failed";
      setError(e);
      return { success: false, error: e };
    } finally {
      setLoading(false);
      setUpdateLoading(false);
    }
  };

  const resetPassword = async (): Promise<{ success: boolean; error?: string } | undefined> => {
    if (!user) return;
    setLoading(true);
    setResetLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiEnvelopeRequest<ResetPasswordResponse>(endpoints.password, {
        method: "POST",
        body: JSON.stringify({ id: user.id }),
      });
      setMessage("Password reset was triggered.");
      return { success: true };
    } catch (err) {
      const e = (err as ApiError).detail ?? "Reset password failed";
      setError(e);
      return { success: false, error: e };
    } finally {
      setLoading(false);
      setResetLoading(false);
    }
  };

  return { user, loading, updateLoading, resetLoading, error, message, updateProfile, resetPassword };
}