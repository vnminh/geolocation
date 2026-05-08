import { FormEvent, useState } from "react";

import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { Loading } from "../../../shared/components/feedback/Loading";
import { ActionStatusModal } from "../../../shared/components/feedback/ActionStatusModal";
import { Spinner } from "../../../shared/components/feedback/Spinner";
import { useUserSettings } from "../hook/useUserSettings";

export function UserSettingsPage() {
  const { user, loading, updateLoading, resetLoading, error, message, updateProfile, resetPassword } = useUserSettings();
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState(user?.role ?? "user");
  const [password, setPassword] = useState("");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalMessage, setProfileModalMessage] = useState("");
  const [profileModalVariant, setProfileModalVariant] = useState<"success" | "error">("success");

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetModalMessage, setResetModalMessage] = useState("");
  const [resetModalVariant, setResetModalVariant] = useState<"success" | "error">("success");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const res = await updateProfile({
      name: name || undefined,
      role,
      password: password || undefined,
    });
    setPassword("");
    if (res && res.success) {
      setProfileModalVariant("success");
      setProfileModalMessage("Profile updated successfully.");
      setProfileModalOpen(true);
    } else {
      setProfileModalVariant("error");
      setProfileModalMessage(res?.error ?? "Profile update failed.");
      setProfileModalOpen(true);
    }
  };

  const handleReset = async () => {
    const res = await resetPassword();
    if (res && res.success) {
      setResetModalVariant("success");
      setResetModalMessage("Check your email for temporary password");
      setResetModalOpen(true);
    } else {
      setResetModalVariant("error");
      setResetModalMessage(res?.error ?? "Reset password failed.");
      setResetModalOpen(true);
    }
  };

  return (
    <div className="grid settings-stack">
      <section className="card">
        <h3 style={{ marginTop: 0 }}>Profile</h3>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Role</label>
            <input value={role} readOnly />
          </div>
          <div className="field">
            <label>New password (optional)</label>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-loading-wrap" disabled={updateLoading || loading}>
            {updateLoading ? (
              <>
                <Spinner size={15} />
                <span>Saving…</span>
              </>
            ) : (
              "Save profile"
            )}
          </button>
        </form>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Password Reset</h3>
        <p className="small">Check your email for new password</p>
        <button
          type="button"
          className="btn-loading-wrap"
          onClick={handleReset}
          disabled={resetLoading || loading}
        >
          {resetLoading ? (
            <>
              <Spinner size={15} />
              <span>Resetting…</span>
            </>
          ) : (
            "Reset Password"
          )}
        </button>
      </section>

      <ActionStatusModal
        open={profileModalOpen}
        title={profileModalVariant === "success" ? "Success" : "Error"}
        message={profileModalMessage}
        variant={profileModalVariant}
        onClose={() => setProfileModalOpen(false)}
      />

      <ActionStatusModal
        open={resetModalOpen}
        title={resetModalVariant === "success" ? "Password Reset" : "Error"}
        message={resetModalMessage}
        variant={resetModalVariant}
        onClose={() => setResetModalOpen(false)}
      />
    </div>
  );
}