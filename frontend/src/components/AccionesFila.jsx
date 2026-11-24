import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AccionesFila = ({ onEditar, onEliminar, testId, children }) => (
  <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
    {children}
    {onEditar && (
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditar} aria-label="Editar" data-testid={`${testId}-editar`}>
        <Pencil className="h-4 w-4" />
      </Button>
    )}
    {onEliminar && (
      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-700 hover:bg-red-50 hover:text-red-800"
        onClick={onEliminar} aria-label="Dar de baja" title="Dar de baja" data-testid={`${testId}-eliminar`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    )}
  </div>
);
