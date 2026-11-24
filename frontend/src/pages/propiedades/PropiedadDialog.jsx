import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Seccion, SelectCatalogo } from "@/components/form/Campo";
import { ProvinciaCiudad } from "@/components/form/ProvinciaCiudad";
import { PersonasMultiSelect } from "@/components/form/PersonasMultiSelect";
import { useCatalogos } from "@/hooks/useCatalogos";
import { api, apiError } from "@/lib/api";
import { erroresDeApi, limpiar, validarPropiedad } from "@/lib/validaciones";
import { AMBIENTES, MEDIDAS, direccion } from "@/lib/propiedades";

const NUMERICOS = ["numero", ...MEDIDAS.map(([k]) => k), ...AMBIENTES.map(([k]) => k)];
const CLAVES = ["calle", "id_provincia", "id_ciudad", "id_barrio", "id_tipo", "id_estado_propiedad",
  "codigo_luz", "codigo_gas", "codigo_agua", "codigo_municipal", ...NUMERICOS];

const NumInput = ({ k, f, set, step }) => (
  <Input type="number" min={0} step={step} value={f[k] ?? ""} onChange={set(k)} data-testid={`propiedad-${k}-input`} />
);

export default function PropiedadDialog({ propiedad, onClose, onGuardado }) {
  const nuevo = !propiedad;
  const cat = useCatalogos();
  const [f, setF] = useState(() => {
    const base = Object.fromEntries(CLAVES.map((k) => [k, propiedad?.[k] ?? (k.startsWith("id_") ? null : "")]));
    return { ...base, propietarios: (propiedad?.propietarios || []).map((p) => p.id) };
  });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    const errs = validarPropiedad(f);
    setErrores(errs);
    setError("");
    if (Object.keys(errs).length) return;
    setGuardando(true);
    try {
      const body = { ...limpiar(f, NUMERICOS), propietarios: f.propietarios };
      if (nuevo) await api.post("/propiedades", body);
      else await api.put(`/propiedades/${propiedad.id}`, body);
      toast.success(nuevo ? "Propiedad creada" : "Cambios guardados");
      onGuardado();
    } catch (err) {
      setErrores(erroresDeApi(err));
      setError(apiError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-4xl" data-testid="propiedad-dialog">
        <DialogHeader>
          <DialogTitle>{nuevo ? "Nueva propiedad" : direccion(propiedad)}</DialogTitle>
          <DialogDescription>Ubicación, características, ambientes y propietarios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-7" noValidate>
          <Seccion titulo="Ubicación">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo label="Calle" req error={errores.calle} testId="propiedad-calle">
                <Input value={f.calle} onChange={set("calle")} data-testid="propiedad-calle-input" />
              </Campo>
              <Campo label="Número" error={errores.numero}><NumInput k="numero" f={f} set={set} /></Campo>
              <Campo label="Barrio">
                <SelectCatalogo value={f.id_barrio} onChange={set("id_barrio")} items={cat?.barrios || []} testId="propiedad-barrio-select" />
              </Campo>
              <ProvinciaCiudad prefijo="propiedad" idProvincia={f.id_provincia} idCiudad={f.id_ciudad} errores={errores}
                onChange={(v) => setF((p) => ({ ...p, ...v }))} />
            </div>
          </Seccion>
          <Seccion titulo="Características">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo label="Tipo"><SelectCatalogo value={f.id_tipo} onChange={set("id_tipo")} items={cat?.tipos_propiedad || []} testId="propiedad-tipo-select" /></Campo>
              <Campo label="Estado"><SelectCatalogo value={f.id_estado_propiedad} onChange={set("id_estado_propiedad")} items={cat?.estados_propiedad || []} testId="propiedad-estado-select" /></Campo>
              {MEDIDAS.map(([k, l]) => <Campo key={k} label={l}><NumInput k={k} f={f} set={set} step="0.01" /></Campo>)}
            </div>
          </Seccion>
          <Seccion titulo="Ambientes (cantidad)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {AMBIENTES.map(([k, l]) => <Campo key={k} label={l}><NumInput k={k} f={f} set={set} /></Campo>)}
            </div>
          </Seccion>
          <Seccion titulo="Servicios (N° partida / usuario)">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Luz (EPE)"><Input value={f.codigo_luz} onChange={set("codigo_luz")} data-testid="propiedad-codigo_luz-input" /></Campo>
              <Campo label="Gas"><Input value={f.codigo_gas} onChange={set("codigo_gas")} data-testid="propiedad-codigo_gas-input" /></Campo>
              <Campo label="Agua"><Input value={f.codigo_agua} onChange={set("codigo_agua")} data-testid="propiedad-codigo_agua-input" /></Campo>
              <Campo label="Municipal"><Input value={f.codigo_municipal} onChange={set("codigo_municipal")} data-testid="propiedad-codigo_municipal-input" /></Campo>
            </div>
          </Seccion>
          <Seccion titulo="Propietarios">
            <PersonasMultiSelect endpoint="/propietarios" testId="propiedad-propietarios" vacio="Elegí uno o varios propietarios"
              value={f.propietarios} onChange={set("propietarios")} />
          </Seccion>
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="propiedad-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="propiedad-cancelar-button">Cancelar</Button>
            <Button type="submit" disabled={guardando} data-testid="propiedad-guardar-button">
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
