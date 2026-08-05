import { fmtMoney } from "./utils";
import { useMoneda } from "./MonedaContext";

function generarInsights(data, moneda, trm) {
  const M   = (n) => fmtMoney(n, moneda, trm);
  const pct = (n, d) => d > 0 ? ((n / d) * 100).toFixed(1) : "0";

  const c            = data.cumplimientoEquipo;
  const cumplPct     = Number(pct(c.gmv, c.meta));
  const clienteTop   = [...data.top10Clientes].sort((a, b) => b.gmvActual - a.gmvActual)[0];
  const totalPerdidos = data.clientesPerdidos.reduce((a, x) => a + x.gmvMesAnterior, 0);
  const totalNuevos   = data.clientesNuevos.reduce((a, x) => a + x.gmv, 0);

  // Cliente con mayor crecimiento y mayor caída (entre los que tenían mes anterior)
  const conAnterior = data.top10Clientes.filter((c) => c.gmvAnterior > 0);
  const mejorCrec   = conAnterior.length ? [...conAnterior].sort((a, b) => b.crecimiento - a.crecimiento)[0] : null;
  const peorCrec    = conAnterior.length ? [...conAnterior].sort((a, b) => a.crecimiento - b.crecimiento)[0] : null;

  // Utilidad neta del equipo
  const utilNeta     = c.utilidadNeta    || 0;
  const metaUtilNeta = c.metaUtilidadNeta || 0;
  const utilNetaPct  = Number(pct(utilNeta, c.gmv));
  const cumplUtil    = metaUtilNeta > 0 ? Number(pct(utilNeta, metaUtilNeta)) : null;

  // Línea de mayor GMV
  const lineas       = data.lineas || [];
  const lineaTop     = lineas.length ? [...lineas].sort((a, b) => b.gmv - a.gmv)[0] : null;

  // GMV Extra total del equipo
  const gmvExtraTotal = (data.kams || []).reduce((a, k) => a + (k.gmvExtra || 0), 0);

  const general = [];

  // Cumplimiento del equipo
  general.push({
    tipo:   cumplPct >= 95 ? "success" : cumplPct >= 80 ? "warning" : "danger",
    icono:  cumplPct >= 95 ? "🏆" : cumplPct >= 80 ? "⚡" : "🚨",
    titulo: `Cumplimiento del equipo: ${cumplPct}%`,
    texto:  cumplPct >= 95
      ? `Excelente resultado. Se superó la meta de ${M(c.meta)} con ${M(c.gmv)}.`
      : cumplPct >= 80
      ? `Buen desempeño. A ${M(c.meta - c.gmv)} de alcanzar la meta de ${M(c.meta)}.`
      : `El equipo no alcanzó la meta. Brecha de ${M(c.meta - c.gmv)} sobre ${M(c.meta)}.`,
  });

  // Clientes perdidos
  if (data.clientesPerdidos.length > 0) {
    const pctPerd = c.mesPasadoGmv > 0 ? ((totalPerdidos / c.mesPasadoGmv) * 100).toFixed(1) : "—";
    general.push({
      tipo:   "danger",
      icono:  "📉",
      titulo: `${data.clientesPerdidos.length} clientes perdidos`,
      texto:  `GMV anterior: ${M(totalPerdidos)} (${pctPerd}% de la facturación del mes pasado). Requieren plan de recuperación.`,
    });
  }

  // Clientes nuevos
  if (data.clientesNuevos.length > 0) {
    general.push({
      tipo:   "success",
      icono:  "🌱",
      titulo: `${data.clientesNuevos.length} clientes nuevos`,
      texto:  `Primer servicio por ${M(totalNuevos)}. Representan el ${pct(totalNuevos, c.gmv)}% del GMV actual.`,
    });
  }

  // Concentración del cliente top
  if (clienteTop) {
    const topCrec = clienteTop.gmvAnterior > 0
      ? `${clienteTop.crecimiento >= 0 ? "+" : ""}${clienteTop.crecimiento.toFixed(1)}% vs mes anterior`
      : "cliente nuevo este mes";
    general.push({
      tipo:   "info",
      icono:  "📊",
      titulo: `Concentración: ${clienteTop.cliente}`,
      texto:  `Representa el ${clienteTop.participacion.toFixed(1)}% del GMV total con ${M(clienteTop.gmvActual)}. ${topCrec}.`,
    });
  }

  // Cliente con mayor crecimiento
  if (mejorCrec && mejorCrec.crecimiento > 0) {
    general.push({
      tipo:   "success",
      icono:  "🚀",
      titulo: `Mayor crecimiento: ${mejorCrec.cliente}`,
      texto:  `Creció +${mejorCrec.crecimiento.toFixed(1)}% vs mes anterior (${M(mejorCrec.gmvAnterior)} → ${M(mejorCrec.gmvActual)}).`,
    });
  }

  // Cliente con mayor caída
  if (peorCrec && peorCrec.crecimiento < 0 && peorCrec.cliente !== mejorCrec?.cliente) {
    general.push({
      tipo:   "warning",
      icono:  "⚠️",
      titulo: `Mayor caída: ${peorCrec.cliente}`,
      texto:  `Redujo ${peorCrec.crecimiento.toFixed(1)}% vs mes anterior (${M(peorCrec.gmvAnterior)} → ${M(peorCrec.gmvActual)}).`,
    });
  }

  // Utilidad neta del equipo
  if (utilNeta > 0) {
    const cumplTexto = cumplUtil !== null
      ? ` Cumplimiento vs meta: ${cumplUtil}%.`
      : "";
    general.push({
      tipo:   cumplUtil === null ? "info" : cumplUtil >= 95 ? "success" : cumplUtil >= 80 ? "warning" : "danger",
      icono:  "💚",
      titulo: `Utilidad Neta: ${utilNetaPct}% sobre GMV`,
      texto:  `${M(utilNeta)} de utilidad neta sobre ${M(c.gmv)} GMV.${cumplTexto}`,
    });
  }

  // Línea principal
  if (lineaTop) {
    const pctLinea = pct(lineaTop.gmv, c.gmv);
    general.push({
      tipo:   "info",
      icono:  "📦",
      titulo: `Línea líder: ${lineaTop.nombre || lineaTop.linea}`,
      texto:  `Concentra el ${pctLinea}% del GMV total con ${M(lineaTop.gmv)}.`,
    });
  }

  // GMV Extra
  if (gmvExtraTotal > 0) {
    general.push({
      tipo:   "info",
      icono:  "🟠",
      titulo: "GMV Extra del equipo",
      texto:  `${M(gmvExtraTotal)} adicionales aportados por GMV Extra. Incluido en el cumplimiento de los KAMs.`,
    });
  }

  // ── Por KAM ──────────────────────────────────────────────────────────────────
  const porKAM = (data.kams || []).map((k) => {
    const nuevos   = data.clientesNuevos.filter((c)   => c.kam === k.nombre);
    const perdidos = data.clientesPerdidos.filter((c) => c.kam === k.nombre);
    const insights = [];
    const gmvEfectivo = (k.gmv || 0) + (k.gmvExtra || 0);

    // Cumplimiento GMV
    if (k.cumplimiento >= 95)
      insights.push({ tipo: "success", texto: `Excelente cumplimiento: ${k.cumplimiento.toFixed(1)}%. Meta ${M(k.meta)} · GMV ${M(k.gmv)}${k.gmvExtra > 0 ? ` + Extra ${M(k.gmvExtra)}` : ""}.` });
    else if (k.cumplimiento >= 80)
      insights.push({ tipo: "warning", texto: `Cumplimiento ${k.cumplimiento.toFixed(1)}%. A ${M(k.meta - gmvEfectivo)} de la meta${k.gmvExtra > 0 ? ` (incluye GMV Extra ${M(k.gmvExtra)})` : ""}.` });
    else
      insights.push({ tipo: "danger", texto: `Cumplimiento bajo: ${k.cumplimiento.toFixed(1)}%. Brecha de ${M(k.meta - gmvEfectivo)}${k.gmvExtra > 0 ? ` (incluye GMV Extra ${M(k.gmvExtra)})` : ""}.` });

    // Clientes
    if (nuevos.length > 0)
      insights.push({ tipo: "success", texto: `${nuevos.length} clientes nuevos · GMV inicial: ${M(nuevos.reduce((a, c) => a + c.gmv, 0))}` });
    if (perdidos.length > 0)
      insights.push({ tipo: "danger", texto: `${perdidos.length} clientes perdidos · GMV anterior: ${M(perdidos.reduce((a, c) => a + c.gmvMesAnterior, 0))}` });

    // Utilidad Neta por KAM
    const kUtilNeta   = k.utilidadNeta    || 0;
    const kMetaUtil   = k.metaUtilidadNeta || 0;
    if (kUtilNeta > 0) {
      const kUtilPct    = k.gmv > 0 ? ((kUtilNeta / k.gmv) * 100).toFixed(1) : "—";
      const kCumplUtil  = kMetaUtil > 0 ? ((kUtilNeta / kMetaUtil) * 100).toFixed(1) : null;
      insights.push({
        tipo: kCumplUtil === null ? "info" : Number(kCumplUtil) >= 95 ? "success" : Number(kCumplUtil) >= 80 ? "warning" : "danger",
        texto: `Util. Neta ${M(kUtilNeta)} (${kUtilPct}% GMV)${kCumplUtil !== null ? ` · ${kCumplUtil}% de la meta` : ""}.`,
      });
    }

    return { kam: k.nombre, cumplimiento: k.cumplimiento, insights };
  });

  return { general, porKAM };
}

