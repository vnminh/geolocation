import { FormEvent, useState } from "react";

import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { Loading } from "../../../shared/components/feedback/Loading";
import { useUserSettings } from "../hook/useUserSettings";

export function UserSettingsPage() {
  const { user, loading, error, message, updateProfile, resetPassword } = useUserSettings();
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState(user?.role ?? "user");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await updateProfile({
      name: name || undefined,
      role,
      password: password || undefined,
    });
    setPassword("");
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
          <button type="submit" disabled={loading}>Save profile</button>
        </form>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Password Reset</h3>
        <p className="small">Calls backend POST /password with your id.</p>
        <button onClick={resetPassword} disabled={loading}>Reset Password</button>
      </section>

      {loading && <Loading label="Processing..." />}
      {message && <p>{message}</p>}
      {error && <ErrorState message={error} />}
    </div>
  );
}