import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Archive, CheckCircle2, Database, HardDriveDownload, Loader2, PlugZap, ShieldCheck, XCircle } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { EstadoError } from "@/components/EstadoVacio";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fmtFechaHora } from "@/lib/format";

const Dato = ({ label, valor, mono = true, testId }) => (
  <div data-testid={testId}>
    <p className="label-caps text-[11px]">{label}</p>
    <p className={`mt-0.5 text-sm ${mono ? "font-mono text-[13px]" : ""}`}>{valor ?? "—"}</p>
  </div>
);

const Semaforo = ({ ok, texto }) => (
  <div className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${ok ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>
    {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
    <span>{texto}</span>
  </div>
);

const fmtTamanio = (b) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
const fmtEpoch = (s) => fmtFechaHora(new Date(s * 1000).toISOString());

const Backups = () => {
  const { data, error, recargar } = useApi("/sistema/backups");
  const [generando, setGenerando] = useState(false);
  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!data) return <Skeleton className="h-32" />;
  const generar = async () => {
    setGenerando(true);
    try { await api.post("/sistema/backups"); toast.success("Backup generado"); recargar(); }
    catch (e) { toast.error(apiError(e)); }
    finally { setGenerando(false); }
  };
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <Archive className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-base font-semibold">Backups de la base</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium num" data-testid="op-backups-count">
          {data.backups.length}
        </span>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-xs text-muted-foreground">
          Volcado automático diario a las 03:00 (Argentina) a <span className="font-mono">{data.directorio}</span>.
          Se conservan los últimos 7. Restaurar con <span className="font-mono">bash /app/scripts/restore_test_db.sh ARCHIVO</span>.
        </p>
        <Button variant="outline" onClick={generar} disabled={generando} data-testid="op-backup-generar">
          {generando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDriveDownload className="mr-2 h-4 w-4" />}
          Generar backup ahora
        </Button>
        {data.backups.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="op-backups-vacio">Todavía no hay backups.</p>
        ) : (
          <ul className="divide-y rounded-md border bg-muted/30" data-testid="op-backups-lista">
            {data.backups.map((b) => (
              <li key={b.archivo} className="flex items-center gap-3 px-3 py-2 text-sm" data-testid={`op-backup-${b.archivo}`}>
                <span className="flex-1 truncate font-mono text-[13px]">{b.archivo}</span>
                <span className="text-xs text-muted-foreground">{fmtEpoch(b.fecha)}</span>
                <span className="num w-20 text-right text-xs font-medium">{fmtTamanio(b.tamanio_bytes)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default function Operacion() {
  const { data, error, recargar } = useApi("/sistema/operacion");
  const [pingando, setPingando] = useState(false);
  const [ping, setPing] = useState(null);

  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!data) return <Skeleton className="h-64" />;

  const { base, n8n } = data;

  const probar = async () => {
    setPingando(true); setPing(null);
    try {
      const r = await api.post("/sistema/n8n/ping");
      setPing({ ok: r.data.ok, mensaje: r.data.detalle || `Respuesta ${r.data.codigo} de ${r.data.url}` });
      if (r.data.ok) toast.success("Conexión con n8n OK");
    } catch (e) {
      setPing({ ok: false, mensaje: apiError(e) });
      toast.error("No se pudo conectar con n8n");
    } finally { setPingando(false); }
  };

  return (
    <div className="space-y-6 fade-up">
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">Base de datos</h3>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${base.ddl_completo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
            data-testid="op-base-badge">
            {base.ddl_completo ? "DDL completo" : `Faltan ${base.faltantes.length}`}
          </span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Dato testId="op-base-nombre" label="Base" valor={base.nombre} />
          <Dato testId="op-base-host" label="Host" valor={`${base.host_configurado}:${base.puerto}`} />
          <Dato testId="op-base-usuario" label="Usuario" valor={base.usuario} />
          <Dato testId="op-base-servidor" label="Servidor" valor={base.servidor} />
          <Dato testId="op-base-ssl" label="SSL" valor={base.ssl ? "require" : "deshabilitado"} />
          <Dato testId="op-base-ddl" label="Tablas del script" valor={base.ddl_completo ? "25/25 OK" : base.faltantes.join(", ")} />
        </div>
        <div className="border-t px-5 py-3 text-xs text-muted-foreground">
          Para pasar a producción: cambiar <span className="font-mono">DATABASE_URL</span> en <span className="font-mono">backend/.env</span> y reiniciar el backend.
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <PlugZap className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">Webhooks de n8n</h3>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${n8n.modo === "real" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
            data-testid="op-n8n-modo-badge">
            Modo: {n8n.modo}
          </span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Dato testId="op-n8n-base" label="N8N_BASE_URL" valor={n8n.base_url} />
          <Dato testId="op-n8n-secreto" label="Secreto configurado" valor={n8n.secreto_configurado ? "Sí" : "No"} />
        </div>
        <div className="space-y-3 border-t px-5 py-4">
          {n8n.modo === "simulador" ? (
            <Semaforo ok={false} texto="Estás usando el simulador local. Para producción: setear N8N_MODO=real y configurar N8N_BASE_URL + N8N_WEBHOOK_SECRET." />
          ) : (
            <Semaforo ok={n8n.listo_para_produccion}
              texto={n8n.listo_para_produccion
                ? "Listo para producción: modo real, secreto configurado y base URL propia."
                : "Modo real activo, pero falta configurar N8N_BASE_URL propio y/o N8N_WEBHOOK_SECRET real."} />
          )}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={probar} disabled={pingando} data-testid="op-n8n-probar">
              {pingando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Probar conexión
            </Button>
            {ping && (
              <span className={`flex items-center gap-1 text-sm ${ping.ok ? "text-green-800" : "text-red-800"}`} data-testid="op-n8n-ping-result">
                {ping.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{ping.mensaje}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Cuando pases a producción, los errores de n8n se devuelven como <span className="font-mono">424 Failed Dependency</span> con mensaje legible.
            Nunca <span className="font-mono">502</span> (el ingress los reemplaza por HTML).
          </p>
        </div>
      </section>

      <Backups />
    </div>
  );
}