const COLORES_TIPO = {
  success: "bg-green-50 border-green-200 text-green-700",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
  danger:  "bg-red-50 border-red-200 text-red-700",
  info:    "bg-blue-50 border-blue-200 text-blue-700",
};

export default function Insights({ data }) {
  const { moneda, trm } = useMoneda();
  const { general, porKAM } = generarInsights(data, moneda, trm);

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-bold text-purple-800 mb-4">💡 Insights y Análisis Inteligente</h2>

      <h3 className="text-base font-semibold text-gray-700 mb-3">Generales del Equipo</h3>
      <div className="grid md:grid-cols-2 gap-3 mb-6">
        {general.map((ins, i) => (
          <div key={i} className={`rounded-xl border p-4 ${COLORES_TIPO[ins.tipo]}`}>
            <p className="font-semibold mb-1 text-sm">{ins.icono} {ins.titulo}</p>
            <p className="text-xs opacity-90">{ins.texto}</p>
          </div>
        ))}
      </div>

      {porKAM.length > 0 && (
        <>
          <h3 className="text-base font-semibold text-gray-700 mb-3">Por KAM</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {porKAM.map((k) => (
              <div key={k.kam} className="rounded-xl border border-purple-100 p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-bold text-purple-700 text-sm">{k.kam}</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    k.cumplimiento >= 95 ? "bg-green-100 text-green-700"
                    : k.cumplimiento >= 80 ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                  }`}>
                    {k.cumplimiento.toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-2">
                  {k.insights.map((ins, i) => (
                    <p key={i} className={`text-xs rounded-lg p-2 border ${COLORES_TIPO[ins.tipo]}`}>{ins.texto}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
