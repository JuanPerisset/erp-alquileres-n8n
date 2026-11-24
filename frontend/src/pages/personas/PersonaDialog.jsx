import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Seccion } from "@/components/form/Campo";
import { ProvinciaCiudad } from "@/components/form/ProvinciaCiudad";
import { DateInput } from "@/components/form/DateInput";
import { api, apiError } from "@/lib/api";
import { erroresDeApi, limpiar, validarPersona } from "@/lib/validaciones";
import Vinculos from "./Vinculos";

const VACIO = { apellido: "", nombre: "", dni: "", cuit: "", fecha_nacimiento: "", sexo: "", estado_civil: "", nacionalidad: "",
  profesion: "", celular: "", email: "", pais_residencia: "", calle: "", numero: "", codigo_postal: "", id_provincia: null, id_ciudad: null };

const SECCIONES = [
  ["Datos personales", [["apellido", "Apellido", { req: true }], ["nombre", "Nombre", { req: true }], ["dni", "DNI", { placeholder: "30123456" }],
    ["cuit", "CUIT/CUIL", { placeholder: "20-30123456-7" }], ["fecha_nacimiento", "Fecha de nacimiento", { type: "date" }],
    ["sexo", "Sexo"], ["estado_civil", "Estado civil"], ["nacionalidad", "Nacionalidad"], ["profesion", "Profesión"]]],
  ["Contacto", [["celular", "Celular", { placeholder: "5493415551234" }], ["email", "Email", { type: "email" }]]],
  ["Domicilio", [["pais_residencia", "País de residencia"], ["calle", "Calle"], ["numero", "Número", { type: "number" }],
    ["codigo_postal", "Código postal"]]],
];

const EstadoSelect = ({ value, onChange }) => (
  <Select value={value || "activo"} onValueChange={onChange}>
    <SelectTrigger data-testid="persona-estado-select"><SelectValue /></SelectTrigger>
    <SelectContent className="bg-white">
      {[...new Set(["activo", "inactivo", value].filter(Boolean))].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
    </SelectContent>
  </Select>
);

export default function PersonaDialog({ tipo, persona, onClose, onGuardado }) {
  const nuevo = !persona;
  const singular = tipo === "inquilinos" ? "inquilino" : "propietario";
  const [f, setF] = useState(() => {
    const base = { ...VACIO, ...(tipo === "inquilinos" ? { estado: "activo" } : {}) };
    Object.keys(base).forEach((k) => { if (persona && persona[k] != null) base[k] = persona[k]; });
    return base;
  });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [vinculos, setVinculos] = useState(null);

  useEffect(() => {
    if (persona) api.get(`/${tipo}/${persona.id}`).then((r) => setVinculos(r.data.vinculos)).catch(() => setVinculos([]));
  }, [persona, tipo]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    const errs = validarPersona(f, persona || {});
    setErrores(errs);
    setError("");
    if (Object.keys(errs).length) return;
    setGuardando(true);
    try {
      const body = limpiar(f, ["numero"]);
      if (nuevo) await api.post(`/${tipo}`, body);
      else await api.put(`/${tipo}/${persona.id}`, body);
      toast.success(nuevo ? `${singular[0].toUpperCase()}${singular.slice(1)} creado` : "Cambios guardados");
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
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-3xl" data-testid="persona-dialog">
        <DialogHeader>
          <DialogTitle>{nuevo ? `Nuevo ${singular}` : `${persona.apellido} ${persona.nombre}`}</DialogTitle>
          <DialogDescription>Los campos con * son obligatorios. DNI, CUIT, celular y email se validan al guardar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-7" noValidate>
          {SECCIONES.map(([titulo, campos]) => (
            <Seccion key={titulo} titulo={titulo}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {campos.map(([k, label, o = {}]) => (
                  <Campo key={k} label={label} req={o.req} error={errores[k]} testId={`persona-${k}`}>
                    {o.type === "date" ? (
                      <DateInput value={f[k] || ""} onChange={set(k)} testId={`persona-${k}-input`} />
                    ) : (
                      <Input type={o.type || "text"} value={f[k] ?? ""} onChange={set(k)} placeholder={o.placeholder}
                        data-testid={`persona-${k}-input`} min={o.type === "number" ? 0 : undefined} />
                    )}
                  </Campo>
                ))}
                {titulo === "Domicilio" && (
                  <ProvinciaCiudad prefijo="persona" idProvincia={f.id_provincia} idCiudad={f.id_ciudad} errores={errores}
                    onChange={(v) => setF((p) => ({ ...p, ...v }))} />
                )}
                {titulo === "Contacto" && tipo === "inquilinos" && (
                  <Campo label="Estado"><EstadoSelect value={f.estado} onChange={set("estado")} /></Campo>
                )}
              </div>
            </Seccion>
          ))}
          {!nuevo && <Vinculos tipo={tipo} vinculos={vinculos} />}
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="persona-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="persona-cancelar-button">Cancelar</Button>
            <Button type="submit" disabled={guardando} data-testid="persona-guardar-button">
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
