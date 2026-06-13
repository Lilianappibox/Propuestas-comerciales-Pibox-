import { useState, useMemo } from "react";
import XLSX from "../utils/xlsxHelper";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const PIBOX_PURPLE = "#7C22D4";
const PIBOX_PINK   = "#C026D3";
const SEM_VERDE    = "#16A34A";
const SEM_ROJO     = "#DC2626";
const SEM_AMARILLO = "#D97706";
const PIE_COLORS   = [SEM_VERDE, SEM_ROJO];
const BAR_COLORS   = [PIBOX_PURPLE, PIBOX_PINK, "#A855F7", "#6366F1", "#EC4899", "#8B5CF6", "#F59E0B", "#10B981"];
/* ── Tráfico storage (por mes) ──────────────────────────────────────────── */
const SK_TRAF_IDX = "pibox_tada_traf_index";
const SK_TRAF_MES = (k) => `pibox_tada_traf_${k}`;
function loadTrafIndex() { try { return JSON.parse(localStorage.getItem(SK_TRAF_IDX) || "{}"); } catch { return {}; } }
function saveTrafIndex(idx) { localStorage.setItem(SK_TRAF_IDX, JSON.stringify(idx)); }
function loadTrafMes(key) { try { return JSON.parse(localStorage.getItem(SK_TRAF_MES(key)) || "null"); } catch { return null; } }
function saveTrafMes(key, d) { localStorage.setItem(SK_TRAF_MES(key), JSON.stringify(d)); }

function pct(n, d) { return d ? ((n / d) * 100).toFixed(1) : "0.0"; }

function processExcel(wb) {
  const sheet = wb.Sheets["DATA"];
  if (!sheet) throw new Error('No se encontró la hoja "DATA" en el archivo.');
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rows.length) throw new Error("La hoja DATA está vacía.");
  return processRows(rows);
}

