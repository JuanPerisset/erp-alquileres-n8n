import { Link } from "react-router-dom";
import { Seccion } from "@/components/form/Campo";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtFecha } from "@/lib/format";
import { direccion } from "@/lib/propiedades";

export default function Vinculos({ tipo, vinculos }) {
  const titulo = tipo === "inquilinos" ? "Contratos" : "Propiedades";
  return (
    <Seccion titulo={titulo}>
      {vinculos === null && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {vinculos?.length === 0 && <p className="text-sm text-muted-foreground" data-testid="vinculos-vacio">Sin {titulo.toLowerCase()} vinculados.</p>}
      {vinculos?.length > 0 && (
        <ul className="divide-y rounded-md border" data-testid="vinculos-lista">
          {vinculos.map((v) => (
            <li key={v.id_contrato || v.id_propiedad} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              {tipo === "inquilinos" ? (
                <>
                  <Link to={`/contratos/${v.id_contrato}`} className="font-medium hover:underline">Contrato #{v.id_contrato}</Link>
                  <span className="text-muted-foreground">{direccion(v)}</span>
                  <span className="text-muted-foreground num">{fmtFecha(v.desde)} → {fmtFecha(v.hasta)}</span>
                </>
              ) : (
                <Link to={`/propiedades/${v.id_propiedad}`} className="font-medium underline-offset-2 hover:underline">
                  {direccion(v)}{v.ciudad ? `, ${v.ciudad}` : ""}
                </Link>
              )}
              <StatusBadge nombre={v.estado} className="ml-auto" />
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}
