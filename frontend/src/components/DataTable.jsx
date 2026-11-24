import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function comparar(x, y) {
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x ?? "").localeCompare(String(y ?? ""), "es", { numeric: true });
}

const IconoOrden = ({ activo, dir }) => {
  if (!activo) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
};

export function DataTable({ columnas, filas, buscar, placeholder = "Buscar…", filtros, vacio = "No hay registros",
  testId = "data-table", porPagina = 15, ordenInicial = null, onFila }) {
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState(ordenInicial);
  const [pagina, setPagina] = useState(0);

  const visibles = useMemo(() => {
    let r = filas;
    if (q && buscar) r = r.filter((f) => norm(buscar(f)).includes(norm(q)));
    if (orden) {
      const col = columnas.find((c) => c.key === orden.key);
      const val = col?.ordenar || ((f) => f[orden.key]);
      r = [...r].sort((a, b) => (orden.dir === "asc" ? 1 : -1) * comparar(val(a), val(b)));
    }
    return r;
  }, [filas, q, orden, buscar, columnas]);

  const paginas = Math.max(1, Math.ceil(visibles.length / porPagina));
  const p = Math.min(pagina, paginas - 1);
  const filasPagina = visibles.slice(p * porPagina, (p + 1) * porPagina);
  const ordenarPor = (key) => setOrden((o) => (o?.key === key ? { key, dir: o.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {buscar && (
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPagina(0); }} placeholder={placeholder}
              className="bg-white pl-9" data-testid={`${testId}-search`} />
          </div>
        )}
        {filtros && <div className="flex flex-wrap items-center gap-2">{filtros}</div>}
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/60">
            <TableRow>
              {columnas.map((c) => (
                <TableHead key={c.key} className={cn("h-10 whitespace-nowrap", c.className)}>
                  {c.ordenable === false ? c.label : (
                    <button type="button" onClick={() => ordenarPor(c.key)} data-testid={`${testId}-sort-${c.key}`}
                      className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                      {c.label}<IconoOrden activo={orden?.key === c.key} dir={orden?.dir} />
                    </button>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasPagina.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnas.length} className="py-12 text-center text-sm text-muted-foreground" data-testid={`${testId}-empty`}>
                  {q ? "No hay resultados para tu búsqueda." : vacio}
                </TableCell>
              </TableRow>
            )}
            {filasPagina.map((f) => (
              <TableRow key={f.id} onClick={onFila ? () => onFila(f) : undefined} data-testid={`${testId}-row-${f.id}`}
                className={cn("transition-colors hover:bg-muted/40", onFila && "cursor-pointer")}>
                {columnas.map((c) => (
                  <TableCell key={c.key} className={cn("py-2", c.className)}>{c.render ? c.render(f) : (f[c.key] ?? "—")}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span data-testid={`${testId}-count`}>
          {visibles.length === 0 ? "0 registros" : `${p * porPagina + 1}–${Math.min((p + 1) * porPagina, visibles.length)} de ${visibles.length}`}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={p === 0} onClick={() => setPagina(p - 1)}
            aria-label="Página anterior" data-testid={`${testId}-prev`}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2 num">{p + 1} / {paginas}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={p >= paginas - 1} onClick={() => setPagina(p + 1)}
            aria-label="Página siguiente" data-testid={`${testId}-next`}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
