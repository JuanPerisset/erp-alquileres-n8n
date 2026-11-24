import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      try {
        const { data } = await api.post("/auth/refresh");
        setUser(data);
      } catch {
        setUser(false);
      }
    }
  }, []);

  useEffect(() => {
    cargar();
    const expirar = () => setUser(false);
    window.addEventListener("auth:expired", expirar);
    return () => window.removeEventListener("auth:expired", expirar);
  }, [cargar]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } finally { setUser(false); }
  };

  const esAdmin = user && user.rol === "administrador";

  return (
    <AuthContext.Provider value={{ user, login, logout, esAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
