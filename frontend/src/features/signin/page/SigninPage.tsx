import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../../shared/auth/context";
import { routePaths } from "../../../shared/constants/routePaths";
import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { useSignin } from "../hook/useSignin";
import { useSigninForm } from "../hook/useSigninForm";

export function SigninPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { signin, loading, error } = useSignin();
  const form = useSigninForm(async (payload) => {
    const result = await signin(payload);
    if (!result) {
      return;
    }
    signIn(result);
    navigate(routePaths.userTagging);
  });

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card">
        <h1>Sign In</h1>
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
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              required
              value={form.values.password}
              onChange={(e) => form.setField("password", e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          {error && <ErrorState message={error} />}
        </form>
        <p className="small">
          No account? <Link to={routePaths.signup}>Create one</Link>
        </p>
      </div>
    </div>
  );
}