function processRows(rows) {
  const totalTurnos = rows.length;
  let colocacionesSI = 0;
  let colocacionesNO = 0;
  let puntualidadSI  = 0;
  const estadoMap    = {};
  const ciudadMap    = {};
  const puntoMap     = {};
  const semanaMap    = {};
  const diaMap       = {};
  const mesMap       = {};
  const pilotos      = new Set();
  const pilotoMap    = {};

  for (const r of rows) {
    const coloc = String(r["COLOCACION"] || r["COLOCACIÓN"] || "").trim().toUpperCase();
    const punt  = String(r["PUNTUALIDAD"] || "").trim().toUpperCase();
    const estado = String(r["ESTADO"] || "").trim();
    const ciudad = String(r["CIUDAD"] || "").trim();
    const punto  = String(r["PUNTO"] || "").trim();
    const semana = String(r["SEMANA"] || "").trim();
    const dia    = String(r["DÍA"] || r["DIA"] || "").trim();
    const mes    = String(r["MES"] || "").trim();
    const piloto = String(r["ID PILOTO"] || "").trim();
    const pilotoNombre = String(r["NOMBRE DE PILOTO"] || r["NOMBRE PILOTO"] || "").trim();

    const isSI  = coloc === "SI";
    const isNO  = coloc === "NO";
    const isPunt = punt === "SI CUMPLE";
    const isNoPunt = punt === "NO CUMPLE";

    if (isSI) colocacionesSI++;
    if (isNO) colocacionesNO++;
    if (isPunt) puntualidadSI++;
    if (piloto) pilotos.add(piloto);

    // Tracking por piloto — ID como key principal
    const pilotoKey = piloto || pilotoNombre;
    if (pilotoKey) {
      if (!pilotoMap[pilotoKey]) pilotoMap[pilotoKey] = { nombre: pilotoNombre, id: piloto, turnos: 0, cumple: 0, noCumple: 0, ciudad: ciudad };
      pilotoMap[pilotoKey].turnos++;
      if (isPunt) pilotoMap[pilotoKey].cumple++;
      if (isNoPunt) pilotoMap[pilotoKey].noCumple++;
      // Tomar el nombre más reciente que no esté vacío
      if (pilotoNombre && pilotoNombre.length > (pilotoMap[pilotoKey].nombre || "").length) pilotoMap[pilotoKey].nombre = pilotoNombre;
      if (ciudad) pilotoMap[pilotoKey].ciudad = ciudad;
    }

    // Estado
    if (estado) estadoMap[estado] = (estadoMap[estado] || 0) + 1;

    // Ciudad
    if (ciudad) {
      if (!ciudadMap[ciudad]) ciudadMap[ciudad] = { turnos: 0, si: 0, no: 0, punt: 0 };
      ciudadMap[ciudad].turnos++;
      if (isSI) ciudadMap[ciudad].si++;
      if (isNO) ciudadMap[ciudad].no++;
      if (isPunt) ciudadMap[ciudad].punt++;
    }

    // Punto
    if (punto) {
      if (!puntoMap[punto]) puntoMap[punto] = { ciudad, turnos: 0, si: 0, no: 0, punt: 0 };
      puntoMap[punto].turnos++;
      if (isSI) puntoMap[punto].si++;
      if (isNO) puntoMap[punto].no++;
      if (isPunt) puntoMap[punto].punt++;
    }

    // Semana
    if (semana) {
      if (!semanaMap[semana]) semanaMap[semana] = { turnos: 0, si: 0, punt: 0 };
      semanaMap[semana].turnos++;
      if (isSI) semanaMap[semana].si++;
      if (isPunt) semanaMap[semana].punt++;
    }

    // Día
    if (dia) diaMap[dia] = (diaMap[dia] || 0) + 1;

    // Mes
    if (mes) {
      if (!mesMap[mes]) mesMap[mes] = { turnos: 0, si: 0, punt: 0 };
      mesMap[mes].turnos++;
      if (isSI) mesMap[mes].si++;
      if (isPunt) mesMap[mes].punt++;
    }
  }

  const cancelaciones = (estadoMap["Cancelado"] || 0) + (estadoMap["CANCELADO"] || 0);

  // Top pilotos impuntuales
  const pilotosImpuntuales = Object.values(pilotoMap)
    .filter(p => p.turnos >= 3 && p.noCumple > 0)
    .map(p => ({ ...p, pctNoCumple: (p.noCumple / p.turnos * 100) }))
    .sort((a, b) => b.noCumple - a.noCumple)
    .slice(0, 10);

  return {
    totalTurnos: rows.length,
    colocacionesSI,
    colocacionesNO,
    puntualidadSI,
    cancelaciones,
    pilotosActivos: pilotos.size,
    estadoMap,
    ciudadMap,
    puntoMap,
    semanaMap,
    diaMap,
    mesMap,
    pilotosImpuntuales,
  };
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-purple-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-purple-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

/* ── KPI Card ────────────────────────────────────────────────────────────── */

function KpiCard({ icon, label, value, sub, borderColor }) {
  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-w-0"
      style={{ borderLeft: `4px solid ${borderColor || PIBOX_PURPLE}` }}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide whitespace-nowrap">
        {icon} {label}
      </p>
      <p
        className="text-xl font-extrabold mt-1 truncate"
        style={{ color: borderColor || PIBOX_PURPLE }}
        title={value}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

/* ── Coloc color helper ──────────────────────────────────────────────────── */

function colocColor(pctVal) {
  const n = parseFloat(pctVal);
  if (n >= 90) return SEM_VERDE;
  if (n >= 70) return SEM_AMARILLO;
  return SEM_ROJO;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                          */
/* ══════════════════════════════════════════════════════════════════════════ */

// ── Facturación storage (por mes) ──────────────────────────────────────────
const SK_FACT_IDX = "pibox_tada_fact_index";
const SK_FACT_MES = (k) => `pibox_tada_fact_${k}`;
function loadFactIndex() { try { return JSON.parse(localStorage.getItem(SK_FACT_IDX) || "{}"); } catch { return {}; } }
function saveFactIndex(idx) { localStorage.setItem(SK_FACT_IDX, JSON.stringify(idx)); }
function loadFactMes(key) { try { return JSON.parse(localStorage.getItem(SK_FACT_MES(key)) || "null"); } catch { return null; } }
function saveFactMes(key, d) { localStorage.setItem(SK_FACT_MES(key), JSON.stringify(d)); }

function processFactExcel(wb) {
  const ws = wb.Sheets["Informe Servicios"] || wb.Sheets[wb.SheetNames[1]] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("No se encontró la hoja 'Informe Servicios'");
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  if (!rows.length) throw new Error("La hoja está vacía");

  let totalGmv = 0, totalPaq = 0, totalServ = rows.length;
  const ciudadMap = {}, puntoMap = {};
  let mesDetectado = "Sin mes";

  for (const r of rows) {
    const gmv = Number(String(r[" MONTO FINAL TRUMP "] || r["MONTO FINAL TRUMP"] || 0).replace(/[^0-9.-]/g, "")) || 0;
    const paq = Number(r["PAQUETES"] || 0) || 0;
    const ciudad = String(r["CIUDAD"] || "Sin ciudad").trim();
    const punto = String(r["PUNTO"] || "Sin punto").trim();
    const fecha = r["FECHA"];
    if (fecha && mesDetectado === "Sin mes") {
      const d = new Date((Number(fecha) - 25569) * 86400000);
      if (!isNaN(d.getTime())) {
        const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
        mesDetectado = meses[d.getMonth()] + " " + d.getFullYear();
      }
    }
    totalGmv += gmv; totalPaq += paq;
    if (!ciudadMap[ciudad]) ciudadMap[ciudad] = { gmv: 0, paquetes: 0, servicios: 0 };
    ciudadMap[ciudad].gmv += gmv; ciudadMap[ciudad].paquetes += paq; ciudadMap[ciudad].servicios++;
    if (!puntoMap[punto]) puntoMap[punto] = { gmv: 0, paquetes: 0, servicios: 0, ciudad };
    puntoMap[punto].gmv += gmv; puntoMap[punto].paquetes += paq; puntoMap[punto].servicios++;
  }
  return { totalGmv, totalPaq, totalServ, ciudadMap, puntoMap, mes: mesDetectado };
}

// ── Insights Tab Component ─────────────────────────────────────────────────
const SK_TADA_UMB = "pibox_tada_umbrales";
const UMB_DEFAULT = {
  colocAlerta: 80, colocExcelente: 95,
  puntAlerta: 70, puntExcelente: 90,
  ciudadColocAlerta: 75, puntoColocAlerta: 60,
  varTurnosAlerta: -10, varTurnosWin: 10,
  gmvCiudadAlerta: -20, gmvCiudadWin: 30,
  gmvPuntoAlerta: -25, gmvTotalAlerta: -15, gmvTotalWin: 15,
  paqAlerta: -15, paqWin: 15,
  minTurnosCiudad: 10, minTurnosPunto: 5, minGmvPunto: 50000,
};

function InsightsTab({ trafIndex, factIndex, loadTrafMes, loadFactMes, fmtMoney, isAdmin }) {
  const [showConfig, setShowConfig] = useState(false);
  const [umb, setUmb] = useState(() => { try { return { ...UMB_DEFAULT, ...JSON.parse(localStorage.getItem(SK_TADA_UMB) || "{}") }; } catch { return UMB_DEFAULT; } });
  const insightsMeses = [...new Set([...Object.keys(trafIndex), ...Object.keys(factIndex)])].sort().reverse();
  const [mesSel, setMesSel] = useState(insightsMeses[0] || "");

  const saveUmb = (u) => { setUmb(u); localStorage.setItem(SK_TADA_UMB, JSON.stringify(u)); };
  const UmbField = ({ label, k, suffix = "%" }) => (
    <div>
      <label className="text-xs text-gray-500 block mb-0.5">{label}</label>
      <div className="flex items-center gap-1">
        <input type="number" value={umb[k]} onChange={e => saveUmb({ ...umb, [k]: Number(e.target.value) })}
          className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400" />
        <span className="text-xs text-gray-400">{suffix}</span>
      </div>
    </div>
  );

  if (insightsMeses.length === 0) return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-8 text-center text-purple-700">
        <p className="text-2xl mb-2">💡</p>
        <p className="text-sm font-medium">Sube datos de tráfico y facturación para generar insights.</p>
      </div>
    </div>
  );

  const traf = loadTrafMes(mesSel)?.data;
  const fact = loadFactMes(mesSel);
  const trafP = (() => { const s = Object.keys(trafIndex).sort(); const i = s.indexOf(mesSel); return i > 0 ? loadTrafMes(s[i-1])?.data : null; })();
  const factP = (() => { const s = Object.keys(factIndex).sort(); const i = s.indexOf(mesSel); return i > 0 ? loadFactMes(s[i-1]) : null; })();

  const alerts = [], wins = [], detallePuntos = [], detalleCiudades = [];

  if (traf) {
    const pctColoc = traf.total > 0 ? (traf.colocacionesSI / traf.total * 100) : 0;
    const pctPunt = traf.total > 0 ? (traf.puntualidadSI / traf.total * 100) : 0;
    if (pctColoc < umb.colocAlerta) alerts.push({ cat: "Tráfico", icon: "🔴", text: `Colocación baja: ${pctColoc.toFixed(1)}% — objetivo mínimo ${umb.colocAlerta}%` });
    else if (pctColoc >= umb.colocExcelente) wins.push({ cat: "Tráfico", icon: "🟢", text: `Colocación excelente: ${pctColoc.toFixed(1)}%` });
    if (pctPunt < umb.puntAlerta) alerts.push({ cat: "Tráfico", icon: "🔴", text: `Puntualidad crítica: ${pctPunt.toFixed(1)}% — mínimo ${umb.puntAlerta}%` });
    else if (pctPunt >= umb.puntExcelente) wins.push({ cat: "Tráfico", icon: "🟢", text: `Puntualidad destacada: ${pctPunt.toFixed(1)}%` });
    if (trafP) {
      const v = trafP.total > 0 ? ((traf.total - trafP.total) / trafP.total * 100) : 0;
      if (v < umb.varTurnosAlerta) alerts.push({ cat: "Tráfico", icon: "📉", text: `Turnos cayeron ${Math.abs(v).toFixed(1)}% vs mes anterior` });
      else if (v > umb.varTurnosWin) wins.push({ cat: "Tráfico", icon: "📈", text: `Turnos crecieron ${v.toFixed(1)}%` });
    }
    // Detalle ciudades tráfico
    if (traf.ciudadMap) {
      Object.entries(traf.ciudadMap).forEach(([c, v]) => {
        const pct = v.turnos > 0 ? (v.si / v.turnos * 100) : 0;
        const pctP = v.turnos > 0 ? (v.punt / v.turnos * 100) : 0;
        if (v.turnos >= umb.minTurnosCiudad) {
          const color = pct < umb.ciudadColocAlerta ? "rojo" : pct >= umb.colocExcelente ? "verde" : "amarillo";
          detalleCiudades.push({ ciudad: c, turnos: v.turnos, coloc: pct, punt: pctP, color });
          if (pct < umb.ciudadColocAlerta) alerts.push({ cat: "Ciudad", icon: "📍", text: `${c}: colocación ${pct.toFixed(1)}% (${v.turnos} turnos)` });
          else if (pct >= umb.colocExcelente) wins.push({ cat: "Ciudad", icon: "📍", text: `${c}: colocación ${pct.toFixed(1)}%` });
        }
      });
    }
    // Detalle puntos tráfico
    if (traf.puntoMap) {
      Object.entries(traf.puntoMap).forEach(([p, v]) => {
        const pct = v.turnos > 0 ? (v.si / v.turnos * 100) : 0;
        if (v.turnos >= umb.minTurnosPunto) {
          const color = pct < umb.puntoColocAlerta ? "rojo" : pct >= umb.colocExcelente ? "verde" : "amarillo";
          detallePuntos.push({ punto: p, ciudad: v.ciudad || "", turnos: v.turnos, coloc: pct, color });
        }
      });
    }
  }
  if (fact) {
    if (factP && factP.totalGmv > 0) {
      const v = ((fact.totalGmv - factP.totalGmv) / factP.totalGmv * 100);
      if (v < umb.gmvTotalAlerta) alerts.push({ cat: "Facturación", icon: "🚨", text: `GMV total cayó ${Math.abs(v).toFixed(1)}%: ${fmtMoney(fact.totalGmv)} vs ${fmtMoney(factP.totalGmv)}` });
      else if (v > umb.gmvTotalWin) wins.push({ cat: "Facturación", icon: "🚀", text: `GMV creció ${v.toFixed(1)}%: ${fmtMoney(fact.totalGmv)}` });
    }
    if (factP && factP.totalPaq > 0) {
      const v = ((fact.totalPaq - factP.totalPaq) / factP.totalPaq * 100);
      if (v < umb.paqAlerta) alerts.push({ cat: "Facturación", icon: "📦", text: `Paquetes cayeron ${Math.abs(v).toFixed(1)}%` });
      else if (v > umb.paqWin) wins.push({ cat: "Facturación", icon: "📦", text: `Paquetes crecieron ${v.toFixed(1)}%` });
    }
    if (fact.ciudadMap && factP?.ciudadMap) {
      Object.entries(fact.ciudadMap).forEach(([c, v]) => {
        const prev = factP.ciudadMap[c];
        if (prev?.gmv > 0) {
          const vg = ((v.gmv - prev.gmv) / prev.gmv * 100);
          if (vg < umb.gmvCiudadAlerta) alerts.push({ cat: "Fact. Ciudad", icon: "💸", text: `${c}: GMV cayó ${Math.abs(vg).toFixed(1)}% (${fmtMoney(v.gmv)} vs ${fmtMoney(prev.gmv)})` });
          else if (vg > umb.gmvCiudadWin) wins.push({ cat: "Fact. Ciudad", icon: "💰", text: `${c}: GMV creció ${vg.toFixed(1)}%` });
        }
      });
    }
    if (fact.puntoMap && factP?.puntoMap) {
      Object.entries(fact.puntoMap).filter(([,v]) => v.gmv > 0).forEach(([p, v]) => {
        const prev = factP.puntoMap[p];
        if (prev?.gmv > umb.minGmvPunto) {
          const vg = ((v.gmv - prev.gmv) / prev.gmv * 100);
          if (vg < umb.gmvPuntoAlerta) alerts.push({ cat: "Fact. Punto", icon: "🏪", text: `${p} (${v.ciudad}): GMV cayó ${Math.abs(vg).toFixed(0)}% — ${fmtMoney(prev.gmv)} → ${fmtMoney(v.gmv)}` });
        }
      });
    }
  }

  detallePuntos.sort((a, b) => a.coloc - b.coloc);
  detalleCiudades.sort((a, b) => a.coloc - b.coloc);
  const SEM = { rojo: "#DC2626", amarillo: "#D97706", verde: "#16A34A" };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Selector de mes + config */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">📅 Mes</label>
            <select value={mesSel} onChange={e => setMesSel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {insightsMeses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {isAdmin && (
            <button onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-purple-50 transition">
              ⚙️ {showConfig ? "Ocultar umbrales" : "Editar umbrales"}
            </button>
          )}
        </div>
      </div>

      {/* Config umbrales */}
      {showConfig && isAdmin && (
        <div className="bg-white rounded-2xl shadow-md border border-purple-100 p-5">
          <h3 className="font-bold text-purple-800 text-sm mb-3">⚙️ Umbrales de alertas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <UmbField label="Colocación alerta" k="colocAlerta" />
            <UmbField label="Colocación excelente" k="colocExcelente" />
            <UmbField label="Puntualidad alerta" k="puntAlerta" />
            <UmbField label="Puntualidad excelente" k="puntExcelente" />
            <UmbField label="Ciudad coloc. alerta" k="ciudadColocAlerta" />
            <UmbField label="Punto coloc. alerta" k="puntoColocAlerta" />
            <UmbField label="Var. turnos alerta" k="varTurnosAlerta" />
            <UmbField label="Var. turnos win" k="varTurnosWin" />
            <UmbField label="GMV ciudad alerta" k="gmvCiudadAlerta" />
            <UmbField label="GMV ciudad win" k="gmvCiudadWin" />
            <UmbField label="GMV punto alerta" k="gmvPuntoAlerta" />
            <UmbField label="GMV total alerta" k="gmvTotalAlerta" />
            <UmbField label="GMV total win" k="gmvTotalWin" />
            <UmbField label="Paquetes alerta" k="paqAlerta" />
            <UmbField label="Mín turnos ciudad" k="minTurnosCiudad" suffix="" />
            <UmbField label="Mín turnos punto" k="minTurnosPunto" suffix="" />
            <UmbField label="Mín GMV punto" k="minGmvPunto" suffix="$" />
          </div>
          <button onClick={() => saveUmb(UMB_DEFAULT)} className="mt-3 text-xs text-red-500 hover:underline">Restaurar valores por defecto</button>
        </div>
      )}

      {/* Alertas y wins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h4 className="text-sm font-bold text-red-600 mb-3">⚠️ Requiere atención ({alerts.length})</h4>
          {alerts.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {alerts.map((a, i) => (
                <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-gray-700 flex items-start gap-2">
                  <span className="shrink-0">{a.icon}</span>
                  <div><span className="font-semibold text-red-600">[{a.cat}]</span> {a.text}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">Sin alertas para {mesSel}</p>}
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h4 className="text-sm font-bold text-green-600 mb-3">✅ Puntos positivos ({wins.length})</h4>
          {wins.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {wins.map((w, i) => (
                <div key={i} className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-gray-700 flex items-start gap-2">
                  <span className="shrink-0">{w.icon}</span>
                  <div><span className="font-semibold text-green-600">[{w.cat}]</span> {w.text}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">Sin highlights para {mesSel}</p>}
        </div>
      </div>

      {/* Detalle por ciudad */}
      {detalleCiudades.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">📍 Detalle por Ciudad — {mesSel}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-purple-600 text-white">
                {["Ciudad","Turnos","Colocación %","Puntualidad %","Estado"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {detalleCiudades.map((c, i) => (
                  <tr key={c.ciudad} className={`border-t ${i%2===0?"bg-white":"bg-purple-50/30"}`}>
                    <td className="px-3 py-2 font-semibold">{c.ciudad}</td>
                    <td className="px-3 py-2">{c.turnos}</td>
                    <td className="px-3 py-2 font-bold" style={{color:SEM[c.color]}}>{c.coloc.toFixed(1)}%</td>
                    <td className="px-3 py-2">{c.punt.toFixed(1)}%</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-white text-xs font-bold" style={{background:SEM[c.color]}}>{c.color === "rojo" ? "Crítico" : c.color === "verde" ? "Excelente" : "Moderado"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle por punto */}
      {detallePuntos.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">🏪 Detalle por Punto — {mesSel}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-purple-600 text-white">
                {["Punto","Ciudad","Turnos","Colocación %","Estado"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {detallePuntos.slice(0, 30).map((p, i) => (
                  <tr key={p.punto} className={`border-t ${i%2===0?"bg-white":"bg-purple-50/30"}`}>
                    <td className="px-3 py-2 font-semibold max-w-[200px] truncate">{p.punto}</td>
                    <td className="px-3 py-2 text-gray-500">{p.ciudad}</td>
                    <td className="px-3 py-2">{p.turnos}</td>
                    <td className="px-3 py-2 font-bold" style={{color:SEM[p.color]}}>{p.coloc.toFixed(1)}%</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-white text-xs font-bold" style={{background:SEM[p.color]}}>{p.color === "rojo" ? "Crítico" : p.color === "verde" ? "Excelente" : "Moderado"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detallePuntos.length > 30 && <p className="text-xs text-gray-400 mt-2 text-center">Mostrando 30 de {detallePuntos.length} puntos</p>}
          </div>
        </div>
      )}

      {/* Top 10 pilotos más impuntuales */}
      {traf && !traf.pilotosImpuntuales && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-amber-700">⚠️ Los datos de pilotos no están disponibles para este mes. <b>Re-sube el archivo de tráfico</b> en la pestaña "Tráfico Pilotos" para generar el ranking.</p>
        </div>
      )}
      {traf?.pilotosImpuntuales?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">⏱️ Top 10 Pilotos más impuntuales — {mesSel}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-600 text-white">
                  {["#", "Piloto", "ID", "Ciudad", "Turnos", "No Cumple", "Cumple", "% Incumplimiento"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {traf.pilotosImpuntuales.map((p, i) => (
                  <tr key={p.id || p.nombre} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-red-50/30"} hover:bg-red-50`}>
                    <td className="px-3 py-2 text-red-400 font-bold">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{p.nombre || "Sin nombre"}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs font-mono truncate max-w-[120px]">{p.id}</td>
                    <td className="px-3 py-2 text-gray-500">{p.ciudad}</td>
                    <td className="px-3 py-2 text-center">{p.turnos}</td>
                    <td className="px-3 py-2 text-center font-bold text-red-600">{p.noCumple}</td>
                    <td className="px-3 py-2 text-center text-green-600">{p.cumple}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${p.pctNoCumple}%` }} />
                        </div>
                        <span className="text-xs font-bold text-red-600 whitespace-nowrap">{p.pctNoCumple.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">Pilotos con mínimo 3 turnos y al menos 1 incumplimiento de puntualidad.</p>
        </div>
      )}

      {/* Recomendaciones */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm font-bold text-amber-800 mb-2">🎯 Recomendaciones para {mesSel}</p>
          <ul className="text-xs text-gray-600 space-y-1.5">
            {alerts.some(a => a.cat === "Ciudad") && <li>• <b>Ciudades críticas:</b> Revisar disponibilidad de pilotos y capacidad operativa en ciudades con baja colocación.</li>}
            {alerts.some(a => a.cat === "Tráfico" && a.text.includes("Puntualidad")) && <li>• <b>Puntualidad:</b> Implementar control con alertas tempranas y seguimiento individual a pilotos.</li>}
            {alerts.some(a => a.cat.includes("Fact")) && <li>• <b>Facturación:</b> Investigar caídas de GMV — ¿menos puntos activos, menor volumen, o cambio de demanda?</li>}
            {alerts.some(a => a.cat === "Fact. Punto") && <li>• <b>Puntos en caída:</b> Contactar a los puntos con mayor decrecimiento para entender causas.</li>}
            {alerts.some(a => a.icon === "📉") && <li>• <b>Turnos:</b> Analizar si la reducción es por falta de demanda o falta de pilotos.</li>}
            {alerts.some(a => a.icon === "🚨") && <li>• <b>Urgente:</b> Reunión con el equipo para plan de acción ante caída general.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function InformeTada({ isAdmin }) {
  const [tab, setTab] = useState("trafico");
  const MESES_LABEL = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  // Tráfico por mes
  const [trafIndex, setTrafIndex] = useState(loadTrafIndex);
  const trafMeses = Object.keys(trafIndex).sort().reverse();
  const [trafMesSel, setTrafMesSel] = useState(trafMeses[0] || "");
  const [trafAnio, setTrafAnio] = useState(2026);
  const [trafMesNum, setTrafMesNum] = useState(new Date().getMonth() + 1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // Facturación por mes
  const [factIndex, setFactIndex] = useState(loadFactIndex);
  const factMeses = Object.keys(factIndex).sort().reverse();
  const [factMesSel, setFactMesSel] = useState(factMeses[0] || "");
  const [factAnio, setFactAnio] = useState(2026);
  const [factMesNum, setFactMesNum] = useState(new Date().getMonth() + 1);
  const [factLoading, setFactLoading] = useState(false);
  const [factError, setFactError] = useState(null);

  /* ── derived data (tráfico) ────────────────────────────────────────────── */
  const trafActual = useMemo(() => trafMesSel ? loadTrafMes(trafMesSel) : null, [trafMesSel, trafIndex]);
  const trafPrevKey = useMemo(() => {
    const sorted = Object.keys(trafIndex).sort();
    const idx = sorted.indexOf(trafMesSel);
    return idx > 0 ? sorted[idx - 1] : null;
  }, [trafMesSel, trafIndex]);
  const trafPrev = useMemo(() => trafPrevKey ? loadTrafMes(trafPrevKey) : null, [trafPrevKey, trafIndex]);

  const data = trafActual?.data || null;

  const estadoData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.estadoMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const ciudadColocData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.ciudadMap)
      .map(([name, v]) => ({ name, SI: v.si, NO: v.no }))
      .sort((a, b) => (b.SI + b.NO) - (a.SI + a.NO));
  }, [data]);

  const ciudadPuntData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.ciudadMap)
      .map(([name, v]) => ({
        name,
        "Puntualidad %": v.turnos ? parseFloat(((v.punt / v.turnos) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b["Puntualidad %"] - a["Puntualidad %"]);
  }, [data]);

  const semanaData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.semanaMap)
      .sort(([a], [b]) => {
        const na = parseFloat(a), nb = parseFloat(b);
        return (isNaN(na) || isNaN(nb)) ? a.localeCompare(b) : na - nb;
      })
      .map(([name, v]) => ({
        name: `S${name}`,
        Turnos: v.turnos,
        Colocaciones: v.si,
        "Puntualidad %": v.turnos ? parseFloat(((v.punt / v.turnos) * 100).toFixed(1)) : 0,
      }));
  }, [data]);

  const diaData = useMemo(() => {
    if (!data) return [];
    const order = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    return Object.entries(data.diaMap)
      .sort(([a], [b]) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([name, value]) => ({ name, Turnos: value }));
  }, [data]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "SI", value: data.colocacionesSI },
      { name: "NO", value: data.colocacionesNO },
    ];
  }, [data]);

  const topPuntos = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.puntoMap)
      .map(([punto, v]) => ({
        punto,
        ciudad: v.ciudad,
        turnos: v.turnos,
        colocaciones: v.si,
        pctColoc: pct(v.si, v.turnos),
        pctPunt: pct(v.punt, v.turnos),
      }))
      .sort((a, b) => b.turnos - a.turnos)
      .slice(0, 20);
  }, [data]);

  /* ── upload handler tráfico ────────────────────────────────────────────── */

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: "array" });
      const processed = processExcel(wb);
      const key = `${MESES_LABEL[trafMesNum]} ${trafAnio}`;
      saveTrafMes(key, { data: processed, archivo: file.name, fecha: new Date().toISOString() });
      const idx = loadTrafIndex();
      idx[key] = { archivo: file.name, fecha: new Date().toISOString() };
      saveTrafIndex(idx);
      setTrafIndex(idx);
      setTrafMesSel(key);
    } catch (err) {
      setError(err.message || "Error al procesar el archivo.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleTrafDeleteMes = (key) => {
    if (!confirm(`¿Eliminar ${key}?`)) return;
    localStorage.removeItem(SK_TRAF_MES(key));
    const idx = loadTrafIndex();
    delete idx[key];
    saveTrafIndex(idx);
    setTrafIndex(idx);
    const remaining = Object.keys(idx).sort().reverse();
    setTrafMesSel(remaining[0] || "");
  };

  /* ── Facturación upload ────────────────────────────────────────────── */
  const handleFactUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFactLoading(true);
    setFactError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: "array" });
      const processed = processFactExcel(wb);
      const key = `${MESES_LABEL[factMesNum]} ${factAnio}`;
      // Guardar mes individual
      saveFactMes(key, { ...processed, mes: key, archivo: file.name, fecha: new Date().toISOString() });
      // Actualizar índice
      const idx = loadFactIndex();
      idx[key] = { archivo: file.name, fecha: new Date().toISOString(), gmv: processed.totalGmv, paquetes: processed.totalPaq, servicios: processed.totalServ };
      saveFactIndex(idx);
      setFactIndex(idx);
      setFactMesSel(key);
    } catch (err) {
      setFactError(err.message);
    } finally {
      setFactLoading(false);
      e.target.value = "";
    }
  };

  const handleFactDeleteMes = (key) => {
    if (!confirm(`¿Eliminar ${key}?`)) return;
    localStorage.removeItem(SK_FACT_MES(key));
    const idx = loadFactIndex();
    delete idx[key];
    saveFactIndex(idx);
    setFactIndex(idx);
    const remaining = Object.keys(idx).sort().reverse();
    setFactMesSel(remaining[0] || "");
  };

  // Datos del mes seleccionado y anterior
  const factActual = useMemo(() => factMesSel ? loadFactMes(factMesSel) : null, [factMesSel, factIndex]);
  const factMesPrevKey = useMemo(() => {
    const sorted = Object.keys(factIndex).sort();
    const idx = sorted.indexOf(factMesSel);
    return idx > 0 ? sorted[idx - 1] : null;
  }, [factMesSel, factIndex]);
  const factPrev = useMemo(() => factMesPrevKey ? loadFactMes(factMesPrevKey) : null, [factMesPrevKey, factIndex]);

  const varFact = (actual, prev) => prev > 0 ? ((actual - prev) / prev) : null;

  /* ── render ───────────────────────────────────────────────────────────── */

  const fmtMoney = (n) => `$${Math.round(n).toLocaleString("es-CO")}`;
  const fmtM = (n) => {
    if (Math.abs(n) >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
    return `$${n.toLocaleString("es-CO")}`;
  };

  const chartCard = (title, children) => (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col">
      <h3 className="text-sm font-bold text-gray-700 mb-3">{title}</h3>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );

  const TABS_TADA = [
    { id: "trafico", label: "📊 Tráfico Pilotos" },
    { id: "facturacion", label: "💰 Facturación" },
    { id: "insights", label: "💡 Insights" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-purple-100 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-base font-bold" style={{ background: BRAND_GRADIENT }}>🍺</div>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">Informe TaDa (Bavaria)</p>
              <p className="text-xs text-gray-500">Tráfico de pilotos y facturación</p>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {TABS_TADA.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  tab === t.id ? "bg-purple-600 text-white shadow" : "text-gray-600 hover:bg-purple-50"
                }`}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TAB: FACTURACIÓN ─────────────────────────────────────────── */}
      {tab === "facturacion" && (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Selector de mes para análisis */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
            <div className="flex flex-wrap gap-4 items-end">
              {factMeses.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">📅 Mes a analizar</label>
                  <select value={factMesSel} onChange={e => setFactMesSel(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                    {factMeses.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
              {factMesPrevKey && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: BRAND_GRADIENT }}>
                  📊 Comparando vs <b className="ml-1">{factMesPrevKey}</b>
                  {factActual && factPrev && (() => {
                    const v = varFact(factActual.totalGmv, factPrev.totalGmv);
                    return v !== null ? (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-white/20">
                        {v >= 0 ? "▲" : "▼"} GMV {Math.abs(v * 100).toFixed(1)}%
                      </span>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          </div>

          {factActual ? (() => {
            const fd = factActual;
            const ciudadData = Object.entries(fd.ciudadMap).map(([name, v]) => ({ name, ...v })).filter(c => c.name && c.name !== "0" && c.name !== "Sin ciudad").sort((a, b) => b.gmv - a.gmv);
            const puntoData = Object.entries(fd.puntoMap).map(([name, v]) => ({ name, ...v })).filter(p => p.name && p.name !== "0" && p.name !== "Sin punto").sort((a, b) => b.gmv - a.gmv);
            const prevCiudad = factPrev ? Object.entries(factPrev.ciudadMap).map(([name, v]) => ({ name, ...v })) : [];

            const VarBadge = ({ actual, prev }) => {
              const v = varFact(actual, prev);
              if (v === null) return null;
              return <span className={`text-xs font-bold ${v >= 0 ? "text-green-600" : "text-red-500"}`}>{v >= 0 ? "▲" : "▼"} {Math.abs(v * 100).toFixed(1)}%</span>;
            };

            return (
              <>
                {/* KPIs con comparativa */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: "💰", label: "GMV", value: fmtMoney(fd.totalGmv), prev: factPrev?.totalGmv, color: PIBOX_PURPLE },
                    { icon: "📦", label: "Paquetes", value: fd.totalPaq.toLocaleString(), prev: factPrev?.totalPaq, color: "#6366F1" },
                    { icon: "📋", label: "Servicios", value: fd.totalServ.toLocaleString(), prev: factPrev?.totalServ, color: PIBOX_PINK },
                    { icon: "📅", label: "Mes", value: factMesSel, prev: null, color: SEM_VERDE },
                  ].map(k => (
                    <div key={k.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4" style={{ borderLeft: `4px solid ${k.color}` }}>
                      <p className="text-xs text-gray-500 uppercase">{k.icon} {k.label}</p>
                      <p className="text-xl font-extrabold mt-1" style={{ color: k.color }}>{k.value}</p>
                      {k.prev != null && <VarBadge actual={typeof k.value === "string" ? (k.label === "GMV" ? fd.totalGmv : k.label === "Paquetes" ? fd.totalPaq : fd.totalServ) : k.value} prev={k.prev} />}
                    </div>
                  ))}
                </div>

                {/* GMV por Ciudad con comparativa */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {chartCard(`🏙️ GMV por Ciudad — ${factMesSel}`, (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={ciudadData.slice(0, 10).map(c => ({
                        ...c, gmvPrev: prevCiudad.find(p => p.name === c.name)?.gmv || 0,
                      }))} layout="vertical" margin={{ left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                        <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 9 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} />
                        <Tooltip formatter={v => fmtMoney(v)} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                        <Bar dataKey="gmv" name={factMesSel} fill={PIBOX_PURPLE} radius={[0, 4, 4, 0]} />
                        {factPrev && <Bar dataKey="gmvPrev" name={factMesPrevKey} fill={PIBOX_PINK} radius={[0, 4, 4, 0]} fillOpacity={0.5} />}
                      </BarChart>
                    </ResponsiveContainer>
                  ))}

                  {chartCard(`📦 Paquetes por Ciudad — ${factMesSel}`, (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={ciudadData.slice(0, 10).map(c => ({
                        ...c, paqPrev: prevCiudad.find(p => p.name === c.name)?.paquetes || 0,
                      }))} layout="vertical" margin={{ left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                        <XAxis type="number" tick={{ fontSize: 9 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} />
                        <Tooltip formatter={v => v.toLocaleString()} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                        <Bar dataKey="paquetes" name={factMesSel} fill="#6366F1" radius={[0, 4, 4, 0]} />
                        {factPrev && <Bar dataKey="paqPrev" name={factMesPrevKey} fill={PIBOX_PINK} radius={[0, 4, 4, 0]} fillOpacity={0.5} />}
                      </BarChart>
                    </ResponsiveContainer>
                  ))}
                </div>

                {/* Evolución histórica (todos los meses) */}
                {factMeses.length > 1 && chartCard("📈 Evolución GMV mensual", (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[...factMeses].reverse().map(m => {
                      const d = loadFactMes(m);
                      return { mes: m, gmv: d?.totalGmv || 0, paquetes: d?.totalPaq || 0 };
                    })}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                      <XAxis dataKey="mes" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={50} />
                      <YAxis tickFormatter={fmtM} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={v => fmtMoney(v)} />
                      <Legend />
                      <Bar dataKey="gmv" name="GMV" fill={PIBOX_PURPLE} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ))}

                {/* Top Puntos */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">🏪 Top Puntos por GMV — {factMesSel}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: PIBOX_PURPLE }} className="text-white">
                          {["#", "Punto", "Ciudad", "GMV", "vs Ant.", "Paquetes", "Servicios", "GMV/Paq"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {puntoData.slice(0, 25).map((p, i) => {
                          const prevP = factPrev ? Object.entries(factPrev.puntoMap).find(([n]) => n === p.name)?.[1] : null;
                          return (
                            <tr key={p.name} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-purple-50/30"} hover:bg-purple-50`}>
                              <td className="px-3 py-2 text-purple-400 font-bold">{i + 1}</td>
                              <td className="px-3 py-2 font-semibold text-gray-800 max-w-[200px] truncate">{p.name}</td>
                              <td className="px-3 py-2 text-gray-500">{p.ciudad}</td>
                              <td className="px-3 py-2 font-bold text-purple-700">{fmtMoney(p.gmv)}</td>
                              <td className="px-3 py-2">{prevP ? <VarBadge actual={p.gmv} prev={prevP.gmv} /> : "—"}</td>
                              <td className="px-3 py-2">{p.paquetes.toLocaleString()}</td>
                              <td className="px-3 py-2">{p.servicios.toLocaleString()}</td>
                              <td className="px-3 py-2 text-gray-500">{p.paquetes > 0 ? fmtMoney(p.gmv / p.paquetes) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })() : (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-8 text-center text-purple-700">
              <p className="text-2xl mb-2">💰</p>
              <p className="text-sm font-medium">Sube el archivo de facturación TaDa para ver el análisis.</p>
              <p className="text-xs text-purple-400 mt-1">Sube un archivo por mes. Cada mes se guarda por separado.</p>
            </div>
          )}

          {/* Subir nuevo mes (Admin) — al final */}
          {isAdmin && (
            <div className="bg-white rounded-2xl shadow-md border border-purple-100 p-5">
              <h3 className="font-bold text-gray-700 text-sm mb-3">📂 Subir nuevo mes</h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Año</label>
                  <select value={factAnio} onChange={e => setFactAnio(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                    {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Mes</label>
                  <select value={factMesNum} onChange={e => setFactMesNum(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                    {MESES_LABEL.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Archivo Excel (.xlsx)</label>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold shadow hover:shadow-lg transition" style={{ background: BRAND_GRADIENT }}>
                    {factLoading ? "Procesando..." : "Seleccionar archivo"}
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFactUpload} disabled={factLoading} />
                  </label>
                </div>
              </div>
              {factError && <p className="mt-2 text-sm text-red-600">❌ {factError}</p>}
              {factMeses.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Meses cargados ({factMeses.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {factMeses.map(m => (
                      <div key={m} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                        factMesSel === m ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600 hover:bg-purple-50"
                      }`}>
                        <button onClick={() => setFactMesSel(m)}>{m}</button>
                        <button onClick={() => handleFactDeleteMes(m)} className="text-red-300 hover:text-red-500 ml-1">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: INSIGHTS ───────────────────────────────────────────── */}
      {tab === "insights" && <InsightsTab trafIndex={trafIndex} factIndex={factIndex} loadTrafMes={loadTrafMes} loadFactMes={loadFactMes} fmtMoney={fmtMoney} isAdmin={isAdmin} />}

      {/* ── TAB: TRÁFICO ─────────────────────────────────────────────── */}
      {tab === "trafico" && (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Selector de mes para análisis */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {trafMeses.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">📅 Mes a analizar</label>
                <select value={trafMesSel} onChange={e => setTrafMesSel(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  {trafMeses.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            {trafPrevKey && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: BRAND_GRADIENT }}>
                📊 Comparando vs <b className="ml-1">{trafPrevKey}</b>
                {data && trafPrev?.data && (() => {
                  const v = trafPrev.data.total > 0 ? ((data.total - trafPrev.data.total) / trafPrev.data.total) : null;
                  return v !== null ? (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-white/20">
                      {v >= 0 ? "▲" : "▼"} Turnos {Math.abs(v * 100).toFixed(1)}%
                    </span>
                  ) : null;
                })()}
              </div>
            )}
            {trafMeses.length === 0 && (
              <p className="text-sm text-gray-400">No hay meses cargados. Sube un reporte al final de la página.</p>
            )}
          </div>
        </div>

        {/* ── No data placeholder ─────────────────────────────────────── */}
        {!data && trafMeses.length > 0 && (
          <div className="text-center py-10 text-gray-400">
            <p>Selecciona un mes para ver el análisis.</p>
          </div>
        )}
        {!data && trafMeses.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">📊</p>
            <p className="text-lg font-semibold">No hay datos cargados</p>
            <p className="text-sm mt-1">
              {isAdmin
                ? "Sube un archivo Excel con la hoja DATA para comenzar."
                : "Un administrador debe subir el reporte para visualizar el dashboard."}
            </p>
          </div>
        )}

        {/* ── Dashboard ───────────────────────────────────────────────── */}
        {data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard
                icon="📋"
                label="Total Turnos"
                value={data.totalTurnos.toLocaleString()}
                borderColor={PIBOX_PURPLE}
              />
              <KpiCard
                icon="✅"
                label="Colocaciones"
                value={data.colocacionesSI.toLocaleString()}
                sub={`${pct(data.colocacionesSI, data.totalTurnos)}%`}
                borderColor={SEM_VERDE}
              />
              <KpiCard
                icon="❌"
                label="No Colocaciones"
                value={data.colocacionesNO.toLocaleString()}
                sub={`${pct(data.colocacionesNO, data.totalTurnos)}%`}
                borderColor={SEM_ROJO}
              />
              <KpiCard
                icon="🚫"
                label="Cancelaciones"
                value={data.cancelaciones.toLocaleString()}
                sub={`${pct(data.cancelaciones, data.totalTurnos)}%`}
                borderColor={SEM_AMARILLO}
              />
              <KpiCard
                icon="⏱️"
                label="Puntualidad"
                value={`${pct(data.puntualidadSI, data.totalTurnos)}%`}
                borderColor="#6366F1"
              />
              <KpiCard
                icon="🧑‍✈️"
                label="Pilotos Activos"
                value={data.pilotosActivos.toLocaleString()}
                borderColor={PIBOX_PINK}
              />
            </div>

            {/* Row 1: Pie + Estado Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {chartCard("Colocación: SI vs NO", (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip content={<TT />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ))}

              {chartCard("Estado del Turno", (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={estadoData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="value" name="Turnos" radius={[0, 6, 6, 0]}>
                      {estadoData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ))}
            </div>

            {/* Row 2: Ciudad Colocación + Ciudad Puntualidad */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {chartCard("Colocación por Ciudad", (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ciudadColocData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<TT />} />
                    <Legend />
                    <Bar dataKey="SI" stackId="a" fill={SEM_VERDE} name="SI" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="NO" stackId="a" fill={SEM_ROJO} name="NO" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ))}

              {chartCard("Puntualidad por Ciudad", (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ciudadPuntData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="Puntualidad %" fill="#6366F1" name="Puntualidad %" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ))}
            </div>

            {/* Row 3: Evolución Semanal + Día de la semana */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {chartCard("Evolución Semanal", (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={semanaData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip content={<TT />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="Turnos" fill={PIBOX_PURPLE} name="Turnos" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="Colocaciones" fill={SEM_VERDE} name="Colocaciones" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="Puntualidad %" fill="#6366F1" name="Puntualidad %" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ))}

              {chartCard("Distribución por Día de la Semana", (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={diaData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="Turnos" fill={PIBOX_PINK} name="Turnos" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ))}
            </div>

            {/* Row 4: Top 20 Puntos table */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                Top 20 Puntos (Tiendas) por Turnos
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-semibold">#</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-semibold">Punto</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-semibold">Ciudad</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-semibold">Turnos</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-semibold">Colocaciones</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-semibold">% Colocación</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-semibold">Puntualidad %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPuntos.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-purple-50/30 transition">
                        <td className="py-2 px-3 text-gray-400 font-mono">{i + 1}</td>
                        <td className="py-2 px-3 font-semibold text-gray-800 max-w-[220px] truncate" title={p.punto}>
                          {p.punto}
                        </td>
                        <td className="py-2 px-3 text-gray-600">{p.ciudad}</td>
                        <td className="py-2 px-3 text-right font-bold text-gray-700">{p.turnos}</td>
                        <td className="py-2 px-3 text-right text-gray-700">{p.colocaciones}</td>
                        <td className="py-2 px-3 text-right font-bold" style={{ color: colocColor(p.pctColoc) }}>
                          {p.pctColoc}%
                        </td>
                        <td className="py-2 px-3 text-right font-bold" style={{ color: colocColor(p.pctPunt) }}>
                          {p.pctPunt}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: SEM_VERDE }} /> {">"}90%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: SEM_AMARILLO }} /> 70-90%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: SEM_ROJO }} /> {"<"}70%
                </span>
              </div>
            </div>
          </>
        )}

        {/* Top 10 pilotos impuntuales */}
        {data?.pilotosImpuntuales?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">⏱️ Top 10 Pilotos más impuntuales — {trafMesSel}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-red-600 text-white">
                    {["#", "Piloto", "ID", "Ciudad", "Turnos", "No Cumple", "Cumple", "% Incumplimiento"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.pilotosImpuntuales.map((p, i) => (
                    <tr key={p.id || p.nombre} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-red-50/30"} hover:bg-red-50`}>
                      <td className="px-3 py-2 text-red-400 font-bold">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{p.nombre || "Sin nombre"}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs font-mono truncate max-w-[120px]">{p.id}</td>
                      <td className="px-3 py-2 text-gray-500">{p.ciudad}</td>
                      <td className="px-3 py-2 text-center">{p.turnos}</td>
                      <td className="px-3 py-2 text-center font-bold text-red-600">{p.noCumple}</td>
                      <td className="px-3 py-2 text-center text-green-600">{p.cumple}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${p.pctNoCumple}%` }} />
                          </div>
                          <span className="text-xs font-bold text-red-600 whitespace-nowrap">{p.pctNoCumple.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Subir nuevo mes tráfico (Admin) — al final */}
        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-md border border-purple-100 p-5">
            <h3 className="font-bold text-gray-700 text-sm mb-3">📂 Subir nuevo mes</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Año</label>
                <select value={trafAnio} onChange={e => setTrafAnio(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Mes</label>
                <select value={trafMesNum} onChange={e => setTrafMesNum(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  {MESES_LABEL.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Archivo Excel (.xlsx)</label>
                <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold shadow hover:shadow-lg transition" style={{ background: BRAND_GRADIENT }}>
                  {loading ? "Procesando..." : "Seleccionar archivo"}
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={loading} />
                </label>
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">❌ {error}</p>}
            {trafMeses.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2">Meses cargados ({trafMeses.length})</p>
                <div className="flex flex-wrap gap-2">
                  {trafMeses.map(m => (
                    <div key={m} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                      trafMesSel === m ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600 hover:bg-purple-50"
                    }`}>
                      <button onClick={() => setTrafMesSel(m)}>{m}</button>
                      <button onClick={() => handleTrafDeleteMes(m)} className="text-red-300 hover:text-red-500 ml-1">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
