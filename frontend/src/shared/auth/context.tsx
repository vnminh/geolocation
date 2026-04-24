import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

import { clearSessionUser, getSessionUser, setSessionUser } from "./token";
import { SessionUser } from "./role";

interface AuthContextValue {
  user: SessionUser | null;
  signIn: (nextUser: SessionUser) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(() => getSessionUser());

  const value = useMemo(
    () => ({
      user,
      signIn: (nextUser: SessionUser) => {
        setSessionUser(nextUser);
        setUser(nextUser);
      },
      signOut: () => {
        clearSessionUser();
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}