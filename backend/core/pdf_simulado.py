"""PDF de MUESTRA para el simulador del flujo E (A4, 2 recibos por hoja). Solo base de prueba."""
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
W, H = A4
X = 18 * mm


def mes_txt(d):
    return f"{MESES[d.month - 1]} {d.year}"


def plata(v, moneda):
    s = f"{float(v or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{'US$' if moneda == 'USD' else '$'} {s}"


def _nombres(personas):
    return " y ".join(f"{p['apellido']} {p['nombre']}" for p in sorted(personas or [], key=lambda p: (p["apellido"], p["nombre"])))


def _fila(c, y, label, valor, negrita=False):
    c.setFont("Helvetica-Bold" if negrita else "Helvetica", 10)
    c.drawString(X, y, label)
    c.drawRightString(W - X, y, valor)


def _recibo(c, f, y0):
    top = y0 + H / 2 - 16 * mm
    m = f["moneda"]
    c.setFont("Helvetica-Bold", 14)
    c.drawString(X, top, "Perisset Inmobiliaria")
    c.setFont("Helvetica", 9)
    c.drawRightString(W - X, top, f"Recibo N° {f['id']:06d}")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(X, top - 22, f"Comprobante de pago - {mes_txt(f['mes_año'])}")
    c.setFont("Helvetica", 10)
    datos = [("Inquilino/s", _nombres(f["inquilinos"]) or "-"),
             ("Propiedad", " ".join(str(x) for x in (f["calle"], f["numero"]) if x) or "-"),
             ("Contrato", f"#{f['id_contrato']}"),
             ("Fecha de pago", f["fecha_pago"].strftime("%d/%m/%Y") if f["fecha_pago"] else "-")]
    y = top - 42
    for k, v in datos:
        c.drawString(X, y, f"{k}: {v}")
        y -= 14
    y -= 6
    c.line(X, y + 8, W - X, y + 8)
    _fila(c, y - 6, "Alquiler", plata(f["alquiler"], m))
    _fila(c, y - 20, "Servicios", plata(f["servicios"], m))
    _fila(c, y - 34, "Adicionales", plata(f["adicionales"], m))
    _fila(c, y - 48, "Descuentos", f"- {plata(f['descuentos'], m)}")
    _fila(c, y - 62, f"Interés por mora ({float(f['porcentaje_mora'] or 0):.2f} %)".replace(".", ","), plata(f["monto_mora"], m))
    c.line(X, y - 70, W - X, y - 70)
    _fila(c, y - 84, "Total pagado", plata(f["monto_total_pagado"], m), negrita=True)
    c.setFont("Helvetica-Oblique", 7)
    c.drawString(X, y0 + 10 * mm, "MUESTRA generada por el simulador de n8n (base de prueba). El PDF real lo arma el flujo E.")


def generar(filas) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Comprobantes {mes_txt(filas[0]['mes_año'])}")
    for i in range(0, len(filas), 2):
        _recibo(c, filas[i], H / 2)
        c.setDash(4, 4)
        c.line(8 * mm, H / 2, W - 8 * mm, H / 2)
        c.setDash()
        if i + 1 < len(filas):
            _recibo(c, filas[i + 1], 0)
        c.showPage()
    c.save()
    return buf.getvalue()
