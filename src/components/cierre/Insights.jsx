import { fmtMoney } from "./utils";
import { useMoneda } from "./MonedaContext";

function generarInsights(data, moneda, trm) {
  const M = (n) => fmtMoney(n, moneda, trm);
  const c = data.cumplimientoEquipo;
  const pct = ((c.gmv / c.meta) * 100).toFixed(1);
  const clienteTop    = [...data.top10Clientes].sort((a, b) => b.gmvActual - a.gmvActual)[0];
  const totalPerdidos = data.clientesPerdidos.reduce((a, c) => a + c.gmvMesAnterior, 0);
  const totalNuevos   = data.clientesNuevos.reduce((a, c) => a + c.gmv, 0);

  return {
    general: [
      {
        tipo: pct >= 95 ? "success" : pct >= 80 ? "warning" : "danger",
        icono: pct >= 95 ? "🏆" : pct >= 80 ? "⚡" : "🚨",
        titulo: `Cumplimiento del equipo: ${pct}%`,
        texto: pct >= 95
          ? "Excelente resultado. Se superó la meta mensual."
          : pct >= 80
          ? `Buen desempeño. A ${M(c.meta - c.gmv)} de alcanzar la meta.`
          : `El equipo no alcanzó la meta. Hay una brecha de ${M(c.meta - c.gmv)} por cerrar.`,
      },
      {
        tipo: "info",
        icono: "📉",
        titulo: "Impacto clientes perdidos",
        texto: `Se perdieron ${data.clientesPerdidos.length} clientes con GMV anterior de ${M(totalPerdidos)}, representando el ${((totalPerdidos / c.mesPasadoGmv) * 100).toFixed(1)}% de la facturación anterior.`,
      },
      {
        tipo: "success",
        icono: "🌱",
        titulo: "Clientes nuevos incorporados",
        texto: `Se incorporaron ${data.clientesNuevos.length} clientes con primer servicio de ${M(totalNuevos)}.`,
      },
      {
        tipo: "info",
        icono: "📊",
        titulo: `Concentración: ${clienteTop.cliente}`,
        texto: `Representa el ${clienteTop.participacion.toFixed(1)}% de la facturación total con ${M(clienteTop.gmvActual)}. Bavaria redujo -30.07% vs mes anterior.`,
      },
    ],
    porKAM: data.kams.map((k) => {
      const nuevos   = data.clientesNuevos.filter((c) => c.kam === k.nombre);
      const perdidos = data.clientesPerdidos.filter((c) => c.kam === k.nombre);
      const insights = [];

      if (k.cumplimiento >= 95)
        insights.push({ tipo: "success", texto: `Excelente cumplimiento del ${k.cumplimiento.toFixed(1)}%. Meta: ${M(k.meta)} · GMV: ${M(k.gmv)}` });
      else if (k.cumplimiento >= 80)
        insights.push({ tipo: "warning", texto: `Cumplimiento ${k.cumplimiento.toFixed(1)}%. A ${M(k.meta - k.gmv)} de la meta.` });
      else
        insights.push({ tipo: "danger", texto: `Cumplimiento bajo: ${k.cumplimiento.toFixed(1)}%. Brecha de ${M(k.meta - k.gmv)}.` });

      if (nuevos.length > 0)
        insights.push({ tipo: "success", texto: `${nuevos.length} clientes nuevos · GMV inicial: ${M(nuevos.reduce((a, c) => a + c.gmv, 0))}` });
      if (perdidos.length > 0)
        insights.push({ tipo: "danger", texto: `${perdidos.length} clientes perdidos · GMV anterior: ${M(perdidos.reduce((a, c) => a + c.gmvMesAnterior, 0))}` });

      return { kam: k.nombre, cumplimiento: k.cumplimiento, insights };
    }),
  };
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

      <h3 className="text-base font-semibold text-gray-700 mb-3">Por KAM</h3>
      <div className="grid md:grid-cols-2 gap-4">
        {porKAM.map((k) => (
          <div key={k.kam} className="rounded-xl border border-purple-100 p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="font-bold text-purple-700 text-sm">{k.kam}</p>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${k.cumplimiento >= 95 ? "bg-green-100 text-green-700" : k.cumplimiento >= 80 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
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
    </section>
  );
}
