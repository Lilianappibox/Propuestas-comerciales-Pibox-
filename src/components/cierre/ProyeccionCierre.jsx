import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, LineChart, Line,
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
export default function ProyeccionCierre({ data }) {
  const { moneda, trm } = useMoneda();
  const M = (n) => fmtMoney(n, moneda, trm);

  const proy = data.proyeccion;

  const [tadaPendiente, setTadaPendiente] = useState(proy?.gmvTadaPendiente || 0);
  const [storagePendiente, setStoragePendiente] = useState(proy?.gmvStoragePendiente || 0);

  // ── Computed values ──────────────────────────────────────────────────────
  const calc = useMemo(() => {
    if (!proy) return null;

    const gmvTotal = proy.gmvActual + tadaPendiente + storagePendiente;
    const cumplPct = proy.metaMes > 0 ? (gmvTotal / proy.metaMes) * 100 : 0;
    const cumplActualPct = proy.metaMes > 0 ? (proy.gmvActual / proy.metaMes) * 100 : 0;
    const utilidad = gmvTotal * (proy.utilidadPct / 100);
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
      gmvTotal, cumplPct, cumplActualPct, utilidad, gap,
      promDiario, proyFinMes, diasRestantes, ritmoNecesario,
      vsMesPasadoAbs, vsMesPasadoPct, semaforo,
    };
  }, [proy, tadaPendiente, storagePendiente]);

  // ── No projection data ─────────────────────────────────────────────────
  if (!proy) {
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
  const proyKams = proy.kams || [];
  const kamsData = (data.kams || []).map((k) => {
    const pk = proyKams.find(p => p.nombre === k.nombre);
    return {
      nombre: k.nombre,
      meta: pk?.meta ?? k.meta,
      gmv: pk?.gmv ?? k.gmv,
      cumplimiento: (pk?.meta ?? k.meta) > 0 ? ((pk?.gmv ?? k.gmv) / (pk?.meta ?? k.meta) * 100) : 0,
      falta: Math.max(0, (pk?.meta ?? k.meta) - (pk?.gmv ?? k.gmv)),
      promDiario: diasT > 0 ? (pk?.gmv ?? k.gmv) / diasT : 0,
      proyFin: diasT > 0 ? ((pk?.gmv ?? k.gmv) / diasT) * diasTot : 0,
    };
  });

  const kamChartData = kamsData.map((k) => ({
    nombre: k.nombre,
    Meta: moneda === "USD" ? k.meta / trm : k.meta,
    GMV: moneda === "USD" ? k.gmv / trm : k.gmv,
  }));

  const semaforoColor = calc.semaforo === "verde" ? GREEN : calc.semaforo === "amarillo" ? YELLOW : RED;
  const semaforoLabel = calc.semaforo === "verde" ? "En camino" : calc.semaforo === "amarillo" ? "Posible con pendientes" : "Riesgo alto";

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 space-y-8">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-purple-800">Proyeccion de Cierre</h2>
          <p className="text-sm text-gray-500">{data.mes}</p>
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
          sub={`${proy.utilidadPct}% sobre GMV`}
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
          {/* Stacked bar */}
          <div className="relative h-10 bg-gray-200 rounded-full overflow-visible">
            <div className="absolute inset-y-0 left-0 flex rounded-full overflow-hidden" style={{ width: `${Math.min(wActual + wTada + wStorage, 100)}%` }}>
              <div style={{ width: `${wActual > 0 ? (proy.gmvActual / calc.gmvTotal) * 100 : 0}%` }} className="h-full bg-purple-600" />
              <div style={{ width: `${tadaPendiente > 0 ? (tadaPendiente / calc.gmvTotal) * 100 : 0}%` }} className="h-full bg-orange-400" />
              <div style={{ width: `${storagePendiente > 0 ? (storagePendiente / calc.gmvTotal) * 100 : 0}%` }} className="h-full bg-blue-500" />
            </div>
            {/* Meta line */}
            <div
              className="absolute top-[-6px] bottom-[-6px] w-0.5 border-l-2 border-dashed border-gray-700"
              style={{ left: `${Math.min(metaLine, 100)}%` }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-600 whitespace-nowrap">
                Meta: {fmtAbr(proy.metaMes)}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-600 inline-block" /> GMV Actual: {fmtAbr(proy.gmvActual)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> TaDa Pendiente: {fmtAbr(tadaPendiente)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Storage Pendiente: {fmtAbr(storagePendiente)}
            </span>
          </div>

          {/* Gap message */}
          <div className="mt-3">
            {calc.gap > 0 ? (
              <p className="text-sm font-semibold text-red-600">
                Falta {M(calc.gap)} para la meta
              </p>
            ) : (
              <p className="text-sm font-semibold text-green-600">
                Supero la meta por {M(Math.abs(calc.gap))}
              </p>
            )}
          </div>
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
                      <td className="p-3 text-right text-gray-600">{M(k.gmv)}</td>
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
            <p className="text-xs text-gray-400 mt-1">
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

      {/* ── Section 5: Evolucion diaria (placeholder) ────────────────────── */}
      <div>
        <h3 className="text-base font-semibold text-gray-700 mb-3">Evolucion Diaria del GMV</h3>
        {data.proyeccion?.evolucionDiaria && data.proyeccion.evolucionDiaria.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.proyeccion.evolucionDiaria} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtAbr} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtFull(v)} />
              <Line type="monotone" dataKey="gmv" stroke={PIBOX_PURPLE} strokeWidth={2} dot={{ r: 3 }} name="GMV Diario" />
              {data.proyeccion.evolucionDiaria[0]?.acumulado !== undefined && (
                <Line type="monotone" dataKey="acumulado" stroke={PIBOX_PINK} strokeWidth={2} dot={false} name="Acumulado" />
              )}
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Grafico de evolucion diaria</p>
              <p className="text-gray-300 text-xs mt-1">Disponible cuando se carguen datos diarios en la proyeccion</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
