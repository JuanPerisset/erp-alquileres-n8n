import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FilePlus2, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError } from "@/components/EstadoVacio";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MesSelector, useMes } from "@/components/MesSelector";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { accion } from "@/lib/acciones";
import { fmtMes, fmtMoneda, nombresAgrupados } from "@/lib/format";
import { direccion } from "@/lib/propiedades";
import { esMoroso, pagoPendiente, totalesPorMoneda } from "@/lib/liquidaciones";
import CobroDialog from "./CobroDialog";

const EstadoPago = ({ l }) => {
  if (!l.estado_pago) return <span className="text-xs text-muted-foreground">{l.estado_liquidacion?.toLowerCase() === "confirmada" ? "Sin notificar" : "—"}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      <StatusBadge nombre={l.estado_pago} testId={`liq-${l.id}-estado-pago`} />
      {esMoroso(l) && <StatusBadge nombre="moroso" testId={`liq-${l.id}-moroso`} />}
    </div>
  );
};

const columnas = (onCobrar) => [
  { key: "id_contrato", label: "Contrato", className: "num", render: (l) => `#${l.id_contrato}` },
  { key: "inquilinos", label: "Inquilinos", ordenar: (l) => nombresAgrupados(l.inquilinos), render: (l) => <span className="font-medium">{nombresAgrupados(l.inquilinos)}</span> },
  { key: "calle", label: "Propiedad", className: "hidden lg:table-cell", ordenar: direccion, render: direccion },
  { key: "alquiler", label: "Alquiler", className: "text-right num whitespace-nowrap", render: (l) => fmtMoneda(l.alquiler, l.moneda) },
  { key: "servicios", label: "Servicios", className: "hidden md:table-cell text-right num whitespace-nowrap", render: (l) => fmtMoneda(l.servicios, l.moneda) },
  { key: "ajustes", label: "Ajustes", className: "hidden md:table-cell text-right num whitespace-nowrap", ordenar: (l) => l.adicionales - l.descuentos,
    render: (l) => fmtMoneda(l.adicionales - l.descuentos, l.moneda) },
  { key: "total", label: "Total", className: "text-right num font-semibold whitespace-nowrap", render: (l) => fmtMoneda(l.total, l.moneda) },
  { key: "estado_liquidacion", label: "Liquidación", render: (l) => <StatusBadge nombre={l.estado_liquidacion} testId={`liq-${l.id}-estado`} /> },
  { key: "estado_pago", label: "Pago", render: (l) => <EstadoPago l={l} /> },
  { key: "acciones", label: "", ordenable: false, render: (l) => pagoPendiente(l) && (
    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onCobrar(l); }} data-testid={`liq-${l.id}-cobrar`}>
      <Wallet className="mr-1.5 h-4 w-4" />Cobrar
    </Button>
  ) },
];

const Totales = ({ filas }) => (
  <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="liq-totales">
    {Object.entries(totalesPorMoneda(filas)).map(([m, t]) => (
      <div key={m} className="rounded-lg border bg-card p-4" data-testid={`liq-total-${m}`}>
        <p className="label-caps">Total liquidado {m}</p>
        <p className="mt-2 font-display text-2xl font-bold num">{fmtMoneda(t.total, m)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.cantidad} liquidaciones · cobrado {fmtMoneda(t.cobrado, m)}</p>
      </div>
    ))}
  </div>
);

