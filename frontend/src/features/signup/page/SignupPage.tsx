import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../../shared/auth/context";
import { routePaths } from "../../../shared/constants/routePaths";
import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { useSignup } from "../hook/useSignup";
import { useSignupForm } from "../hook/useSignupForm";

export function SignupPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { signup, loading, error } = useSignup();
  const form = useSignupForm(async (payload) => {
    const result = await signup(payload);
    if (!result) {
      return;
    }
    signIn(result);
    navigate(routePaths.userTagging);
  });

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card">
        <h1>Sign Up</h1>
        <form onSubmit={form.handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={form.values.email} onChange={(e) => form.setField("email", e.target.value)} />
          </div>
          <div className="field">
            <label>Name</label>
            <input required value={form.values.name} onChange={(e) => form.setField("name", e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required minLength={6} value={form.values.password} onChange={(e) => form.setField("password", e.target.value)} />
          </div>
          <button type="submit" disabled={loading}>{loading ? "Creating..." : "Create account"}</button>
          {error && <ErrorState message={error} />}
        </form>
        <p className="small">
          Already have an account? <Link to={routePaths.signin}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}