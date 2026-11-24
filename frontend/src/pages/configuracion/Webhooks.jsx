import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoError } from "@/components/EstadoVacio";
import { useApi } from "@/hooks/useApi";

export default function Webhooks() {
  const { data, error, recargar } = useApi("/sistema/webhooks");
  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!data) return <Skeleton className="h-64" />;
  return (
    <div className="fade-up">
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        Definidos en un único archivo (<span className="font-mono text-xs">backend/core/n8n.py</span>). La URL base y el secreto
        (header <span className="font-mono text-xs">X-Webhook-Secret</span>) salen de N8N_BASE_URL y N8N_WEBHOOK_SECRET. El secreto nunca se muestra.
      </p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table data-testid="webhooks-table">
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead>Flujo</TableHead><TableHead>Webhook</TableHead><TableHead>Payload</TableHead>
              <TableHead>Respuesta</TableHead><TableHead className="min-w-[280px]">Qué hace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((w) => (
              <TableRow key={w.clave} data-testid={`webhook-row-${w.path}`}>
                <TableCell className="py-2 font-display font-bold">{w.flujo}</TableCell>
                <TableCell className="py-2">
                  <p className="font-mono text-[13px]">{w.path}</p>
                  <p className="max-w-[260px] truncate text-xs text-muted-foreground" title={w.url}>{w.url}</p>
                </TableCell>
                <TableCell className="py-2 font-mono text-xs">{w.campos.length ? `{ ${w.campos.join(", ")} }` : "sin datos"}</TableCell>
                <TableCell className="py-2 text-xs uppercase">{w.respuesta}</TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground">{w.descripcion}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
