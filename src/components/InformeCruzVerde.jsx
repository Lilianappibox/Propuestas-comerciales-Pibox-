import { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line,
} from "recharts";
import XLSX from "../utils/xlsxHelper";

// ── Constantes ─────────────────────────────────────────────────────────────
const BRAND  = "linear-gradient(135deg,#00897B 0%,#00BCD4 100%)";
const C_TEAL = "#00897B";
const C_CYAN = "#00BCD4";
const C_RED  = "#EF4444";
const C_AMB  = "#F59E0B";
const C_GRN  = "#10B981";
const C_GRAY = "#6B7280";
const COLORS  = [C_TEAL, C_CYAN, "#6366F1", "#A855F7", "#EC4899", "#F59E0B", "#10B981", "#EF4444"];

const INTEG_USERS = new Set(["cruz verde integración", "ferney jimenez", "ivan javier", "oms back office"]);
const isInteg = (u) => INTEG_USERS.has((u || "").toLowerCase().trim());

const SLA_SD_RANGES = [
  { maxKm: 3,  min: 35  },
  { maxKm: 5,  min: 45  },
  { maxKm: 7,  min: 50  },
  { maxKm: 10, min: 65  },
  { maxKm: 17, min: 110 },
];
function getSlaLimite(km) {
  for (const r of SLA_SD_RANGES) if (km <= r.maxKm) return r.min;
  return null;
}

const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function toMesLabel(dateStr) {
  if (!dateStr) return "Sin fecha";
  const d = new Date(dateStr);
  if (isNaN(d)) return "Sin fecha";
  return `${MESES_ES[d.getMonth()]} ${d.getFullYear()}`;
}
function toDateStr(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
function horaMin(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d) ? null : d.getHours() * 60 + d.getMinutes();
}

function getLinea(row) {
  if (isInteg(row.nombre_usuario)) {
    return row.next_day === "Next Day" ? "integ_nd" : "integ_sd";
  }
  return "mostrador";
}

function procesarRows(rawRows) {
  return rawRows.map((r) => {
    const linea = getLinea(r);
    const estado = (r.estado || "").trim();
    const km = parseFloat(r.distancia_km) || 0;
    let slaCumplido = null, slaLimite = null, minutos = null;

    if (linea === "integ_nd") {
      // Next Day: llego_donde_el_cliente antes de las 18:00
      const hm = horaMin(r.llego_donde_el_cliente);
      if (hm !== null && estado === "Finalizado") slaCumplido = hm < 18 * 60;
    } else {
      // Same Day: salio_de_origen → llego_donde_el_cliente vs tabla de distancias
      if (r.salio_de_origen && r.llego_donde_el_cliente) {
        const t0 = new Date(r.salio_de_origen);
        const t1 = new Date(r.llego_donde_el_cliente);
        if (!isNaN(t0) && !isNaN(t1) && t1 > t0) {
          minutos = (t1 - t0) / 60000;
          slaLimite = getSlaLimite(km);
          if (slaLimite !== null && estado === "Finalizado") slaCumplido = minutos <= slaLimite;
        }
      }
    }

    return {
      uuid:       r.uuid_booking || "",
      fecha:      toDateStr(r.salio_de_origen || r.iniciado),
      mes:        toMesLabel(r.salio_de_origen || r.iniciado),
      estado,
      linea,
      ciudad:     (r.ciudad || "Sin ciudad").trim(),
      sucursal:   (r.nombre_usuario || "Sin sucursal").trim(),
      km,
      minutos,
      slaLimite,
      slaCumplido,
      horaEntrega: horaMin(r.llego_donde_el_cliente),
      esDevolucion: !!(r.fecha_devolucion_paquete && String(r.fecha_devolucion_paquete).trim()),
      esPerfecto:  estado === "Finalizado",
    };
  });
}

// ── Persistencia ────────────────────────────────────────────────────────────
const IDB_NAME  = "pibox_cv_db";
const IDB_STORE = "cvData";
const SK_INDEX  = "pibox_cv_index";

function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => res(req.result);
    req.onerror  = () => rej(req.error);
  });
}
async function idbSave(key, data) {
  const db = await idbOpen();
  const tx = db.transaction(IDB_STORE, "readwrite");
  tx.objectStore(IDB_STORE).put(data, key);
  return new Promise((r) => { tx.oncomplete = r; });
}
async function idbLoad(key) {
  const db = await idbOpen();
  const tx = db.transaction(IDB_STORE, "readonly");
  const req = tx.objectStore(IDB_STORE).get(key);
  return new Promise((r) => { req.onsuccess = () => r(req.result || null); req.onerror = () => r(null); });
}
async function idbDelete(key) {
  const db = await idbOpen();
  const tx = db.transaction(IDB_STORE, "readwrite");
  tx.objectStore(IDB_STORE).delete(key);
}
function loadIndex() {
  try { return JSON.parse(localStorage.getItem(SK_INDEX) || "{}"); } catch { return {}; }
}
function saveIndex(idx) { localStorage.setItem(SK_INDEX, JSON.stringify(idx)); }

