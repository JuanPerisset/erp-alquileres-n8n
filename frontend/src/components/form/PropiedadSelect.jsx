import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";
import { direccion } from "@/lib/propiedades";
import { cn } from "@/lib/utils";

export const PropiedadSelect = ({ value, onChange, testId = "contrato-propiedad" }) => {
  const { data } = useApi("/propiedades");
  const [open, setOpen] = useState(false);
  const lista = data || [];
  const actual = lista.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal" data-testid={`${testId}-trigger`}>
          <span className="truncate">{actual ? `${direccion(actual)}${actual.ciudad ? `, ${actual.ciudad}` : ""}` : "Elegí la propiedad"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] bg-white p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por dirección o ciudad" data-testid={`${testId}-search`} />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {lista.map((p) => (
                <CommandItem key={p.id} value={`${direccion(p)} ${p.ciudad || ""} ${p.id}`} data-testid={`${testId}-opcion-${p.id}`}
                  onSelect={() => { onChange(p.id, p); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{direccion(p)}</span>
                  <span className="ml-auto pl-2 text-xs text-muted-foreground">{p.ciudad} · {p.estado}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