export default function LiquidacionesPage() {
  const navigate = useNavigate();
  const [mes, setMes] = useMes();
  const { data, error, recargar } = useApi(`/liquidaciones?mes=${mes}`);
  const [dialogo, setDialogo] = useState(null);
  const [cobrando, setCobrando] = useState(null);
  const borradores = useMemo(() => (data || []).filter((l) => l.estado_liquidacion?.toLowerCase() === "borrador").length, [data]);
  const sinNotificar = useMemo(() => (data || []).filter((l) => l.estado_liquidacion?.toLowerCase() === "confirmada" && !l.id_pago_inquilino).length, [data]);

  const generar = () => accion(async () => {
    const r = await api.post("/liquidaciones/generar", { "mes_año": mes });
    if (r.data.creadas === 0) throw Object.assign(new Error(), { response: { data: { detail: "No había contratos activos sin liquidación en este mes." } } });
  }, "Borradores generados", recargar);
  const confirmarBorradores = () => accion(async () => {
    await api.post("/liquidaciones/confirmar-borradores", { "mes_año": mes });
  }, "Borradores confirmados", recargar);
  const notificar = () => accion(() => api.post("/liquidaciones/notificar", { "mes_año": mes }), "Notificación enviada a n8n", recargar);

  return (
    <div>
      <PageHeader eyebrow="Gestión mensual" titulo="Liquidaciones" descripcion="Generá, completá y confirmá las liquidaciones del mes; después notificá y registrá los cobros.">
        <MesSelector mes={mes} onChange={setMes} />
        <Button variant="outline" onClick={() => setDialogo("generar")} data-testid="liq-generar-button"><FilePlus2 className="mr-1.5 h-4 w-4" />Generar borradores</Button>
        <Button variant="outline" onClick={() => setDialogo("confirmar_todos")} disabled={!borradores} data-testid="liq-confirmar-todos-button"><CheckCircle2 className="mr-1.5 h-4 w-4" />Confirmar borradores ({borradores})</Button>
        <Button onClick={() => setDialogo("notificar")} disabled={!sinNotificar} data-testid="liq-notificar-button"><Send className="mr-1.5 h-4 w-4" />Notificar confirmadas ({sinNotificar})</Button>
      </PageHeader>
      {error && <EstadoError mensaje={error} onReintentar={recargar} />}
      {!data && !error && <Skeleton className="h-80" />}
      {data && (
        <>
          <Totales filas={data} />
          <DataTable testId="liq-table" columnas={columnas(setCobrando)} filas={data} onFila={(l) => navigate(`/liquidaciones/${l.id}`)}
            ordenInicial={{ key: "id_contrato", dir: "asc" }} placeholder="Buscar por inquilino, dirección o contrato"
            buscar={(l) => `${nombresAgrupados(l.inquilinos)} ${direccion(l)} #${l.id_contrato}`}
            vacio={`No hay liquidaciones en ${fmtMes(mes)}. Usá "Generar borradores".`} />
        </>
      )}
      <ConfirmDialog open={dialogo === "generar"} onOpenChange={() => setDialogo(null)} testId="liq-generar-dialog" confirmar="Generar"
        titulo={`¿Generar borradores de ${fmtMes(mes)}?`} onConfirm={generar}
        descripcion="Se crea un borrador por cada contrato activo que todavía no tenga liquidación este mes, con el alquiler actual del contrato. No se duplican." />
      <ConfirmDialog open={dialogo === "confirmar_todos"} onOpenChange={() => setDialogo(null)} testId="liq-confirmar-todos-dialog" confirmar="Confirmar todas"
        titulo={`¿Confirmar los ${borradores} borradores de ${fmtMes(mes)}?`} onConfirm={confirmarBorradores}
        descripcion="Pasan todas las liquidaciones en borrador de este mes a estado Confirmada para que puedas notificarlas juntas." />
      <ConfirmDialog open={dialogo === "notificar"} onOpenChange={() => setDialogo(null)} testId="liq-notificar-dialog" confirmar="Notificar"
        titulo={`¿Notificar las ${sinNotificar} liquidaciones confirmadas de ${fmtMes(mes)}?`} onConfirm={notificar}
        descripcion="n8n envía el detalle a los inquilinos y deja el pago en estado pendiente. Se notifican las confirmadas sin pago registrado." />
      {cobrando && <CobroDialog liquidacion={cobrando} onClose={() => setCobrando(null)} onCobrado={() => { setCobrando(null); recargar(); }} />}
    </div>
  );
}
