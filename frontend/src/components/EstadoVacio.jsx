import { Inbox, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const EstadoVacio = ({ titulo, texto, icon: Icon = Inbox, testId = "empty-state" }) => (
  <div data-testid={testId} className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-14 text-center">
    <Icon className="mb-3 h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
    <p className="font-display text-sm font-semibold">{titulo}</p>
    {texto && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{texto}</p>}
  </div>
);

export const EstadoError = ({ mensaje, onReintentar }) => (
  <div data-testid="error-state" className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 sm:flex-row sm:items-center">
    <AlertTriangle className="h-4 w-4 shrink-0" />
    <span className="flex-1">{mensaje}</span>
    {onReintentar && (
      <Button size="sm" variant="outline" onClick={onReintentar} data-testid="error-retry-button">Reintentar</Button>
    )}
  </div>
);
