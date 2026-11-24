import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoError, EstadoVacio } from "@/components/EstadoVacio";
import { useApi } from "@/hooks/useApi";
import { fmtCelular, fmtFecha, fmtMoneda, fmtNumero, nombresAgrupados } from "@/lib/format";
import { AMBIENTES, MEDIDAS, direccion } from "@/lib/propiedades";
import PropiedadDialog from "./PropiedadDialog";

const Tarjeta = ({ titulo, children, testId }) => (
  <section className="rounded-lg border bg-card p-5" data-testid={testId}>
    <h2 className="label-caps mb-4">{titulo}</h2>
    {children}
  </section>
);

const Dato = ({ label, valor }) => (
  <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-medium num">{valor ?? "—"}</dd></div>
);

const Contratos = ({ lista }) => lista.length === 0 ? <EstadoVacio titulo="Sin contratos" texto="Esta propiedad no tiene contratos cargados." /> : (
  <ul className="divide-y" data-testid="ficha-contratos">
    {lista.map((c) => (
      <li key={c.id_contrato} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
        <Link to={`/contratos/${c.id_contrato}`} className="font-medium hover:underline" data-testid={`ficha-contrato-link-${c.id_contrato}`}>#{c.id_contrato}</Link>
        <span>{nombresAgrupados(c.inquilinos) || "Sin inquilinos"}</span>
        <span className="text-muted-foreground num">{fmtFecha(c.desde)} → {fmtFecha(c.hasta)}</span>
        <span className="num">{fmtMoneda(c.alquiler_actual, c.moneda)}</span>
        <StatusBadge nombre={c.estado} className="ml-auto" />
      </li>
    ))}
  </ul>
);

export default function PropiedadFicha() {
  const { id } = useParams();
  const { data: p, error, recargar } = useApi(`/propiedades/${id}`);
  const [editando, setEditando] = useState(false);

  if (error) return <EstadoError mensaje={error} onReintentar={recargar} />;
  if (!p) return <Skeleton className="h-96" />;
  return (
    <div>
      <Link to="/propiedades" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="ficha-volver">
        <ArrowLeft className="h-4 w-4" /> Propiedades
      </Link>
      <PageHeader eyebrow={`${p.tipo || "Propiedad"} · ${p.barrio || "Sin barrio"}`} titulo={direccion(p)}
        descripcion={[p.ciudad, p.provincia].filter(Boolean).join(", ")}>
        <StatusBadge nombre={p.estado} testId="ficha-estado" />
        <Button variant="outline" onClick={() => setEditando(true)} data-testid="ficha-editar-button"><Pencil className="mr-1.5 h-4 w-4" />Editar</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-3 fade-up">
        <Tarjeta titulo="Ambientes" testId="ficha-ambientes">
          <dl className="grid grid-cols-3 gap-4">{AMBIENTES.map(([k, l]) => <Dato key={k} label={l} valor={p[k] ?? 0} />)}</dl>
        </Tarjeta>
        <Tarjeta titulo="Medidas" testId="ficha-medidas">
          <dl className="grid grid-cols-2 gap-4">{MEDIDAS.map(([k, l]) => <Dato key={k} label={l} valor={p[k] != null ? fmtNumero(p[k]) : null} />)}</dl>
        </Tarjeta>
        <Tarjeta titulo="Propietarios" testId="ficha-propietarios">
          {p.propietarios.length === 0 ? <p className="text-sm text-muted-foreground">Sin propietarios asignados.</p> : (
            <ul className="space-y-3">
              {p.propietarios.map((o) => (
                <li key={o.id} className="text-sm"><p className="font-medium">{o.apellido} {o.nombre}</p>
                  <p className="text-xs text-muted-foreground">{[o.celular && fmtCelular(o.celular), o.email].filter(Boolean).join(" · ") || "Sin contacto"}</p></li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
      <div className="mt-4">
        <Tarjeta titulo="Servicios (N° partida / usuario)" testId="ficha-servicios">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato label="Luz (EPE)" valor={p.codigo_luz || null} />
            <Dato label="Gas" valor={p.codigo_gas || null} />
            <Dato label="Agua" valor={p.codigo_agua || null} />
            <Dato label="Municipal" valor={p.codigo_municipal || null} />
          </dl>
        </Tarjeta>
      </div>
      <div className="mt-4"><Tarjeta titulo="Contratos"><Contratos lista={p.lista_contratos} /></Tarjeta></div>
      {editando && <PropiedadDialog propiedad={p} onClose={() => setEditando(false)} onGuardado={() => { setEditando(false); recargar(); }} />}
    </div>
  );
}
