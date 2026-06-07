import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, ReferenceLine,
} from "recharts";
import { fmtMoney, fmtM, PIBOX_PURPLE, PIBOX_PINK } from "./utils";
import { useMoneda } from "./MonedaContext";
import { TooltipMetaGMV } from "./TooltipCustom";

// ── Helpers ───────────────────────────────────────────────────────────────
const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_LARGO = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_UPPER = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];

function parseMes(label) {
  const parts = label.trim().split(/\s+/);
  const nombre = parts[0];
  // Buscar en abreviado, completo y mayúsculas
  let mesIdx = MESES_CORTO.indexOf(nombre);
  if (mesIdx < 0) mesIdx = MESES_LARGO.indexOf(nombre);
  if (mesIdx < 0) mesIdx = MESES_UPPER.indexOf(nombre.toUpperCase());
  if (mesIdx < 0) {
    // Buscar por las primeras 3 letras
    const n3 = nombre.slice(0, 3).toLowerCase();
    mesIdx = MESES_CORTO.findIndex((m) => m.toLowerCase() === n3);
  }
  const raw = parseInt(parts[1] || "0");
  const anio = raw < 100 ? 2000 + raw : raw;
  return { mesIdx, anio, mesNum: mesIdx + 1 };
}

// Para generar labels siempre usamos el formato corto
const MESES = MESES_CORTO;

