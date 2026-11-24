import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Campo = ({ label, error, req, className, children, testId }) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="text-xs font-medium text-slate-700">
      {label}{req && <span className="text-red-600"> *</span>}
    </Label>
    {children}
    {error && <p className="text-xs text-red-700" data-testid={testId ? `${testId}-error` : undefined}>{error}</p>}
  </div>
);

export const SelectCatalogo = ({ value, onChange, items = [], placeholder = "Elegí…", vacio = "Sin especificar",
  testId, disabled, sinVacio }) => (
  <Select value={value == null ? (sinVacio ? undefined : "none") : String(value)}
    onValueChange={(v) => onChange(v === "none" ? null : Number(v))} disabled={disabled}>
    <SelectTrigger data-testid={testId}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent className="max-h-72 bg-white">
      {!sinVacio && <SelectItem value="none">{vacio}</SelectItem>}
      {items.map((i) => (
        <SelectItem key={i.id} value={String(i.id)} data-testid={testId ? `${testId}-option-${i.id}` : undefined}>{i.nombre}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export const SelectSimple = ({ value, onChange, opciones, testId, className, disabled }) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger className={cn("bg-white", className)} data-testid={testId}><SelectValue /></SelectTrigger>
    <SelectContent className="bg-white">
      {opciones.map(([v, l]) => <SelectItem key={v} value={v} data-testid={testId ? `${testId}-option-${v}` : undefined}>{l}</SelectItem>)}
    </SelectContent>
  </Select>
);

export const Seccion = ({ titulo, children, className }) => (
  <fieldset className={cn("space-y-4", className)}>
    <legend className="label-caps mb-3">{titulo}</legend>
    {children}
  </fieldset>
);
