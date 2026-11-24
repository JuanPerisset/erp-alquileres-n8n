import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Printer, RefreshCw, Save, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError } from "@/components/EstadoVacio";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Campo } from "@/components/form/Campo";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { accion } from "@/lib/acciones";
import { fmtMes, fmtMoneda, nombresAgrupados } from "@/lib/format";
import { direccion } from "@/lib/propiedades";
import { SERVICIOS, esBorrador, pagoPendiente } from "@/lib/liquidaciones";
import { Desglose } from "./Desglose";
import { Conceptos } from "./Conceptos";
import { PagoInquilino, PagoPropietario } from "./Pagos";
import CobroDialog from "./CobroDialog";

const NUM_SERV_VALIDO = /^\d+(?:[.,]\d{1,2})?$/;
const esValorServValido = (v) => {
  const s = String(v ?? "").trim();
  return s === "" || NUM_SERV_VALIDO.test(s);
};
const normalizarNumServ = (v) => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (s === "" || !NUM_SERV_VALIDO.test(String(v ?? "").trim())) return null;
  return Number(s);
};

const servDe = (l) => Object.fromEntries(SERVICIOS.map(([k]) => [k, l?.servicios_detalle?.[k] ?? ""]));

const BarraNavegacionContratos = ({ l, onIr, guardando }) => {
  if (!l || (!l.anterior_id && !l.siguiente_id)) return null;
  return (
    <div className="flex items-center gap-2" data-testid="liq-nav-contratos">
      <Button
        variant="outline"
        size="sm"
        disabled={!l.anterior_id || guardando}
        onClick={() => onIr(l.anterior_id)}
        data-testid="liq-anterior-button"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Anterior
      </Button>
      {l.posicion_mes && l.total_mes && (
        <span className="px-2 text-xs font-medium text-muted-foreground num" data-testid="liq-posicion-mes">
          {l.posicion_mes} de {l.total_mes}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={!l.siguiente_id || guardando}
        onClick={() => onIr(l.siguiente_id)}
        data-testid="liq-siguiente-button"
      >
        Siguiente
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
};

const Servicios = ({ serv, setServ, editable, moneda, onBlurCampo, estadoGuardado, erroresServ, codigos }) => (
  <section className="rounded-lg border bg-card p-5" data-testid="servicios">
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="label-caps">Servicios del mes ({moneda})</h2>
      {editable && (
        <span className="text-xs text-muted-foreground" data-testid="servicios-autoguardado-estado">
          {estadoGuardado === "guardando" && "Guardando automáticamente…"}
          {estadoGuardado === "guardado" && "✓ Guardado automático"}
          {estadoGuardado === "error_num" && <span className="font-medium text-red-600">Revisá los campos en rojo</span>}
        </span>
      )}
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {SERVICIOS.map(([k, label]) => {
        const invalido = Boolean(erroresServ[k]);
        const codigo = codigos?.[`codigo_${k}`];
        return (
          <Campo key={k} label={label} error={erroresServ[k]} testId={`servicio-${k}`}>
            <Input
              type="text"
              inputMode="decimal"
              value={serv[k]}
              disabled={!editable}
              placeholder="0"
              className={invalido ? "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500" : ""}
              onChange={(e) => setServ((p) => ({ ...p, [k]: e.target.value }))}
              onBlur={onBlurCampo}
              data-testid={`servicio-${k}-input`}
            />
            {codigo && (
              <p className="truncate font-mono text-[11px] text-muted-foreground" title={codigo} data-testid={`servicio-${k}-codigo`}>
                N° {codigo}
              </p>
            )}
          </Campo>
        );
      })}
    </div>
  </section>
);

export default function LiquidacionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, recargar } = useApi(`/liquidaciones/${id}`);
  const [l, setL] = useState(null);
  const [serv, setServ] = useState(servDe(null));
  const [dialogo, setDialogo] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState("");
  const idCargadoRef = useRef(null);
  const servRef = useRef(serv);
  servRef.current = serv;

  useEffect(() => {
    if (data) {
      const cambioDeLiquidacion = idCargadoRef.current !== data.id;
      idCargadoRef.current = data.id;
      setL(data);
      if (cambioDeLiquidacion) {
        setServ(servDe(data));
        setEstadoGuardado("");
      }
    }
  }, [data]);

  const editable = l ? esBorrador(l) : false;

  const erroresServ = l
    ? Object.fromEntries(
        SERVICIOS.map(([k]) => [
          k,
          esValorServValido(serv[k]) ? "" : "Solo números válidos (sin letras)",
        ]).filter(([, msg]) => msg)
      )
    : {};
  const hayErrorNum = Object.keys(erroresServ).length > 0;

  const sucio = l
    ? SERVICIOS.some(([k]) => {
        const actual = normalizarNumServ(serv[k]);
        const guardado = l.servicios_detalle?.[k] == null ? null : Number(l.servicios_detalle[k]);
        return actual !== guardado;
      })
    : false;

  const bodyServ = useCallback(
    (s = servRef.current) => Object.fromEntries(SERVICIOS.map(([k]) => [k, normalizarNumServ(s[k])])),
    []
  );

  const guardarSilencioso = useCallback(async () => {
    if (!l || !esBorrador(l) || hayErrorNum) return;
    const hayCambios = SERVICIOS.some(([k]) => {
      const actual = normalizarNumServ(servRef.current[k]);
      const guardado = l.servicios_detalle?.[k] == null ? null : Number(l.servicios_detalle[k]);
      return actual !== guardado;
    });
    if (!hayCambios) return;
    setEstadoGuardado("guardando");
    try {
      const r = await api.put(`/liquidaciones/${l.id}/servicios`, bodyServ(servRef.current));
      setL(r.data);
      setEstadoGuardado("guardado");
    } catch {
      setEstadoGuardado("");
    }
  }, [l, hayErrorNum, bodyServ]);

  useEffect(() => {
    if (hayErrorNum) {
      setEstadoGuardado("error_num");
      return;
    }
    if (!sucio || !editable) return;
    const t = setTimeout(() => {
      guardarSilencioso();
    }, 600);
    return () => clearTimeout(t);
  }, [serv, sucio, editable, hayErrorNum, guardarSilencioso]);

  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!l) return <Skeleton className="h-96" />;

  const actualizarTodo = (d) => {
    setL(d);
    setServ(servDe(d));
  };
  const actualizarDesdeConceptos = (d) => {
    setL(d);
  };

  const guardarServ = () =>
    accion(async () => {
      if (hayErrorNum) throw new Error("Revisá los servicios marcados en rojo.");
      const r = await api.put(`/liquidaciones/${l.id}/servicios`, bodyServ());
      actualizarTodo(r.data);
      setEstadoGuardado("guardado");
    }, "Servicios guardados");

  const refrescar = () =>
    accion(async () => {
      await guardarSilencioso();
      actualizarTodo((await api.post(`/liquidaciones/${l.id}/refrescar-alquiler`)).data);
    }, "Alquiler actualizado desde el contrato");

  const confirmar = () =>
    accion(async () => {
      if (hayErrorNum) throw new Error("Corregí los servicios en rojo antes de confirmar.");
      if (sucio) await api.put(`/liquidaciones/${l.id}/servicios`, bodyServ());
      actualizarTodo((await api.post(`/liquidaciones/${l.id}/confirmar`)).data);
    }, "Liquidación confirmada");

  const irALiquidacion = async (targetId) => {
    if (!targetId) return;
    if (editable && sucio && !hayErrorNum) {
      await guardarSilencioso();
    }
    navigate(`/liquidaciones/${targetId}`);
  };

  const imprimirRecibo = () =>
    accion(async () => {
      setImprimiendo(true);
      try {
        const r = await api.post("/impresion/pdf", { mes_impresion: l["mes_año"], id_liquidacion: l.id }, { responseType: "blob" });
        const url = URL.createObjectURL(r.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `comprobante-contrato-${l.id_contrato}-${String(l["mes_año"]).slice(0, 7)}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } finally {
        setImprimiendo(false);
      }
    }, "Comprobante PDF descargado");

  const servParaDesglose = Object.fromEntries(
    SERVICIOS.map(([k]) => [k, esValorServValido(serv[k]) ? String(serv[k] ?? "").replace(",", ".") : 0])
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to={`/liquidaciones?mes=${l["mes_año"]}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="liq-volver">
          <ArrowLeft className="h-4 w-4" /> Liquidaciones de {fmtMes(l["mes_año"])}
        </Link>
        <BarraNavegacionContratos l={l} onIr={irALiquidacion} guardando={estadoGuardado === "guardando"} />
      </div>
      <PageHeader eyebrow={`Contrato #${l.id_contrato} · ${direccion(l)}`} titulo={`${fmtMes(l["mes_año"])} · ${nombresAgrupados(l.inquilinos)}`}>
        <StatusBadge nombre={l.estado_liquidacion} testId="liq-detalle-estado" />
        <Button variant="outline" onClick={imprimirRecibo} disabled={imprimiendo} data-testid="liq-imprimir-button">
          {imprimiendo ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}
          {imprimiendo ? "Generando…" : "Imprimir recibo"}
        </Button>
        {editable && <Button variant="outline" onClick={refrescar} data-testid="liq-refrescar-button"><RefreshCw className="mr-1.5 h-4 w-4" />Refrescar alquiler</Button>}
        {editable && <Button variant="outline" onClick={guardarServ} disabled={!sucio || hayErrorNum} data-testid="liq-guardar-servicios-button"><Save className="mr-1.5 h-4 w-4" />Guardar servicios</Button>}
        {editable && <Button onClick={() => setDialogo("confirmar")} disabled={hayErrorNum} data-testid="liq-confirmar-button"><CheckCircle2 className="mr-1.5 h-4 w-4" />Confirmar</Button>}
        {pagoPendiente(l) && <Button onClick={() => setDialogo("cobro")} data-testid="liq-cobrar-button"><Wallet className="mr-1.5 h-4 w-4" />Registrar cobro</Button>}
      </PageHeader>
      {l.moneda === "USD" && editable && (
        <p className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900" data-testid="liq-aviso-usd">
          <AlertTriangle className="h-4 w-4" />Esta liquidación es en USD: cargá los servicios ya convertidos.
        </p>
      )}
      {editable && Number(l.alquiler) !== Number(l.alquiler_actual) && (
        <p className="mb-4 text-sm text-amber-800" data-testid="liq-aviso-alquiler">El alquiler del contrato cambió a {fmtMoneda(l.alquiler_actual, l.moneda)}. Usá "Refrescar alquiler".</p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px] fade-up">
        <div className="space-y-4">
          <Servicios
            serv={serv}
            setServ={setServ}
            editable={editable}
            moneda={l.moneda}
            onBlurCampo={guardarSilencioso}
            estadoGuardado={estadoGuardado}
            erroresServ={erroresServ}
            codigos={l}
          />
          <Conceptos l={l} editable={editable} onCambio={actualizarDesdeConceptos} antesDeGuardar={guardarSilencioso} />
        </div>
        <div className="space-y-2">
          <Desglose alquiler={l.alquiler} servicios={servParaDesglose} conceptos={l.conceptos} moneda={l.moneda} />
          {hayErrorNum && <p className="text-xs font-medium text-red-600" data-testid="liq-error-num">Corregí los campos en rojo (solo se permiten números).</p>}
          {!hayErrorNum && sucio && <p className="text-xs text-amber-800" data-testid="liq-sin-guardar">Guardando cambios de servicios…</p>}
          {!editable && <p className="text-xs text-muted-foreground">Total guardado: <span className="num font-medium" data-testid="liq-total-guardado">{fmtMoneda(l.total, l.moneda)}</span></p>}
        </div>
      </div>
      <div className="mt-4 space-y-4"><PagoInquilino l={l} /><PagoPropietario l={l} /></div>
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <Link to={`/liquidaciones?mes=${l["mes_año"]}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a Liquidaciones
        </Link>
        <BarraNavegacionContratos l={l} onIr={irALiquidacion} guardando={estadoGuardado === "guardando"} />
      </div>
      <ConfirmDialog open={dialogo === "confirmar"} onOpenChange={() => setDialogo(null)} testId="liq-confirmar-dialog" confirmar="Confirmar liquidación"
        titulo="¿Confirmar la liquidación?" onConfirm={confirmar}
        descripcion="Se guardan los servicios, se recalcula el total y la liquidación pasa a confirmada. Después ya no se puede editar." />
      {dialogo === "cobro" && <CobroDialog liquidacion={l} onClose={() => setDialogo(null)} onCobrado={(d) => { setDialogo(null); actualizarTodo(d); }} />}
    </div>
  );
}
