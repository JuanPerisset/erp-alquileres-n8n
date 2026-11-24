import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError, EstadoVacio } from "@/components/EstadoVacio";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { fmtFecha } from "@/lib/format";
import UsuarioDialog from "./UsuarioDialog";

const ROL = { administrador: ["Administrador/a", "azul"], operadora: ["Operadora", "gris"] };

export default function Usuarios() {
  const { user } = useAuth();
  const { data, error, recargar } = useApi("/usuarios");
  const [editando, setEditando] = useState(undefined);

  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!data) return <Skeleton className="h-64" />;
  return (
    <div className="fade-up">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Solo el administrador/a puede gestionar usuarios. La operadora no ve esta sección.</p>
        <Button onClick={() => setEditando(null)} data-testid="usuario-nuevo-button" className="shrink-0 active:scale-95">
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo usuario
        </Button>
      </div>
      {data.length === 0 ? <EstadoVacio titulo="Todavía no hay usuarios" /> : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table data-testid="usuarios-table">
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead><TableHead className="hidden md:table-cell">Alta</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id} className="hover:bg-muted/40" data-testid={`usuario-row-${u.id}`}>
                  <TableCell className="py-2 font-medium">{u.nombre}{u.id === user.id && <span className="ml-2 text-xs text-muted-foreground">(vos)</span>}</TableCell>
                  <TableCell className="py-2">{u.email}</TableCell>
                  <TableCell className="py-2"><StatusBadge nombre={ROL[u.rol][0]} variante={ROL[u.rol][1]} className="normal-case" /></TableCell>
                  <TableCell className="py-2"><StatusBadge nombre={u.activo ? "activo" : "inactivo"} /></TableCell>
                  <TableCell className="hidden py-2 md:table-cell">{fmtFecha(u.created_at)}</TableCell>
                  <TableCell className="py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditando(u)} data-testid={`usuario-editar-${u.id}`} aria-label="Editar usuario">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editando !== undefined && (
        <UsuarioDialog usuario={editando} esPropio={editando?.id === user.id}
          onClose={() => setEditando(undefined)} onGuardado={() => { setEditando(undefined); recargar(); }} />
      )}
    </div>
  );
}
