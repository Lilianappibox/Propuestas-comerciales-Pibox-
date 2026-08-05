import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel,
  PageBreak, Header, Footer, PageNumber,
} from "docx";
import { saveAs } from "file-saver";
import { COBERTURA } from "../data/tarifas";

const fmt = (n) =>
  n === 0 || n === "" || n == null ? "—" : "$" + Number(n).toLocaleString("es-CO");

const BLUE = "1B4F8A";
const BLUE_LIGHT = "D6E4F7";
const GRAY = "4A4A4A";
const GRAY_LIGHT = "F5F5F5";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: "0F3460" };
const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

const cell = (text, opts = {}) =>
  new TableCell({
    borders: opts.header ? headerBorders : borders,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.header
      ? { fill: BLUE, type: ShadingType.CLEAR }
      : opts.alt
      ? { fill: BLUE_LIGHT, type: ShadingType.CLEAR }
      : { fill: "FFFFFF", type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: String(text),
            color: opts.header ? "FFFFFF" : GRAY,
            bold: opts.bold || opts.header,
            size: 18,
            font: "Arial",
          }),
        ],
      }),
    ],
  });

const makeTable = (headers, rows, colWidths) => {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) =>
          new TableCell({
            borders: headerBorders,
            width: { size: colWidths[i], type: WidthType.DXA },
            shading: { fill: BLUE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: h, color: "FFFFFF", bold: true, size: 18, font: "Arial" })] })],
          })
        ),
      }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((cellText, ci) =>
            new TableCell({
              borders,
              width: { size: colWidths[ci], type: WidthType.DXA },
              shading: { fill: ri % 2 === 0 ? "FFFFFF" : BLUE_LIGHT, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: String(cellText), size: 18, font: "Arial", color: GRAY })] })],
            })
          ),
        })
      ),
    ],
  });
};

const policyTable = (rows) =>
  makeTable(["Ítem", "Observaciones"], rows, [3000, 6360]);

const h2 = (text, color = BLUE) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color, font: "Arial" })],
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
  });

const h3 = (text, color = GRAY) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color, font: "Arial" })],
    spacing: { before: 200, after: 100 },
  });

const p = (text, opts = {}) =>
  new Paragraph({
    children: [new TextRun({ text, size: 20, font: "Arial", ...opts })],
    spacing: { after: 100 },
  });

const note = (text) =>
  new Paragraph({
    children: [new TextRun({ text, size: 18, font: "Arial", color: "777777", italics: true })],
    spacing: { after: 60 },
  });

