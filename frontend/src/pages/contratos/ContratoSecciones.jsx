import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { EstadoVacio } from "@/components/EstadoVacio";
import { fmtCelular, fmtFecha, fmtFechaHora, fmtMes, fmtMoneda, fmtNumero } from "@/lib/format";
import { direccion } from "@/lib/propiedades";

export const Tarjeta = ({ titulo, children, testId, className = "" }) => (
  <section className={`rounded-lg border bg-card p-5 ${className}`} data-testid={testId}>
    <h2 className="label-caps mb-4">{titulo}</h2>
    {children}
  </section>
);

const Dato = ({ label, valor, testId }) => (
  <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-medium num" data-testid={testId}>{valor ?? "—"}</dd></div>
);

const Personas = ({ lista }) => lista.length === 0 ? <p className="text-sm text-muted-foreground">Sin asignar.</p> : (
  <ul className="space-y-3">
    {lista.map((p) => (
      <li key={p.id} className="text-sm"><p className="font-medium">{p.apellido} {p.nombre}</p>
        <p className="text-xs text-muted-foreground">{[p.celular && fmtCelular(p.celular), p.email].filter(Boolean).join(" · ") || "Sin contacto"}</p></li>
    ))}
  </ul>
);

export const Partes = ({ c }) => (
  <div className="grid gap-4 lg:grid-cols-3">
    <Tarjeta titulo="Inquilinos" testId="contrato-inquilinos"><Personas lista={c.inquilinos} /></Tarjeta>
    <Tarjeta titulo="Propietarios" testId="contrato-propietarios"><Personas lista={c.propietarios} /></Tarjeta>
    <Tarjeta titulo="Propiedad" testId="contrato-propiedad">
      <Link to={`/propiedades/${c.id_propiedad}`} className="text-sm font-medium hover:underline" data-testid="contrato-propiedad-link">{direccion(c)}</Link>
      <p className="text-xs text-muted-foreground">{[c.barrio, c.ciudad].filter(Boolean).join(" · ")}</p>
    </Tarjeta>
  </div>
);

export const Condiciones = ({ c }) => (
  <Tarjeta titulo="Condiciones" testId="contrato-condiciones">
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Dato label="Alquiler actual" valor={fmtMoneda(c.alquiler_actual, c.moneda)} testId="contrato-alquiler-actual" />
      <Dato label="Moneda" valor={c.moneda} />
      <Dato label="Honorarios" valor={c.porcentaje_honorarios != null ? `${fmtNumero(c.porcentaje_honorarios)} %` : null} />
      <Dato label="Forma de pago" valor={c.forma_pago} />
      <Dato label="Vigencia" valor={`${fmtFecha(c.desde)} → ${fmtFecha(c.hasta)}`} />
      <Dato label="Índice" valor={c.indice_de_actualizacion} />
      <Dato label="Frecuencia" valor={c.frecuencia_de_actualizacion ? `Cada ${c.frecuencia_de_actualizacion} meses` : null} />
      <Dato label="Próxima actualización" valor={`${fmtFecha(c.proxima_actualizacion)}${c.actualizacion_vencida ? " (vencida)" : ""}`} />
    </dl>
  </Tarjeta>
);

const TablaSimple = ({ cols, filas, testId, vacio }) => filas.length === 0 ? <EstadoVacio titulo={vacio} testId={`${testId}-vacio`} /> : (
  <div className="overflow-x-auto">
    <Table data-testid={testId}>
      <TableHeader className="bg-muted/60"><TableRow>{cols.map(([l, , cl]) => <TableHead key={l} className={cl}>{l}</TableHead>)}</TableRow></TableHeader>
      <TableBody>
        {filas.map((f, i) => (
          <TableRow key={i}>{cols.map(([l, r, cl]) => <TableCell key={l} className={`py-2 ${cl || ""}`}>{r(f)}</TableCell>)}</TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export const Historial = ({ c }) => (
  <Tarjeta titulo="Historial de actualizaciones">
    <TablaSimple testId="contrato-historial" vacio="Sin actualizaciones registradas" filas={c.historial} cols={[
      ["Fecha", (h) => fmtFechaHora(h.fecha_de_actualizacion), "num whitespace-nowrap"],
      ["Índice", (h) => h.indice_de_actualizacion || "—"],
      ["% aplicado", (h) => (h.porcentaje_aplicado != null ? `${fmtNumero(h.porcentaje_aplicado, 4)} %` : "—"), "text-right num"],
      ["Alquiler anterior → nuevo", (h) => `${fmtMoneda(h.alquiler_anterior, c.moneda)} → ${fmtMoneda(h.alquiler_nuevo, c.moneda)}`, "text-right num whitespace-nowrap"],
    ]} />
  </Tarjeta>
);

export const Liquidaciones = ({ c }) => (
  <Tarjeta titulo="Liquidaciones del contrato">
    <TablaSimple testId="contrato-liquidaciones" vacio="Sin liquidaciones todavía" filas={c.lista_liquidaciones} cols={[
      ["Mes", (l) => fmtMes(l["mes_año"]), "whitespace-nowrap"],
      ["Alquiler", (l) => fmtMoneda(l.alquiler, l.moneda), "text-right num"],
      ["Total", (l) => fmtMoneda(l.total, l.moneda), "text-right num"],
      ["Liquidación", (l) => <StatusBadge nombre={l.estado_liquidacion} />],
      ["Pago", (l) => (l.estado_pago ? <StatusBadge nombre={l.estado_pago} /> : <span className="text-muted-foreground">—</span>)],
      ["Fecha de pago", (l) => fmtFecha(l.fecha_pago), "num"],
      ["Total pagado", (l) => (l.monto_total_pagado != null ? fmtMoneda(l.monto_total_pagado, l.moneda) : "—"), "text-right num"],
    ]} />
  </Tarjeta>
);