function calcEstacionalidad(tendencias) {
  // Índice estacional: promedio del GMV de cada mes / promedio general
  const porMes = Array.from({ length: 12 }, () => []);
  tendencias.forEach((t) => {
    const { mesIdx } = parseMes(t.mes);
    if (mesIdx >= 0) porMes[mesIdx].push(t.gmv);
  });
  const promedios = porMes.map((arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const promedioGlobal = promedios.filter(Boolean).reduce((a, b) => a + b, 0) / promedios.filter(Boolean).length || 1;
  return promedios.map((avg) => avg ? parseFloat((avg / promedioGlobal).toFixed(3)) : 0);
}

function predecirSiguienteMes(tendencias) {
  if (tendencias.length < 3) return null;
  const indices = calcEstacionalidad(tendencias);
  const ult = tendencias[tendencias.length - 1];
  const { mesIdx: ultMesIdx, anio: ultAnio } = parseMes(ult.mes);

  // El mes siguiente al último dato
  const sigMesIdx = (ultMesIdx + 1) % 12;
  const sigAnio = ultMesIdx === 11 ? ultAnio + 1 : ultAnio;
  const sigLabel = `${MESES[sigMesIdx]} ${String(sigAnio).slice(-2)}`;

  // Buscar el mismo mes calendario en años anteriores para crecimiento interanual
  const mismosAnios = tendencias.filter((t) => parseMes(t.mes).mesIdx === sigMesIdx);
  let crecInteranual = 0.15; // default 15% si no hay datos históricos del mismo mes
  if (mismosAnios.length >= 2) {
    const sorted = [...mismosAnios].sort((a, b) => parseMes(a.mes).anio - parseMes(b.mes).anio);
    const ultimo = sorted[sorted.length - 1].gmv;
    const penultimo = sorted[sorted.length - 2].gmv;
    crecInteranual = penultimo > 0 ? (ultimo - penultimo) / penultimo : 0.15;
  }

  // Base: GMV del mismo mes del año más reciente (o el último dato si no hay)
  const baseGmv = mismosAnios.length > 0
    ? [...mismosAnios].sort((a, b) => parseMes(a.mes).anio - parseMes(b.mes).anio).pop().gmv
    : ult.gmv;

  const indiceEstacional = indices[sigMesIdx] > 0 ? indices[sigMesIdx] : 1;

  // Predicción: base * (1 + crecimiento interanual)
  // Si hay datos del mismo mes del año anterior, usamos crecimiento interanual directo
  // Si no, usamos el GMV actual ajustado por estacionalidad relativa
  let prediccionGmv;
  if (mismosAnios.length >= 1) {
    prediccionGmv = Math.round(baseGmv * (1 + crecInteranual));
  } else {
    // Sin datos del mismo mes: usar último GMV * ratio estacional
    const ultIndice = indices[ultMesIdx] > 0 ? indices[ultMesIdx] : 1;
    prediccionGmv = Math.round(ult.gmv * (indiceEstacional / ultIndice));
  }

  // Servicios predicción
  const mismosServ = tendencias.filter((t) => parseMes(t.mes).mesIdx === sigMesIdx && t.servicios);
  let predServicios = 0;
  if (mismosServ.length > 0) {
    const ultServ = [...mismosServ].sort((a, b) => parseMes(a.mes).anio - parseMes(b.mes).anio).pop().servicios;
    predServicios = Math.round(ultServ * (1 + crecInteranual));
  }

  // Índice estacional seguro (nunca 0)
  const indiceDisplay = indiceEstacional > 0 ? indiceEstacional : 1;

  return {
    mes: sigLabel,
    gmvPrediccion: prediccionGmv,
    serviciosPrediccion: predServicios,
    crecInteranual: parseFloat((crecInteranual * 100).toFixed(1)),
    indiceEstacional: indiceDisplay,
    tieneHistorico: mismosAnios.length >= 1,
  };
}

// ── Datos de contexto del mercado colombiano ──────────────────────────────
// Fuentes: CCCE (Cámara Colombiana de Comercio Electrónico), MinTIC, DANE
const CONTEXTO_MERCADO = [
  {
    titulo: "E-commerce Colombia (CCCE)",
    datos: [
      "El comercio electrónico en Colombia creció 12.4% en 2024 alcanzando $72 billones COP",
      "Logística de última milla representa el 53% del costo total de envío e-commerce",
      "68% de los compradores esperan entrega en menos de 48 horas",
      "Categorías líderes: moda (22%), tecnología (18%), alimentos (15%)",
    ],
    fuente: "CCCE — Informe de comercio electrónico 2024",
    color: "blue",
  },
  {
    titulo: "Transformación Digital (MinTIC)",
    datos: [
      "73% de las MiPyMEs colombianas ya venden por canales digitales",
      "Penetración internet: 78.2% de hogares colombianos conectados",
      "El gobierno proyecta 85% de penetración para 2026",
      "Programa 'Última Milla Digital' busca conectar zonas rurales",
    ],
    fuente: "MinTIC — Colombia Digital 2024-2026",
    color: "green",
  },
  {
    titulo: "Oportunidades Última Milla",
    datos: [
      "Mercado de última milla en LATAM: USD $8.2B (crecimiento 18% anual)",
      "Colombia es el 4° mercado de e-commerce en LATAM",
      "Picos estacionales: Nov-Dic (+40%), May (Día Madre +25%), Jun (Día Padre +15%)",
      "Tendencia: micro-fulfillment y dark stores en ciudades principales",
    ],
    fuente: "Análisis sectorial — Logística e-commerce Colombia",
    color: "purple",
  },
];

// ── Componente ────────────────────────────────────────────────────────────
export default function Tendencias({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  const tendencias = data.tendencias || [];
  const indices = calcEstacionalidad(tendencias);
  const prediccion = predecirSiguienteMes(tendencias);

  // Chart principal: últimos 13 meses + predicción
  const ultimos13 = tendencias.slice(-13);
  const chartData = ultimos13.map((t) => ({
    mes: t.mes,
    Meta: conv(t.meta),
    GMV: conv(t.gmv),
    metaOrig: t.meta,
    gmvOrig: t.gmv,
  }));
  if (prediccion) {
    chartData.push({
      mes: `${prediccion.mes} (P)`,
      Meta: null,
      GMV: null,
      Predicción: conv(prediccion.gmvPrediccion),
    });
  }

  // Estacionalidad chart
  const estacionalData = MESES.map((m, i) => ({
    mes: m,
    indice: indices[i],
    color: indices[i] >= 1.1 ? "#22c55e" : indices[i] <= 0.9 ? "#ef4444" : "#8b5cf6",
  }));

  // YoY comparison
  const ult = tendencias[tendencias.length - 1];
  const prev = tendencias.length >= 2 ? tendencias[tendencias.length - 2] : null;
  const tendenciaMes = ult && prev ? ult.gmv - prev.gmv : 0;

  // Mismo mes año anterior
  const ultParsed = ult ? parseMes(ult.mes) : null;
  const mismoMesAnioAnt = ultParsed ? tendencias.find((t) => {
    const p = parseMes(t.mes);
    return p.mesIdx === ultParsed.mesIdx && p.anio === ultParsed.anio - 1;
  }) : null;
  const yoyGrowth = mismoMesAnioAnt && mismoMesAnioAnt.gmv > 0
    ? ((ult.gmv - mismoMesAnioAnt.gmv) / mismoMesAnioAnt.gmv * 100)
    : null;

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-bold text-purple-800 mb-1">Tendencias y Análisis Estacional</h2>
      <p className="text-sm text-gray-500 mb-4">Histórico GMV, estacionalidad y predicción — contexto del mercado colombiano</p>

      {/* KPIs */}
      <div className="flex flex-wrap gap-3 mb-5 text-sm">
        <div className={`rounded-lg px-3 py-2 ${tendenciaMes >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <p className="text-gray-500 text-xs">Var. vs mes anterior</p>
          <p className={`font-bold ${tendenciaMes >= 0 ? "text-green-600" : "text-red-500"}`}>
            {tendenciaMes >= 0 ? "▲" : "▼"} {M(Math.abs(tendenciaMes))}
          </p>
        </div>
        {yoyGrowth !== null && (
          <div className={`rounded-lg px-3 py-2 ${yoyGrowth >= 0 ? "bg-blue-50" : "bg-red-50"}`}>
            <p className="text-gray-500 text-xs">Crecimiento interanual</p>
            <p className={`font-bold ${yoyGrowth >= 0 ? "text-blue-600" : "text-red-500"}`}>
              {yoyGrowth >= 0 ? "▲" : "▼"} {Math.abs(yoyGrowth).toFixed(1)}%
            </p>
          </div>
        )}
        <div className="rounded-lg px-3 py-2 bg-purple-50">
          <p className="text-gray-500 text-xs">Meses de datos</p>
          <p className="font-bold text-purple-700">{tendencias.length} meses</p>
        </div>
        {prediccion && (
          <div className="rounded-lg px-3 py-2 bg-amber-50 border border-amber-200">
            <p className="text-gray-500 text-xs">Predicción {prediccion.mes}</p>
            <p className="font-bold text-amber-700">{M(prediccion.gmvPrediccion)}</p>
          </div>
        )}
      </div>

      {/* Gráfica principal: GMV vs Meta */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">GMV vs Meta — últimos 13 meses</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
            <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={45} />
            <YAxis tickFormatter={Mx} tick={{ fontSize: 10 }} />
            <Tooltip content={(props) => <TooltipMetaGMV {...props} fmt={Mx} />} />
            <Legend />
            <Line type="monotone" dataKey="Meta" name="Meta" stroke={PIBOX_PURPLE} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="GMV" name="GMV Real" stroke={PIBOX_PINK} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            {prediccion && (
              <Line type="monotone" dataKey="Predicción" name="Predicción" stroke="#f59e0b" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 5, fill: "#f59e0b" }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Índice estacional */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Índice Estacional por Mes</h3>
          <p className="text-xs text-gray-400 mb-2">Valores {">"} 1.0 = mes fuerte, {"<"} 1.0 = mes bajo</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={estacionalData}>
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, "auto"]} tick={{ fontSize: 10 }} />
              <ReferenceLine y={1} stroke="#9ca3af" strokeDasharray="3 3" />
              <Tooltip formatter={(v) => v.toFixed(3)} />
              <Bar dataKey="indice" name="Índice" radius={[4, 4, 0, 0]}>
                {estacionalData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Predicción detallada */}
        {prediccion && (
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Predicción: {prediccion.mes}</h3>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">GMV estimado</span>
                <span className="text-lg font-bold text-amber-700">{M(prediccion.gmvPrediccion)}</span>
              </div>
              {prediccion.serviciosPrediccion > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Servicios estimados</span>
                  <span className="text-sm font-bold text-amber-700">{prediccion.serviciosPrediccion.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Crec. interanual base</span>
                <span className={`text-sm font-bold ${prediccion.crecInteranual >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {prediccion.crecInteranual >= 0 ? "+" : ""}{prediccion.crecInteranual}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Índice estacional</span>
                <span className="text-sm font-bold text-purple-700">{prediccion.indiceEstacional.toFixed(3)}</span>
              </div>
              <p className="text-xs text-gray-400 border-t border-amber-200 pt-2">
                {prediccion.tieneHistorico
                  ? `Metodología: GMV de ${prediccion.mes.split(" ")[0]} del año anterior × (1 + crecimiento interanual ${prediccion.crecInteranual >= 0 ? "+" : ""}${prediccion.crecInteranual}%). Basado en ${tendencias.length} meses de historia.`
                  : `Metodología: GMV actual ajustado por ratio estacional relativo (${prediccion.indiceEstacional.toFixed(3)}). Sin datos históricos de ${prediccion.mes.split(" ")[0]} — se recomienda cargar más años para mejorar la predicción.`
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Contexto del mercado colombiano */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Contexto del Mercado — Última Milla Colombia</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {CONTEXTO_MERCADO.map((ctx) => (
            <div key={ctx.titulo} className={`bg-${ctx.color}-50 border border-${ctx.color}-200 rounded-xl p-4`}
              style={{
                backgroundColor: ctx.color === "blue" ? "#eff6ff" : ctx.color === "green" ? "#f0fdf4" : "#faf5ff",
                borderColor: ctx.color === "blue" ? "#bfdbfe" : ctx.color === "green" ? "#bbf7d0" : "#e9d5ff",
              }}
            >
              <p className="font-bold text-sm mb-2" style={{
                color: ctx.color === "blue" ? "#1d4ed8" : ctx.color === "green" ? "#15803d" : "#7c22d4",
              }}>
                {ctx.color === "blue" ? "🛒" : ctx.color === "green" ? "📱" : "🚀"} {ctx.titulo}
              </p>
              <ul className="space-y-1.5">
                {ctx.datos.map((d, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-400 mt-2 italic">{ctx.fuente}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Insights automáticos */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-purple-50 rounded-xl p-3">
          <p className="font-semibold text-purple-700 text-sm">📈 Análisis de Tendencia</p>
          <p className="text-gray-600 mt-1 text-xs">
            {tendenciaMes >= 0
              ? `GMV creció ${M(tendenciaMes)} vs mes anterior. `
              : `GMV cayó ${M(Math.abs(tendenciaMes))} vs mes anterior. `}
            {yoyGrowth !== null && (
              yoyGrowth >= 0
                ? `Crecimiento interanual de +${yoyGrowth.toFixed(1)}%, por encima del promedio del sector e-commerce (12.4%).`
                : `Contracción interanual de ${yoyGrowth.toFixed(1)}%. Revisar estrategia de retención.`
            )}
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="font-semibold text-blue-700 text-sm">📊 Estacionalidad</p>
          <p className="text-gray-600 mt-1 text-xs">
            Meses fuertes: {MESES.filter((_, i) => indices[i] >= 1.1).join(", ") || "—"}.
            Meses bajos: {MESES.filter((_, i) => indices[i] > 0 && indices[i] <= 0.9).join(", ") || "—"}.
            Nov-Dic concentran la mayor actividad, alineado con Black Friday, Navidad y el pico del e-commerce colombiano.
          </p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="font-semibold text-green-700 text-sm">🎯 Recomendación</p>
          <p className="text-gray-600 mt-1 text-xs">
            {prediccion
              ? `Para ${prediccion.mes}: apuntar a ${M(prediccion.gmvPrediccion)} de GMV. ${prediccion.indiceEstacional >= 1.05 ? "Mes estacionalmente fuerte — reforzar capacidad operativa y pilotos." : prediccion.indiceEstacional <= 0.95 ? "Mes estacionalmente bajo — enfocarse en retención de clientes y activación de nuevos." : "Mes con estacionalidad neutral — mantener ritmo operativo."}`
              : "Cargar más datos históricos para generar predicciones más precisas."}
          </p>
        </div>
      </div>
    </section>
  );
}
