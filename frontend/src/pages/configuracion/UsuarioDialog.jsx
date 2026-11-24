import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, apiError } from "@/lib/api";

const Campo = ({ label, children }) => <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;

export default function UsuarioDialog({ usuario, esPropio, onClose, onGuardado }) {
  const nuevo = !usuario;
  const [f, setF] = useState({ nombre: usuario?.nombre || "", email: usuario?.email || "", rol: usuario?.rol || "operadora",
    activo: usuario?.activo ?? true, password: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    setError("");
    setGuardando(true);
    try {
      if (nuevo) await api.post("/usuarios", f);
      else await api.patch(`/usuarios/${usuario.id}`, { nombre: f.nombre, rol: f.rol, activo: f.activo, password: f.password || null });
      toast.success(nuevo ? "Usuario creado" : "Usuario actualizado");
      onGuardado();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white sm:max-w-md" data-testid="usuario-dialog">
        <DialogHeader>
          <DialogTitle>{nuevo ? "Nuevo usuario" : "Editar usuario"}</DialogTitle>
          <DialogDescription>{nuevo ? "Va a poder ingresar con este email y contraseña." : usuario.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-4">
          <Campo label="Nombre"><Input required value={f.nombre} onChange={set("nombre")} data-testid="usuario-nombre-input" /></Campo>
          {nuevo && <Campo label="Email"><Input type="email" required value={f.email} onChange={set("email")} data-testid="usuario-email-input" /></Campo>}
          <Campo label="Rol">
            <Select value={f.rol} onValueChange={set("rol")} disabled={esPropio}>
              <SelectTrigger data-testid="usuario-rol-select"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="administrador" data-testid="usuario-rol-administrador">Administrador/a</SelectItem>
                <SelectItem value="operadora" data-testid="usuario-rol-operadora">Operadora</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <Campo label={nuevo ? "Contraseña (mín. 8 caracteres)" : "Nueva contraseña (opcional)"}>
            <Input type="password" required={nuevo} minLength={8} value={f.password} onChange={set("password")} data-testid="usuario-password-input" />
          </Campo>
          {!nuevo && !esPropio && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="activo">Usuario activo</Label>
              <Switch id="activo" checked={f.activo} onCheckedChange={set("activo")} data-testid="usuario-activo-switch" />
            </div>
          )}
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="usuario-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="usuario-cancelar-button">Cancelar</Button>
            <Button type="submit" disabled={guardando} data-testid="usuario-guardar-button">
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
