import { createContext, useState, type ReactNode } from "react";
import type { LoginPayload, SignupPayload, User } from "../types/auth";

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const login = async (_payload: LoginPayload): Promise<void> => {
    // TODO: implement (call api/auth.login, persist token, set user)
    throw new Error("not implemented");
  };

  const signup = async (_payload: SignupPayload): Promise<void> => {
    // TODO: implement (call api/auth.signup, persist token, set user)
    throw new Error("not implemented");
  };

  const logout = (): void => {
    // TODO: implement (clear token + user)
    setUser(null);
    setToken(null);
  };

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: Boolean(token),
    loading,
    login,
    signup,
    logout,
  };

  // setLoading/setUser/setToken are wired up by the TODO implementations above.
  void setUser;
  void setToken;
  void setLoading;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
