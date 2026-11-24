import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError } from "@/components/EstadoVacio";
import { useApi } from "@/hooks/useApi";
import { invalidarCatalogos } from "@/hooks/useCatalogos";
import { fmtNumero } from "@/lib/format";
import CatalogoEditable from "./CatalogoEditable";

const GRUPOS = [
  ["estados_pago", "Estados de pago"], ["estados_liquidacion", "Estados de liquidación"],
  ["estados_servicios", "Estados de servicios"], ["estados_contrato", "Estados de contrato"],
  ["estados_propiedad", "Estados de propiedad"],
];

const ReglasMora = ({ reglas }) => (
  <div className="overflow-hidden rounded-lg border bg-card">
    <div className="border-b px-5 py-4">
      <h3 className="text-base font-semibold">Reglas de mora</h3>
      <p className="mt-1 text-xs text-muted-foreground">Solo lectura. La mora se aplica sobre el total de la liquidación (alquiler + servicios + conceptos); los días se cuentan desde el día 1 del mes de la liquidación.</p>
    </div>
    <Table data-testid="reglas-mora-table">
      <TableHeader className="bg-muted/60">
        <TableRow>
          <TableHead>Rango</TableHead><TableHead className="text-right">Días desde</TableHead>
          <TableHead className="text-right">Días hasta</TableHead><TableHead className="text-right">% mora</TableHead>
          <TableHead className="hidden md:table-cell">Descripción</TableHead><TableHead>Activa</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reglas.map((r) => (
          <TableRow key={r.id_regla} data-testid={`regla-mora-${r.id_regla}`}>
            <TableCell className="py-2 font-mono text-[13px]">{r.rango}</TableCell>
            <TableCell className="py-2 text-right num">{r.dias_desde}</TableCell>
            <TableCell className="py-2 text-right num">{r.dias_hasta}</TableCell>
            <TableCell className="py-2 text-right num font-medium">{fmtNumero(r.porcentaje_mora)} %</TableCell>
            <TableCell className="hidden py-2 text-muted-foreground md:table-cell">{r.descripcion || "—"}</TableCell>
            <TableCell className="py-2"><StatusBadge nombre={r.activo ? "activa" : "inactiva"} variante={r.activo ? "verde" : "gris"} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const Lista = ({ titulo, items }) => (
  <div className="rounded-lg border bg-card p-5" data-testid={`catalogo-${titulo}`}>
    <p className="label-caps mb-3">{titulo}</p>
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => <span key={i.id} className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground num">{i.id}</span><StatusBadge nombre={i.nombre} /></span>)}
    </div>
  </div>
);

export default function Catalogos() {
  const { data, error, recargar } = useApi("/catalogos");
  const ciudades = useApi("/catalogos/ciudades");
  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!data || !ciudades.data) return <Skeleton className="h-64" />;
  const cambio = () => { invalidarCatalogos(); recargar(); ciudades.recargar(); };
  return (
    <div className="space-y-8 fade-up">
      <ReglasMora reglas={data.reglas_mora} />
      <div>
        <h3 className="text-base font-semibold">Estados</h3>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">Solo lectura: los usa la lógica del sistema y las automatizaciones.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GRUPOS.map(([k, t]) => <Lista key={k} titulo={t} items={data[k]} badges />)}
        </div>
      </div>
      <div>
        <h3 className="text-base font-semibold">Tipos y ubicaciones</h3>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">Editables. Un registro en uso (por ejemplo, una ciudad con personas cargadas) no se puede eliminar.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CatalogoEditable titulo="Tipos de propiedad" catalogo="tipos_propiedad" items={data.tipos_propiedad} onCambio={cambio} />
          <CatalogoEditable titulo="Barrios" catalogo="barrios" items={data.barrios} onCambio={cambio} />
          <CatalogoEditable titulo="Provincias" catalogo="provincias" items={data.provincias} onCambio={cambio} />
          <CatalogoEditable titulo="Ciudades" catalogo="ciudades" items={ciudades.data} provincias={data.provincias} onCambio={cambio} />
        </div>
      </div>
    </div>
  );
}
