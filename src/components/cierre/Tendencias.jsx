import { useState, useEffect } from "react";
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
  const parsed = parseMes(ult.mes);
  const ultMesIdx = parsed.mesIdx;
  // Si el año no viene en el label (e.g. "Mayo" sin año), inferir del actual
  let ultAnio = parsed.anio;
  if (ultAnio < 2020 && ultMesIdx >= 0) {
    const now = new Date();
    ultAnio = now.getFullYear();
    if (ultMesIdx > now.getMonth()) ultAnio -= 1;
  }

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

// ── Contexto del mercado — Última Milla Colombia ──────────────────────────
// Actualizado: Julio 2026 · Fuentes: CCCE, Valora Analitik, Portafolio, Inexmoda
const MERCADO_VERSION = "2026-07"; // año-mes en que se revisó este contenido

const CONTEXTO_MERCADO = [
  {
    titulo: "E-commerce Colombia — H1 2026",
    icono: "🛒",
    color: "blue",
    datos: [
      "Q1 2026: $39,7 billones COP (+14,5% YoY), 186,4M transacciones — mejor trimestre desde 2019.",
      "Q2 2026 (estimado): +12–15% YoY impulsado por temporada de mitad de año y Día del Padre.",
      "Cierre 2025: $145,4 billones COP, 684,6M operaciones — récord histórico (+19,9% en volumen).",
      "Colombia crece al doble de la media global (14,5% vs 7,2%). CAGR 2022–2026: 27,9%.",
      "Mobile commerce supera USD $12.000M en 2026; el 68% de compras se inician desde smartphone.",
    ],
    fuente: "CCCE / Americas Market Intelligence / MinComercio — Q1 2026",
  },
  {
    titulo: "Mensajería y Última Milla Colombia",
    icono: "📦",
    color: "green",
    datos: [
      "Mercado última milla Colombia: ~USD $800M estimado 2026, CAGR ~10% hasta 2030.",
      "Densidad de envíos crece en ciudades intermedias: Bucaramanga, Manizales, Ibagué y Pasto aceleran +18% YoY.",
      "Couriers tradicionales pierden participación: Servientrega -3,9%; operadores tech-enabled ganan +15% anual.",
      "Entregas same-day y next-day ya representan el 34% del mercado B2C urbano.",
      "Pibox: único operador postal tech autorizado por MinTIC; diferenciador clave en costos logísticos B2B.",
    ],
    fuente: "Valora Analitik / La República / Bonafide Research — Jun 2026",
  },
  {
    titulo: "Logística IA y Temporadas 2026",
    icono: "🚀",
    color: "purple",
    datos: [
      "IA en rutas reduce costos operativos hasta 20% y mejora tasa de éxito de primera entrega al 91%.",
      "Julio–Agosto: temporada baja; el sector proyecta -8% vs junio — ideal para optimizar cobertura.",
      "Sep–Dic: pico estacional (Amor y Amistad, Halloween, Black Friday, Navidad) concentra ~38% del GMV anual.",
      "Salario mínimo 2026 (+9,54%) presiona costos variables; operadores tech compensan con eficiencia algorítmica.",
      "Regulación MinTransporte 2026: nuevas exigencias de trazabilidad aceleran adopción de plataformas digitales.",
    ],
    fuente: "Portafolio / MinTransporte / Foro Económico Mundial — Jul 2026",
  },
];

// ── Detector de primer día hábil del mes ─────────────────────────────────
const MERCADO_KEY = "pibox_mercado_version";

function esPrimerDiaHabilMes(fecha = new Date()) {
  const dom = fecha.getDay(); // 0=dom, 6=sab
  return fecha.getDate() <= 7 && dom >= 1 && dom <= 5; // primera semana hábil
}

function getMesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function marcadoComoActualizado() {
  try { return localStorage.getItem(MERCADO_KEY) === getMesActual(); } catch { return false; }
}
function marcarActualizado() {
  try { localStorage.setItem(MERCADO_KEY, getMesActual()); } catch {}
}

