import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const ProtectedRoute = ({ children, rol }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center" data-testid="auth-checking">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (rol && user.rol !== rol) return <Navigate to="/" replace />;
  return children;
};
