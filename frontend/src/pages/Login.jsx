import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

const PanelMarca = () => (
  <div className="relative hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brass font-display text-xl font-extrabold text-ink">P</div>
      <span className="text-[11px] uppercase tracking-[0.2em] text-ink-soft">Inmobiliaria</span>
    </div>
    <div>
      <h1 className="font-display text-5xl font-extrabold leading-[1.05]">Perisset</h1>
      <p className="mt-4 max-w-sm text-sm text-ink-soft">Administración de alquileres: contratos, liquidaciones mensuales, cobros y pagos a propietarios.</p>
    </div>
    <p className="text-xs text-ink-soft/70">Carcarañá · Rosario · Santa Fe</p>
  </div>
);

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setError("");
    setEnviando(true);
    try {
      await login(email, password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(apiError(err, "No pudimos iniciar sesión."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <PanelMarca />
      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={enviar} className="w-full max-w-sm fade-up" data-testid="login-form">
          <p className="label-caps mb-3">Acceso interno</p>
          <h2 className="font-display text-3xl font-bold">Ingresá a tu cuenta</h2>
          <p className="mt-2 text-sm text-muted-foreground">Usá el email y la contraseña que te dio la administración.</p>
          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} data-testid="login-email-input" placeholder="nombre@perisset.com.ar" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} data-testid="login-password-input" />
            </div>
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="login-error">{error}</p>
            )}
            <Button type="submit" className="w-full active:scale-[0.98]" disabled={enviando} data-testid="login-submit-button">
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {enviando ? "Ingresando…" : "Ingresar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
