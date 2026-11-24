import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SelectCatalogo } from "@/components/form/Campo";
import { api, apiError } from "@/lib/api";

const Fila = ({ item, catalogo, onGuardar, onBorrar }) => {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(item.nombre);
  const guardar = async () => { if (await onGuardar(item, nombre)) setEditando(false); };
  return (
    <li className="flex items-center gap-2 py-1.5 text-sm" data-testid={`${catalogo}-item-${item.id}`}>
      {editando ? (
        <>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-8" autoFocus data-testid={`${catalogo}-editar-input-${item.id}`} />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={guardar} aria-label="Guardar" data-testid={`${catalogo}-guardar-${item.id}`}><Check className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditando(false); setNombre(item.nombre); }} aria-label="Cancelar"><X className="h-4 w-4" /></Button>
        </>
      ) : (
        <>
          <span className="flex-1 truncate">{item.nombre}{item.provincia && <span className="ml-2 text-xs text-muted-foreground">{item.provincia}</span>}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditando(true)} aria-label="Editar" data-testid={`${catalogo}-editar-${item.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-700 hover:bg-red-50" onClick={() => onBorrar(item)} aria-label="Eliminar" data-testid={`${catalogo}-eliminar-${item.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
        </>
      )}
    </li>
  );
};

export default function CatalogoEditable({ titulo, catalogo, items, provincias, onCambio }) {
  const conProvincia = catalogo === "ciudades";
  const [nombre, setNombre] = useState("");
  const [prov, setProv] = useState(null);
  const [borrando, setBorrando] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const visibles = useMemo(() => (conProvincia && prov ? items.filter((i) => i.id_provincia === prov) : items), [items, prov, conProvincia]);

  const ejecutar = async (fn, ok) => {
    try { await fn(); toast.success(ok); onCambio(); return true; } catch (e) { toast.error(apiError(e)); return false; }
  };
  const agregar = async (e) => {
    e.preventDefault();
    if (enviando || !nombre.trim()) return;
    if (conProvincia && !prov) { toast.error("Elegí la provincia de la ciudad"); return; }
    setEnviando(true);
    if (await ejecutar(() => api.post(`/catalogos/${catalogo}`, { nombre, id_provincia: prov }), "Agregado")) setNombre("");
    setEnviando(false);
  };
  const guardar = (item, n) => ejecutar(() => api.put(`/catalogos/${catalogo}/${item.id}`, { nombre: n, id_provincia: item.id_provincia }), "Guardado");
  const borrar = async () => (await ejecutar(() => api.delete(`/catalogos/${catalogo}/${borrando.id}`), "Eliminado")) || false;

  return (
    <div className="flex flex-col rounded-lg border bg-card p-5" data-testid={`catalogo-editable-${catalogo}`}>
      <p className="label-caps mb-3">{titulo}</p>
      {conProvincia && (
        <div className="mb-2"><SelectCatalogo value={prov} onChange={setProv} items={provincias} vacio="Todas las provincias" testId="ciudades-provincia-select" /></div>
      )}
      <form onSubmit={agregar} className="mb-2 flex gap-2">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nuevo…" className="h-9" data-testid={`${catalogo}-nuevo-input`} />
        <Button type="submit" size="sm" disabled={enviando} data-testid={`${catalogo}-agregar-button`}><Plus className="h-4 w-4" /></Button>
      </form>
      <ul className="max-h-64 divide-y overflow-y-auto">
        {visibles.map((i) => <Fila key={i.id} item={i} catalogo={catalogo} onGuardar={guardar} onBorrar={setBorrando} />)}
        {visibles.length === 0 && <li className="py-3 text-sm text-muted-foreground">Sin registros.</li>}
      </ul>
      <ConfirmDialog open={!!borrando} onOpenChange={(o) => !o && setBorrando(null)} destructivo confirmar="Eliminar"
        testId={`${catalogo}-eliminar-dialog`} titulo={`¿Eliminar "${borrando?.nombre}"?`}
        descripcion="Si está en uso por otros registros no se va a poder eliminar." onConfirm={borrar} />
    </div>
  );
}
