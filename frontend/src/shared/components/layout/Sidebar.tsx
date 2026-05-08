import { Link } from "react-router-dom";

import { useAuth } from "../../auth/context";
import { routePaths } from "../../constants/routePaths";

interface SidebarProps {
  publicMode?: boolean;
}

export function Sidebar({ publicMode = false }: SidebarProps) {
  const { user, signOut } = useAuth();

  return (
    <aside className="sidebar card">
      <h2 className="sidebar-title">GeoTagging</h2>

      <nav className="sidebar-nav">
        {publicMode ? (
          <>
            <Link to={routePaths.signin}>Sign In</Link>
            <Link to={routePaths.signup}>Sign Up</Link>
          </>
        ) : (
          <>
            <Link to={routePaths.userTagging}>Tagging Chat</Link>
            <Link to={routePaths.userMap}>Map</Link>
            <Link to={routePaths.userHistory}>My History</Link>
            <Link to={routePaths.userSettings}>Settings</Link>
            {user?.role === "admin" && <Link to={routePaths.userUpsertRequest}>Upsert Requests</Link>}
            {user?.role === "admin" && <Link to={routePaths.userManagement}>User Management</Link>}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <p className="small">{user ? `${user.name} (${user.role})` : "Not signed in"}</p>
        {!publicMode && user && <button onClick={signOut}>Sign out</button>}
      </div>
    </aside>
  );
}