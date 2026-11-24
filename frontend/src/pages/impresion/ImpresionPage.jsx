import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError } from "@/components/EstadoVacio";
import { MesSelector, useMes } from "@/components/MesSelector";
import { useApi } from "@/hooks/useApi";
import { api, apiError } from "@/lib/api";
import { fmtMes, fmtMoneda, nombresAgrupados } from "@/lib/format";
import { direccion } from "@/lib/propiedades";

const bajar = (url, nombre) => { const a = document.createElement("a"); a.href = url; a.download = nombre; a.click(); };

async function errorDeBlob(e) {
  const d = e?.response?.data;
  if (d instanceof Blob) { try { e.response.data = JSON.parse(await d.text()); } catch { /* respuesta no JSON */ } }
  return apiError(e, "No se pudo generar el PDF.");
}

const Resumen = ({ mes }) => {
  const { data, error, recargar } = useApi(`/impresion/resumen?mes=${mes}`);
  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!data) return <Skeleton className="h-16" />;
  if (!data.length) return <p className="text-sm text-muted-foreground" data-testid="imp-resumen-vacio">No hay liquidaciones generadas en {fmtMes(mes)}.</p>;
  return (
    <div className="flex flex-wrap gap-2" data-testid="imp-resumen">
      {data.map((r) => (
        <div key={`${r.estado}-${r.moneda}`} className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm">
          <StatusBadge nombre={r.estado} /><span className="num font-semibold">{r.cantidad}</span><span className="text-muted-foreground">{r.moneda}</span>
        </div>
      ))}
    </div>
  );
};

export default function ImpresionPage() {
  const [mes, setMes] = useMes();
  const [idLiq, setIdLiq] = useState("");
  const { data: liqs } = useApi(`/liquidaciones?mes=${mes}`);
  const [estado, setEstado] = useState({ cargando: false, error: "", pdf: null });

  useEffect(() => () => estado.pdf && URL.revokeObjectURL(estado.pdf.url), [estado.pdf]);
  useEffect(() => { setIdLiq(""); setEstado((s) => ({ ...s, error: "", pdf: null })); }, [mes]);

  const generar = async (idIndividual = null) => {
    if (estado.cargando) return;
    setEstado({ cargando: true, error: "", pdf: null });
    try {
      const payload = { mes_impresion: mes };
      if (idIndividual) payload.id_liquidacion = Number(idIndividual);
      const r = await api.post("/impresion/pdf", payload, { responseType: "blob" });
      const sufijo = idIndividual ? `-liq-${idIndividual}` : "";
      const pdf = { url: URL.createObjectURL(r.data), nombre: `comprobantes-${mes.slice(0, 7)}${sufijo}.pdf`, kb: Math.round(r.data.size / 1024), mes };
      bajar(pdf.url, pdf.nombre);
      setEstado({ cargando: false, error: "", pdf });
    } catch (e) {
      setEstado({ cargando: false, error: await errorDeBlob(e), pdf: null });
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Gestión mensual" titulo="Centro de impresión"
        descripcion="Genera el PDF consolidado de todo el mes o de un contrato particular (A4, 2 recibos por hoja) con el flujo E de n8n." />
      <div className="max-w-3xl space-y-6 rounded-lg border bg-card p-6" data-testid="imp-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <MesSelector mes={mes} onChange={setMes} />
          <Button onClick={() => generar(null)} disabled={estado.cargando} data-testid="imp-generar-btn">
            {estado.cargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            {estado.cargando ? "Generando PDF…" : "Imprimir todo el mes"}
          </Button>
        </div>
        <div><p className="label-caps mb-2">Liquidaciones de {fmtMes(mes)}</p><Resumen mes={mes} /></div>
        {liqs && liqs.length > 0 && (
          <div className="border-t pt-4">
            <p className="label-caps mb-2">Imprimir un comprobante particular</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={idLiq}
                onChange={(e) => setIdLiq(e.target.value)}
                data-testid="imp-select-individual"
              >
                <option value="">Elegí un contrato / inquilino de {fmtMes(mes)}…</option>
                {liqs.map((l) => (
                  <option key={l.id} value={l.id}>
                    Contrato #{l.id_contrato} · {nombresAgrupados(l.inquilinos)} · {direccion(l)} ({fmtMoneda(l.total, l.moneda)} — {l.estado_liquidacion})
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => generar(idLiq)} disabled={!idLiq || estado.cargando} data-testid="imp-generar-individual-btn">
                <Printer className="mr-2 h-4 w-4" />Imprimir individual
              </Button>
            </div>
          </div>
        )}
        {estado.cargando && <p className="text-sm text-muted-foreground" data-testid="imp-cargando">Esperando el PDF de n8n. Puede tardar unos segundos…</p>}
        {estado.error && <EstadoError mensaje={estado.error} onReintentar={() => generar(idLiq || null)} />}
        {estado.pdf && (
          <div className="flex flex-col gap-3 rounded-md border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center" data-testid="imp-listo">
            <FileText className="h-5 w-5 shrink-0 text-green-700" />
            <div className="flex-1 text-sm"><p className="font-medium text-green-900">{estado.pdf.nombre}</p><p className="text-green-800">PDF de {fmtMes(estado.pdf.mes)} · <span className="num">{estado.pdf.kb}</span> KB · ya se descargó</p></div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => bajar(estado.pdf.url, estado.pdf.nombre)} data-testid="imp-descargar-otra-vez"><Download className="mr-1.5 h-4 w-4" />Descargar</Button>
              <Button size="sm" variant="outline" onClick={() => window.open(estado.pdf.url, "_blank")} data-testid="imp-abrir"><ExternalLink className="mr-1.5 h-4 w-4" />Abrir</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
