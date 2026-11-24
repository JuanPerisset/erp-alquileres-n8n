import { CheckCircle2, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError } from "@/components/EstadoVacio";
import { useApi } from "@/hooks/useApi";

const ORIGEN = { ddl: ["Script original", "azul"], app: ["Nueva (app_)", "amarillo"], otra: ["Otra", "gris"] };

const Resumen = ({ d }) => {
  const ok = d.faltantes.length === 0 && d.columnas_especiales.every((c) => c.existe);
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className={`mb-6 flex gap-3 rounded-lg border p-4 text-sm ${ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}
      data-testid="tablas-resumen">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">
          {ok ? `Las ${d.esperadas} tablas del script existen con su nombre exacto (base ${d.base}).`
            : `Faltan tablas: ${d.faltantes.join(", ")}`}
        </p>
        <p className="mt-1 opacity-80">
          Columnas especiales verificadas: {d.columnas_especiales.map((c) => `${c.tabla}.${c.columna} ${c.existe ? "✓" : "✗"}`).join(" · ")}.
          Las únicas tablas agregadas por la app llevan prefijo app_.
        </p>
      </div>
    </div>
  );
};

export default function TablasBD() {
  const { data, error, recargar } = useApi("/sistema/tablas");
  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!data) return <Skeleton className="h-64" />;
  return (
    <div className="fade-up">
      <Resumen d={data} />
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table data-testid="tablas-table">
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead>Tabla</TableHead><TableHead>Origen</TableHead>
              <TableHead className="text-right">Columnas</TableHead><TableHead className="text-right">Filas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.tablas.map((t) => (
              <TableRow key={t.tabla} className="hover:bg-muted/40" data-testid={`tabla-row-${t.tabla}`}>
                <TableCell className="py-2 font-mono text-[13px]">{t.tabla}</TableCell>
                <TableCell className="py-2"><StatusBadge nombre={ORIGEN[t.origen][0]} variante={ORIGEN[t.origen][1]} className="normal-case" /></TableCell>
                <TableCell className="py-2 text-right num">{t.columnas}</TableCell>
                <TableCell className="py-2 text-right num">{t.filas}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
