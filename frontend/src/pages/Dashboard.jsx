import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Banknote, CalendarClock, FileClock, HandCoins, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { EstadoError } from "@/components/EstadoVacio";
import { Skeleton } from "@/components/ui/skeleton";
import { MesSelector, useMes } from "@/components/MesSelector";
import { fmtFecha, fmtMes, fmtMoneda, nombresAgrupados } from "@/lib/format";

const Kpi = ({ icon: Icon, label, valor, detalle, testId, tono = "neutral" }) => {
  const colores = { neutral: "text-foreground", bueno: "text-green-700", malo: "text-amber-700" };
  return (
    <div className="rounded-lg border bg-card p-5" data-testid={testId}>
      <div className="flex items-center justify-between">
        <p className="label-caps">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className={`mt-3 font-display text-2xl font-bold num ${colores[tono] || ""}`}>{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>
    </div>
  );
};

const BloqueKpis = ({ k }) => (
  <section className="rounded-lg border bg-muted/30 p-4" data-testid={`kpis-${k.moneda}`}>
    <h3 className="label-caps mb-3">Mes en {k.moneda} · {k.contratos_activos} contratos activos</h3>
    <div className="grid gap-3 md:grid-cols-4">
      <Kpi testId={`kpi-recaudado-${k.moneda}`} icon={TrendingUp} tono="bueno" label="Recaudado"
        valor={fmtMoneda(k.recaudado_mes, k.moneda)} detalle="Liquidaciones pagadas del mes" />
      <Kpi testId={`kpi-pendiente-${k.moneda}`} icon={TrendingDown} tono={Number(k.pendiente_mes) > 0 ? "malo" : "neutral"}
        label="Pendiente de cobro" valor={fmtMoneda(k.pendiente_mes, k.moneda)} detalle="Confirmadas o notificadas sin cobro" />
      <Kpi testId={`kpi-honorarios-${k.moneda}`} icon={HandCoins} label="Honorarios"
        valor={fmtMoneda(k.honorarios_mes, k.moneda)} detalle="Según pagos a propietarios del mes" />
      <Kpi testId={`kpi-total-${k.moneda}`} icon={Banknote} label="Total liquidado"
        valor={fmtMoneda(k.total_mes, k.moneda)} detalle={`${k.borradores} borrador${k.borradores === 1 ? "" : "es"} del mes`} />
    </div>
  </section>
);

const Lista = ({ titulo, icon: Icon, items, vacio, verMas, children, testId }) => (
  <section className="overflow-hidden rounded-lg border bg-card" data-testid={testId}>
    <div className="flex items-center justify-between border-b px-5 py-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        <h2 className="text-base font-semibold">{titulo}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium num" data-testid={`${testId}-count`}>{items.length}</span>
      </div>
      {verMas && (
        <Link to={verMas} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          data-testid={`${testId}-ver`}>Ver sección <ArrowUpRight className="h-3 w-3" /></Link>
      )}
    </div>
    {items.length === 0 ? (
      <p className="px-5 py-8 text-center text-sm text-muted-foreground" data-testid={`${testId}-vacio`}>{vacio}</p>
    ) : <ul className="divide-y">{children}</ul>}
  </section>
);

const Direccion = ({ f }) => <>{f.calle} {f.numero}{f.ciudad ? `, ${f.ciudad}` : ""}</>;

export default function Dashboard() {
  const { user } = useAuth();
  const [mes, setMes] = useMes();
  const { data, error, recargar } = useApi(`/dashboard?mes=${mes}`);

  return (
    <div>
      <PageHeader eyebrow="Panel" titulo={`Hola, ${user.nombre.split(" ")[0]}`}
        descripcion="KPIs del mes por moneda y lo que requiere atención hoy.">
        <MesSelector mes={mes} onChange={setMes} />
      </PageHeader>
      {error && <EstadoError mensaje={error} onReintentar={recargar} />}
      {!data && !error && <div className="grid gap-3 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>}
      {data && (
        <div className="space-y-8 fade-up">
          <div className="space-y-4">
            {data.kpis.length === 0
              ? <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground" data-testid="kpis-vacio">
                No hay movimiento registrado para {fmtMes(mes)}.</p>
              : data.kpis.map((k) => <BloqueKpis key={k.moneda} k={k} />)}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Lista testId="morosos" titulo="Morosos" icon={AlertTriangle} verMas="/liquidaciones"
              items={data.morosos} vacio="Sin morosos hasta este mes. 🎉">
              {data.morosos.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm" data-testid={`moroso-${m.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium"><Direccion f={m} /></p>
                    <p className="truncate text-xs text-muted-foreground">{nombresAgrupados(m.inquilinos)} · {fmtMes(m.mes_año)}</p>
                  </div>
                  <div className="text-right">
                    <p className="num font-semibold">{fmtMoneda(m.total, m.moneda)}</p>
                    <p className="text-xs text-amber-700">{m.dias_atraso} día{m.dias_atraso === 1 ? "" : "s"} de atraso</p>
                  </div>
                  <Link to={`/liquidaciones/${m.id}`} className="text-muted-foreground hover:text-foreground"
                    data-testid={`moroso-${m.id}-link`}><ArrowUpRight className="h-4 w-4" /></Link>
                </li>
              ))}
            </Lista>

            <Lista testId="actualizaciones" titulo="Actualizaciones pendientes" icon={RefreshCw} verMas="/actualizaciones"
              items={data.actualizaciones_pendientes} vacio="Ningún contrato con la actualización vencida.">
              {data.actualizaciones_pendientes.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm" data-testid={`actualizacion-${a.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium"><Direccion f={a} /></p>
                    <p className="truncate text-xs text-muted-foreground">
                      {nombresAgrupados(a.inquilinos)} · {a.indice_de_actualizacion || "sin índice"}
                      {a.pendiente_aprobacion && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Pedido en Telegram</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num font-semibold">{fmtMoneda(a.alquiler_actual, a.moneda)}</p>
                    <p className="text-xs text-amber-700">Vencida {a.dias_vencida} día{a.dias_vencida === 1 ? "" : "s"}</p>
                  </div>
                </li>
              ))}
            </Lista>

            <Lista testId="vencimientos" titulo={`Vencimientos de contrato · próximos ${data.ventana_vencimiento_dias} días`} icon={CalendarClock}
              verMas="/contratos" items={data.vencimientos_contratos} vacio="Ningún contrato vence en la ventana.">
              {data.vencimientos_contratos.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3 text-sm" data-testid={`vencimiento-${v.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium"><Direccion f={v} /></p>
                    <p className="truncate text-xs text-muted-foreground">
                      Inquilinos: {nombresAgrupados(v.inquilinos)}
                      {v.propietarios?.length ? ` · Propietarios: ${nombresAgrupados(v.propietarios)}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num font-medium">{fmtFecha(v.hasta)}</p>
                    <p className={`text-xs ${v.dias_restantes < 0 ? "text-red-700" : "text-muted-foreground"}`}>
                      {v.dias_restantes < 0 ? `Vencido hace ${-v.dias_restantes} día${v.dias_restantes === -1 ? "" : "s"}`
                        : v.dias_restantes === 0 ? "Vence hoy" : `En ${v.dias_restantes} día${v.dias_restantes === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <Link to={`/contratos/${v.id_contrato}`} className="text-muted-foreground hover:text-foreground"
                    data-testid={`vencimiento-${v.id}-link`}><ArrowUpRight className="h-4 w-4" /></Link>
                </li>
              ))}
            </Lista>

            <Lista testId="borradores" titulo="Borradores del mes" icon={FileClock} verMas={`/liquidaciones?mes=${mes}`}
              items={data.borradores_mes} vacio="No quedan borradores por confirmar este mes.">
              {data.borradores_mes.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3 text-sm" data-testid={`borrador-${b.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium"><Direccion f={b} /></p>
                    <p className="truncate text-xs text-muted-foreground">{nombresAgrupados(b.inquilinos)}</p>
                  </div>
                  <div className="text-right">
                    <p className="num font-semibold">{fmtMoneda(b.total, b.moneda)}</p>
                    <p className="text-xs text-muted-foreground">Contrato #{b.id_contrato}</p>
                  </div>
                  <Link to={`/liquidaciones/${b.id}`} className="text-muted-foreground hover:text-foreground"
                    data-testid={`borrador-${b.id}-link`}><ArrowUpRight className="h-4 w-4" /></Link>
                </li>
              ))}
            </Lista>
          </div>
        </div>
      )}
    </div>
  );
}
