import { useState } from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError } from "@/components/EstadoVacio";
import { MesSelector, useMes } from "@/components/MesSelector";
import { useApi } from "@/hooks/useApi";
import { fmtFecha, fmtMes, fmtMoneda, fmtNumero, nombresAgrupados } from "@/lib/format";
import { direccion } from "@/lib/propiedades";
import PagoPropietarioDialog from "./PagoPropietarioDialog";

const comunes = [
  { key: "mes_año", label: "Mes", className: "whitespace-nowrap", render: (f) => fmtMes(f["mes_año"]) },
  { key: "propietarios", label: "Propietarios", ordenar: (f) => nombresAgrupados(f.propietarios), render: (f) => <span className="font-medium">{nombresAgrupados(f.propietarios) || "—"}</span> },
  { key: "calle", label: "Propiedad", className: "hidden lg:table-cell", ordenar: direccion, render: (f) => <div><p>{direccion(f)}</p><p className="text-xs text-muted-foreground">Contrato #{f.id_contrato}</p></div> },
  { key: "alquiler", label: "Alquiler", className: "text-right num whitespace-nowrap", render: (f) => fmtMoneda(f.alquiler, f.moneda) },
];
const pct = (v) => (v != null ? `${fmtNumero(v)} %` : "—");

const colPendientes = (onPagar) => [
  ...comunes,
  { key: "porcentaje_honorarios", label: "% honorarios", className: "text-right num", render: (f) => pct(f.porcentaje_honorarios) },
  { key: "honorarios", label: "Retenido", className: "text-right num whitespace-nowrap", render: (f) => fmtMoneda(f.honorarios, f.moneda) },
  { key: "neto", label: "Neto a pagar", className: "text-right num font-semibold whitespace-nowrap", render: (f) => fmtMoneda(f.neto, f.moneda) },
  { key: "fecha_cobro", label: "Cobrado el", className: "hidden md:table-cell num", render: (f) => fmtFecha(f.fecha_cobro) },
  { key: "acciones", label: "", ordenable: false, render: (f) => (
    <Button size="sm" onClick={() => onPagar(f)} data-testid={`pp-pagar-${f.id}`}><HandCoins className="mr-1.5 h-4 w-4" />Registrar pago</Button>
  ) },
];

const colHistorial = [
  { key: "fecha_pago", label: "Pagado el", className: "num whitespace-nowrap", render: (f) => fmtFecha(f.fecha_pago) },
  ...comunes,
  { key: "porcentaje_honorarios_aplicado", label: "% aplicado", className: "text-right num", render: (f) => pct(f.porcentaje_honorarios_aplicado) },
  { key: "honorarios", label: "Honorarios", className: "text-right num whitespace-nowrap", render: (f) => fmtMoneda(f.honorarios, f.moneda) },
  { key: "monto_neto", label: "Neto pagado", className: "text-right num font-semibold whitespace-nowrap", render: (f) => fmtMoneda(f.monto_neto, f.moneda) },
  { key: "estado", label: "Estado", render: (f) => <StatusBadge nombre={f.estado} /> },
];

const Totales = ({ filas, campos, testId }) => {
  const t = {};
  filas.forEach((f) => { t[f.moneda] = t[f.moneda] || { n: 0 }; t[f.moneda].n += 1; campos.forEach(([k]) => { t[f.moneda][k] = (t[f.moneda][k] || 0) + Number(f[k] || 0); }); });
  return (
    <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid={testId}>
      {Object.entries(t).map(([m, v]) => (
        <div key={m} className="rounded-lg border bg-card p-4" data-testid={`${testId}-${m}`}>
          <p className="label-caps">{m} · {v.n} pagos</p>
          {campos.map(([k, l]) => <p key={k} className="mt-1 text-sm"><span className="text-muted-foreground">{l}: </span><span className="num font-semibold">{fmtMoneda(v[k], m)}</span></p>)}
        </div>
      ))}
    </div>
  );
};

const Pendientes = ({ onPagar, datos }) => {
  const { data, error, recargar } = datos;
  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!data) return <Skeleton className="h-64" />;
  return (
    <>
      <Totales filas={data} campos={[["neto", "Neto a pagar"], ["honorarios", "Honorarios a retener"]]} testId="pp-totales-pendientes" />
      <DataTable testId="pp-pendientes-table" columnas={colPendientes(onPagar)} filas={data} ordenInicial={{ key: "mes_año", dir: "asc" }}
        buscar={(f) => `${nombresAgrupados(f.propietarios)} ${nombresAgrupados(f.inquilinos)} ${direccion(f)}`} placeholder="Buscar por propietario, inquilino o dirección"
        vacio="No hay pagos pendientes: todas las liquidaciones cobradas ya se pagaron al propietario." />
    </>
  );
};

const Historial = () => {
  const [mes, setMes] = useMes();
  const { data, error, recargar } = useApi(`/pagos-propietarios/historial?mes=${mes}`);
  return (
    <>
      <div className="mb-4 flex items-center gap-3"><MesSelector mes={mes} onChange={setMes} /><span className="text-xs text-muted-foreground">Según la fecha de pago al propietario</span></div>
      {error && <EstadoError mensaje={error} onReintentar={recargar} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && (
        <>
          <Totales filas={data} campos={[["monto_neto", "Neto pagado"], ["honorarios", "Honorarios"]]} testId="pp-totales-historial" />
          <DataTable testId="pp-historial-table" columnas={colHistorial} filas={data} ordenInicial={{ key: "fecha_pago", dir: "desc" }}
            buscar={(f) => `${nombresAgrupados(f.propietarios)} ${direccion(f)}`} placeholder="Buscar por propietario o dirección"
            vacio={`No hay pagos a propietarios en ${fmtMes(mes)}.`} />
        </>
      )}
    </>
  );
};

export default function PagosPropietariosPage() {
  const pendientes = useApi("/pagos-propietarios/pendientes");
  const [pagando, setPagando] = useState(null);
  const [tab, setTab] = useState("pendientes");
  return (
    <div>
      <PageHeader eyebrow="Gestión mensual" titulo="Pagos a propietarios"
        descripcion="Liquidaciones ya cobradas al inquilino. Neto = alquiler − honorarios (los honorarios se calculan solo sobre el alquiler)." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6" data-testid="pp-tabs">
          <TabsTrigger value="pendientes" data-testid="pp-tab-pendientes">Pendientes{pendientes.data ? ` (${pendientes.data.length})` : ""}</TabsTrigger>
          <TabsTrigger value="historial" data-testid="pp-tab-historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="pendientes"><Pendientes datos={pendientes} onPagar={setPagando} /></TabsContent>
        <TabsContent value="historial">{tab === "historial" && <Historial />}</TabsContent>
      </Tabs>
      {pagando && <PagoPropietarioDialog item={pagando} onClose={() => setPagando(null)} onPagado={() => { setPagando(null); pendientes.recargar(); }} />}
    </div>
  );
}
