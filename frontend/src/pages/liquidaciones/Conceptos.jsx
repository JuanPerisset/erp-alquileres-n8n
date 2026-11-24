import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { SelectSimple } from "@/components/form/Campo";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { accion } from "@/lib/acciones";
import { fmtMoneda } from "@/lib/format";

const VACIO = { descripcion: "", monto: "", tipo: "adicional", observacion: "" };
const NUM_VALIDO = /^\d+(?:[.,]\d{1,2})?$/;

export const Conceptos = ({ l, editable, onCambio, antesDeGuardar }) => {
  const [f, setF] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [borrar, setBorrar] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const usd = l.moneda === "USD";
  const montoStr = String(f.monto ?? "").trim();
  const montoInvalido = montoStr !== "" && (!NUM_VALIDO.test(montoStr) || !(Number(montoStr.replace(",", ".")) > 0));

  const guardar = async (e) => {
    e.preventDefault();
    if (enviando || !f.descripcion.trim() || !montoStr || montoInvalido) return;
    setEnviando(true);
    try {
      if (antesDeGuardar) await antesDeGuardar();
      const body = { ...f, monto: Number(montoStr.replace(",", ".")) };
      const url = `/liquidaciones/${l.id}/conceptos${editId ? `/${editId}` : ""}`;
      await accion(async () => onCambio((await (editId ? api.put(url, body) : api.post(url, body))).data), editId ? "Concepto actualizado" : "Concepto agregado",
        () => { setF(VACIO); setEditId(null); });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-5" data-testid="conceptos">
      <h2 className="label-caps">Conceptos</h2>
      <p className="mb-4 mt-2 text-sm text-muted-foreground">Cargá acá impuestos, tasas o gastos extraordinarios que no tienen campo propio (ej. inmobiliario, plomería). Los 'adicional' suman al total y los 'descuento' restan.</p>
      <ul className="divide-y">
        {l.conceptos.map((c) => (
          <li key={c.id_concepto} className="flex flex-wrap items-center gap-2 py-2 text-sm" data-testid={`concepto-${c.id_concepto}`}>
            <StatusBadge nombre={c.tipo} variante={c.tipo === "adicional" ? "azul" : "amarillo"} />
            <span className="font-medium">{c.descripcion}</span>
            {c.observacion && <span className="text-xs text-muted-foreground">{c.observacion}</span>}
            <span className="ml-auto num">{c.tipo === "descuento" ? "− " : "+ "}{fmtMoneda(c.monto, l.moneda)}</span>
            {editable && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar concepto" data-testid={`concepto-${c.id_concepto}-editar`}
                  onClick={() => { setEditId(c.id_concepto); setF({ descripcion: c.descripcion, monto: c.monto, tipo: c.tipo, observacion: c.observacion || "" }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-700" aria-label="Quitar concepto" data-testid={`concepto-${c.id_concepto}-quitar`}
                  onClick={() => setBorrar(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </>
            )}
          </li>
        ))}
        {l.conceptos.length === 0 && <li className="py-2 text-sm text-muted-foreground">Sin conceptos.</li>}
      </ul>
      {editable && (
        <form onSubmit={guardar} className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_140px]" data-testid="concepto-form">
          <Input placeholder="Descripción (ej. Trabajo de plomería)" value={f.descripcion} onChange={set("descripcion")} data-testid="concepto-descripcion-input" />
          <div>
            <Input type="text" inputMode="decimal" placeholder="Monto" value={f.monto} onChange={set("monto")}
              className={montoInvalido ? "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500" : ""}
              data-testid="concepto-monto-input" />
            {montoInvalido && <p className="mt-1 text-xs font-medium text-red-600" data-testid="concepto-monto-error">Solo números válidos (sin letras)</p>}
          </div>
          <SelectSimple value={f.tipo} onChange={set("tipo")} opciones={[["adicional", "Adicional"], ["descuento", "Descuento"]]} testId="concepto-tipo-select" />
          <Input className="sm:col-span-2" placeholder={usd ? "Observación (ej. tipo de cambio usado)" : "Observación (opcional)"} value={f.observacion}
            onChange={set("observacion")} data-testid="concepto-observacion-input" />
          <Button type="submit" disabled={enviando || montoInvalido} data-testid="concepto-guardar-button"><Plus className="mr-1 h-4 w-4" />{editId ? "Guardar" : "Agregar"}</Button>
        </form>
      )}
      <ConfirmDialog open={!!borrar} onOpenChange={() => setBorrar(null)} destructivo confirmar="Quitar" testId="concepto-quitar-dialog"
        titulo={`¿Quitar "${borrar?.descripcion}"?`} descripcion="Se recalcula el total del borrador."
        onConfirm={() => accion(async () => {
          if (antesDeGuardar) await antesDeGuardar();
          onCambio((await api.delete(`/liquidaciones/${l.id}/conceptos/${borrar.id_concepto}`)).data);
        }, "Concepto quitado")} />
    </section>
  );
};