// ── Helpers de métricas ────────────────────────────────────────────────────
function pct(n, d) { return d > 0 ? n / d : 0; }
function fmtPct(v) { return (v * 100).toFixed(1) + "%"; }
function fmtNum(n) { return (n || 0).toLocaleString("es-CO"); }
function fmtMin(m) {
  if (m == null) return "—";
  const h = Math.floor(m / 60), mn = Math.round(m % 60);
  return h > 0 ? `${h}h ${mn}min` : `${mn}min`;
}

function calcMetricas(rows) {
  const total    = rows.length;
  const entregados = rows.filter(r => r.esPerfecto).length;
  const slaDefined = rows.filter(r => r.slaCumplido !== null);
  const slaMet   = slaDefined.filter(r => r.slaCumplido).length;
  const devol    = rows.filter(r => r.esDevolucion).length;
  const noPerfectos = rows.filter(r => !r.esPerfecto).length;
  const tiempos  = rows.filter(r => r.minutos != null).map(r => r.minutos);
  const avgMin   = tiempos.length ? tiempos.reduce((a,b)=>a+b,0)/tiempos.length : null;
  const ciudades = new Set(rows.map(r => r.ciudad)).size;
  const sucursales = new Set(rows.map(r => r.sucursal)).size;
  return { total, entregados, slaMet, slaDef: slaDefined.length, noPerfectos, devol, avgMin, ciudades, sucursales };
}

function groupBy(rows, key) {
  return rows.reduce((acc, r) => {
    const k = r[key] || "Sin dato";
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});
}

function topN(rows, key, n = 12) {
  const grp = groupBy(rows, key);
  return Object.entries(grp)
    .map(([k, v]) => ({ name: k, total: v.length, entregados: v.filter(r=>r.esPerfecto).length, slaMet: v.filter(r=>r.slaCumplido).length, slaDef: v.filter(r=>r.slaCumplido!==null).length }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

function dailyTrend(rows) {
  const grp = groupBy(rows, "fecha");
  return Object.entries(grp)
    .filter(([k]) => k)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([fecha, rs]) => ({
      fecha: fecha.slice(5),
      total: rs.length,
      entregados: rs.filter(r=>r.esPerfecto).length,
      sla: rs.filter(r=>r.slaCumplido!==null).length > 0
        ? Math.round(pct(rs.filter(r=>r.slaCumplido).length, rs.filter(r=>r.slaCumplido!==null).length)*100) : null,
    }));
}

function slaDistribucion(rows) {
  const met  = rows.filter(r=>r.slaCumplido===true).length;
  const noMet = rows.filter(r=>r.slaCumplido===false).length;
  const sin   = rows.filter(r=>r.slaCumplido===null).length;
  return [
    { name:"Cumplido", value:met,  color:C_GRN  },
    { name:"Incumplido", value:noMet, color:C_RED },
    { name:"Sin datos", value:sin,  color:C_GRAY },
  ].filter(d=>d.value>0);
}

function slaByRange(rows) {
  const ranges = [
    { label:"0–3 km",   lim:3,  min:35  },
    { label:"3.1–5 km", lim:5,  min:45  },
    { label:"5.1–7 km", lim:7,  min:50  },
    { label:"7.1–10 km",lim:10, min:65  },
    { label:"10.1–17 km",lim:17,min:110 },
    { label:">17 km",   lim:Infinity, min:null },
  ];
  const prev = [0,3,5,7,10,17];
  return ranges.map((rng, i) => {
    const sub = rows.filter(r => r.km > prev[i] && r.km <= rng.lim && r.esPerfecto && r.minutos!=null);
    const met = sub.filter(r=>r.slaCumplido===true).length;
    const total = sub.length;
    const avg = sub.length ? sub.reduce((a,b)=>a+b.minutos,0)/sub.length : null;
    return { ...rng, total, met, pct: pct(met,total), avg };
  }).filter(r=>r.total>0);
}

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
         style={{ borderLeft: `4px solid ${color || C_TEAL}` }}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{icon} {label}</p>
      <p className="text-2xl font-extrabold mt-1" style={{ color: color || C_TEAL }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────
const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-teal-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-teal-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value?.toLocaleString()}</p>
      ))}
    </div>
  );
};

