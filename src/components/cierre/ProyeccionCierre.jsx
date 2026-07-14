import { useState, useMemo } from "react";
import {
  ComposedChart, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Line, Area, ReferenceLine,
} from "recharts";
import { fmtMoney, fmtM, PIBOX_PURPLE, PIBOX_PINK } from "./utils";
import { useMoneda } from "./MonedaContext";

const GREEN  = "#16A34A";
const YELLOW = "#D97706";
const RED    = "#DC2626";
const ORANGE = "#EA580C";
const BLUE   = "#2563EB";

/** Abbreviated currency format */
function fmtAbr(n) {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

function fmtFull(n) {
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

function parseNumericInput(val) {
  const cleaned = val.replace(/[^0-9]/g, "");
  return cleaned === "" ? 0 : Number(cleaned);
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = "purple", children }) {
  const bgMap = {
    purple: "bg-purple-50",
    pink: "bg-pink-50",
    orange: "bg-orange-50",
    blue: "bg-blue-50",
    green: "bg-green-50",
    gray: "bg-gray-50",
  };
  const textMap = {
    purple: "text-purple-700",
    pink: "text-pink-600",
    orange: "text-orange-600",
    blue: "text-blue-600",
    green: "text-green-600",
    gray: "text-gray-600",
  };
  return (
    <div className={`${bgMap[accent] || bgMap.purple} rounded-xl p-4 min-w-[150px]`}>
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      {children || (
        <p className={`font-bold text-base ${textMap[accent] || textMap.purple}`}>{value}</p>
      )}
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Editable Money Input ────────────────────────────────────────────────────
function EditableMoneyInput({ label, value, onChange, accent = "orange" }) {
  const bgMap = { orange: "bg-orange-50", blue: "bg-blue-50" };
  const borderMap = { orange: "border-orange-300", blue: "border-blue-300" };
  const textMap = { orange: "text-orange-700", blue: "text-blue-700" };

  return (
    <div className={`${bgMap[accent]} rounded-xl p-4 min-w-[150px]`}>
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <div className="relative">
        <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-sm font-bold ${textMap[accent]}`}>$</span>
        <input
          type="text"
          value={Math.round(value).toLocaleString("es-CO")}
          onChange={(e) => onChange(parseNumericInput(e.target.value))}
          className={`w-full pl-6 pr-2 py-1.5 rounded-lg border ${borderMap[accent]} bg-white text-sm font-bold ${textMap[accent]} focus:outline-none focus:ring-2 focus:ring-purple-300`}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">Editable</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ProyeccionCierre({ data, printing = false }) {
  const { moneda, trm } = useMoneda();
  const M = (n) => fmtMoney(n, moneda, trm);

  const rawProy = data.proyeccion;

  // Normalizar valores a números (pueden venir como strings desde Config)
  const proy = rawProy ? {
    mesProyeccion: rawProy.mesProyeccion || "",
    metaMes: Number(rawProy.metaMes) || 0,
    gmvActual: Number(rawProy.gmvActual) || 0,
    gmvTadaPendiente: Number(rawProy.gmvTadaPendiente) || 0,
    gmvStoragePendiente: Number(rawProy.gmvStoragePendiente) || 0,
    utilidadPct: Number(rawProy.utilidadPct) || 0,
    utilidadValor: Number(rawProy.utilidadValor) || 0,
    diasTranscurridos: Number(rawProy.diasTranscurridos) || 0,
    diasTotalesMes: Number(rawProy.diasTotalesMes) || 30,
    gmvMesPasado: Number(rawProy.gmvMesPasado) || 0,
    kams: rawProy.kams || [],
    archivoOps: rawProy.archivoOps || "",
    diasEvolucion: Number(rawProy.diasEvolucion) || 0,
  } : null;

  const [tadaPendiente, setTadaPendiente] = useState(proy?.gmvTadaPendiente || 0);
  const [storagePendiente, setStoragePendiente] = useState(proy?.gmvStoragePendiente || 0);

  // ── Computed values ──────────────────────────────────────────────────────
  const calc = useMemo(() => {
    if (!proy) return null;

    const gmvTotal = proy.gmvActual + tadaPendiente + storagePendiente;
    const cumplPct = proy.metaMes > 0 ? (gmvTotal / proy.metaMes) * 100 : 0;
    const cumplActualPct = proy.metaMes > 0 ? (proy.gmvActual / proy.metaMes) * 100 : 0;
    const utilidad = proy.utilidadValor > 0 ? proy.utilidadValor : gmvTotal * (proy.utilidadPct / 100);
    const utilidadPctCalc = gmvTotal > 0 ? (utilidad / gmvTotal * 100) : 0;
    const gap = proy.metaMes - gmvTotal;

    const promDiario = proy.diasTranscurridos > 0 ? proy.gmvActual / proy.diasTranscurridos : 0;
    const proyFinMes = promDiario * proy.diasTotalesMes;
    const diasRestantes = proy.diasTotalesMes - proy.diasTranscurridos;
    const ritmoNecesario = diasRestantes > 0 ? (proy.metaMes - proy.gmvActual) / diasRestantes : 0;

    const vsMesPasadoAbs = proy.gmvActual - proy.gmvMesPasado;
    const vsMesPasadoPct = proy.gmvMesPasado > 0 ? (vsMesPasadoAbs / proy.gmvMesPasado) * 100 : 0;

    // Traffic light
    let semaforo = "rojo";
    if (proyFinMes >= proy.metaMes) semaforo = "verde";
    else if (proyFinMes + tadaPendiente + storagePendiente >= proy.metaMes) semaforo = "amarillo";

    return {
      gmvTotal, cumplPct, cumplActualPct, utilidad, utilidadPctCalc, gap,
      promDiario, proyFinMes, diasRestantes, ritmoNecesario,
      vsMesPasadoAbs, vsMesPasadoPct, semaforo,
    };
  }, [proy, tadaPendiente, storagePendiente]);

  // ── No projection data ─────────────────────────────────────────────────
  if (!rawProy) {
    return (
      <section className="bg-white rounded-2xl shadow-md p-6">
        <h2 className="text-xl font-bold text-purple-800 mb-2">Proyeccion de Cierre</h2>
        <div className="flex items-center gap-3 bg-purple-50 rounded-xl p-6">
          <span className="text-3xl">⚙️</span>
          <p className="text-purple-700 font-medium">
            Configura la proyeccion en ⚙️ Config para ver el analisis.
          </p>
        </div>
      </section>
    );
  }

  // ── Bar widths for stacked progress ────────────────────────────────────
  const maxVal = Math.max(calc.gmvTotal, proy.metaMes) * 1.1;
  const wActual  = (proy.gmvActual / maxVal) * 100;
  const wTada    = (tadaPendiente / maxVal) * 100;
  const wStorage = (storagePendiente / maxVal) * 100;
  const metaLine = (proy.metaMes / maxVal) * 100;

  // ── KAM data: merge proyeccion KAMs con data.kams ──────────────────────
  const diasT = proy.diasTranscurridos || 1;
  const diasTot = proy.diasTotalesMes || 30;
  // Si hay KAMs en proyeccion, usar esos. Si no, merge con data.kams
  const allKams = proy.kams && proy.kams.length > 0
    ? proy.kams.map(pk => ({
        nombre: pk.nombre,
        meta: Number(pk.meta) || 0,
        gmv: Number(pk.gmv) || 0,
        gmvExtra: Number(pk.gmvExtra) || 0,
      }))
    : (data.kams || []).map(k => ({ nombre: k.nombre, meta: k.meta, gmv: k.gmv, gmvExtra: 0 }));

  const kamsData = allKams.filter(k => k.nombre).map((k) => {
    const effectiveGmv = (k.gmv || 0) + (k.gmvExtra || 0);
    return {
      nombre: k.nombre,
      meta: k.meta,
      gmv: k.gmv,
      gmvExtra: k.gmvExtra || 0,
      effectiveGmv,
      cumplimiento: k.meta > 0 ? (effectiveGmv / k.meta * 100) : 0,
      falta: Math.max(0, k.meta - effectiveGmv),
      promDiario: diasT > 0 ? effectiveGmv / diasT : 0,
      proyFin: diasT > 0 ? (effectiveGmv / diasT) * diasTot : 0,
    };
  });

  const kamChartData = kamsData.map((k) => ({
    nombre: k.nombre,
    Meta: moneda === "USD" ? k.meta / trm : k.meta,
    GMV: moneda === "USD" ? k.effectiveGmv / trm : k.effectiveGmv,
  }));

  const semaforoColor = calc.semaforo === "verde" ? GREEN : calc.semaforo === "amarillo" ? YELLOW : RED;
  const semaforoLabel = calc.semaforo === "verde" ? "En camino" : calc.semaforo === "amarillo" ? "Posible con pendientes" : "Riesgo alto";

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 space-y-8">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-purple-800">Proyección de Cierre</h2>
          <p className="text-sm text-gray-500">{proy.mesProyeccion || data.mes}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: semaforoColor }}
          />
          <span className="text-sm font-semibold" style={{ color: semaforoColor }}>
            {semaforoLabel}
          </span>
        </div>
      </div>

      {/* ── Section 1: KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Meta del Mes" value={M(proy.metaMes)} accent="purple" />
        <KpiCard
          label="GMV en Sistema"
          value={M(proy.gmvActual)}
          sub={`${calc.cumplActualPct.toFixed(1)}% cumplimiento`}
          accent="pink"
        />
        <EditableMoneyInput
          label="GMV TaDa Pendiente"
          value={tadaPendiente}
          onChange={setTadaPendiente}
          accent="orange"
        />
        <EditableMoneyInput
          label="GMV Storage Pendiente"
          value={storagePendiente}
          onChange={setStoragePendiente}
          accent="blue"
        />
        <KpiCard
          label="GMV Total Proyectado"
          value={M(calc.gmvTotal)}
          accent="green"
        />
        <KpiCard
          label="Cumplimiento Proyectado"
          value={`${calc.cumplPct.toFixed(1)}%`}
          accent={calc.cumplPct >= 95 ? "green" : calc.cumplPct >= 80 ? "orange" : "pink"}
        />
        <KpiCard
          label="Utilidad Proyectada"
          value={M(calc.utilidad)}
          sub={`${calc.utilidadPctCalc.toFixed(1)}% sobre GMV`}
          accent="purple"
        />
        <KpiCard
          label="Dias Transcurridos"
          value={`${proy.diasTranscurridos} / ${proy.diasTotalesMes}`}
          sub={`${((proy.diasTranscurridos / proy.diasTotalesMes) * 100).toFixed(0)}% del mes`}
          accent="gray"
        />
      </div>

      {/* ── Section 2: Cumplimiento visual ───────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold text-gray-700 mb-3">Cumplimiento Visual</h3>
        <div className="bg-gray-50 rounded-xl p-5">
          {(() => {
            const umbral80 = proy.metaMes * 0.8;
            const umbral80Line = (umbral80 / maxVal) * 100;
            const faltaPara80 = umbral80 - calc.gmvTotal;
            const faltaPara80SinPend = umbral80 - proy.gmvActual;
            const [hover, setHover] = useState(null);

            return (
              <>
                {/* Stacked bar */}
                <div className="relative h-12 bg-gray-200 rounded-full overflow-visible cursor-pointer"
                  onMouseLeave={() => setHover(null)}>
                  {/* Barra GMV Actual */}
                  <div className="absolute inset-y-0 left-0 rounded-l-full bg-purple-600 transition-all"
                    style={{ width: `${Math.min(wActual, 100)}%` }}
                    onMouseEnter={() => setHover("actual")} />
                  {/* Barra TaDa */}
                  <div className="absolute inset-y-0 bg-orange-400 transition-all"
                    style={{ left: `${Math.min(wActual, 100)}%`, width: `${Math.min(wTada, 100 - wActual)}%` }}
                    onMouseEnter={() => setHover("tada")} />
                  {/* Barra Storage */}
                  <div className="absolute inset-y-0 bg-blue-500 transition-all"
                    style={{ left: `${Math.min(wActual + wTada, 100)}%`, width: `${Math.min(wStorage, 100 - wActual - wTada)}%`, borderRadius: storagePendiente > 0 ? "0 9999px 9999px 0" : 0 }}
                    onMouseEnter={() => setHover("storage")} />

                  {/* Línea umbral 80% */}
                  <div className="absolute top-[-8px] bottom-[-8px] w-0.5 border-l-2 border-dashed border-yellow-500"
                    style={{ left: `${Math.min(umbral80Line, 100)}%` }}>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-yellow-600 whitespace-nowrap bg-yellow-50 px-1 rounded">
                      80%: {fmtAbr(umbral80)}
                    </span>
                  </div>

                  {/* Línea Meta 100% */}
                  <div className="absolute top-[-8px] bottom-[-8px] w-0.5 border-l-2 border-dashed border-gray-700"
                    style={{ left: `${Math.min(metaLine, 100)}%` }}>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-600 whitespace-nowrap bg-white px-1 rounded">
                      Meta: {fmtAbr(proy.metaMes)}
                    </span>
                  </div>

                  {/* Tooltip flotante */}
                  {hover && (
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-white border border-purple-200 rounded-xl shadow-lg px-4 py-3 z-10 min-w-[280px]">
                      {hover === "actual" && (
                        <>
                          <p className="font-bold text-purple-700 text-sm mb-1">GMV en Sistema</p>
                          <p className="text-gray-700">{M(proy.gmvActual)}</p>
                          <p className="text-xs text-gray-500">Cumplimiento solo sistema: <b className="text-purple-700">{calc.cumplActualPct.toFixed(1)}%</b></p>
                        </>
                      )}
                      {hover === "tada" && (
                        <>
                          <p className="font-bold text-orange-600 text-sm mb-1">+ TaDa Pendiente</p>
                          <p className="text-gray-700">{M(tadaPendiente)}</p>
                          <p className="text-xs text-gray-500">Acumulado con TaDa: <b className="text-orange-600">{proy.metaMes > 0 ? ((proy.gmvActual + tadaPendiente) / proy.metaMes * 100).toFixed(1) : 0}%</b></p>
                        </>
                      )}
                      {hover === "storage" && (
                        <>
                          <p className="font-bold text-blue-600 text-sm mb-1">+ Storage Pendiente</p>
                          <p className="text-gray-700">{M(storagePendiente)}</p>
                          <p className="text-xs text-gray-500">Cumplimiento total: <b className="text-blue-600">{calc.cumplPct.toFixed(1)}%</b></p>
                        </>
                      )}
                      <div className="border-t border-gray-100 mt-2 pt-2 text-xs">
                        <p>Sistema: {fmtAbr(proy.gmvActual)} ({calc.cumplActualPct.toFixed(1)}%)</p>
                        <p>+ TaDa: {fmtAbr(tadaPendiente)} → {proy.metaMes > 0 ? ((proy.gmvActual + tadaPendiente) / proy.metaMes * 100).toFixed(1) : 0}%</p>
                        <p>+ Storage: {fmtAbr(storagePendiente)} → <b>{calc.cumplPct.toFixed(1)}%</b></p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-purple-600 inline-block" /> GMV Actual: {fmtAbr(proy.gmvActual)} ({calc.cumplActualPct.toFixed(1)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> TaDa: {fmtAbr(tadaPendiente)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Storage: {fmtAbr(storagePendiente)}
                  </span>
                  <span className="flex items-center gap-1.5 font-bold" style={{ color: calc.cumplPct >= 80 ? GREEN : RED }}>
                    Total: {calc.cumplPct.toFixed(1)}%
                  </span>
                </div>

                {/* Gap messages */}
                <div className="mt-3 space-y-1">
                  {calc.gap > 0 ? (
                    <p className="text-sm font-semibold text-red-600">Falta {M(calc.gap)} para la meta (100%)</p>
                  ) : (
                    <p className="text-sm font-semibold text-green-600">Superó la meta por {M(Math.abs(calc.gap))}</p>
                  )}
                  {faltaPara80 > 0 ? (
                    <p className="text-sm font-semibold text-yellow-600">Falta {M(faltaPara80)} para el umbral mínimo (80% = {fmtAbr(umbral80)})</p>
                  ) : (
                    <p className="text-sm font-semibold text-green-600">✅ Ya superó el umbral mínimo del 80%</p>
                  )}
                  {faltaPara80SinPend > 0 && faltaPara80 <= 0 && (
                    <p className="text-xs text-gray-500">Nota: sin pendientes (solo sistema), faltarían {M(faltaPara80SinPend)} para el 80%</p>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── Section 3: Cumplimiento por KAM ──────────────────────────────── */}
      {data.kams && data.kams.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-gray-700 mb-3">Cumplimiento por KAM</h3>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={Math.max(200, data.kams.length * 50)}>
            <BarChart data={kamChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => fmtM(v, moneda, trm)}
                tick={{ fontSize: 11 }}
              />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} width={100} />
              <Tooltip
                formatter={(v) => M(moneda === "USD" ? v * trm : v)}
                labelStyle={{ fontWeight: 700 }}
              />
              <Legend />
              <Bar dataKey="Meta" fill={PIBOX_PURPLE} radius={[0, 6, 6, 0]} />
              <Bar dataKey="GMV" fill={PIBOX_PINK} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Table */}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-purple-50 text-purple-800">
                  <th className="text-left p-3 rounded-tl-xl">KAM</th>
                  <th className="text-right p-3">Meta</th>
                  <th className="text-right p-3">GMV</th>
                  <th className="text-right p-3">Cumplimiento</th>
                  <th className="text-right p-3">Falta</th>
                  <th className="text-right p-3">Prom. Diario</th>
                  <th className="text-right p-3 rounded-tr-xl">Proyección Mes</th>
                </tr>
              </thead>
              <tbody>
                {kamsData.map((k, i) => {
                  const proyVsMeta = k.meta > 0 ? (k.proyFin / k.meta * 100) : 0;
                  return (
                    <tr key={k.nombre} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-3 font-medium text-gray-800">{k.nombre}</td>
                      <td className="p-3 text-right text-gray-600">{M(k.meta)}</td>
                      <td className="p-3 text-right text-gray-600">{M(k.effectiveGmv)}</td>
                      <td className="p-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                          k.cumplimiento >= 95 ? "bg-green-100 text-green-700" : k.cumplimiento >= 80 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                        }`}>{k.cumplimiento.toFixed(1)}%</span>
                      </td>
                      <td className={`p-3 text-right font-semibold ${k.falta > 0 ? "text-red-500" : "text-green-600"}`}>
                        {k.falta > 0 ? M(k.falta) : "✅"}
                      </td>
                      <td className="p-3 text-right text-gray-500">{fmtAbr(k.promDiario)}/día</td>
                      <td className="p-3 text-right">
                        <span className={`font-semibold ${proyVsMeta >= 100 ? "text-green-600" : proyVsMeta >= 80 ? "text-yellow-600" : "text-red-500"}`}>
                          {fmtAbr(k.proyFin)} <span className="text-xs">({proyVsMeta.toFixed(0)}%)</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 4: Insights automaticos ──────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold text-gray-700 mb-3">Insights Automaticos</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {/* Facturacion diaria promedio */}
          <div className="bg-purple-50 rounded-xl border border-purple-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Facturacion diaria promedio</p>
            <p className="font-bold text-purple-700 text-lg">{M(calc.promDiario)}</p>
            <p className="text-xs text-gray-400 mt-1">
              Basado en {proy.diasTranscurridos} dias transcurridos
            </p>
          </div>

          {/* Proyeccion a fin de mes */}
          <div className="bg-purple-50 rounded-xl border border-purple-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Proyeccion a fin de mes</p>
            <p className="font-bold text-purple-700 text-lg">{M(calc.proyFinMes)}</p>
            {proy.metaMes > 0 && (
              <p className={`text-xs font-semibold mt-1 ${calc.proyFinMes >= proy.metaMes ? "text-green-600" : "text-red-500"}`}>
                {(calc.proyFinMes / proy.metaMes * 100).toFixed(1)}% de la meta ({fmtAbr(proy.metaMes)})
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              Al ritmo actual ({fmtAbr(calc.promDiario)}/dia x {proy.diasTotalesMes} dias)
            </p>
          </div>

          {/* Comparativa vs mes pasado */}
          <div className={`rounded-xl border p-4 ${calc.vsMesPasadoAbs >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
            <p className="text-xs text-gray-500 mb-1">Vs Mes Pasado</p>
            <p className={`font-bold text-lg ${calc.vsMesPasadoAbs >= 0 ? "text-green-700" : "text-red-600"}`}>
              {calc.vsMesPasadoAbs >= 0 ? "+" : ""}{M(calc.vsMesPasadoAbs)}
            </p>
            <p className={`text-xs mt-1 ${calc.vsMesPasadoAbs >= 0 ? "text-green-500" : "text-red-400"}`}>
              {calc.vsMesPasadoPct >= 0 ? "+" : ""}{calc.vsMesPasadoPct.toFixed(1)}% respecto a {fmtAbr(proy.gmvMesPasado)}
            </p>
          </div>

          {/* Ritmo necesario */}
          <div className={`rounded-xl border p-4 ${calc.gap <= 0 ? "bg-green-50 border-green-100" : "bg-orange-50 border-orange-100"}`}>
            <p className="text-xs text-gray-500 mb-1">Ritmo necesario para la meta</p>
            {calc.gap <= 0 ? (
              <p className="font-bold text-green-700 text-lg">Meta alcanzada</p>
            ) : calc.diasRestantes > 0 ? (
              <>
                <p className="font-bold text-orange-700 text-lg">{M(calc.ritmoNecesario)}/dia</p>
                <p className="text-xs text-gray-400 mt-1">
                  {calc.diasRestantes} dias restantes para cubrir {M(calc.gap)}
                </p>
              </>
            ) : (
              <p className="font-bold text-red-600 text-lg">Sin dias restantes</p>
            )}
          </div>
        </div>

        {/* Traffic light summary */}
        <div className="mt-4 flex items-center gap-3 p-4 rounded-xl border" style={{ backgroundColor: `${semaforoColor}10`, borderColor: `${semaforoColor}40` }}>
          <div className="flex gap-1.5">
            {[GREEN, YELLOW, RED].map((c) => (
              <span
                key={c}
                className="w-5 h-5 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c === semaforoColor ? c : "transparent",
                  borderColor: c,
                  opacity: c === semaforoColor ? 1 : 0.3,
                }}
              />
            ))}
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: semaforoColor }}>{semaforoLabel}</p>
            <p className="text-xs text-gray-500">
              {calc.semaforo === "verde"
                ? `La proyeccion a fin de mes (${fmtAbr(calc.proyFinMes)}) supera la meta.`
                : calc.semaforo === "amarillo"
                ? `Con los pendientes de TaDa y Storage, se podria alcanzar la meta.`
                : `Aun con pendientes (${fmtAbr(calc.gmvTotal)}), no se alcanza la meta de ${fmtAbr(proy.metaMes)}.`
              }
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 5: Evolución diaria ────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold text-gray-700 mb-3">Evolución Diaria del GMV</h3>
        {(() => {
          let evDiaria = null;
          try { const s = localStorage.getItem("pibox_cierre_evolucion"); if (s) evDiaria = JSON.parse(s); } catch {}
          if (!evDiaria || !evDiaria.length) return (
            <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Gráfico de evolución diaria</p>
                <p className="text-gray-300 text-xs mt-1">Sube el archivo de operaciones en ⚙️ Config → Proyección Cierre</p>
              </div>
            </div>
          );

          // Preparar datos con media móvil 7d y label dd/MM
          const promedio = evDiaria.reduce((s, d) => s + d.gmv, 0) / evDiaria.length;
          const maxD = evDiaria.reduce((m, d) => d.gmv > m.gmv ? d : m, evDiaria[0]);
          const minD = evDiaria.reduce((m, d) => d.gmv < m.gmv ? d : m, evDiaria[0]);
          const acumulado = evDiaria[evDiaria.length - 1]?.gmvAcumulado || 0;
          const totalServ = evDiaria.reduce((s, d) => s + (d.servicios || 0), 0);
          const totalPaq  = evDiaria.reduce((s, d) => s + (d.paquetes  || 0), 0);

          const fmtDia = (fecha) => {
            if (!fecha) return "";
            const p = fecha.slice(0, 10).split("-");
            return `${p[2]}/${p[1]}`;
          };

          const evData = evDiaria.map((d, i) => {
            // Media móvil 7 días
            const start = Math.max(0, i - 6);
            const slice = evDiaria.slice(start, i + 1);
            const mm7 = slice.reduce((s, x) => s + x.gmv, 0) / slice.length;
            return {
              ...d,
              dia:  fmtDia(d.fecha || d.dia),
              rawFecha: d.fecha || d.dia || "",
              mm7:  Math.round(mm7),
              promedio: Math.round(promedio),
            };
          });

          // Escala derecha para acumulado (max ≈ acumulado)
          const maxAcum = acumulado * 1.1 || 1;
          const maxGmv  = Math.max(...evData.map(d => d.gmv)) * 1.2 || 1;

          return (
            <div className="space-y-4">
              {/* ── Gráfica 1: GMV Diario ── */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 print-no-break">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">📅 GMV Diario</p>
                    <p className="text-xs text-gray-400">Barras: GMV del día · Línea: media móvil 7 días · {evData.length} días con datos</p>
                  </div>
                  {/* KPI chips */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-purple-50 text-purple-700 rounded-full px-3 py-1 font-medium">
                      Prom/día <strong>{fmtAbr(promedio)}</strong>
                    </span>
                    <span className="bg-green-50 text-green-700 rounded-full px-3 py-1 font-medium">
                      Mejor día {fmtDia(maxD.fecha || maxD.dia)} · <strong>{fmtAbr(maxD.gmv)}</strong>
                    </span>
                    <span className="bg-red-50 text-red-600 rounded-full px-3 py-1 font-medium">
                      Menor día {fmtDia(minD.fecha || minD.dia)} · <strong>{fmtAbr(minD.gmv)}</strong>
                    </span>
                    <span className="bg-blue-50 text-blue-700 rounded-full px-3 py-1 font-medium">
                      Acumulado <strong>{fmtAbr(acumulado)}</strong>
                    </span>
                  </div>
                </div>

                {/* Tabla compacta en PDF — gráfica de barras no renderiza en print */}
                {printing ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-purple-50 text-purple-800">
                          <th className="text-left p-2 border border-purple-100">Fecha</th>
                          <th className="text-right p-2 border border-purple-100">GMV del día</th>
                          <th className="text-right p-2 border border-purple-100">Media móvil 7d</th>
                          <th className="text-right p-2 border border-purple-100">GMV Acumulado</th>
                          <th className="text-right p-2 border border-purple-100">Servicios</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evData.map((d, i) => (
                          <tr key={d.rawFecha || i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="p-2 border border-gray-100 font-medium">{d.dia}</td>
                            <td className="p-2 border border-gray-100 text-right text-purple-700 font-semibold">{fmtAbr(d.gmv)}</td>
                            <td className="p-2 border border-gray-100 text-right text-pink-600">{fmtAbr(d.mm7)}</td>
                            <td className="p-2 border border-gray-100 text-right text-blue-700 font-semibold">{fmtAbr(d.gmvAcumulado)}</td>
                            <td className="p-2 border border-gray-100 text-right text-gray-600">{(d.servicios || 0).toLocaleString("es-CO")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={evData} margin={{ top: 8, right: 60, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                    <XAxis dataKey="dia" tick={{ fontSize: 9 }} />
                    {/* Eje izquierdo: GMV diario */}
                    <YAxis yAxisId="left" tickFormatter={fmtAbr} tick={{ fontSize: 9 }} domain={[0, maxGmv]} />
                    {/* Eje derecho: acumulado */}
                    <YAxis yAxisId="right" orientation="right" tickFormatter={fmtAbr} tick={{ fontSize: 9 }} domain={[0, maxAcum]} />
                    <Tooltip formatter={(v, name) => [fmtFull(v), name]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    {/* Promedio diario */}
                    <ReferenceLine yAxisId="left" y={promedio} stroke="#9ca3af" strokeDasharray="4 3"
                      label={{ value: "Prom.", position: "insideRight", fontSize: 9, fill: "#9ca3af" }} />
                    {/* Area acumulado — eje derecho */}
                    <Area yAxisId="right" type="monotone" dataKey="gmvAcumulado"
                      name="GMV acumulado (eje der.)"
                      fill="#bfdbfe" stroke="#93c5fd" strokeWidth={1.5} fillOpacity={0.5} dot={false} />
                    {/* Barras GMV diario */}
                    <Bar yAxisId="left" dataKey="gmv" name="GMV diario" fill={PIBOX_PURPLE} radius={[3, 3, 0, 0]} maxBarSize={40} />
                    {/* Media móvil 7d */}
                    <Line yAxisId="left" type="monotone" dataKey="mm7"
                      name="Media móvil 7 días"
                      stroke={PIBOX_PINK} strokeWidth={2} strokeDasharray="6 3" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
                )}{/* fin printing ternario */}
              </div>

              {/* ── Gráfica 2: Servicios y Paquetes — oculta en print ── */}
              {!printing && (
              <div className="bg-white rounded-xl border border-gray-100 p-4 print-no-break">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">📦 Servicios y Paquetes Diarios</p>
                    <p className="text-xs text-gray-400">{totalServ.toLocaleString("es-CO")} servicios · {totalPaq.toLocaleString("es-CO")} paquetes en el período</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-purple-50 text-purple-700 rounded-full px-3 py-1 font-medium">
                      Total servicios <strong>{totalServ.toLocaleString("es-CO")}</strong>
                    </span>
                    {totalPaq > 0 && (
                      <span className="bg-pink-50 text-pink-700 rounded-full px-3 py-1 font-medium">
                        Total paquetes <strong>{totalPaq.toLocaleString("es-CO")}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={evData} margin={{ top: 4, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                    <XAxis dataKey="dia" tick={{ fontSize: 9 }} />
                    <YAxis yAxisId="serv" tick={{ fontSize: 9 }} />
                    {totalPaq > 0 && <YAxis yAxisId="paq" orientation="right" tick={{ fontSize: 9 }} />}
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="serv" dataKey="servicios" name="Servicios" fill={PIBOX_PURPLE} radius={[3, 3, 0, 0]} maxBarSize={40} />
                    {totalPaq > 0 && (
                      <Bar yAxisId={totalPaq > 0 ? "paq" : "serv"} dataKey="paquetes" name="Paquetes" fill={PIBOX_PINK} radius={[3, 3, 0, 0]} maxBarSize={40} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              )}{/* fin !printing chart 2 */}
            </div>
          );
        })()}
      </div>
    </section>
  );
}
