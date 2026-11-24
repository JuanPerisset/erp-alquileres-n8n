import { ConfirmDialog } from "@/components/ConfirmDialog";

// baja: { nombre, eliminar } | { alternativa: { titulo, descripcion, confirmar, run } } | { bloqueo }
export const BajaDialog = ({ baja, onClose, testId = "baja-dialog" }) => {
  let props = {};
  if (baja?.alternativa) {
    const a = baja.alternativa;
    props = { titulo: a.titulo, descripcion: a.descripcion, confirmar: a.confirmar, onConfirm: a.run };
  } else if (baja?.bloqueo) {
    props = { titulo: "No se puede eliminar", descripcion: baja.bloqueo, soloInfo: true };
  } else if (baja) {
    props = { titulo: `¿Eliminar ${baja.nombre}?`, descripcion: "Esta acción no se puede deshacer.", confirmar: "Eliminar",
      destructivo: true, onConfirm: baja.eliminar };
  }
  return <ConfirmDialog open={!!baja} onOpenChange={(o) => !o && onClose()} testId={testId} {...props} />;
};
