import { toast } from "sonner";
import { apiError } from "@/lib/api";

// Ejecuta una acción con toast de éxito/error. Devuelve false si falló (mantiene abierto el diálogo).
export async function accion(fn, mensajeOk, despues) {
  try {
    await fn();
    toast.success(mensajeOk);
    despues?.();
  } catch (e) {
    toast.error(apiError(e));
    return false;
  }
}
