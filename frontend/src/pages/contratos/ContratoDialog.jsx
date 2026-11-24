import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Seccion, SelectCatalogo, SelectSimple } from "@/components/form/Campo";
import { DateInput } from "@/components/form/DateInput";
import { PropiedadSelect } from "@/components/form/PropiedadSelect";
import { PersonasMultiSelect } from "@/components/form/PersonasMultiSelect";
import { useCatalogos } from "@/hooks/useCatalogos";
import { api, apiError } from "@/lib/api";
import { nombresAgrupados } from "@/lib/format";
import { erroresDeApi, limpiar, validarContrato } from "@/lib/validaciones";
import { INDICES, MONEDAS, idEstado, sumarMeses } from "@/lib/contratos";

const CAMPOS = ["id_propiedad", "desde", "hasta", "alquiler_actual", "moneda", "frecuencia_de_actualizacion", "indice_de_actualizacion",
  "proxima_actualizacion", "forma_pago", "porcentaje_honorarios", "id_estado_contrato"];
const NUMERICOS = ["alquiler_actual", "frecuencia_de_actualizacion", "porcentaje_honorarios"];

function inicial(c) {
  const f = Object.fromEntries(CAMPOS.map((k) => [k, c?.[k] ?? (k.startsWith("id_") ? null : "")]));
  return { ...f, moneda: c?.moneda || "ARS", inquilinos: (c?.inquilinos || []).map((i) => i.id) };
}

export default function ContratoDialog({ contrato, onClose, onGuardado }) {
  const nuevo = !contrato;
  const cat = useCatalogos();
  const [f, setF] = useState(() => inicial(contrato));
  const [propietarios, setPropietarios] = useState(contrato?.propietarios || []);
  const [proxTocada, setProxTocada] = useState(!nuevo);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));

  useEffect(() => {
    if (nuevo && f.id_estado_contrato == null && cat) setF((p) => ({ ...p, id_estado_contrato: idEstado(cat.estados_contrato, "activo") ?? null }));
  }, [cat, nuevo, f.id_estado_contrato]);

  useEffect(() => {
    if (!proxTocada && f.desde && Number(f.frecuencia_de_actualizacion) > 0)
      setF((p) => ({ ...p, proxima_actualizacion: sumarMeses(p.desde, p.frecuencia_de_actualizacion) }));
  }, [f.desde, f.frecuencia_de_actualizacion, proxTocada]);

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    const errs = validarContrato(f);
    setErrores(errs);
    setError("");
    if (Object.keys(errs).length) return;
    setGuardando(true);
    try {
      const body = { ...limpiar(f, NUMERICOS), inquilinos: f.inquilinos };
      if (nuevo) await api.post("/contratos", body);
      else await api.put(`/contratos/${contrato.id}`, body);
      toast.success(nuevo ? "Contrato creado" : "Cambios guardados");
      onGuardado();
    } catch (err) {
      setErrores(erroresDeApi(err));
      setError(apiError(err));
    } finally {
      setGuardando(false);
    }
  };

  const conLiq = contrato?.liquidaciones > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-3xl" data-testid="contrato-dialog">
        <DialogHeader>
          <DialogTitle>{nuevo ? "Nuevo contrato" : `Contrato #${contrato.id}`}</DialogTitle>
          <DialogDescription>Los propietarios salen de la propiedad. Los campos con * son obligatorios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-7" noValidate>
          <Seccion titulo="Partes">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Propiedad" req error={errores.id_propiedad} testId="contrato-propiedad">
                <PropiedadSelect value={f.id_propiedad} onChange={(id, p) => { setF((x) => ({ ...x, id_propiedad: id })); setPropietarios(p.propietarios); }} />
              </Campo>
              <Campo label="Propietarios (según la propiedad)">
                <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm" data-testid="contrato-propietarios-derivados">
                  {nombresAgrupados(propietarios) || "—"}
                </p>
              </Campo>
            </div>
            <Campo label="Inquilinos" req error={errores.inquilinos} testId="contrato-inquilinos">
              <PersonasMultiSelect endpoint="/inquilinos" testId="contrato-inquilinos" vacio="Elegí uno o varios inquilinos"
                value={f.inquilinos} onChange={set("inquilinos")} />
            </Campo>
          </Seccion>
          <Seccion titulo="Vigencia">
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Desde" req error={errores.desde} testId="contrato-desde"><DateInput value={f.desde} onChange={set("desde")} testId="contrato-desde-input" /></Campo>
              <Campo label="Hasta" req error={errores.hasta} testId="contrato-hasta"><DateInput value={f.hasta} onChange={set("hasta")} testId="contrato-hasta-input" /></Campo>
              <Campo label="Estado" req error={errores.id_estado_contrato}>
                <SelectCatalogo value={f.id_estado_contrato} onChange={set("id_estado_contrato")} items={cat?.estados_contrato || []} sinVacio testId="contrato-estado-select" />
              </Campo>
            </div>
          </Seccion>
          <Seccion titulo="Alquiler y honorarios">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Alquiler actual" req error={errores.alquiler_actual} testId="contrato-alquiler">
                <Input type="number" min={0} step="0.01" value={f.alquiler_actual} onChange={set("alquiler_actual")} data-testid="contrato-alquiler-input" />
              </Campo>
              <Campo label="Moneda" req error={errores.moneda} testId="contrato-moneda">
                <SelectSimple value={f.moneda} onChange={set("moneda")} opciones={MONEDAS.map((m) => [m, m])} disabled={conLiq} testId="contrato-moneda-select" />
              </Campo>
              <Campo label="Honorarios (%)" error={errores.porcentaje_honorarios} testId="contrato-honorarios">
                <Input type="number" min={0} max={100} step="0.01" value={f.porcentaje_honorarios} onChange={set("porcentaje_honorarios")} data-testid="contrato-honorarios-input" />
              </Campo>
              <Campo label="Forma de pago">
                <Input list="formas-pago" value={f.forma_pago} onChange={set("forma_pago")} data-testid="contrato-forma-pago-input" />
                <datalist id="formas-pago"><option value="Transferencia" /><option value="Efectivo" /><option value="Cheque" /></datalist>
              </Campo>
            </div>
            <p className="text-xs text-muted-foreground">
              {conLiq ? "La moneda no se puede cambiar porque el contrato ya tiene liquidaciones. " : ""}
              Las actualizaciones por índice las registra el flujo de n8n; editá el alquiler a mano solo para corregir.
            </p>
          </Seccion>
          <Seccion titulo="Actualización del alquiler">
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Frecuencia (meses)" error={errores.frecuencia_de_actualizacion} testId="contrato-frecuencia">
                <Input type="number" min={1} value={f.frecuencia_de_actualizacion} onChange={set("frecuencia_de_actualizacion")} data-testid="contrato-frecuencia-input" />
              </Campo>
              <Campo label="Índice">
                <SelectSimple value={f.indice_de_actualizacion || undefined} onChange={set("indice_de_actualizacion")}
                  opciones={INDICES.map((i) => [i, i])} testId="contrato-indice-select" />
              </Campo>
              <Campo label="Próxima actualización">
                <DateInput value={f.proxima_actualizacion} onChange={(v) => { setProxTocada(true); set("proxima_actualizacion")(v); }} testId="contrato-proxima-input" />
              </Campo>
            </div>
          </Seccion>
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="contrato-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="contrato-cancelar-button">Cancelar</Button>
            <Button type="submit" disabled={guardando} data-testid="contrato-guardar-button">
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
