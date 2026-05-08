import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

import { routePaths } from "../../../shared/constants/routePaths";
import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { ActionStatusModal } from "../../../shared/components/feedback/ActionStatusModal";
import { useForgetPass } from "../hook/useForgetPass";
import { useForgetPassForm } from "../hook/useForgetPassForm";

export function ForgetPassPage() {
  const navigate = useNavigate();
  const { forgetPass, loading, error } = useForgetPass();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const form = useForgetPassForm(async (payload) => {
    const result = await forgetPass(payload);
    if (!result) {
      return;
    }

    setStatusMessage(`A temporary password has been sent to ${payload.email}.`);
  });

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card">
        <h1>Forgot Password</h1>
        <p className="small" style={{ marginTop: 0 }}>
          Enter your email and we’ll send a temporary password.
        </p>
        <form onSubmit={form.handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              value={form.values.email}
              onChange={(e) => form.setField("email", e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send temporary password"}
          </button>
          {error && <ErrorState message={error} />}
        </form>
        <p className="small">
          Remembered it? <Link to={routePaths.signin}>Back to sign in</Link>
        </p>
      </div>

      <ActionStatusModal
        open={statusMessage !== null}
        title="Password reset sent"
        message={statusMessage ?? ""}
        variant="success"
        closeLabel="Go to sign in"
        onClose={() => navigate(routePaths.signin)}
      />
    </div>
  );
}