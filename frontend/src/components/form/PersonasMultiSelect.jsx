import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

// Selección múltiple de inquilinos o propietarios (endpoint: "/inquilinos" | "/propietarios").
export const PersonasMultiSelect = ({ endpoint, value, onChange, testId, vacio = "Elegí una o varias personas" }) => {
  const { data } = useApi(endpoint);
  const [open, setOpen] = useState(false);
  const lista = data || [];
  const elegidos = lista.filter((p) => value.includes(p.id));
  const alternar = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between font-normal sm:w-80" data-testid={`${testId}-trigger`}>
            {elegidos.length ? `${elegidos.length} elegido(s)` : vacio}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-white p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar por apellido, nombre o DNI" data-testid={`${testId}-search`} />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {lista.map((p) => (
                  <CommandItem key={p.id} value={`${p.apellido} ${p.nombre} ${p.dni || ""}`} onSelect={() => alternar(p.id)}
                    data-testid={`${testId}-opcion-${p.id}`}>
                    <Check className={cn("mr-2 h-4 w-4", value.includes(p.id) ? "opacity-100" : "opacity-0")} />
                    {p.apellido} {p.nombre}
                    <span className="ml-auto text-xs text-muted-foreground num">{p.dni}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap gap-1.5" data-testid={`${testId}-elegidos`}>
        {elegidos.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 py-0.5 pl-2 pr-1 text-xs">
            {p.apellido} {p.nombre}
            <button type="button" onClick={() => alternar(p.id)} className="rounded p-0.5 hover:bg-muted" aria-label="Quitar"
              data-testid={`${testId}-quitar-${p.id}`}><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
    </div>
  );
};
