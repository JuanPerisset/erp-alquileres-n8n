import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// onConfirm puede devolver false para dejar el diálogo abierto (ej. error).
export function ConfirmDialog({ open, onOpenChange, titulo, descripcion, confirmar = "Confirmar", destructivo,
  onConfirm, testId = "confirm-dialog", children, soloInfo }) {
  const [enviando, setEnviando] = useState(false);

  const aceptar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await onConfirm();
      if (r !== false) onOpenChange(false);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <AlertDialogContent className="bg-white" data-testid={testId}>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descripcion && <AlertDialogDescription>{descripcion}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando} data-testid={`${testId}-cancel`}>{soloInfo ? "Entendido" : "Cancelar"}</AlertDialogCancel>
          {!soloInfo && (
            <Button onClick={aceptar} disabled={enviando} variant={destructivo ? "destructive" : "default"} data-testid={`${testId}-confirm`}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{confirmar}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
