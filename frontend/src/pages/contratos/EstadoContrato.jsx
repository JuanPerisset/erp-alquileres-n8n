import { StatusBadge } from "@/components/StatusBadge";

export const EstadoContrato = ({ c }) => (
  <div className="flex flex-wrap items-center gap-1">
    <StatusBadge nombre={c.estado} testId={`contrato-${c.id}-estado`} />
    {c.vencido_sugerido && (
      <StatusBadge nombre="Vencido (sugerido)" variante="rojo" className="normal-case border-dashed" testId={`contrato-${c.id}-vencido-sugerido`} />
    )}
  </div>
);