// ── Tabla Ciudad / Sucursal ─────────────────────────────────────────────────
function TablaRanking({ rows, groupKey, title, showSla }) {
  const data = topN(rows, groupKey, 15);
  if (!data.length) return <p className="text-gray-400 text-sm">Sin datos</p>;
  return (
    <div className="overflow-x-auto">
      <p className="text-sm font-bold text-gray-700 mb-2">{title}</p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-teal-50 text-teal-700">
            <th className="text-left p-2 font-semibold">#</th>
            <th className="text-left p-2 font-semibold">{groupKey === "ciudad" ? "Ciudad" : "Sucursal"}</th>
            <th className="text-right p-2 font-semibold">Total</th>
            <th className="text-right p-2 font-semibold">Entregados</th>
            <th className="text-right p-2 font-semibold">% Entrega</th>
            {showSla && <th className="text-right p-2 font-semibold">% SLA</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={d.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-2 text-gray-400">{i + 1}</td>
              <td className="p-2 font-medium text-gray-700 max-w-[200px] truncate" title={d.name}>{d.name}</td>
              <td className="p-2 text-right">{fmtNum(d.total)}</td>
              <td className="p-2 text-right text-green-700">{fmtNum(d.entregados)}</td>
              <td className="p-2 text-right font-semibold" style={{ color: pct(d.entregados,d.total)>=0.95?C_GRN:pct(d.entregados,d.total)>=0.85?C_AMB:C_RED }}>
                {fmtPct(pct(d.entregados, d.total))}
              </td>
              {showSla && (
                <td className="p-2 text-right font-semibold" style={{ color: pct(d.slaMet,d.slaDef)>=0.95?C_GRN:pct(d.slaMet,d.slaDef)>=0.85?C_AMB:C_RED }}>
                  {d.slaDef > 0 ? fmtPct(pct(d.slaMet, d.slaDef)) : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Panel de una línea de negocio ──────────────────────────────────────────
function LineaPanel({ rows, linea }) {
  const m = calcMetricas(rows);
  const tendencia = dailyTrend(rows);
  const byCiudad  = topN(rows, "ciudad", 12).map(d => ({ ...d, pct_sla: d.slaDef > 0 ? Math.round(pct(d.slaMet,d.slaDef)*100) : null }));
  const bySucursal = topN(rows, "sucursal", 10);
  const slaDist    = slaDistribucion(rows);
  const slaRanges  = slaByRange(rows);
  const isNextDay  = linea === "integ_nd";

  // Insights automáticos
  const insights = [];
  if (m.total > 0) {
    const pctEnt = pct(m.entregados, m.total);
    if (pctEnt < 0.85) insights.push({ tipo:"red", txt:`Tasa de entrega baja: ${fmtPct(pctEnt)}. Revisar causas de no entrega.` });
    else if (pctEnt >= 0.95) insights.push({ tipo:"green", txt:`Excelente tasa de entrega: ${fmtPct(pctEnt)}.` });
    if (m.slaDef > 0) {
      const pctSla = pct(m.slaMet, m.slaDef);
      if (pctSla < 0.80) insights.push({ tipo:"red", txt:`SLA crítico: ${fmtPct(pctSla)} de cumplimiento. Se requiere acción inmediata.` });
      else if (pctSla >= 0.95) insights.push({ tipo:"green", txt:`SLA excelente: ${fmtPct(pctSla)} de cumplimiento.` });
      else insights.push({ tipo:"amber", txt:`SLA moderado: ${fmtPct(pctSla)}. Margen de mejora disponible.` });
    }
    const topBad = byCiudad.filter(c=>pct(c.entregados,c.total)<0.85 && c.total>=10).slice(0,2);
    if (topBad.length) insights.push({ tipo:"amber", txt:`Ciudades con baja entrega: ${topBad.map(c=>`${c.name} (${fmtPct(pct(c.entregados,c.total))})`).join(", ")}.` });
    if (m.devol > 0) insights.push({ tipo:"amber", txt:`${fmtNum(m.devol)} devoluciones registradas (${fmtPct(pct(m.devol,m.total))} del total).` });
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon="📦" label="Total servicios" value={fmtNum(m.total)} color={C_TEAL} />
        <KpiCard icon="✅" label="Entregados" value={fmtNum(m.entregados)} sub={fmtPct(pct(m.entregados, m.total))} color={C_GRN} />
        <KpiCard icon="⚠️" label="No perfectos" value={fmtNum(m.noPerfectos)} sub={fmtPct(pct(m.noPerfectos, m.total))} color={C_RED} />
        {!isNextDay
          ? <KpiCard icon="⏱️" label="Tiempo prom." value={fmtMin(m.avgMin)} sub={m.slaDef > 0 ? `SLA ${fmtPct(pct(m.slaMet, m.slaDef))}` : "Sin SLA"} color={C_CYAN} />
          : <KpiCard icon="🕕" label="SLA ≤ 18:00" value={m.slaDef > 0 ? fmtPct(pct(m.slaMet, m.slaDef)) : "—"} sub={`${fmtNum(m.slaMet)} de ${fmtNum(m.slaDef)}`} color={C_CYAN} />
        }
        <KpiCard icon="🏙️" label="Ciudades" value={m.ciudades} color="#6366F1" />
        <KpiCard icon="🏪" label="Sucursales" value={m.sucursales} color="#A855F7" />
        <KpiCard icon="↩️" label="Devoluciones" value={fmtNum(m.devol)} color={C_AMB} />
        <KpiCard icon="📊" label="Servicios c/SLA" value={fmtNum(m.slaDef)} color={C_GRAY} />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-2">💡 Insights Automáticos</p>
          <div className="space-y-1.5">
            {insights.map((ins, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${ins.tipo==="red"?"bg-red-50 text-red-700":ins.tipo==="green"?"bg-green-50 text-green-700":"bg-amber-50 text-amber-700"}`}>
                <span>{ins.tipo==="red"?"🔴":ins.tipo==="green"?"🟢":"🟡"}</span>
                <span>{ins.txt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tendencia diaria */}
      {tendencia.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">📈 Tendencia diaria</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval={Math.floor(tendencia.length/10)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<TT />} />
              <Legend />
              <Line type="monotone" dataKey="total"      name="Total"      stroke={C_TEAL} dot={false} />
              <Line type="monotone" dataKey="entregados" name="Entregados"  stroke={C_GRN}  dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ciudad + SLA Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por ciudad */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">🏙️ Distribución por ciudad (top 10)</p>
          {byCiudad.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byCiudad.slice(0,10)} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip content={<TT />} />
                <Bar dataKey="entregados" name="Entregados" fill={C_GRN} radius={[0,3,3,0]} />
                <Bar dataKey="total"      name="Total"      fill={C_TEAL} radius={[0,3,3,0]} fillOpacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm">Sin datos</p>}
        </div>

        {/* SLA dist o ranking horas entrega */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          {!isNextDay ? (
            <>
              <p className="text-sm font-bold text-gray-700 mb-3">⏱️ Cumplimiento SLA</p>
              {slaDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={slaDist} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({name,value,percent})=>`${name}: ${value} (${(percent*100).toFixed(0)}%)`} labelLine={false}>
                      {slaDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-sm">Sin datos de SLA</p>}
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-gray-700 mb-3">🕕 Hora de entrega (Next Day)</p>
              {(() => {
                const byHora = Array.from({length:24},(_,h)=>({hora:`${String(h).padStart(2,"0")}:00`, n:rows.filter(r=>r.esPerfecto && r.horaEntrega !== null && Math.floor(r.horaEntrega/60)===h).length})).filter(h=>h.n>0);
                return byHora.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byHora}>
                      <XAxis dataKey="hora" tick={{fontSize:10}} />
                      <YAxis tick={{fontSize:10}} />
                      <Tooltip content={<TT />} />
                      <Bar dataKey="n" name="Entregas" fill={C_TEAL} radius={[3,3,0,0]}>
                        {byHora.map((d,i)=><Cell key={i} fill={Math.floor(d.hora)<18?C_GRN:C_RED} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-sm">Sin datos</p>;
              })()}
            </>
          )}
        </div>
      </div>

      {/* SLA por rango de distancia (solo same day) */}
      {!isNextDay && slaRanges.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">📏 SLA por rango de distancia</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-teal-50 text-teal-700">
                  <th className="text-left p-2">Rango</th>
                  <th className="text-right p-2">Límite SLA</th>
                  <th className="text-right p-2">Servicios</th>
                  <th className="text-right p-2">Cumplidos</th>
                  <th className="text-right p-2">% SLA</th>
                  <th className="text-right p-2">Prom. tiempo</th>
                </tr>
              </thead>
              <tbody>
                {slaRanges.map((r, i) => (
                  <tr key={i} className={i%2===0?"bg-white":"bg-gray-50"}>
                    <td className="p-2 font-medium">{r.label}</td>
                    <td className="p-2 text-right">{r.min ? `${r.min} min` : "—"}</td>
                    <td className="p-2 text-right">{fmtNum(r.total)}</td>
                    <td className="p-2 text-right text-green-700">{fmtNum(r.met)}</td>
                    <td className="p-2 text-right font-semibold" style={{ color: r.pct>=0.95?C_GRN:r.pct>=0.85?C_AMB:C_RED }}>
                      {r.min != null ? fmtPct(r.pct) : "—"}
                    </td>
                    <td className="p-2 text-right">{fmtMin(r.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tablas ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <TablaRanking rows={rows} groupKey="ciudad" title="🏙️ Ranking por ciudad" showSla={!isNextDay} />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <TablaRanking rows={rows} groupKey="sucursal" title="🏪 Ranking por sucursal (top 15)" showSla={!isNextDay} />
        </div>
      </div>
    </div>
  );
}

// ── Panel Devoluciones ─────────────────────────────────────────────────────
function DevolucionesPanel({ rows }) {
  const devol = rows.filter(r => r.esDevolucion || !r.esPerfecto);
  const m     = calcMetricas(devol);
  const byLinea = {
    mostrador:  devol.filter(r=>r.linea==="mostrador"),
    integ_sd:   devol.filter(r=>r.linea==="integ_sd"),
    integ_nd:   devol.filter(r=>r.linea==="integ_nd"),
  };
  const byEstado = Object.entries(groupBy(devol, "estado")).sort((a,b)=>b[1].length-a[1].length);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon="❌" label="Total no perfectos" value={fmtNum(devol.length)} color={C_RED} />
        <KpiCard icon="🏪" label="Mostrador" value={fmtNum(byLinea.mostrador.length)} sub={fmtPct(pct(byLinea.mostrador.length,devol.length))} color={C_TEAL} />
        <KpiCard icon="🔄" label="Integ. Same Day" value={fmtNum(byLinea.integ_sd.length)} sub={fmtPct(pct(byLinea.integ_sd.length,devol.length))} color={C_CYAN} />
        <KpiCard icon="📅" label="Integ. Next Day" value={fmtNum(byLinea.integ_nd.length)} sub={fmtPct(pct(byLinea.integ_nd.length,devol.length))} color="#6366F1" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">📊 Por estado</p>
          {byEstado.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byEstado.map(([k,v])=>({name:k.length>25?k.slice(0,25)+"…":k,value:v.length}))}>
                <XAxis dataKey="name" tick={{fontSize:9}} />
                <YAxis tick={{fontSize:10}} />
                <Tooltip content={<TT />} />
                <Bar dataKey="value" name="Servicios" fill={C_RED} radius={[3,3,0,0]}>
                  {byEstado.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm">Sin datos</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">🏙️ Por ciudad (top 10)</p>
          {topN(devol,"ciudad",10).length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topN(devol,"ciudad",10)} layout="vertical" margin={{left:10}}>
                <XAxis type="number" tick={{fontSize:10}} />
                <YAxis type="category" dataKey="name" width={120} tick={{fontSize:10}} />
                <Tooltip content={<TT />} />
                <Bar dataKey="total" name="No perfectos" fill={C_RED} radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm">Sin datos</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <TablaRanking rows={devol} groupKey="sucursal" title="🏪 No perfectos por sucursal (top 15)" showSla={false} />
      </div>

      {/* Tabla detalle estados */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-bold text-gray-700 mb-3">📋 Detalle por estado y línea</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-red-50 text-red-700">
                <th className="text-left p-2">Estado</th>
                <th className="text-right p-2">Mostrador</th>
                <th className="text-right p-2">Integ SD</th>
                <th className="text-right p-2">Integ ND</th>
                <th className="text-right p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {byEstado.map(([estado, rs], i) => (
                <tr key={estado} className={i%2===0?"bg-white":"bg-gray-50"}>
                  <td className="p-2 font-medium">{estado}</td>
                  <td className="p-2 text-right">{fmtNum(rs.filter(r=>r.linea==="mostrador").length)}</td>
                  <td className="p-2 text-right">{fmtNum(rs.filter(r=>r.linea==="integ_sd").length)}</td>
                  <td className="p-2 text-right">{fmtNum(rs.filter(r=>r.linea==="integ_nd").length)}</td>
                  <td className="p-2 text-right font-bold">{fmtNum(rs.length)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Panel Resumen General ──────────────────────────────────────────────────
function ResumenPanel({ rows }) {
  const lineas = [
    { key:"mostrador",  label:"Cruz Verde Mostrador", color:C_TEAL  },
    { key:"integ_sd",   label:"Integración Same Day", color:C_CYAN  },
    { key:"integ_nd",   label:"Integración Next Day", color:"#6366F1" },
  ];
  const mTotal = calcMetricas(rows);
  const byLinea = lineas.map(l => ({ ...l, rows: rows.filter(r=>r.linea===l.key), m: calcMetricas(rows.filter(r=>r.linea===l.key)) }));

  const pieData = byLinea.map(l => ({ name: l.label, value: l.m.total, color: l.color })).filter(d=>d.value>0);
  const entregaPieData = byLinea.map(l => ({ name: l.label, value: l.m.entregados, color: l.color })).filter(d=>d.value>0);
  const byCiudad = topN(rows, "ciudad", 12);

  return (
    <div className="space-y-6">
      {/* KPIs globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon="📦" label="Total servicios" value={fmtNum(mTotal.total)} color={C_TEAL} />
        <KpiCard icon="✅" label="Entregados" value={fmtNum(mTotal.entregados)} sub={fmtPct(pct(mTotal.entregados, mTotal.total))} color={C_GRN} />
        <KpiCard icon="⚠️" label="No perfectos" value={fmtNum(mTotal.noPerfectos)} sub={fmtPct(pct(mTotal.noPerfectos, mTotal.total))} color={C_RED} />
        <KpiCard icon="⏱️" label="SLA global" value={mTotal.slaDef>0?fmtPct(pct(mTotal.slaMet,mTotal.slaDef)):"—"} sub={`${fmtNum(mTotal.slaMet)} de ${fmtNum(mTotal.slaDef)}`} color={C_CYAN} />
        <KpiCard icon="🏙️" label="Ciudades" value={mTotal.ciudades} color="#6366F1" />
        <KpiCard icon="🏪" label="Sucursales" value={mTotal.sucursales} color="#A855F7" />
        <KpiCard icon="↩️" label="Devoluciones" value={fmtNum(mTotal.devol)} color={C_AMB} />
        <KpiCard icon="📊" label="Con SLA medido" value={fmtNum(mTotal.slaDef)} color={C_GRAY} />
      </div>

      {/* Composición por línea */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {byLinea.map(l => (
          <div key={l.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4" style={{ borderTop: `3px solid ${l.color}` }}>
            <p className="text-sm font-bold mb-3" style={{ color: l.color }}>{l.label}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-500">Total</span><p className="font-bold text-lg" style={{color:l.color}}>{fmtNum(l.m.total)}</p></div>
              <div><span className="text-gray-500">Entregados</span><p className="font-bold text-lg text-green-600">{fmtPct(pct(l.m.entregados,l.m.total))}</p></div>
              <div><span className="text-gray-500">SLA cumplido</span><p className="font-semibold">{l.m.slaDef>0?fmtPct(pct(l.m.slaMet,l.m.slaDef)):"—"}</p></div>
              <div><span className="text-gray-500">No perfectos</span><p className="font-semibold text-red-500">{fmtNum(l.m.noPerfectos)}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">🍩 Participación por línea</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80}
                  label={({name,percent})=>`${name.replace("Cruz Verde ","").replace("Integración ","")}: ${(percent*100).toFixed(0)}%`}
                  labelLine={false}>
                  {pieData.map((d,i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm">Sin datos</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">🏙️ Top ciudades</p>
          {byCiudad.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCiudad.slice(0,10)} layout="vertical" margin={{left:10}}>
                <XAxis type="number" tick={{fontSize:10}} />
                <YAxis type="category" dataKey="name" width={100} tick={{fontSize:10}} />
                <Tooltip content={<TT />} />
                <Bar dataKey="entregados" name="Entregados" fill={C_GRN} radius={[0,3,3,0]} />
                <Bar dataKey="total"      name="Total"      fill={C_TEAL} fillOpacity={0.3} radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm">Sin datos</p>}
        </div>
      </div>

      {/* SLA por línea bar chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-bold text-gray-700 mb-3">📊 Comparativa de indicadores por línea</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-teal-50 text-teal-700">
                <th className="text-left p-2">Línea de negocio</th>
                <th className="text-right p-2">Total</th>
                <th className="text-right p-2">Entregados</th>
                <th className="text-right p-2">% Entrega</th>
                <th className="text-right p-2">SLA medido</th>
                <th className="text-right p-2">% SLA</th>
                <th className="text-right p-2">No perfectos</th>
              </tr>
            </thead>
            <tbody>
              {byLinea.map((l, i) => (
                <tr key={l.key} className={i%2===0?"bg-white":"bg-gray-50"}>
                  <td className="p-2 font-semibold" style={{color:l.color}}>{l.label}</td>
                  <td className="p-2 text-right">{fmtNum(l.m.total)}</td>
                  <td className="p-2 text-right text-green-700">{fmtNum(l.m.entregados)}</td>
                  <td className="p-2 text-right font-semibold" style={{color:pct(l.m.entregados,l.m.total)>=0.95?C_GRN:pct(l.m.entregados,l.m.total)>=0.85?C_AMB:C_RED}}>
                    {fmtPct(pct(l.m.entregados,l.m.total))}
                  </td>
                  <td className="p-2 text-right">{fmtNum(l.m.slaDef)}</td>
                  <td className="p-2 text-right font-semibold" style={{color:l.m.slaDef>0?(pct(l.m.slaMet,l.m.slaDef)>=0.95?C_GRN:pct(l.m.slaMet,l.m.slaDef)>=0.85?C_AMB:C_RED):C_GRAY}}>
                    {l.m.slaDef>0?fmtPct(pct(l.m.slaMet,l.m.slaDef)):"—"}
                  </td>
                  <td className="p-2 text-right text-red-600">{fmtNum(l.m.noPerfectos)}</td>
                </tr>
              ))}
              <tr className="bg-teal-50 font-bold">
                <td className="p-2 text-teal-700">TOTAL</td>
                <td className="p-2 text-right">{fmtNum(mTotal.total)}</td>
                <td className="p-2 text-right text-green-700">{fmtNum(mTotal.entregados)}</td>
                <td className="p-2 text-right" style={{color:pct(mTotal.entregados,mTotal.total)>=0.95?C_GRN:pct(mTotal.entregados,mTotal.total)>=0.85?C_AMB:C_RED}}>
                  {fmtPct(pct(mTotal.entregados,mTotal.total))}
                </td>
                <td className="p-2 text-right">{fmtNum(mTotal.slaDef)}</td>
                <td className="p-2 text-right" style={{color:mTotal.slaDef>0?(pct(mTotal.slaMet,mTotal.slaDef)>=0.95?C_GRN:pct(mTotal.slaMet,mTotal.slaDef)>=0.85?C_AMB:C_RED):C_GRAY}}>
                  {mTotal.slaDef>0?fmtPct(pct(mTotal.slaMet,mTotal.slaDef)):"—"}
                </td>
                <td className="p-2 text-right text-red-600">{fmtNum(mTotal.noPerfectos)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Constantes de meses ────────────────────────────────────────────────────
const MESES_LABEL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ── Componente principal ───────────────────────────────────────────────────
const TABS = [
  { id:"resumen",    label:"Resumen",              icon:"📊" },
  { id:"mostrador",  label:"Cruz Verde Mostrador",  icon:"🏪" },
  { id:"integ_sd",   label:"Integración Same Day",  icon:"⚡" },
  { id:"integ_nd",   label:"Integración Next Day",  icon:"📅" },
  { id:"devolucion", label:"Devoluciones",           icon:"↩️" },
];

export default function InformeCruzVerde({ isAdmin }) {
  const now = new Date();
  const [tab,        setTab]        = useState("resumen");
  const [index,      setIndex]      = useState(() => loadIndex());
  const [mesSel,     setMesSel]     = useState("");
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState(null);
  const [filtCiudad, setFiltCiudad] = useState("todas");
  const [filtLinea,  setFiltLinea]  = useState("todas");
  // Upload year/month selectors
  const [upAnio,  setUpAnio]  = useState(now.getFullYear());
  const [upMesN,  setUpMesN]  = useState(now.getMonth() + 1);

  // Auto-seleccionar mes más reciente al cargar
  useEffect(() => {
    const meses = Object.keys(index).sort().reverse();
    if (!mesSel && meses.length) setMesSel(meses[0]);
  }, [index]);

  // Cargar filas del mes seleccionado
  useEffect(() => {
    if (!mesSel) { setRows([]); return; }
    idbLoad(mesSel).then(data => setRows(data?.rows || []));
  }, [mesSel]);

  // Filtros derivados
  const filteredRows = useMemo(() => {
    let r = rows;
    if (filtLinea  !== "todas") r = r.filter(row => row.linea   === filtLinea);
    if (filtCiudad !== "todas") r = r.filter(row => row.ciudad  === filtCiudad);
    return r;
  }, [rows, filtLinea, filtCiudad]);

  const ciudades = useMemo(() => [...new Set(rows.map(r => r.ciudad))].filter(Boolean).sort(), [rows]);

  // Upload handler — usa año/mes del selector, no del archivo
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setUploadMsg(null);
    try {
      const buf     = await file.arrayBuffer();
      const wb      = XLSX.read(buf, { type: "array" });
      const ws      = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(ws, { range: 3, defval: "" });
      if (!rawRows.length) throw new Error("El archivo no contiene datos.");
      if (!rawRows[0].uuid_booking && !rawRows[0].nombre_usuario)
        throw new Error("Formato no reconocido. ¿Es el archivo 'Cruz verde [mes].xlsx'?");
      const processed = procesarRows(rawRows);
      const mesKey    = `${MESES_LABEL[upMesN - 1]} ${upAnio}`;
      await idbSave(mesKey, { rows: processed, archivo: file.name, fecha: new Date().toISOString(), total: processed.length });
      const newIdx = { ...index, [mesKey]: { archivo: file.name, fecha: new Date().toISOString(), total: processed.length } };
      saveIndex(newIdx);
      setIndex(newIdx);
      setMesSel(mesKey);
      setUploadMsg({ ok: true, txt: `✅ ${mesKey}: ${processed.length.toLocaleString()} registros importados` });
    } catch (err) {
      setUploadMsg({ ok: false, txt: `❌ ${err.message}` });
    } finally {
      setLoading(false);
      e.target.value = "";
      setTimeout(() => setUploadMsg(null), 6000);
    }
  };

  const handleDelete = async (mes) => {
    if (!confirm(`¿Eliminar datos de ${mes}?`)) return;
    await idbDelete(mes);
    const newIdx = { ...index };
    delete newIdx[mes];
    saveIndex(newIdx);
    setIndex(newIdx);
    if (mesSel === mes) {
      const rest = Object.keys(newIdx).sort().reverse();
      setMesSel(rest[0] || "");
    }
  };

  const meses = Object.keys(index).sort().reverse();

  // Filas filtradas por tab de línea
  const tabRows = useMemo(() => {
    if (tab === "mostrador")  return filteredRows.filter(r => r.linea === "mostrador");
    if (tab === "integ_sd")   return filteredRows.filter(r => r.linea === "integ_sd");
    if (tab === "integ_nd")   return filteredRows.filter(r => r.linea === "integ_nd");
    return filteredRows;
  }, [tab, filteredRows]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Banner ── */}
      <div className="border-b border-teal-100 bg-white shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Título */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                 style={{ background: BRAND }}>🟢</div>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">Informe Cruz Verde</p>
              <p className="text-xs text-gray-500">Mostrador · Integración Same Day · Integración Next Day · SLA en tiempo real</p>
            </div>
          </div>

          {/* Filtros de mes + línea + ciudad */}
          {meses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 font-medium">Mes:</span>
              <div className="flex gap-1 flex-wrap">
                {meses.map(m => (
                  <button key={m} onClick={() => setMesSel(m)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition border ${mesSel===m?"text-white border-transparent":"border-gray-200 text-gray-600 hover:bg-teal-50"}`}
                    style={mesSel===m?{background:C_TEAL}:{}}>
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <span className="text-xs text-gray-500">Línea:</span>
                <select value={filtLinea} onChange={e => setFiltLinea(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                  <option value="todas">Todas</option>
                  <option value="mostrador">Mostrador</option>
                  <option value="integ_sd">Integ. Same Day</option>
                  <option value="integ_nd">Integ. Next Day</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Ciudad:</span>
                <select value={filtCiudad} onChange={e => setFiltCiudad(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                  <option value="todas">Todas</option>
                  {ciudades.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {rows.length > 0 && (
                <span className="text-xs text-gray-400 ml-1">{filteredRows.length.toLocaleString()} servicios</span>
              )}
            </div>
          )}

          {/* Sub-tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${tab===t.id?"text-white shadow":"text-gray-600 hover:bg-teal-50"}`}
                style={tab===t.id?{background:C_TEAL}:{}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Estado vacío */}
        {rows.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🟢</div>
            <p className="text-lg font-bold text-gray-700 mb-2">Informe Cruz Verde</p>
            <p className="text-gray-500 text-sm mb-2">Selecciona el año y mes, luego sube el archivo Excel de Cruz Verde.</p>
            <p className="text-xs text-gray-400">Columnas requeridas: uuid_booking, estado, nombre_usuario, next_day, distancia_km, salio_de_origen, llego_donde_el_cliente</p>
          </div>
        )}

        {/* Paneles de análisis */}
        {rows.length > 0 && (
          <>
            {tab === "resumen"    && <ResumenPanel    rows={filteredRows} />}
            {tab === "mostrador"  && <LineaPanel      rows={tabRows} linea="mostrador" />}
            {tab === "integ_sd"   && <LineaPanel      rows={tabRows} linea="integ_sd" />}
            {tab === "integ_nd"   && <LineaPanel      rows={tabRows} linea="integ_nd" />}
            {tab === "devolucion" && <DevolucionesPanel rows={filteredRows} />}
          </>
        )}

        {/* ── Panel: Subir nuevo mes ── */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-4">📂 Subir nuevo mes</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Año</label>
              <select value={upAnio} onChange={e => setUpAnio(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Mes</label>
              <select value={upMesN} onChange={e => setUpMesN(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                {MESES_LABEL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Archivo Excel (.xlsx)</label>
              <label className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold shadow transition ${loading?"opacity-60 cursor-not-allowed":"hover:opacity-90"}`}
                style={{ background: BRAND }}>
                {loading ? "⏳ Procesando..." : "Seleccionar archivo"}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={loading} />
              </label>
            </div>
          </div>

          {uploadMsg && (
            <p className={`mt-3 text-sm font-semibold ${uploadMsg.ok ? "text-green-600" : "text-red-600"}`}>{uploadMsg.txt}</p>
          )}

          {meses.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Meses cargados ({meses.length})</p>
              <div className="flex flex-wrap gap-2">
                {meses.map(m => (
                  <div key={m}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                      mesSel === m
                        ? "text-white border-transparent"
                        : "border-gray-200 text-gray-600 hover:bg-teal-50"
                    }`}
                    style={mesSel === m ? { background: C_TEAL } : {}}>
                    <button onClick={() => setMesSel(m)}>{m}</button>
                    <button onClick={() => handleDelete(m)}
                      className="text-red-300 hover:text-red-500 ml-1 font-bold leading-none">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