export async function exportToWord(propuesta, tarifas, modulos) {
  const { cliente, ciudad, fecha, contacto, notas } = propuesta;
  const fechaFmt = fecha
    ? new Date(fecha + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })
    : "_____ de 2026";

  const children = [];

  // Header info
  children.push(
    contacto ? new Paragraph({ children: [new TextRun({ text: `Señor(a): ${contacto}`, size: 20, bold: true, font: "Arial" })], spacing: { after: 60 } }) : null,
    cliente ? new Paragraph({ children: [new TextRun({ text: cliente, size: 24, bold: true, color: BLUE, font: "Arial" })], spacing: { after: 60 } }) : null,
    ciudad ? new Paragraph({ children: [new TextRun({ text: `Ciudad: ${ciudad}`, size: 20, font: "Arial" })], spacing: { after: 60 } }) : null,
    new Paragraph({ children: [new TextRun({ text: "Asunto: Propuesta Comercial", size: 20, bold: true, font: "Arial" })], spacing: { after: 200 } }),
  ).filter(Boolean);

  // Intro
  children.push(
    p("Somos Digital Platforms Colombia / Digital Network Colombia SAS, administramos la marca Pibox en Colombia. Hemos desarrollado tecnología de vanguardia para la logística, conectando a través de nuestra plataforma digital una de las redes de vehículos más extensas del país."),
    p("Cada driver cuenta con una App que le permite mantenerse conectado y garantizar una trazabilidad permanente, con actualización en tiempo real de cada estado del envío hasta su finalización."),
    p("Nuestra solución atiende de manera eficiente la primera y última milla para miles de usuarios, operando como una red de crowdsourcing de alto impacto."),
  );

  // ON DEMAND
  if (modulos.onDemand) {
    children.push(
      h2("⚡ Pibox On Demand"),
      note("El cálculo de la tarifa se determina de manera dinámica:"),
      makeTable(
        ["Ciudad", "Vehículo", "Km Base", "Tarifa Km Base", "Km Extra", "Parada Adicional", "VD / Ruta"],
        tarifas.onDemand.ciudades.map((c) => [c.ciudad, c.vehiculo, `${c.kmBase} Km`, fmt(c.tarifaKmBase), fmt(c.tarifaKmExtra), fmt(c.paradaAdicional), fmt(c.vdRuta)]),
        [1200, 1400, 900, 1400, 900, 1500, 1060]
      ),
      note("* Km base: tarifa mínima. * Km extra: conteo después del km base. * No se tiene recaudo contra entrega."),
      h3("Tarifas Adicionales"),
      makeTable(
        ["Ciudad", "Vehículo", "Tiempo Espera", "Tarifa Minuto", "Bonificación", "Recargo Periferia", "Aledaño", "Lejanía"],
        tarifas.onDemand.adicionales.map((a) => [a.ciudad, a.vehiculo, a.tiempoEspera, fmt(a.tarifaMinuto), fmt(a.bonificacion), fmt(a.recargo), fmt(a.aledanos ?? "N.A"), fmt(a.lejania ?? "N.A")]),
        [1000, 1000, 1200, 1200, 1100, 1100, 860, 900]
      ),
      h3("Políticas Comerciales y Operativas"),
      policyTable([
        ["Política de Recaudo", "Pilotos con base para pagar al recoger paquetes hasta $200.000."],
        ["Comodatos", "Para préstamos a un piloto, gestionar en la web la asignación en comodato."],
        ["Datáfonos", "Máximo valor declarado: $600.000."],
        ["Condiciones de Entrega", "La entrega se realiza frente al domicilio/comercio. No incluye ingreso a residencias."],
        ["Devoluciones", "Toda devolución genera cobro por km recorridos para retornar el paquete."],
      ]),
      h3("ANS — Moto"),
      note("Tiempo asignación Bogotá: ≤5 min (valle) / ≤10 min (pico) | Ejecución ≥96% (Q1-Q3) | Disponibilidad 24/7 | Soporte ≤3 min | Capacidad: 50×50×50 cm / 50kg"),
    );
  }

  // PROGRAMADO BLOQUE HORAS
  if (modulos.programadoBloqueHoras) {
    children.push(
      h2("🛵 Pibox Programado — Bloque de Horas"),
      note("Bloques mínimos de 4 horas con drivers fidelizados y rutas optimizadas."),
      makeTable(
        ["Ciudad", "Pilotos", "Horas/Día", "Tarifa/Hora", "Cobertura", "VD / Ruta", "Recaudo / Ruta"],
        tarifas.programadoBloqueHoras.reservas.map((r) => [r.ciudad, r.pilotos, r.horasDia, fmt(r.tarifaHora), r.cobertura, fmt(r.vdRuta), fmt(r.recaudoRuta)]),
        [1200, 800, 900, 1200, 1000, 1300, 1360]
      ),
      makeTable(
        ["% Recaudo Ida/Vuelta", "Parada en Falso", "Recargo Periferia", "Aledaño", "Lejanía"],
        [[`${tarifas.programadoBloqueHoras.adicionales.recaudoIdaVuelta}%`, fmt(tarifas.programadoBloqueHoras.adicionales.paradaEnFalso), fmt(tarifas.programadoBloqueHoras.adicionales.recargo), fmt(tarifas.programadoBloqueHoras.adicionales.aledanos ?? "N.A"), fmt(tarifas.programadoBloqueHoras.adicionales.lejania ?? "N.A")]],
        [1872, 1872, 1872, 1872, 1872]
      ),
      h3("Políticas Comerciales"),
      policyTable([
        ["Tareas de reserva", "Todas las reservas deben tener tareas asociadas para garantizar trazabilidad."],
        ["Política de Cancelación", "Mínimo 3 horas hábiles. Cancelaciones con menos de 4h generan parada en falso."],
        ["Datáfonos", "Máximo valor declarado: $600.000."],
      ]),
      note("ANS: Asignación 98% | Efectividad 97% | Cumplimiento tiempos 97% | Capacidad Moto: 50×50×50 / 50kg"),
    );
  }

  // PROGRAMADO RUTAS
  if (modulos.programadoRutas) {
    children.push(
      h2("🔁 Pibox Programado — Rutas"),
      note("Mínimo 10 entregas agrupables organizadas por sectores."),
      makeTable(
        ["Ciudad", "Paquetes/Ruta", "Paquetes/Día", "Tarifa Paquete", "VD / Ruta", "Recaudo / Ruta"],
        tarifas.programadoRutas.rutas.map((r) => [r.ciudad, r.paquetesPorRuta, r.paquetesDia, fmt(r.tarifaPaquete), fmt(r.vdRuta), fmt(r.recaudoRuta)]),
        [1200, 1300, 1300, 1500, 1400, 1660]
      ),
      makeTable(
        ["Medio Recaudo", "% Ida/Vuelta", "Intentos Entrega", "Tarifa Devoluciones", "Recargo Periferia", "Aledaño", "Lejanía"],
        [[tarifas.programadoRutas.adicionales.medioRecaudo, `${tarifas.programadoRutas.adicionales.recaudoIdaVuelta}%`, tarifas.programadoRutas.adicionales.intentosEntrega, fmt(tarifas.programadoRutas.adicionales.tarifaDevoluciones), fmt(tarifas.programadoRutas.adicionales.recargoPeriferia ?? 0), fmt(tarifas.programadoRutas.adicionales.aledanos ?? "N.A"), fmt(tarifas.programadoRutas.adicionales.lejania ?? "N.A")]],
        [1560, 1170, 1170, 1560, 1300, 1300, 1300]
      ),
      note("ANS: 98% | Hora recogida máxima: 3:00 PM | Capacidad Moto: 50×50×50 / 50kg"),
    );
  }

  // PICARGA
  if (modulos.picarga) {
    children.push(
      h2("🚚 Picarga"),
      makeTable(
        ["Ciudad", "Vehículo", "Km Base", "Tarifa Km Base", "Km Extra", "Parada Adicional", "VD / Ruta"],
        tarifas.picarga.ciudades.map((c) => [c.ciudad, c.vehiculo, `${c.kmBase} Km`, fmt(c.tarifaKmBase), fmt(c.tarifaKmExtra), fmt(c.paradaAdicional), fmt(c.vdRuta)]),
        [1200, 1400, 900, 1400, 900, 1500, 1060]
      ),
      h3("Tarifas Adicionales"),
      makeTable(
        ["Ciudad", "Vehículo", "Tiempo Espera", "Tarifa Minuto", "Bonificación"],
        tarifas.picarga.adicionales.map((a) => [a.ciudad, a.vehiculo, a.tiempoEspera, fmt(a.tarifaMinuto), fmt(a.bonificacion)]),
        [1872, 1872, 1872, 1872, 1872]
      ),
      note("Bogotá: ANS 98% (3h anticipación) | Medellín: ANS 95% (24h) | Carry: hasta 700kg"),
    );
  }

  // STORAGE
  if (modulos.storage) {
    children.push(
      h2("📦 Pibox Storage"),
      p("Operamos warehouses estratégicos que funcionan como puntos de almacenamiento, distribución y cross-docking. Nuestras instalaciones están diseñadas para optimizar su cadena logística con ubicaciones en las principales ciudades del país."),
      note("Las tarifas de Storage se presentan según volumetría y requerimientos específicos del cliente."),
    );
  }

  // COBERTURA
  if (modulos.cobertura) {
    children.push(
      h2("📍 Cobertura Pibox"),
      makeTable(
        ["Ciudad", "Área Metro.", "Periferia", "Aledaños", "Lejanías", "Zonas Rojas"],
        COBERTURA.map((r) => [r.ciudad, r.origen, r.periferia || "—", r.aledanos || "—", r.lejanias || "—", r.zonasRojas || "—"]),
        [900, 1500, 1700, 1600, 1600, 2060]
      ),
    );
  }

  // NOTAS
  if (notas) {
    children.push(
      h2("Notas de Negociación"),
      new Paragraph({
        children: [new TextRun({ text: notas, size: 20, font: "Arial", color: GRAY })],
        spacing: { after: 200 },
        shading: { fill: "FFFDE7", type: ShadingType.CLEAR },
      }),
    );
  }

  // Cierre
  children.push(
    new Paragraph({ children: [], spacing: { before: 400 } }),
    p("Quedamos atentos a sus comentarios y disponibles para una reunión de presentación detallada."),
    p("Cordialmente,"),
    new Paragraph({ children: [new TextRun({ text: "Equipo Comercial", bold: true, size: 22, color: BLUE, font: "Arial" })], spacing: { before: 200, after: 60 } }),
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "Pág. ", size: 16, font: "Arial", color: "999999" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: "999999" }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: children.filter(Boolean),
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `Propuesta_${(cliente || "Cliente").replace(/\s+/g, "_")}.docx`;
  saveAs(new Blob([buffer]), filename);
}
