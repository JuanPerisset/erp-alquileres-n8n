import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EstadoError } from "@/components/EstadoVacio";
import { SelectSimple } from "@/components/form/Campo";
import { useApi } from "@/hooks/useApi";
import { nombresAgrupados } from "@/lib/format";
import { direccion } from "@/lib/propiedades";
import { APROBADO, aprobadoClave, colHistorial, colTelegram, colVencidas } from "./columnas";
import { EjecutarActualizacion } from "./EjecutarActualizacion";

const buscar = (f) => `${f.id_contrato} ${nombresAgrupados(f.inquilinos)} ${direccion(f)} ${f.mensaje || ""}`;
const OPCIONES_APROBADO = [["todos", "Aprobado: todos"], ...Object.entries(APROBADO).map(([k, [t]]) => [k, `Aprobado: ${t}`])];

const Contenido = ({ datos, children }) => {
  if (datos.error) return <EstadoError mensaje={datos.error} onReintentar={datos.recargar} />;
  if (!datos.data) return <Skeleton className="h-64" />;
  return children(datos.data);
};

const ConFiltroAprobado = ({ filas, testId, columnas, vacio }) => {
  const [ap, setAp] = useState("todos");
  return (
    <DataTable testId={testId} columnas={columnas} filas={ap === "todos" ? filas : filas.filter((f) => aprobadoClave(f.aprobado) === ap)}
      buscar={buscar} placeholder="Buscar por contrato, inquilino o dirección" vacio={vacio}
      filtros={<SelectSimple value={ap} onChange={setAp} opciones={OPCIONES_APROBADO} className="w-48" testId={`${testId}-filtro-aprobado`} />} />
  );
};

export default function ActualizacionesPage() {
  const navigate = useNavigate();
  const vencidas = useApi("/actualizaciones/vencidas");
  const historial = useApi("/actualizaciones/historial");
  const telegram = useApi("/actualizaciones/comunicaciones");
  const recargar = () => { vencidas.recargar(); historial.recargar(); telegram.recargar(); };

  return (
    <div>
      <PageHeader eyebrow="Cartera" titulo="Actualizaciones de alquiler"
        descripcion="Contratos activos cuya próxima actualización ya pasó. El cálculo y la aprobación los hace n8n (flujo A, Telegram); acá solo se consulta.">
        <EjecutarActualizacion vencidas={vencidas.data} onEjecutado={recargar} />
      </PageHeader>
      <Tabs defaultValue="vencidas">
        <TabsList className="mb-6" data-testid="act-tabs">
          <TabsTrigger value="vencidas" data-testid="act-tab-vencidas">Vencidas{vencidas.data ? ` (${vencidas.data.length})` : ""}</TabsTrigger>
          <TabsTrigger value="historial" data-testid="act-tab-historial">Historial</TabsTrigger>
          <TabsTrigger value="telegram" data-testid="act-tab-telegram">Comunicaciones (Telegram)</TabsTrigger>
        </TabsList>
        <TabsContent value="vencidas">
          <Contenido datos={vencidas}>{(filas) => (
            <DataTable testId="act-vencidas-table" columnas={colVencidas} filas={filas} buscar={buscar} placeholder="Buscar por contrato, inquilino o dirección"
              onFila={(f) => navigate(`/contratos/${f.id_contrato}`)} vacio="No hay contratos con la actualización vencida." />
          )}</Contenido>
        </TabsContent>
        <TabsContent value="historial">
          <Contenido datos={historial}>{(filas) => (
            <ConFiltroAprobado testId="act-historial-table" columnas={colHistorial} filas={filas} vacio="Sin actualizaciones registradas." />
          )}</Contenido>
        </TabsContent>
        <TabsContent value="telegram">
          <Contenido datos={telegram}>{(filas) => (
            <ConFiltroAprobado testId="act-telegram-table" columnas={colTelegram} filas={filas} vacio="Sin comunicaciones registradas." />
          )}</Contenido>
        </TabsContent>
      </Tabs>
    </div>
  );
}