// ── Componente ────────────────────────────────────────────────────────────
export default function Tendencias({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  // Banner primer día hábil
  const [bannerVisible, setBannerVisible] = useState(() =>
    esPrimerDiaHabilMes() && !marcadoComoActualizado()
  );
  const cerrarBanner = () => { marcarActualizado(); setBannerVisible(false); };

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
      <p className="text-sm text-gray-500 mb-3">Histórico GMV, estacionalidad y predicción — contexto del mercado colombiano</p>

      {/* Banner primer día hábil */}
      {bannerVisible && (
        <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-amber-800">🔔 Nuevo mes — Contexto del Mercado actualizado</p>
            <p className="text-xs text-amber-700 mt-0.5">
              El contenido de Última Milla Colombia fue revisado el {new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}.
              Versión: <strong>{MERCADO_VERSION}</strong>.
            </p>
          </div>
          <button onClick={cerrarBanner} className="text-amber-500 hover:text-amber-700 font-bold text-lg leading-none shrink-0">✕</button>
        </div>
      )}

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
          <LineChart data={chartData} margin={{ right: 50, left: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
            <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={45} />
            <YAxis tickFormatter={Mx} tick={{ fontSize: 10 }} />
            <Tooltip content={(props) => <TooltipMetaGMV {...props} fmt={Mx} fmtFull={M} />} />
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
        {/* Índice estacional — oculto en PDF */}
        <div className="cierre-print-hide">
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-600">Contexto del Mercado — Última Milla Colombia</h3>
          <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            Actualizado: {MERCADO_VERSION}
          </span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {CONTEXTO_MERCADO.map((ctx) => {
            const bg = ctx.color === "blue" ? "#eff6ff" : ctx.color === "green" ? "#f0fdf4" : "#faf5ff";
            const bd = ctx.color === "blue" ? "#bfdbfe" : ctx.color === "green" ? "#bbf7d0" : "#e9d5ff";
            const cl = ctx.color === "blue" ? "#1d4ed8" : ctx.color === "green" ? "#15803d" : "#7c22d4";
            return (
              <div key={ctx.titulo} className="rounded-xl p-4" style={{ backgroundColor: bg, border: `1px solid ${bd}` }}>
                <p className="font-bold text-sm mb-2" style={{ color: cl }}>{ctx.icono} {ctx.titulo}</p>
                <ul className="space-y-1.5">
                  {ctx.datos.map((d, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 mt-2 italic">{ctx.fuente}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights automáticos */}
      <div className="grid md:grid-cols-3 gap-3">
        {/* Análisis de tendencia */}
        <div className="bg-purple-50 rounded-xl p-3">
          <p className="font-semibold text-purple-700 text-sm">📈 Análisis de Tendencia</p>
          <p className="text-gray-600 mt-1 text-xs leading-relaxed">
            {ult ? (
              <>
                {tendenciaMes >= 0
                  ? `▲ GMV creció ${M(tendenciaMes)} (${prev?.gmv > 0 ? ((tendenciaMes / prev.gmv) * 100).toFixed(1) : "—"}%) respecto al mes anterior.`
                  : `▼ GMV cayó ${M(Math.abs(tendenciaMes))} (${prev?.gmv > 0 ? (Math.abs(tendenciaMes / prev.gmv) * 100).toFixed(1) : "—"}%) respecto al mes anterior.`}
                {" "}
                {yoyGrowth !== null
                  ? yoyGrowth >= 14
                    ? `Crecimiento interanual de +${yoyGrowth.toFixed(1)}% — por encima del promedio del sector e-commerce colombiano (14,5% Q1 2026). Ritmo sostenido.`
                    : yoyGrowth >= 0
                      ? `Crecimiento interanual de +${yoyGrowth.toFixed(1)}% — en línea con el mercado (sector crece ~14,5% YoY). Mantener estrategia.`
                      : `Contracción interanual de ${yoyGrowth.toFixed(1)}% — por debajo del mercado (+14,5%). Revisar retención y activación de cuentas.`
                  : "Sin datos del mismo mes del año anterior para comparativa interanual."
                }
              </>
            ) : "Carga la base plana mensual para ver el análisis de tendencia."}
          </p>
        </div>

        {/* Estacionalidad */}
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="font-semibold text-blue-700 text-sm">📊 Estacionalidad</p>
          <p className="text-gray-600 mt-1 text-xs leading-relaxed">
            {tendencias.length >= 6 ? (
              <>
                <strong>Meses fuertes</strong> (índice ≥ 1.10):{" "}
                {MESES.filter((_, i) => indices[i] >= 1.10).join(", ") || "—"}.{" "}
                <strong>Meses bajos</strong> (índice ≤ 0.90):{" "}
                {MESES.filter((_, i) => indices[i] > 0 && indices[i] <= 0.90).join(", ") || "—"}.{" "}
                {(() => {
                  const ultMes = ult ? parseMes(ult.mes).mesIdx : -1;
                  const idxActual = ultMes >= 0 ? indices[ultMes] : 0;
                  if (!idxActual) return "Carga más meses para calibrar la estacionalidad.";
                  if (idxActual >= 1.1) return `El mes actual es estacionalmente fuerte (índice ${idxActual.toFixed(2)}). Nov–Dic concentran ~38% del GMV anual (Black Friday, Navidad).`;
                  if (idxActual <= 0.9) return `El mes actual es estacionalmente bajo (índice ${idxActual.toFixed(2)}). Típico en Jul–Ago; ideal para optimizar cobertura y retención.`;
                  return `Mes neutral (índice ${idxActual.toFixed(2)}). El pico anual se concentra en Sep–Dic: Amor y Amistad, Halloween, Black Friday, Navidad.`;
                })()}
              </>
            ) : "Carga al menos 6 meses de tendencias para calcular estacionalidad confiable."}
          </p>
        </div>

        {/* Recomendación */}
        <div className="bg-green-50 rounded-xl p-3">
          <p className="font-semibold text-green-700 text-sm">🎯 Recomendación</p>
          <p className="text-gray-600 mt-1 text-xs leading-relaxed">
            {prediccion ? (
              <>
                <strong>Meta sugerida {prediccion.mes}:</strong> {M(prediccion.gmvPrediccion)}{" "}
                ({prediccion.crecInteranual >= 0 ? "+" : ""}{prediccion.crecInteranual}% interanual).{" "}
                {prediccion.indiceEstacional >= 1.05
                  ? "Mes estacionalmente fuerte — reforzar capacidad operativa, pilotos y acuerdos de SLA con clientes ancla."
                  : prediccion.indiceEstacional <= 0.95
                    ? "Mes bajo — priorizar retención de cuentas actuales, activar nuevos y preparar capacidad para el pico de septiembre."
                    : "Estacionalidad neutral — mantener ritmo operativo y preparar campaña Amor y Amistad (Sep) con clientes B2C."}
                {prediccion.tieneHistorico
                  ? ` Proyección basada en ${tendencias.length} meses de historia.`
                  : " Sin historial del mismo mes — aumentar meses cargados para mayor precisión."}
              </>
            ) : "Carga al menos 3 meses de tendencias para generar la proyección del mes siguiente."}
          </p>
        </div>
      </div>
    </section>
  );
}
