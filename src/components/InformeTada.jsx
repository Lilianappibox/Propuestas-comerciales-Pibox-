import { useState, useMemo, useEffect, useRef } from "react";
import XLSX from "../utils/xlsxHelper";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
  ComposedChart, Line,
} from "recharts";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const PIBOX_PURPLE = "#7C22D4";
const PIBOX_PINK   = "#C026D3";

// Estados excluidos del cálculo de puntualidad
const ESTADOS_EXCLUIR_PUNTUALIDAD = ["reemplazo", "adicional", "adicional tada", "adicional cancelado", "piloto cancela"];
const SEM_VERDE    = "#16A34A";
const SEM_ROJO     = "#DC2626";
const SEM_AMARILLO = "#D97706";
const PIE_COLORS   = [SEM_VERDE, SEM_ROJO];
const BAR_COLORS   = [PIBOX_PURPLE, PIBOX_PINK, "#A855F7", "#6366F1", "#EC4899", "#8B5CF6", "#F59E0B", "#10B981"];
import tadaInicial from "../data/tadaInicial.json";
import NotasTareas from "./NotasTareas";

/* ── Tráfico storage (por mes) ──────────────────────────────────────────── */
const SK_TRAF_IDX = "pibox_tada_traf_index";
const SK_TRAF_MES = (k) => `pibox_tada_traf_${k}`;
function loadTrafIndex() { try { return JSON.parse(localStorage.getItem(SK_TRAF_IDX) || "{}"); } catch { return {}; } }
function saveTrafIndex(idx) { localStorage.setItem(SK_TRAF_IDX, JSON.stringify(idx)); }
function loadTrafMes(key) {
  try {
    const d = JSON.parse(localStorage.getItem(SK_TRAF_MES(key)) || "null");
    if (d) delete d.rows; // rows now live in IndexedDB
    return d;
  } catch { return null; }
}
function saveTrafMes(key, d) {
  const { rows, ...rest } = d;
  localStorage.setItem(SK_TRAF_MES(key), JSON.stringify(rest));
  if (rows) idbSaveRows(SK_TRAF_MES(key), rows);
}
async function saveTrafMesAsync(key, d) {
  const { rows, ...rest } = d;
  localStorage.setItem(SK_TRAF_MES(key), JSON.stringify(rest));
  if (rows) await idbSaveRows(SK_TRAF_MES(key), rows);
}

/* ── IndexedDB helpers for raw rows ────────────────────────────────────── */
const IDB_NAME = "pibox_tada_db";
const IDB_STORE = "rows";
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSaveRows(key, rows) {
  try {
    const db = await idbOpen();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(rows, key);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch (e) { console.warn("IDB save error:", e); }
}
async function idbLoadRows(key) {
  try {
    const db = await idbOpen();
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    return new Promise((res) => { req.onsuccess = () => res(req.result || null); req.onerror = () => res(null); });
  } catch { return null; }
}
async function idbDeleteRows(key) {
  try {
    const db = await idbOpen();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
  } catch {}
}

/* ── Funciones para no-admin (leer del código) ─────────────────────────── */
function loadTrafIndexReadonly() {
  return tadaInicial.trafIndex || {};
}
function loadTrafMesReadonly(key) {
  return tadaInicial.meses?.[`traf_${key}`] || null;
}
function loadFactIndexReadonly() {
  return tadaInicial.factIndex || {};
}
function loadFactMesReadonly(key) {
  return tadaInicial.meses?.[`fact_${key}`] || null;
}


function pct(n, d) { return d ? ((n / d) * 100).toFixed(1) : "0.0"; }

function parseFecha(raw) {
  if (!raw) return null;
  // Excel serial number (days since 1899-12-30)
  if (typeof raw === "number" && raw > 30000 && raw < 60000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  // Already a Date object
  if (raw instanceof Date && !isNaN(raw)) return raw.toISOString().slice(0, 10);
  // String date formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, a, b, y] = dmy;
    // Assume DD/MM/YYYY
    const dt = new Date(`${y}-${b.padStart(2,"0")}-${a.padStart(2,"0")}`);
    if (!isNaN(dt)) return dt.toISOString().slice(0, 10);
  }
  return null;
}

function processExcel(wb) {
  const sheet = wb.Sheets["DATA"];
  if (!sheet) throw new Error('No se encontró la hoja "DATA" en el archivo.');
  const rowsRaw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rowsRaw.length) throw new Error("La hoja DATA está vacía.");
  // Also read with date formatting for FECHA parsing
  const rowsFmt = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
  // Extract FECHA and attach to raw rows (preserving numeric values for INICIO DE TURNO etc.)
  const FECHA_COLS = ["FECHA", "FECHA_TURNO", "FECHA TURNO", "FECHA DEL TURNO", "DATE", "Fecha"];
  const fechaCol = FECHA_COLS.find(c => rowsRaw[0]?.[c] !== undefined && rowsRaw[0]?.[c] !== "");
  const enrichedRows = rowsRaw.map((r, i) => {
    const fmt = rowsFmt[i];
    let fecha = null;
    if (fechaCol) {
      fecha = parseFecha(r[fechaCol]) || parseFecha(fmt?.[fechaCol]);
    }
    if (!fecha) {
      for (const c of FECHA_COLS) {
        fecha = parseFecha(r[c]) || parseFecha(fmt?.[c]);
        if (fecha) break;
      }
    }
    return { ...r, _fecha: fecha };
  });
  const hasFechas = enrichedRows.some(r => r._fecha);
  // Slim rows: only keep columns needed by processRows to save localStorage space
  const slimRows = hasFechas ? enrichedRows.map(r => {
    const s = { _fecha: r._fecha };
    // Map all known column variants
    const coloc = r["COLOCACION"] || r["COLOCACIÓN"] || "";
    const punt = r["PUNTUALIDAD"] || "";
    const estado = r["ESTADO"] || "";
    const ciudad = r["CIUDAD"] || "";
    const punto = r["PUNTO"] || "";
    const semana = r["SEMANA"] || "";
    const dia = r["DÍA"] || r["DIA"] || "";
    const mes = r["MES"] || "";
    const piloto = r["ID PILOTO"] || "";
    const pilotoNombre = r["NOMBRE DE PILOTO"] || r["NOMBRE PILOTO"] || "";
    const inicio = r["INICIO DE TURNO"] || r["INICIO_TURNO"] || "";
    if (coloc) s["COLOCACION"] = coloc;
    if (punt) s["PUNTUALIDAD"] = punt;
    if (estado) s["ESTADO"] = estado;
    if (ciudad) s["CIUDAD"] = ciudad;
    if (punto) s["PUNTO"] = punto;
    if (semana) s["SEMANA"] = semana;
    if (dia) s["DIA"] = dia;
    if (mes) s["MES"] = mes;
    if (piloto) s["ID PILOTO"] = piloto;
    if (pilotoNombre) s["NOMBRE PILOTO"] = pilotoNombre;
    if (inicio) s["INICIO_TURNO"] = inicio;
    return s;
  }) : null;
  return { data: processRows(enrichedRows), rows: slimRows };
}

function processRows(rows) {
  let totalTurnos = 0;      // Solo cuenta turnos que NO son "cliente cancela"
  let clienteCancela = 0;
  let colocacionesSI = 0;
  let colocacionesNO = 0;
  let puntualidadSI    = 0;
  let puntualidadTurnos = 0; // Turnos válidos para medir puntualidad (excluye estados especiales)
  const estadoMap    = {};
  const ciudadMap    = {};
  const puntoMap     = {};
  const semanaMap    = {};
  const diaMap       = {};
  const mesMap       = {};
  const pilotos      = new Set();
  const pilotoMap    = {};
  const horaMap      = {};
  const horaDiaMap   = {};

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
    const estadoLower = estado.toLowerCase();
    const esExcluidoPuntualidad = ESTADOS_EXCLUIR_PUNTUALIDAD.some(e => estadoLower === e);
    const isPunt = !esExcluidoPuntualidad && punt === "SI CUMPLE";
    const isNoPunt = !esExcluidoPuntualidad && punt === "NO CUMPLE";
    const esClienteCancela = estadoLower.includes("cliente cancela");

    // Estado siempre se contabiliza (para gráfica de distribución de estados)
    if (estado) estadoMap[estado] = (estadoMap[estado] || 0) + 1;

    // Tracking por piloto (siempre, independiente de si es cliente cancela)
    const esCancelacion = estado.toUpperCase().includes("CANCEL") || estado.toUpperCase().includes("PILOTO CANCELA");
    if (piloto) pilotos.add(piloto);
    const pilotoKey = piloto || pilotoNombre;
    if (pilotoKey) {
      if (!pilotoMap[pilotoKey]) pilotoMap[pilotoKey] = { nombre: pilotoNombre, id: piloto, turnos: 0, cumple: 0, noCumple: 0, cancela: 0, ciudad: ciudad };
      pilotoMap[pilotoKey].turnos++;
      if (isPunt) pilotoMap[pilotoKey].cumple++;
      if (isNoPunt) pilotoMap[pilotoKey].noCumple++;
      if (esCancelacion) pilotoMap[pilotoKey].cancela++;
      if (pilotoNombre && pilotoNombre.length > (pilotoMap[pilotoKey].nombre || "").length) pilotoMap[pilotoKey].nombre = pilotoNombre;
      if (ciudad) pilotoMap[pilotoKey].ciudad = ciudad;
    }

    // Los turnos "cliente cancela" no cuentan para métricas de efectividad
    if (esClienteCancela) {
      clienteCancela++;
      continue;
    }

    totalTurnos++;
    if (isSI) colocacionesSI++;
    if (isNO) colocacionesNO++;
    if (!esExcluidoPuntualidad) puntualidadTurnos++;
    if (isPunt) puntualidadSI++;

    // Hora de inicio de turno (decimal Excel → hora, o HH:MM:SS string)
    const inicioVal = r["INICIO DE TURNO"] || r["INICIO_TURNO"] || "";
    const inicioRaw = Number(inicioVal);
    let horaLabel = null;
    if (inicioRaw > 0 && inicioRaw <= 1) {
      horaLabel = `${String(Math.floor(inicioRaw * 24)).padStart(2,"0")}:00`;
    } else {
      const hm = String(inicioVal).match(/^(\d{1,2}):/);
      if (hm) horaLabel = `${hm[1].padStart(2,"0")}:00`;
    }
    if (horaLabel) {
      if (!horaMap[horaLabel]) horaMap[horaLabel] = { turnos: 0, si: 0, punt: 0 };
      horaMap[horaLabel].turnos++;
      if (isSI) horaMap[horaLabel].si++;
      if (isPunt) horaMap[horaLabel].punt++;

      // Hora + Día cruzado
      if (dia) {
        const hdKey = `${dia}|${horaLabel}`;
        if (!horaDiaMap[hdKey]) horaDiaMap[hdKey] = { dia, hora: horaLabel, turnos: 0, si: 0 };
        horaDiaMap[hdKey].turnos++;
        if (isSI) horaDiaMap[hdKey].si++;
      }
    }

    // Ciudad
    if (ciudad) {
      if (!ciudadMap[ciudad]) ciudadMap[ciudad] = { turnos: 0, si: 0, no: 0, punt: 0, puntTurnos: 0 };
      ciudadMap[ciudad].turnos++;
      if (isSI) ciudadMap[ciudad].si++;
      if (isNO) ciudadMap[ciudad].no++;
      if (!esExcluidoPuntualidad) ciudadMap[ciudad].puntTurnos++;
      if (isPunt) ciudadMap[ciudad].punt++;
    }

    // Punto
    if (punto) {
      if (!puntoMap[punto]) puntoMap[punto] = { ciudad, turnos: 0, si: 0, no: 0, punt: 0, puntTurnos: 0 };
      puntoMap[punto].turnos++;
      if (isSI) puntoMap[punto].si++;
      if (isNO) puntoMap[punto].no++;
      if (!esExcluidoPuntualidad) puntoMap[punto].puntTurnos++;
      if (isPunt) puntoMap[punto].punt++;
    }

    // Semana
    if (semana) {
      if (!semanaMap[semana]) semanaMap[semana] = { turnos: 0, si: 0, punt: 0, puntTurnos: 0 };
      semanaMap[semana].turnos++;
      if (isSI) semanaMap[semana].si++;
      if (!esExcluidoPuntualidad) semanaMap[semana].puntTurnos++;
      if (isPunt) semanaMap[semana].punt++;
    }

    // Día
    if (dia) {
      if (!diaMap[dia]) diaMap[dia] = { turnos: 0, si: 0 };
      diaMap[dia].turnos++;
      if (isSI) diaMap[dia].si++;
    }

    // Mes
    if (mes) {
      if (!mesMap[mes]) mesMap[mes] = { turnos: 0, si: 0, punt: 0, puntTurnos: 0 };
      mesMap[mes].turnos++;
      if (isSI) mesMap[mes].si++;
      if (!esExcluidoPuntualidad) mesMap[mes].puntTurnos++;
      if (isPunt) mesMap[mes].punt++;
    }
  }

  const cancelaciones = Object.entries(estadoMap).reduce((sum, [k, v]) => {
    const kl = k.toLowerCase();
    return (kl === "piloto cancela" || kl === "adicional cancela") ? sum + v : sum;
  }, 0);

  // Pilotos impuntuales (todos, sin limitar)
  const pilotosImpuntuales = Object.values(pilotoMap)
    .filter(p => p.turnos >= 3 && p.noCumple > 0)
    .map(p => ({ ...p, pctNoCumple: (p.noCumple / p.turnos * 100) }))
    .sort((a, b) => b.noCumple - a.noCumple);

  // Pilotos que más cancelan (todos, sin limitar)
  const pilotosCanceladores = Object.values(pilotoMap)
    .filter(p => p.cancela > 0)
    .map(p => ({ ...p, pctCancela: (p.cancela / p.turnos * 100) }))
    .sort((a, b) => b.cancela - a.cancela);

  return {
    totalTurnos,
    clienteCancela,
    colocacionesSI,
    colocacionesNO,
    puntualidadSI,
    puntualidadTurnos,
    cancelaciones,
    pilotosActivos: pilotos.size,
    estadoMap,
    ciudadMap,
    puntoMap,
    semanaMap,
    diaMap,
    mesMap,
    pilotosImpuntuales,
    pilotosCanceladores,
    porHora: Object.entries(horaMap).map(([h, v]) => ({ hora: h, ...v, pctColoc: v.turnos > 0 ? (v.si/v.turnos*100) : 0 })).sort((a,b) => a.hora.localeCompare(b.hora)),
    porHoraDia: Object.values(horaDiaMap),
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

function InsightsTab({ trafIndex, factIndex, loadTrafMes, loadFactMes, fmtMoney, isAdmin, importedData }) {
  const pilotosNuevosPdfRef = useRef(null);
  const [showConfig, setShowConfig] = useState(false);
  const [umb, setUmb] = useState(() => { try { return { ...UMB_DEFAULT, ...JSON.parse(localStorage.getItem(SK_TADA_UMB) || "{}") }; } catch { return UMB_DEFAULT; } });
  const insightsMeses = [...new Set([...Object.keys(trafIndex), ...Object.keys(factIndex)])].sort().reverse();
  const [mesSel, setMesSel] = useState(insightsMeses[0] || "");

  // Cargar rows de mes actual y anterior para análisis de pilotos nuevos
  const [insRows, setInsRows] = useState(null);
  const [insPrevRows, setInsPrevRows] = useState(null);
  const insPrevKey = useMemo(() => {
    if (!mesSel) return null;
    // Calcular mes calendario anterior (Junio 2026 → Mayo 2026)
    const ML = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const parts = mesSel.split(" ");
    if (parts.length !== 2) return null;
    const mi = ML.indexOf(parts[0]);
    const yr = parseInt(parts[1]);
    if (mi <= 0 || isNaN(yr)) return null;
    const prevMi = mi === 1 ? 12 : mi - 1;
    const prevYr = mi === 1 ? yr - 1 : yr;
    return `${ML[prevMi]} ${prevYr}`;
  }, [mesSel]);
  useEffect(() => {
    setInsRows(null);
    if (!mesSel) return;
    if (isAdmin) {
      idbLoadRows(SK_TRAF_MES(mesSel)).then(r => setInsRows(r || null));
    } else {
      const imp = importedData?.meses?.[`traf_${mesSel}`];
      const fb = tadaInicial.meses?.[`traf_${mesSel}`];
      setInsRows(imp?.rows || fb?.rows || null);
    }
  }, [mesSel, trafIndex, importedData]);
  useEffect(() => {
    setInsPrevRows(null);
    if (!insPrevKey) return;
    if (isAdmin) {
      idbLoadRows(SK_TRAF_MES(insPrevKey)).then(r => setInsPrevRows(r || null));
    } else {
      const imp = importedData?.meses?.[`traf_${insPrevKey}`];
      const fb = tadaInicial.meses?.[`traf_${insPrevKey}`];
      setInsPrevRows(imp?.rows || fb?.rows || null);
    }
  }, [insPrevKey, trafIndex, importedData]);

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

  const _loadT = (k) => importedData?.meses?.[`traf_${k}`] || loadTrafMes(k);
  const _loadF = (k) => importedData?.meses?.[`fact_${k}`] || loadFactMes(k);
  const traf = _loadT(mesSel)?.data;
  const fact = _loadF(mesSel);
  // Mes calendario anterior para comparación
  const insPrevMesKey = (() => {
    const ML = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const parts = mesSel.split(" ");
    if (parts.length !== 2) return null;
    const mi = ML.indexOf(parts[0]), yr = parseInt(parts[1]);
    if (mi <= 0 || isNaN(yr)) return null;
    return `${ML[mi === 1 ? 12 : mi - 1]} ${mi === 1 ? yr - 1 : yr}`;
  })();
  const trafP = insPrevMesKey ? _loadT(insPrevMesKey)?.data : null;
  const factP = insPrevMesKey ? _loadF(insPrevMesKey) : null;

  const alerts = [], wins = [], detallePuntos = [], detalleCiudades = [];

  if (traf) {
    const T = traf.totalTurnos;
    const pctColoc = T > 0 ? (traf.colocacionesSI / T * 100) : 0;
    const pctNoColoc = T > 0 ? (traf.colocacionesNO / T * 100) : 0;
    const PT = traf.puntualidadTurnos || 0;
    const pctPunt = PT > 0 ? (traf.puntualidadSI / PT * 100) : 0;
    const pctCancel = T > 0 ? (traf.cancelaciones / T * 100) : 0;

    // 1. Colocación general
    if (pctColoc < umb.colocAlerta) alerts.push({ cat: "Colocación", icon: "🔴", text: `Colocación ${pctColoc.toFixed(1)}% (${traf.colocacionesSI.toLocaleString()} de ${T.toLocaleString()} turnos) — por debajo del objetivo ${umb.colocAlerta}%. Se pierden ${traf.colocacionesNO.toLocaleString()} oportunidades de colocación.` });
    else if (pctColoc >= umb.colocExcelente) wins.push({ cat: "Colocación", icon: "🟢", text: `Colocación excelente: ${pctColoc.toFixed(1)}% — ${traf.colocacionesSI.toLocaleString()} turnos colocados de ${T.toLocaleString()}.` });
    else wins.push({ cat: "Colocación", icon: "🟡", text: `Colocación en rango aceptable: ${pctColoc.toFixed(1)}% (${traf.colocacionesSI.toLocaleString()} de ${T.toLocaleString()}).` });

    // 2. Puntualidad general
    if (pctPunt < umb.puntAlerta) alerts.push({ cat: "Puntualidad", icon: "⏱️", text: `Puntualidad crítica: ${pctPunt.toFixed(1)}% — ${(T - traf.puntualidadSI).toLocaleString()} turnos con llegada tardía. Esto impacta la experiencia del cliente y la confiabilidad del servicio.` });
    else if (pctPunt >= umb.puntExcelente) wins.push({ cat: "Puntualidad", icon: "⏱️", text: `Puntualidad destacada: ${pctPunt.toFixed(1)}% — los pilotos están llegando a tiempo consistentemente.` });
    else alerts.push({ cat: "Puntualidad", icon: "⏱️", text: `Puntualidad moderada: ${pctPunt.toFixed(1)}% — hay margen de mejora. ${(T - traf.puntualidadSI).toLocaleString()} turnos con incumplimiento.` });

    // 3. Cancelaciones
    if (pctCancel > 15) alerts.push({ cat: "Cancelaciones", icon: "🚫", text: `Tasa de cancelación alta: ${pctCancel.toFixed(1)}% (${traf.cancelaciones.toLocaleString()} turnos). Investigar causas principales y pilotos reincidentes.` });
    else if (pctCancel > 8) alerts.push({ cat: "Cancelaciones", icon: "🚫", text: `Cancelaciones en ${pctCancel.toFixed(1)}% (${traf.cancelaciones.toLocaleString()} turnos). Mantener monitoreo para evitar que escale.` });
    else if (pctCancel <= 5 && T > 0) wins.push({ cat: "Cancelaciones", icon: "🚫", text: `Cancelaciones controladas: solo ${pctCancel.toFixed(1)}% (${traf.cancelaciones.toLocaleString()} de ${T.toLocaleString()}).` });

    // 4. Variación vs mes anterior
    if (trafP && trafP.totalTurnos > 0) {
      const vTurnos = ((T - trafP.totalTurnos) / trafP.totalTurnos * 100);
      const vColoc = trafP.colocacionesSI > 0 ? ((traf.colocacionesSI - trafP.colocacionesSI) / trafP.colocacionesSI * 100) : 0;
      const pctPuntP = (trafP.puntualidadTurnos || 0) > 0 ? (trafP.puntualidadSI / trafP.puntualidadTurnos * 100) : 0;
      const diffPunt = pctPunt - pctPuntP;
      if (vTurnos < umb.varTurnosAlerta) alerts.push({ cat: "Tendencia", icon: "📉", text: `Turnos cayeron ${Math.abs(vTurnos).toFixed(1)}% vs ${insPrevMesKey} (${trafP.totalTurnos.toLocaleString()} → ${T.toLocaleString()}). Revisar si es por menor demanda o falta de pilotos.` });
      else if (vTurnos > umb.varTurnosWin) wins.push({ cat: "Tendencia", icon: "📈", text: `Turnos crecieron ${vTurnos.toFixed(1)}% vs ${insPrevMesKey} (${trafP.totalTurnos.toLocaleString()} → ${T.toLocaleString()}).` });
      if (diffPunt < -5) alerts.push({ cat: "Tendencia", icon: "📉", text: `Puntualidad cayó ${Math.abs(diffPunt).toFixed(1)} puntos vs ${insPrevMesKey} (${pctPuntP.toFixed(1)}% → ${pctPunt.toFixed(1)}%).` });
      else if (diffPunt > 5) wins.push({ cat: "Tendencia", icon: "📈", text: `Puntualidad mejoró ${diffPunt.toFixed(1)} puntos vs ${insPrevMesKey} (${pctPuntP.toFixed(1)}% → ${pctPunt.toFixed(1)}%).` });
    }

    // 5. Pilotos activos
    if (trafP && trafP.pilotosActivos > 0) {
      const vPilotos = ((traf.pilotosActivos - trafP.pilotosActivos) / trafP.pilotosActivos * 100);
      const turnosPorPiloto = traf.pilotosActivos > 0 ? (T / traf.pilotosActivos) : 0;
      if (vPilotos < -10) alerts.push({ cat: "Pilotos", icon: "👤", text: `Base de pilotos se redujo ${Math.abs(vPilotos).toFixed(0)}% (${trafP.pilotosActivos} → ${traf.pilotosActivos}). Promedio ${turnosPorPiloto.toFixed(1)} turnos/piloto.` });
      else if (vPilotos > 10) wins.push({ cat: "Pilotos", icon: "👤", text: `Base de pilotos creció ${vPilotos.toFixed(0)}% (${trafP.pilotosActivos} → ${traf.pilotosActivos}). Promedio ${turnosPorPiloto.toFixed(1)} turnos/piloto.` });
      else {
        const info = traf.pilotosActivos === trafP.pilotosActivos ? "se mantuvo estable" : (vPilotos > 0 ? `creció ${vPilotos.toFixed(0)}%` : `bajó ${Math.abs(vPilotos).toFixed(0)}%`);
        wins.push({ cat: "Pilotos", icon: "👤", text: `Base de pilotos ${info}: ${traf.pilotosActivos} activos. Promedio ${turnosPorPiloto.toFixed(1)} turnos/piloto.` });
      }
    } else if (traf.pilotosActivos > 0) {
      const turnosPorPiloto = T / traf.pilotosActivos;
      wins.push({ cat: "Pilotos", icon: "👤", text: `${traf.pilotosActivos} pilotos activos con promedio de ${turnosPorPiloto.toFixed(1)} turnos/piloto.` });
    }

    // 6. Pilotos impuntuales reincidentes
    if (traf.pilotosImpuntuales?.length > 0) {
      const top3 = traf.pilotosImpuntuales.slice(0, 3);
      const totalNoCumple = top3.reduce((s, p) => s + p.noCumple, 0);
      alerts.push({ cat: "Pilotos", icon: "⏱️", text: `Top 3 pilotos impuntuales acumulan ${totalNoCumple} incumplimientos: ${top3.map(p => `${p.nombre || p.id} (${p.noCumple})`).join(", ")}. Requieren seguimiento individual.` });
    }

    // 7. Pilotos canceladores reincidentes
    if (traf.pilotosCanceladores?.length > 0) {
      const topCancel = traf.pilotosCanceladores.slice(0, 3);
      const totalCancel = topCancel.reduce((s, p) => s + p.cancela, 0);
      alerts.push({ cat: "Pilotos", icon: "🚫", text: `Top 3 pilotos que más cancelan acumulan ${totalCancel} cancelaciones: ${topCancel.map(p => `${p.nombre || p.id} (${p.cancela})`).join(", ")}.` });
    }

    // 8. Concentración por ciudad
    if (traf.ciudadMap) {
      const ciudades = Object.entries(traf.ciudadMap).sort((a, b) => b[1].turnos - a[1].turnos);
      if (ciudades.length > 0) {
        const topCiudad = ciudades[0];
        const pctTop = T > 0 ? (topCiudad[1].turnos / T * 100) : 0;
        if (pctTop > 50) alerts.push({ cat: "Operación", icon: "📊", text: `Alta concentración: ${topCiudad[0]} representa ${pctTop.toFixed(0)}% de los turnos (${topCiudad[1].turnos.toLocaleString()}). Diversificar operación reduciría riesgo.` });
        else wins.push({ cat: "Operación", icon: "📊", text: `Operación diversificada en ${ciudades.length} ciudades. Ciudad principal: ${topCiudad[0]} con ${pctTop.toFixed(0)}% de los turnos.` });
      }

      // Ciudades con problemas y ciudades destacadas
      Object.entries(traf.ciudadMap).forEach(([c, v]) => {
        const pct = v.turnos > 0 ? (v.si / v.turnos * 100) : 0;
        const pctP = (v.puntTurnos || 0) > 0 ? (v.punt / v.puntTurnos * 100) : 0;
        if (v.turnos >= umb.minTurnosCiudad) {
          const color = pct < umb.ciudadColocAlerta ? "rojo" : pct >= umb.colocExcelente ? "verde" : "amarillo";
          detalleCiudades.push({ ciudad: c, turnos: v.turnos, coloc: pct, punt: pctP, color });
          if (pct < umb.ciudadColocAlerta) alerts.push({ cat: "Ciudad", icon: "📍", text: `${c}: colocación ${pct.toFixed(1)}% con ${v.turnos} turnos — requiere plan de acción.` });
          else if (pct >= umb.colocExcelente) wins.push({ cat: "Ciudad", icon: "📍", text: `${c}: colocación ${pct.toFixed(1)}% — modelo a replicar.` });
        }
      });
    }

    // 9. Puntos con bajo rendimiento
    if (traf.puntoMap) {
      const puntosProblema = [];
      Object.entries(traf.puntoMap).forEach(([p, v]) => {
        const pct = v.turnos > 0 ? (v.si / v.turnos * 100) : 0;
        if (v.turnos >= umb.minTurnosPunto) {
          const color = pct < umb.puntoColocAlerta ? "rojo" : pct >= umb.colocExcelente ? "verde" : "amarillo";
          detallePuntos.push({ punto: p, ciudad: v.ciudad || "", turnos: v.turnos, coloc: pct, color });
          if (pct < umb.puntoColocAlerta) puntosProblema.push({ punto: p, ciudad: v.ciudad, pct, turnos: v.turnos });
        }
      });
      if (puntosProblema.length > 0) {
        const top3Puntos = puntosProblema.sort((a, b) => a.pct - b.pct).slice(0, 3);
        alerts.push({ cat: "Puntos", icon: "🏪", text: `${puntosProblema.length} puntos con colocación crítica (<${umb.puntoColocAlerta}%). Peores: ${top3Puntos.map(p => `${p.punto} (${p.pct.toFixed(0)}%)`).join(", ")}.` });
      }
      const puntosExcelentes = detallePuntos.filter(p => p.color === "verde").length;
      if (puntosExcelentes > 0) wins.push({ cat: "Puntos", icon: "🏪", text: `${puntosExcelentes} puntos con colocación excelente (>${umb.colocExcelente}%).` });
    }

    // 10. Distribución semanal — detectar semanas irregulares
    if (traf.semanaMap) {
      const semanas = Object.entries(traf.semanaMap);
      if (semanas.length >= 2) {
        const turnosSem = semanas.map(([, v]) => v.turnos);
        const avgSem = turnosSem.reduce((a, b) => a + b, 0) / turnosSem.length;
        const semBaja = semanas.find(([, v]) => v.turnos < avgSem * 0.6);
        const semAlta = semanas.find(([, v]) => v.turnos > avgSem * 1.4);
        if (semBaja) alerts.push({ cat: "Operación", icon: "📅", text: `Semana ${semBaja[0]} tuvo solo ${semBaja[1].turnos} turnos (promedio semanal: ${avgSem.toFixed(0)}). Revisar si fue por festivo, falta de demanda o problema operativo.` });
        if (semAlta) wins.push({ cat: "Operación", icon: "📅", text: `Semana ${semAlta[0]} fue la más productiva con ${semAlta[1].turnos} turnos (promedio: ${avgSem.toFixed(0)}).` });
      }
    }
  }

  // Facturación insights
  if (fact) {
    if (factP && factP.totalGmv > 0) {
      const v = ((fact.totalGmv - factP.totalGmv) / factP.totalGmv * 100);
      if (v < umb.gmvTotalAlerta) alerts.push({ cat: "Facturación", icon: "🚨", text: `GMV total cayó ${Math.abs(v).toFixed(1)}%: ${fmtMoney(fact.totalGmv)} vs ${fmtMoney(factP.totalGmv)}. Analizar si es por volumen, precio o mix de ciudades.` });
      else if (v > umb.gmvTotalWin) wins.push({ cat: "Facturación", icon: "🚀", text: `GMV creció ${v.toFixed(1)}%: ${fmtMoney(factP.totalGmv)} → ${fmtMoney(fact.totalGmv)}.` });
    }
    if (factP && factP.totalPaq > 0) {
      const v = ((fact.totalPaq - factP.totalPaq) / factP.totalPaq * 100);
      if (v < umb.paqAlerta) alerts.push({ cat: "Facturación", icon: "📦", text: `Paquetes cayeron ${Math.abs(v).toFixed(1)}% (${factP.totalPaq.toLocaleString()} → ${fact.totalPaq.toLocaleString()}).` });
      else if (v > umb.paqWin) wins.push({ cat: "Facturación", icon: "📦", text: `Paquetes crecieron ${v.toFixed(1)}% (${fact.totalPaq.toLocaleString()}).` });
    }
    if (fact.ciudadMap && factP?.ciudadMap) {
      Object.entries(fact.ciudadMap).forEach(([c, v]) => {
        const prev = factP.ciudadMap[c];
        if (prev?.gmv > 0) {
          const vg = ((v.gmv - prev.gmv) / prev.gmv * 100);
          if (vg < umb.gmvCiudadAlerta) alerts.push({ cat: "Fact. Ciudad", icon: "💸", text: `${c}: GMV cayó ${Math.abs(vg).toFixed(1)}% (${fmtMoney(prev.gmv)} → ${fmtMoney(v.gmv)}).` });
          else if (vg > umb.gmvCiudadWin) wins.push({ cat: "Fact. Ciudad", icon: "💰", text: `${c}: GMV creció ${vg.toFixed(1)}%: ${fmtMoney(v.gmv)}.` });
        }
      });
    }
    if (fact.puntoMap && factP?.puntoMap) {
      Object.entries(fact.puntoMap).filter(([,v]) => v.gmv > 0).forEach(([p, v]) => {
        const prev = factP.puntoMap[p];
        if (prev?.gmv > umb.minGmvPunto) {
          const vg = ((v.gmv - prev.gmv) / prev.gmv * 100);
          if (vg < umb.gmvPuntoAlerta) alerts.push({ cat: "Fact. Punto", icon: "🏪", text: `${p} (${v.ciudad}): GMV cayó ${Math.abs(vg).toFixed(0)}% — ${fmtMoney(prev.gmv)} → ${fmtMoney(v.gmv)}.` });
        }
      });
    }
  }

  detallePuntos.sort((a, b) => a.coloc - b.coloc);
  detalleCiudades.sort((a, b) => a.coloc - b.coloc);
  const SEM = { rojo: "#DC2626", amarillo: "#D97706", verde: "#16A34A" };

  // ── Análisis de pilotos nuevos ──
  const analisisNuevos = useMemo(() => {
    if (!insRows?.length || !insPrevRows?.length) return null;
    const prevIds = new Set();
    for (const r of insPrevRows) {
      const id = String(r["ID PILOTO"] || "").trim();
      if (id) prevIds.add(id);
    }
    // Todos los IDs del mes actual
    const allCurrentIds = new Set();
    for (const r of insRows) {
      const id = String(r["ID PILOTO"] || "").trim();
      if (id) allCurrentIds.add(id);
    }
    // Pilotos que estaban el mes anterior pero no están este mes (perdidos/rotación)
    const pilotosPerdidos = new Set();
    for (const id of prevIds) { if (!allCurrentIds.has(id)) pilotosPerdidos.add(id); }

    // Agrupar data de pilotos nuevos
    const map = {};
    const porCiudad = {};
    let totalTurnosNuevos = 0, totalPuntSI = 0, totalPuntEval = 0, totalCancela = 0;
    for (const r of insRows) {
      const id = String(r["ID PILOTO"] || "").trim();
      if (!id || prevIds.has(id)) continue;
      const nombre = String(r["NOMBRE DE PILOTO"] || r["NOMBRE PILOTO"] || "").trim();
      const ciudad = String(r["CIUDAD"] || "").trim();
      const estado = String(r["ESTADO"] || "").trim();
      const punto = String(r["PUNTO"] || "").trim();
      const punt = String(r["PUNTUALIDAD"] || "").trim().toUpperCase();
      const esCancela = estado.toUpperCase().includes("CANCEL") || estado.toUpperCase().includes("PILOTO CANCELA");
      const esExcluidoPuntN = ESTADOS_EXCLUIR_PUNTUALIDAD.some(e => estado.toLowerCase() === e);
      if (!map[id]) map[id] = { id, nombre, ciudad, turnos: 0, puntSI: 0, puntTotal: 0, cancela: 0, estados: {}, puntos: new Set() };
      map[id].turnos++;
      totalTurnosNuevos++;
      if (estado) map[id].estados[estado] = (map[id].estados[estado] || 0) + 1;
      if (punto) map[id].puntos.add(punto);
      if (!esExcluidoPuntN && (punt === "SI CUMPLE" || punt === "NO CUMPLE")) { map[id].puntTotal++; totalPuntEval++; }
      if (!esExcluidoPuntN && punt === "SI CUMPLE") { map[id].puntSI++; totalPuntSI++; }
      if (esCancela) { map[id].cancela++; totalCancela++; }
      if (nombre && nombre.length > (map[id].nombre || "").length) map[id].nombre = nombre;
      if (ciudad) map[id].ciudad = ciudad;
      // Por ciudad
      if (ciudad) {
        if (!porCiudad[ciudad]) porCiudad[ciudad] = { nuevos: new Set(), turnos: 0, puntSI: 0, puntTotal: 0, cancela: 0, confirmados: 0 };
        porCiudad[ciudad].nuevos.add(id);
        porCiudad[ciudad].turnos++;
        if (!esExcluidoPuntN && punt === "SI CUMPLE") porCiudad[ciudad].puntSI++;
        if (!esExcluidoPuntN && (punt === "SI CUMPLE" || punt === "NO CUMPLE")) porCiudad[ciudad].puntTotal++;
        if (esCancela) porCiudad[ciudad].cancela++;
        if (estado === "Confirmado") porCiudad[ciudad].confirmados++;
      }
    }
    const nuevos = Object.values(map).map(p => ({ ...p, puntos: [...p.puntos] }));
    const totalNuevos = nuevos.length;
    if (totalNuevos === 0) return null;
    // Promedios
    const avgTurnos = totalTurnosNuevos / totalNuevos;
    const pctPuntGlobal = totalPuntEval > 0 ? (totalPuntSI / totalPuntEval * 100) : 0;
    const pctCancelaGlobal = totalTurnosNuevos > 0 ? (totalCancela / totalTurnosNuevos * 100) : 0;
    // Tasa de retención: pilotos del mes anterior que siguen este mes
    const retenidos = [...prevIds].filter(id => allCurrentIds.has(id)).length;
    const tasaRetencion = prevIds.size > 0 ? (retenidos / prevIds.size * 100) : 0;
    // Distribución por rango de turnos
    const rangos = { "1 turno": 0, "2-3 turnos": 0, "4-7 turnos": 0, "8-15 turnos": 0, "16+ turnos": 0 };
    for (const p of nuevos) {
      if (p.turnos === 1) rangos["1 turno"]++;
      else if (p.turnos <= 3) rangos["2-3 turnos"]++;
      else if (p.turnos <= 7) rangos["4-7 turnos"]++;
      else if (p.turnos <= 15) rangos["8-15 turnos"]++;
      else rangos["16+ turnos"]++;
    }
    // Ciudad data
    const ciudadData = Object.entries(porCiudad)
      .map(([ciudad, v]) => ({
        ciudad,
        nuevos: v.nuevos.size,
        turnos: v.turnos,
        avgTurnos: v.turnos / v.nuevos.size,
        pctPunt: v.puntTotal > 0 ? (v.puntSI / v.puntTotal * 100) : null,
        pctCancela: v.turnos > 0 ? (v.cancela / v.turnos * 100) : 0,
        pctConfirmado: v.turnos > 0 ? (v.confirmados / v.turnos * 100) : 0,
      }))
      .sort((a, b) => b.nuevos - a.nuevos);
    // Pilotos nuevos que cancelan (todos, ordenados)
    const allCanceladores = nuevos.filter(p => p.cancela > 0)
      .map(p => ({ ...p, pctCancela: p.turnos > 0 ? (p.cancela / p.turnos * 100) : 0 }))
      .sort((a, b) => b.cancela - a.cancela);
    const topCanceladores = allCanceladores.slice(0, 5);
    // Pilotos nuevos más activos (todos, ordenados)
    const allActivos = [...nuevos].sort((a, b) => b.turnos - a.turnos)
      .map(p => ({ ...p, pctPunt: p.puntTotal > 0 ? (p.puntSI / p.puntTotal * 100) : null }));
    const topActivos = allActivos.slice(0, 5);

    // ── Top 5 pilotos perdidos con mayor GMV estimado (basado en mes anterior) ──
    // GMV estimado = (turnos_SI_piloto_en_ciudad / total_SI_ciudad_mes_ant) × GMV_ciudad_mes_ant
    const perdidosAcum = {};
    const cityPrevSI = {};
    for (const r of insPrevRows) {
      const id = String(r["ID PILOTO"] || "").trim();
      if (!id) continue;
      const nombre = String(r["NOMBRE DE PILOTO"] || r["NOMBRE PILOTO"] || "").trim();
      const ciudad = String(r["CIUDAD"] || "").trim();
      const coloc = String(r["COLOCACION"] || r["COLOCACIÓN"] || "").trim().toUpperCase();
      const esSI = coloc === "SI";
      const esCancela = String(r["ESTADO"] || "").toUpperCase().includes("CANCEL");
      if (!perdidosAcum[id]) perdidosAcum[id] = { id, nombre, ciudad, turnos: 0, si: 0, cancela: 0 };
      perdidosAcum[id].turnos++;
      if (esSI) perdidosAcum[id].si++;
      if (esCancela) perdidosAcum[id].cancela++;
      if (nombre && nombre.length > (perdidosAcum[id].nombre || "").length) perdidosAcum[id].nombre = nombre;
      if (ciudad) perdidosAcum[id].ciudad = ciudad;
      if (ciudad && esSI) cityPrevSI[ciudad] = (cityPrevSI[ciudad] || 0) + 1;
    }
    const allPerdidos = Object.values(perdidosAcum)
      .filter(p => pilotosPerdidos.has(p.id))
      .map(p => {
        let gmvEst = 0;
        if (factP?.ciudadMap && p.ciudad && cityPrevSI[p.ciudad] > 0) {
          const cGmv = factP.ciudadMap[p.ciudad]?.gmv || 0;
          gmvEst = (p.si / cityPrevSI[p.ciudad]) * cGmv;
        }
        return { ...p, gmvEst };
      })
      .sort((a, b) => b.gmvEst - a.gmvEst || b.si - a.si);
    const topPerdidosGMV = allPerdidos.slice(0, 5);
    const tieneGMVEst = allPerdidos.some(p => p.gmvEst > 0);

    return {
      totalNuevos, totalTurnosNuevos, avgTurnos, pctPuntGlobal, pctCancelaGlobal,
      pilotosPerdidos: pilotosPerdidos.size, tasaRetencion, prevTotal: prevIds.size,
      rangos, ciudadData, topCanceladores, topActivos, allActivos, allCanceladores,
      topPerdidosGMV, allPerdidos, tieneGMVEst,
    };
  }, [insRows, insPrevRows, factP]);

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

      {/* ── Análisis Pilotos Nuevos ──────────────────────────────────── */}
      {analisisNuevos && (
        <div ref={pilotosNuevosPdfRef} className="space-y-6">
          <div className="bg-gradient-to-r from-purple-700 to-fuchsia-600 rounded-2xl shadow-md p-5 text-white">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold">🆕 Análisis de Pilotos Nuevos — {mesSel}</h3>
              <button onClick={() => printSection(pilotosNuevosPdfRef, `Pilotos Nuevos — ${mesSel}`)}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold transition">
                📄 Descargar PDF
              </button>
            </div>
            <p className="text-xs opacity-80 mb-4">Pilotos programados este mes que no aparecieron en {insPrevKey}.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Pilotos nuevos", value: analisisNuevos.totalNuevos, icon: "👤" },
                { label: "Turnos asignados", value: analisisNuevos.totalTurnosNuevos, icon: "📋" },
                { label: "Promedio turnos/piloto", value: analisisNuevos.avgTurnos.toFixed(1), icon: "📊" },
                { label: "Puntualidad", value: `${analisisNuevos.pctPuntGlobal.toFixed(1)}%`, icon: "⏱️" },
                { label: "Tasa cancelación", value: `${analisisNuevos.pctCancelaGlobal.toFixed(1)}%`, icon: "🚫" },
                { label: "Retención mes ant.", value: `${analisisNuevos.tasaRetencion.toFixed(1)}%`, icon: "🔄" },
              ].map((kpi, i) => (
                <div key={i} className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
                  <p className="text-lg mb-0.5">{kpi.icon}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                  <p className="text-[10px] opacity-80">{kpi.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rotación */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">🔄 Rotación de Pilotos — {mesSel} vs {insPrevKey}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-purple-700">{analisisNuevos.prevTotal}</p>
                <p className="text-xs text-gray-500">Pilotos mes anterior</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{analisisNuevos.prevTotal - analisisNuevos.pilotosPerdidos}</p>
                <p className="text-xs text-gray-500">Retenidos</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{analisisNuevos.pilotosPerdidos}</p>
                <p className="text-xs text-gray-500">Perdidos (no volvieron)</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{analisisNuevos.totalNuevos}</p>
                <p className="text-xs text-gray-500">Nuevos ingresaron</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${analisisNuevos.tasaRetencion}%` }} title={`Retención: ${analisisNuevos.tasaRetencion.toFixed(1)}%`} />
                <div className="h-full bg-red-400 transition-all" style={{ width: `${100 - analisisNuevos.tasaRetencion}%` }} title={`Pérdida: ${(100 - analisisNuevos.tasaRetencion).toFixed(1)}%`} />
              </div>
              <span className="font-bold text-green-600">{analisisNuevos.tasaRetencion.toFixed(0)}% retención</span>
            </div>
          </div>

          {/* Distribución por rango de turnos */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">📊 Distribución de Pilotos Nuevos por Actividad</h3>
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(analisisNuevos.rangos).map(([rango, count], idx) => {
                const pct = analisisNuevos.totalNuevos > 0 ? (count / analisisNuevos.totalNuevos * 100) : 0;
                const colors = ["#7C22D4", "#A855F7", "#C026D3", "#6366F1", "#EC4899"];
                return (
                  <div key={rango} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                    <p className="text-2xl font-bold" style={{ color: colors[idx] }}>{count}</p>
                    <p className="text-xs font-semibold text-gray-600 mt-1">{rango}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${Math.max(pct, 4)}%`, background: colors[idx] }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{pct.toFixed(0)}% del total</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Por ciudad */}
          {analisisNuevos.ciudadData.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">📍 Pilotos Nuevos por Ciudad</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-purple-700 text-white">
                      {["Ciudad", "Nuevos", "Turnos", "Prom. Turnos/Piloto", "% Confirmado", "% Cancelación", "% Puntualidad"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analisisNuevos.ciudadData.map((c, i) => (
                      <tr key={c.ciudad} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-purple-50/30"} hover:bg-purple-50`}>
                        <td className="px-3 py-2 font-semibold text-gray-800">{c.ciudad}</td>
                        <td className="px-3 py-2 text-center font-bold text-purple-600">{c.nuevos}</td>
                        <td className="px-3 py-2 text-center">{c.turnos}</td>
                        <td className="px-3 py-2 text-center">{c.avgTurnos.toFixed(1)}</td>
                        <td className="px-3 py-2 text-center font-bold text-green-600">{c.pctConfirmado.toFixed(0)}%</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-bold ${c.pctCancela > 20 ? "text-red-600" : c.pctCancela > 10 ? "text-orange-600" : "text-green-600"}`}>
                            {c.pctCancela.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {c.pctPunt !== null ? (
                            <span className={`font-bold ${c.pctPunt >= 90 ? "text-green-600" : c.pctPunt >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                              {c.pctPunt.toFixed(0)}%
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top 5 pilotos nuevos más activos + Top 5 que más cancelan */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analisisNuevos.topActivos.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700">🏆 Top 5 Pilotos Nuevos Más Activos</h3>
                  <button onClick={() => {
                    try {
                      const csvRows = [["#","Piloto","ID","Ciudad","Turnos","Confirmados","Cancelaciones","% Puntualidad","Puntos"].join(",")];
                      (analisisNuevos.allActivos || []).forEach((p, i) => {
                        const nombre = String(p.nombre||"").replace(/"/g,'""');
                        const conf = (p.estados && p.estados["Confirmado"]) || 0;
                        const punt = p.pctPunt !== null && p.pctPunt !== undefined ? p.pctPunt.toFixed(1)+"%" : "";
                        const puntos = Array.isArray(p.puntos) ? p.puntos.join("; ") : "";
                        csvRows.push([i+1,`"${nombre}"`,`"${p.id||""}"`,`"${p.ciudad||""}"`,p.turnos||0,conf,p.cancela||0,punt,`"${puntos}"`].join(","));
                      });
                      const blob = new Blob(["\uFEFF"+csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "Pilotos_Nuevos_Activos_" + mesSel.replace(/ /g,"_") + ".csv";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch(e) { alert("Error: " + e.message); }
                  }} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition">
                    📥 Descargar todos ({analisisNuevos.allActivos.length})
                  </button>
                </div>
                <div className="space-y-2">
                  {analisisNuevos.topActivos.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-lg font-bold text-purple-400 w-6">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.nombre || p.id}</p>
                        <p className="text-[10px] text-gray-400">{p.ciudad}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-purple-700">{p.turnos} turnos</p>
                        <p className="text-[10px] text-gray-500">
                          Punt: {p.pctPunt !== null ? <span className={p.pctPunt >= 90 ? "text-green-600 font-bold" : p.pctPunt >= 70 ? "text-yellow-600 font-bold" : "text-red-600 font-bold"}>{p.pctPunt.toFixed(0)}%</span> : "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analisisNuevos.topCanceladores.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700">🚫 Top 5 Pilotos Nuevos que Más Cancelan</h3>
                  <button onClick={() => {
                    try {
                      const csvRows = [["#","Piloto","ID","Ciudad","Turnos","Cancelaciones","No Cancela","% Cancelación","Puntos"].join(",")];
                      (analisisNuevos.allCanceladores || []).forEach((p, i) => {
                        const nombre = String(p.nombre||"").replace(/"/g,'""');
                        const puntos = Array.isArray(p.puntos) ? p.puntos.join("; ") : "";
                        csvRows.push([i+1,`"${nombre}"`,`"${p.id||""}"`,`"${p.ciudad||""}"`,p.turnos||0,p.cancela||0,(p.turnos||0)-(p.cancela||0),p.pctCancela.toFixed(1)+"%",`"${puntos}"`].join(","));
                      });
                      const blob = new Blob(["\uFEFF"+csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "Pilotos_Nuevos_Canceladores_" + mesSel.replace(/ /g,"_") + ".csv";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch(e) { alert("Error: " + e.message); }
                  }} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition">
                    📥 Descargar todos ({analisisNuevos.allCanceladores.length})
                  </button>
                </div>
                <div className="space-y-2">
                  {analisisNuevos.topCanceladores.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 bg-red-50/50 rounded-lg px-3 py-2">
                      <span className="text-lg font-bold text-red-400 w-6">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.nombre || p.id}</p>
                        <p className="text-[10px] text-gray-400">{p.ciudad}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-orange-600">{p.cancela}/{p.turnos}</p>
                        <p className="text-[10px] font-bold text-red-600">{p.pctCancela.toFixed(0)}% cancel.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top 5 pilotos perdidos por GMV */}
          {analisisNuevos.topPerdidosGMV.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-700">⚠️ Top 5 Pilotos Perdidos por GMV</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Clasificados como perdidos en {mesSel} · datos del mes anterior {insPrevKey}
                    {analisisNuevos.tieneGMVEst ? " · GMV estimado por proporción de colocaciones en ciudad" : " · ordenado por turnos colocados (SI)"}
                  </p>
                </div>
                <button onClick={() => {
                  try {
                    const fmtMoney = (v) => Math.round(v).toLocaleString("es-CO");
                    const csvRows = [["#","Piloto","ID","Ciudad","Turnos (mes ant.)","Colocados (SI)","Cancelaciones","GMV Estimado"].join(",")];
                    analisisNuevos.allPerdidos.forEach((p, i) => {
                      const nombre = String(p.nombre || "").replace(/"/g, '""');
                      csvRows.push([
                        i + 1,
                        `"${nombre}"`,
                        `"${p.id || ""}"`,
                        `"${p.ciudad || ""}"`,
                        p.turnos || 0,
                        p.si || 0,
                        p.cancela || 0,
                        analisisNuevos.tieneGMVEst ? fmtMoney(p.gmvEst) : "—",
                      ].join(","));
                    });
                    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Pilotos_Perdidos_GMV_${mesSel.replace(/ /g, "_")}.csv`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (e) { alert("Error: " + e.message); }
                }} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition whitespace-nowrap">
                  📥 Descargar todos ({analisisNuevos.allPerdidos.length})
                </button>
              </div>
              <div className="space-y-2">
                {analisisNuevos.topPerdidosGMV.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 bg-red-50/40 rounded-lg px-3 py-2">
                    <span className="text-lg font-bold text-red-300 w-6">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{p.nombre || p.id}</p>
                      <p className="text-[10px] text-gray-400">{p.ciudad} · {p.turnos} turnos · {p.si} colocados</p>
                    </div>
                    <div className="text-right">
                      {analisisNuevos.tieneGMVEst
                        ? <p className="text-sm font-bold text-green-700">${Math.round(p.gmvEst).toLocaleString("es-CO")}</p>
                        : <p className="text-sm font-bold text-purple-700">{p.si} turnos SI</p>
                      }
                      {p.cancela > 0 && (
                        <p className="text-[10px] text-red-500">{p.cancela} cancel.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {isAdmin && insRows && !insPrevRows && insPrevKey && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center text-purple-600 text-sm">
          Para ver el análisis de pilotos nuevos, sube también el reporte de <b>{insPrevKey}</b> en la pestaña Tráfico Pilotos.
        </div>
      )}
    </div>
  );
}

async function printSection(ref, title) {
  if (!ref?.current) return;
  // Snapshot all Recharts SVGs as PNG via canvas (ensures images load before cloning)
  const svgContainers = ref.current.querySelectorAll(".recharts-wrapper");
  const snapshots = [];
  for (const wrapper of svgContainers) {
    const svg = wrapper.querySelector("svg");
    if (!svg) continue;
    const width = wrapper.offsetWidth || 800;
    const height = wrapper.offsetHeight || 400;
    // Clone SVG with explicit pixel dimensions and namespace
    const svgClone = svg.cloneNode(true);
    svgClone.setAttribute("width", width);
    svgClone.setAttribute("height", height);
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    // Render SVG into canvas to get a PNG data URL
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    await new Promise((resolve) => {
      const tmpImg = new Image();
      tmpImg.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(tmpImg, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve();
      };
      tmpImg.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      tmpImg.src = url;
    });
    const imgEl = document.createElement("img");
    imgEl.src = canvas.toDataURL("image/png");
    imgEl.style.cssText = `width:${width}px;height:${height}px;max-width:100%;display:block;`;
    snapshots.push({ wrapper, img: imgEl });
  }
  // Temporarily replace SVG wrappers with PNG images
  for (const { wrapper, img } of snapshots) {
    wrapper._origHTML = wrapper.innerHTML;
    wrapper.innerHTML = "";
    wrapper.appendChild(img);
  }
  const content = ref.current.cloneNode(true);
  // Restore originals
  for (const { wrapper } of snapshots) {
    wrapper.innerHTML = wrapper._origHTML;
    delete wrapper._origHTML;
  }
  // Remove download buttons from the clone
  for (const btn of content.querySelectorAll("button")) btn.remove();
  for (const lbl of content.querySelectorAll("label")) {
    if (lbl.querySelector('input[type="file"]')) lbl.remove();
  }
  const win = window.open("", "_blank");
  if (!win) { alert("Permite ventanas emergentes para descargar el PDF"); return; }
  // Copy all stylesheets
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(s => s.outerHTML).join("\n");
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>${styles}
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      body { margin: 0; background: white; }
      .max-w-7xl { max-width: 100% !important; }
      .grid { display: block !important; }
      .grid > * { margin-bottom: 16px; }
      .lg\\:grid-cols-2 { display: block !important; }
      .recharts-wrapper, .recharts-surface { width: 100% !important; max-width: 100% !important; }
      svg { max-width: 100%; height: auto; }
      .overflow-x-auto { overflow: visible !important; }
      table { width: 100% !important; font-size: 10px; }
      .rounded-2xl, .rounded-xl { break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px; }
      .shadow-md { box-shadow: none !important; border: 1px solid #e5e7eb; }
    </style>
    </head><body><div class="max-w-7xl mx-auto px-4 py-4 space-y-4">${content.innerHTML}</div></body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 800);
}

export default function InformeTada({ isAdmin }) {
  const [tab, setTab] = useState("trafico");
  const MESES_LABEL = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const trafDashRef = useRef(null);
  const pilotosNuevosRef = useRef(null);

  // Funciones de lectura según rol
  const _loadTrafIndex = isAdmin ? loadTrafIndex : loadTrafIndexReadonly;
  const _loadTrafMes = isAdmin ? loadTrafMes : loadTrafMesReadonly;
  const _loadFactIndex = isAdmin ? loadFactIndex : loadFactIndexReadonly;
  const _loadFactMes = isAdmin ? loadFactMes : loadFactMesReadonly;

  // Datos importados por usuario no-admin
  const [importedData, setImportedData] = useState(null);

  // Tráfico por mes
  const [trafIndex, setTrafIndex] = useState(_loadTrafIndex);
  const trafMeses = Object.keys(trafIndex).sort().reverse();
  const [trafMesSel, setTrafMesSel] = useState(trafMeses[0] || "");
  const [trafAnio, setTrafAnio] = useState(2026);
  const [trafMesNum, setTrafMesNum] = useState(new Date().getMonth() + 1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [trafFechaInicio, setTrafFechaInicio] = useState("");
  const [trafFechaFin, setTrafFechaFin] = useState("");
  const [trafPuntoSel, setTrafPuntoSel] = useState("");

  // Facturación por mes
  const [factIndex, setFactIndex] = useState(_loadFactIndex);
  const factMeses = Object.keys(factIndex).sort().reverse();
  const [factMesSel, setFactMesSel] = useState(factMeses[0] || "");
  const [factAnio, setFactAnio] = useState(2026);
  const [factMesNum, setFactMesNum] = useState(new Date().getMonth() + 1);
  const [factLoading, setFactLoading] = useState(false);
  const [factError, setFactError] = useState(null);

  /* ── derived data (tráfico) ────────────────────────────────────────────── */
  const trafActual = useMemo(() => {
    if (!trafMesSel) return null;
    if (importedData?.meses?.[`traf_${trafMesSel}`]) return importedData.meses[`traf_${trafMesSel}`];
    return _loadTrafMes(trafMesSel);
  }, [trafMesSel, trafIndex, importedData]);
  const trafPrevKey = useMemo(() => {
    if (!trafMesSel) return null;
    const ML = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const parts = trafMesSel.split(" ");
    if (parts.length !== 2) return null;
    const mi = ML.indexOf(parts[0]);
    const yr = parseInt(parts[1]);
    if (mi <= 0 || isNaN(yr)) return null;
    const prevMi = mi === 1 ? 12 : mi - 1;
    const prevYr = mi === 1 ? yr - 1 : yr;
    return `${ML[prevMi]} ${prevYr}`;
  }, [trafMesSel]);
  const trafPrev = useMemo(() => {
    if (!trafPrevKey) return null;
    if (importedData?.meses?.[`traf_${trafPrevKey}`]) return importedData.meses[`traf_${trafPrevKey}`];
    return _loadTrafMes(trafPrevKey);
  }, [trafPrevKey, trafIndex, importedData]);

  // Cargar rows (IndexedDB para admin, importedData o tadaInicial para readonly)
  const [trafRows, setTrafRows] = useState(null);
  const [trafPrevRows, setTrafPrevRows] = useState(null);
  useEffect(() => {
    setTrafRows(null);
    if (!trafMesSel) return;
    if (isAdmin) {
      idbLoadRows(SK_TRAF_MES(trafMesSel)).then(r => setTrafRows(r || null));
    } else {
      const imported = importedData?.meses?.[`traf_${trafMesSel}`];
      const fallback = tadaInicial.meses?.[`traf_${trafMesSel}`];
      setTrafRows(imported?.rows || fallback?.rows || null);
    }
  }, [trafMesSel, trafIndex, importedData]);
  useEffect(() => {
    setTrafPrevRows(null);
    if (!trafPrevKey) return;
    if (isAdmin) {
      idbLoadRows(SK_TRAF_MES(trafPrevKey)).then(r => setTrafPrevRows(r || null));
    } else {
      const imported = importedData?.meses?.[`traf_${trafPrevKey}`];
      const fallback = tadaInicial.meses?.[`traf_${trafPrevKey}`];
      setTrafPrevRows(imported?.rows || fallback?.rows || null);
    }
  }, [trafPrevKey, trafIndex, importedData]);

  // Filtrar por fechas/punto si hay rows crudos y filtros activos
  const trafHasRows = !!(trafRows?.length);
  const trafFiltroActivo = trafHasRows && (trafFechaInicio || trafFechaFin || trafPuntoSel);
  const data = useMemo(() => {
    if (!trafActual) return null;
    if (trafFiltroActivo) {
      const filtered = trafRows.filter(r => {
        if (trafFechaInicio && r._fecha && r._fecha < trafFechaInicio) return false;
        if (trafFechaFin && r._fecha && r._fecha > trafFechaFin) return false;
        if (trafPuntoSel) {
          const punto = String(r["PUNTO"] || "").trim();
          if (punto !== trafPuntoSel) return false;
        }
        return true;
      });
      if (filtered.length === 0) return null;
      return processRows(filtered);
    }
    // Si hay rows crudos disponibles, reprocesar siempre para aplicar la lógica más reciente
    if (trafRows?.length) return processRows(trafRows);
    return trafActual.data || null;
  }, [trafActual, trafRows, trafFiltroActivo, trafFechaInicio, trafFechaFin, trafPuntoSel]);

  // Lista de puntos disponibles (del data completo, no filtrado)
  const trafPuntosDisponibles = useMemo(() => {
    const d = trafActual?.data;
    if (!d?.puntoMap) return [];
    return Object.keys(d.puntoMap).sort();
  }, [trafActual]);

  // Pilotos nuevos: programados este mes pero no el anterior
  const pilotosNuevos = useMemo(() => {
    if (!trafRows?.length || !trafPrevRows?.length) return [];
    // Set de IDs del mes anterior
    const prevIds = new Set();
    for (const r of trafPrevRows) {
      const id = String(r["ID PILOTO"] || "").trim();
      if (id) prevIds.add(id);
    }
    // Filtrar rows del mes actual (respetando filtros de fecha/punto si activos)
    const rowsActuales = trafFiltroActivo ? trafRows.filter(r => {
      if (trafFechaInicio && r._fecha && r._fecha < trafFechaInicio) return false;
      if (trafFechaFin && r._fecha && r._fecha > trafFechaFin) return false;
      if (trafPuntoSel && String(r["PUNTO"] || "").trim() !== trafPuntoSel) return false;
      return true;
    }) : trafRows;
    // Agrupar pilotos nuevos
    const map = {};
    for (const r of rowsActuales) {
      const id = String(r["ID PILOTO"] || "").trim();
      if (!id || prevIds.has(id)) continue;
      const nombre = String(r["NOMBRE DE PILOTO"] || r["NOMBRE PILOTO"] || "").trim();
      const ciudad = String(r["CIUDAD"] || "").trim();
      const estado = String(r["ESTADO"] || "").trim();
      const punto = String(r["PUNTO"] || "").trim();
      const punt = String(r["PUNTUALIDAD"] || "").trim().toUpperCase();
      const esExcluidoPuntM = ESTADOS_EXCLUIR_PUNTUALIDAD.some(e => estado.toLowerCase() === e);
      if (!map[id]) map[id] = { id, nombre, ciudad, turnos: 0, puntSI: 0, puntTotal: 0, estados: {}, puntos: new Set() };
      map[id].turnos++;
      if (estado) map[id].estados[estado] = (map[id].estados[estado] || 0) + 1;
      if (punto) map[id].puntos.add(punto);
      if (!esExcluidoPuntM && (punt === "SI CUMPLE" || punt === "NO CUMPLE")) {
        map[id].puntTotal++;
        if (punt === "SI CUMPLE") map[id].puntSI++;
      }
      if (nombre && nombre.length > (map[id].nombre || "").length) map[id].nombre = nombre;
      if (ciudad) map[id].ciudad = ciudad;
    }
    return Object.values(map)
      .map(p => ({ ...p, puntos: [...p.puntos], pctPunt: p.puntTotal > 0 ? (p.puntSI / p.puntTotal * 100) : null }))
      .sort((a, b) => b.turnos - a.turnos);
  }, [trafRows, trafPrevRows, trafFiltroActivo, trafFechaInicio, trafFechaFin, trafPuntoSel]);

  // Columnas de estado únicas de pilotos nuevos
  const estadosNuevos = useMemo(() => {
    const s = new Set();
    for (const p of pilotosNuevos) Object.keys(p.estados).forEach(e => s.add(e));
    return [...s].sort();
  }, [pilotosNuevos]);

  // clienteCancela: desde processRows si está disponible, sino desde estadoMap cacheado
  const clienteCancelaCount = useMemo(() => {
    if (!data) return 0;
    if (data.clienteCancela != null) return data.clienteCancela;
    return Object.entries(data.estadoMap || {}).reduce((s, [k, v]) =>
      k.toLowerCase().includes("cliente cancela") ? s + v : s, 0);
  }, [data]);

  // Turnos efectivos (sin cliente cancela) para denominadores de KPIs
  // Si processRows ya corrió con el nuevo código: data.totalTurnos ya excluye cliente cancela
  // Si es dato cacheado: data.totalTurnos incluye todo, hay que restar
  const efectiveTurnos = data
    ? (data.clienteCancela != null ? data.totalTurnos : data.totalTurnos - clienteCancelaCount)
    : 0;

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
        "Puntualidad %": (v.puntTurnos || 0) ? parseFloat(((v.punt / v.puntTurnos) * 100).toFixed(1)) : 0,
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
        "Puntualidad %": (v.puntTurnos || 0) ? parseFloat(((v.punt / v.puntTurnos) * 100).toFixed(1)) : 0,
      }));
  }, [data]);

  const diaData = useMemo(() => {
    if (!data) return [];
    const order = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return Object.entries(data.diaMap)
      .sort(([a], [b]) => {
        const ia = order.indexOf(norm(a)), ib = order.indexOf(norm(b));
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([name, v]) => ({
        name,
        Turnos: v.turnos,
        "Colocación %": v.turnos > 0 ? parseFloat((v.si / v.turnos * 100).toFixed(1)) : 0,
      }));
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
        pctPunt: pct(v.punt, v.puntTurnos || 0),
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
      const { data: processed, rows: rawRows } = processExcel(wb);
      const key = `${MESES_LABEL[trafMesNum]} ${trafAnio}`;
      await saveTrafMesAsync(key, { data: processed, rows: rawRows, archivo: file.name, fecha: new Date().toISOString() });
      const idx = loadTrafIndex();
      idx[key] = { archivo: file.name, fecha: new Date().toISOString() };
      saveTrafIndex(idx);
      setTrafIndex(idx);
      setTrafMesSel(key);
      if (rawRows) setTrafRows(rawRows);
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
    idbDeleteRows(SK_TRAF_MES(key));
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
  const factActual = useMemo(() => {
    if (!factMesSel) return null;
    if (importedData?.meses?.[`fact_${factMesSel}`]) return importedData.meses[`fact_${factMesSel}`];
    return _loadFactMes(factMesSel);
  }, [factMesSel, factIndex, importedData]);
  const factMesPrevKey = useMemo(() => {
    const sorted = Object.keys(factIndex).sort();
    const idx = sorted.indexOf(factMesSel);
    return idx > 0 ? sorted[idx - 1] : null;
  }, [factMesSel, factIndex]);
  const factPrev = useMemo(() => {
    if (!factMesPrevKey) return null;
    if (importedData?.meses?.[`fact_${factMesPrevKey}`]) return importedData.meses[`fact_${factMesPrevKey}`];
    return _loadFactMes(factMesPrevKey);
  }, [factMesPrevKey, factIndex, importedData]);

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
    { id: "notas", label: "📝 Notas y Tareas" },
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
            {isAdmin && (
              <button onClick={async () => {
                const allData = {
                  trafIndex: loadTrafIndex(),
                  factIndex: loadFactIndex(),
                  meses: {},
                  notas: JSON.parse(localStorage.getItem("pibox_tada_notas") || "[]"),
                  tareas: JSON.parse(localStorage.getItem("pibox_tada_tareas") || "[]"),
                  umbrales: JSON.parse(localStorage.getItem("pibox_tada_umbrales") || "{}"),
                };
                for (const key of Object.keys(allData.trafIndex)) {
                  const d = loadTrafMes(key);
                  if (d) {
                    const rows = await idbLoadRows(SK_TRAF_MES(key));
                    allData.meses[`traf_${key}`] = rows ? { ...d, rows } : d;
                  }
                }
                for (const key of Object.keys(allData.factIndex)) {
                  const d = loadFactMes(key);
                  if (d) allData.meses[`fact_${key}`] = d;
                }
                const blob = new Blob([JSON.stringify(allData)], { type: "application/json" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                a.download = "tada-export.json"; a.click();
              }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition">
                📤 Exportar para el equipo
              </button>
            )}
            {!isAdmin && (
              <label className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition cursor-pointer">
                📥 Importar datos
                <input type="file" accept=".json" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const imported = JSON.parse(ev.target.result);
                      if (!imported.trafIndex || !imported.meses) { alert("Archivo inválido"); return; }
                      setImportedData(imported);
                      setTrafIndex(imported.trafIndex || {});
                      setFactIndex(imported.factIndex || {});
                      const trafKeys = Object.keys(imported.trafIndex || {}).sort().reverse();
                      if (trafKeys[0]) setTrafMesSel(trafKeys[0]);
                      const factKeys = Object.keys(imported.factIndex || {}).sort().reverse();
                      if (factKeys[0]) setFactMesSel(factKeys[0]);
                      if (imported.notas) localStorage.setItem("pibox_tada_notas", JSON.stringify(imported.notas));
                      if (imported.tareas) localStorage.setItem("pibox_tada_tareas", JSON.stringify(imported.tareas));
                      if (imported.umbrales && Object.keys(imported.umbrales).length) localStorage.setItem("pibox_tada_umbrales", JSON.stringify(imported.umbrales));
                      alert("Datos importados correctamente");
                    } catch { alert("Error al leer el archivo JSON"); }
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }} />
              </label>
            )}
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
                      const d = _loadFactMes(m);
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
      {tab === "insights" && <InsightsTab trafIndex={trafIndex} factIndex={factIndex} loadTrafMes={_loadTrafMes} loadFactMes={_loadFactMes} fmtMoney={fmtMoney} isAdmin={isAdmin} importedData={importedData} />}

      {/* ── TAB: NOTAS Y TAREAS ──────────────────────────────────────── */}
      {tab === "notas" && <NotasTareas />}

      {/* ── TAB: TRÁFICO ─────────────────────────────────────────────── */}
      {tab === "trafico" && (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Selector de mes para análisis */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {data && (
              <button onClick={() => printSection(trafDashRef, `Tráfico Pilotos — ${trafMesSel}`)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-white shadow hover:shadow-md transition"
                style={{ background: BRAND_GRADIENT }}>
                📄 Descargar PDF
              </button>
            )}
            {trafMeses.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">📅 Mes a analizar</label>
                <select value={trafMesSel} onChange={e => { setTrafMesSel(e.target.value); setTrafFechaInicio(""); setTrafFechaFin(""); setTrafPuntoSel(""); }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  {trafMeses.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            {/* Filtros de fecha y punto */}
            {trafHasRows && (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">📆 Desde</label>
                  <input type="date" value={trafFechaInicio} onChange={e => setTrafFechaInicio(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">📆 Hasta</label>
                  <input type="date" value={trafFechaFin} onChange={e => setTrafFechaFin(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">📍 Punto</label>
                  <select value={trafPuntoSel} onChange={e => setTrafPuntoSel(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 max-w-[200px]">
                    <option value="">Todos</option>
                    {trafPuntosDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {(trafFechaInicio || trafFechaFin || trafPuntoSel) && (
                  <button onClick={() => { setTrafFechaInicio(""); setTrafFechaFin(""); setTrafPuntoSel(""); }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition">
                    Limpiar filtros
                  </button>
                )}
              </>
            )}
            {trafPrevKey && !trafFiltroActivo && (
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
            {trafFiltroActivo && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold flex-wrap" style={{ background: "linear-gradient(135deg,#D97706 0%,#F59E0B 100%)" }}>
                🔍 Filtro activo:
                {(trafFechaInicio || trafFechaFin) && <span>{trafFechaInicio || "..."} → {trafFechaFin || "..."}</span>}
                {trafPuntoSel && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20">📍 {trafPuntoSel}</span>}
                {data && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20">{data.totalTurnos} turnos</span>}
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
            <p>{trafFiltroActivo ? "No hay datos con los filtros seleccionados." : "Selecciona un mes para ver el análisis."}</p>
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
          <div ref={trafDashRef} className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard
                icon="📋"
                label="Total Turnos"
                value={efectiveTurnos.toLocaleString()}
                sub={clienteCancelaCount > 0 ? `(${data.totalTurnos.toLocaleString()} brutos)` : undefined}
                borderColor={PIBOX_PURPLE}
              />
              <KpiCard
                icon="✅"
                label="Colocaciones"
                value={data.colocacionesSI.toLocaleString()}
                sub={`${pct(data.colocacionesSI, efectiveTurnos)}%`}
                borderColor={SEM_VERDE}
              />
              <KpiCard
                icon="❌"
                label="No Colocaciones"
                value={data.colocacionesNO.toLocaleString()}
                sub={`${pct(data.colocacionesNO, efectiveTurnos)}%`}
                borderColor={SEM_ROJO}
              />
              <KpiCard
                icon="🚫"
                label="Cancelaciones"
                value={data.cancelaciones.toLocaleString()}
                sub={`${pct(data.cancelaciones, efectiveTurnos)}%`}
                borderColor={SEM_AMARILLO}
              />
              <KpiCard
                icon="⏱️"
                label="Puntualidad"
                value={`${pct(data.puntualidadSI, data.puntualidadTurnos || efectiveTurnos)}%`}
                borderColor="#6366F1"
              />
              <KpiCard
                icon="🧑‍✈️"
                label="Pilotos Activos"
                value={data.pilotosActivos.toLocaleString()}
                borderColor={PIBOX_PINK}
              />
            </div>

            {/* Badge: Cliente Cancela */}
            {clienteCancelaCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 text-sm w-fit">
                <span className="text-base">🙅</span>
                <span className="font-semibold">{clienteCancelaCount.toLocaleString()} turno{clienteCancelaCount !== 1 ? "s" : ""} en estado <b>"cliente cancela"</b></span>
                <span className="text-xs text-orange-500 ml-1">— excluidos del cálculo de efectividad</span>
              </div>
            )}

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
                  <ComposedChart data={diaData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<TT />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="Turnos" fill={PIBOX_PINK} name="Turnos" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="Colocación %" stroke={SEM_VERDE} strokeWidth={2} dot={{ r: 4, fill: SEM_VERDE }} name="Colocación %" />
                  </ComposedChart>
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

        {/* Turnos por hora de inicio + heatmap hora x día */}
        {data?.porHora?.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Turnos por hora de inicio */}
            {chartCard("⏰ Turnos por Hora de Inicio", (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.porHora}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                  <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => [v, n === "turnos" ? "Turnos" : n === "si" ? "Colocados" : n]} />
                  <Legend />
                  <Bar dataKey="turnos" name="Turnos" fill={PIBOX_PURPLE} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="si" name="Colocados" fill={SEM_VERDE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ))}

            {/* Heatmap: día x hora */}
            {data.porHoraDia?.length > 0 && chartCard("📊 Turnos por Día y Hora", (
              <div className="overflow-x-auto">
                {(() => {
                  const dias = ["Lunes","Martes","Miercoles","Miércoles","Jueves","Viernes","Sabado","Sábado","Domingo"];
                  const diasOrden = [...new Set(data.porHoraDia.map(d => d.dia))].sort((a,b) => {
                    const ia = dias.findIndex(d => d.toLowerCase() === a.toLowerCase());
                    const ib = dias.findIndex(d => d.toLowerCase() === b.toLowerCase());
                    return (ia===-1?99:ia) - (ib===-1?99:ib);
                  });
                  const horas = [...new Set(data.porHoraDia.map(d => d.hora))].sort();
                  const maxT = Math.max(...data.porHoraDia.map(d => d.turnos), 1);
                  const getVal = (dia, hora) => data.porHoraDia.find(d => d.dia === dia && d.hora === hora);
                  return (
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-1.5 text-left text-gray-500 font-semibold">Día / Hora</th>
                          {horas.map(h => <th key={h} className="px-2 py-1.5 text-center text-gray-500 font-semibold">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {diasOrden.map(dia => (
                          <tr key={dia} className="border-t border-gray-100">
                            <td className="px-2 py-1.5 font-semibold text-gray-700 whitespace-nowrap">{dia}</td>
                            {horas.map(hora => {
                              const v = getVal(dia, hora);
                              const t = v?.turnos || 0;
                              const intensity = t > 0 ? Math.max(0.15, t / maxT) : 0;
                              return (
                                <td key={hora} className="px-1 py-1 text-center" title={`${dia} ${hora}: ${t} turnos`}>
                                  {t > 0 ? (
                                    <div className="rounded-md px-1 py-1 text-xs font-bold" style={{
                                      backgroundColor: `rgba(124, 34, 212, ${intensity})`,
                                      color: intensity > 0.5 ? "#fff" : "#7C22D4",
                                    }}>{t}</div>
                                  ) : (
                                    <span className="text-gray-200">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            ))}
          </div>
        )}

        {/* Top 10 pilotos impuntuales */}
        {data?.pilotosImpuntuales?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-gray-700">⏱️ Top 10 Pilotos más impuntuales — {trafMesSel}</h3>
              <button onClick={() => {
                // Recalcular desde rows para obtener lista COMPLETA
                const fullData = trafRows?.length ? processRows(trafFiltroActivo ? trafRows.filter(r => {
                  if (trafFechaInicio && r._fecha && r._fecha < trafFechaInicio) return false;
                  if (trafFechaFin && r._fecha && r._fecha > trafFechaFin) return false;
                  if (trafPuntoSel && String(r["PUNTO"]||"").trim() !== trafPuntoSel) return false;
                  return true;
                }) : trafRows) : data;
                const lista = fullData.pilotosImpuntuales || [];
                const csvRows = [["#","Piloto","ID","Ciudad","Turnos","No Cumple","Cumple","% Incumplimiento"].join(",")];
                lista.forEach((p, i) => {
                  csvRows.push([i+1,`"${(p.nombre||"").replace(/"/g,'""')}"`,p.id,p.ciudad,p.turnos,p.noCumple,p.cumple,`${p.pctNoCumple.toFixed(1)}%`].join(","));
                });
                const blob = new Blob(["\uFEFF"+csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Pilotos_Impuntuales_${trafMesSel}.csv`; a.click();
              }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow hover:shadow-md transition" style={{ background: "linear-gradient(135deg,#DC2626,#EF4444)" }}>
                📥 Descargar todos
              </button>
            </div>
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
                  {data.pilotosImpuntuales.slice(0, 10).map((p, i) => (
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
            {data.pilotosImpuntuales.length > 10 && (
              <p className="text-xs text-gray-400 mt-2 text-center">Mostrando 10 de {data.pilotosImpuntuales.length} pilotos. Descarga el CSV para ver todos.</p>
            )}
          </div>
        )}

        {/* Top 10 pilotos que más cancelan */}
        {data?.pilotosCanceladores?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-gray-700">🚫 Top 10 Pilotos que más cancelan — {trafMesSel}</h3>
              <button onClick={() => {
                const fullData = trafRows?.length ? processRows(trafFiltroActivo ? trafRows.filter(r => {
                  if (trafFechaInicio && r._fecha && r._fecha < trafFechaInicio) return false;
                  if (trafFechaFin && r._fecha && r._fecha > trafFechaFin) return false;
                  if (trafPuntoSel && String(r["PUNTO"]||"").trim() !== trafPuntoSel) return false;
                  return true;
                }) : trafRows) : data;
                const lista = fullData.pilotosCanceladores || [];
                const csvRows = [["#","Piloto","ID","Ciudad","Turnos","Cancelaciones","No Cancela","% Cancelación"].join(",")];
                lista.forEach((p, i) => {
                  csvRows.push([i+1,`"${(p.nombre||"").replace(/"/g,'""')}"`,p.id,p.ciudad,p.turnos,p.cancela,p.turnos-p.cancela,`${p.pctCancela.toFixed(1)}%`].join(","));
                });
                const blob = new Blob(["\uFEFF"+csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Pilotos_Canceladores_${trafMesSel}.csv`; a.click();
              }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow hover:shadow-md transition" style={{ background: "linear-gradient(135deg,#D97706,#F59E0B)" }}>
                📥 Descargar todos
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-orange-600 text-white">
                    {["#", "Piloto", "ID", "Ciudad", "Turnos", "Cancelaciones", "No Cancela", "% Cancelación"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.pilotosCanceladores.slice(0, 10).map((p, i) => (
                    <tr key={p.id || p.nombre} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-orange-50/30"} hover:bg-orange-50`}>
                      <td className="px-3 py-2 text-orange-400 font-bold">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{p.nombre || "Sin nombre"}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs font-mono truncate max-w-[120px]">{p.id}</td>
                      <td className="px-3 py-2 text-gray-500">{p.ciudad}</td>
                      <td className="px-3 py-2 text-center">{p.turnos}</td>
                      <td className="px-3 py-2 text-center font-bold text-orange-600">{p.cancela}</td>
                      <td className="px-3 py-2 text-center text-green-600">{p.turnos - p.cancela}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${p.pctCancela}%` }} />
                          </div>
                          <span className="text-xs font-bold text-orange-600 whitespace-nowrap">{p.pctCancela.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pilotosCanceladores.length > 10 && (
              <p className="text-xs text-gray-400 mt-2 text-center">Mostrando 10 de {data.pilotosCanceladores.length} pilotos. Descarga el CSV para ver todos.</p>
            )}
          </div>
        )}

        {/* Pilotos nuevos del mes */}
        {pilotosNuevos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-gray-700">🆕 Pilotos nuevos — {trafMesSel}</h3>
              <button onClick={() => {
                const hdr = ["#","Piloto","ID","Ciudad","Turnos",...estadosNuevos,"% Efectividad","% Puntualidad","Puntos"];
                const csvRows = [hdr.join(",")];
                const ESTADOS_EFECTIVOS = ["adicional", "confirmado", "reemplazo", "adicional tada"];
                const ESTADOS_CANCELA_PIL = ["piloto cancela", "adicional cancela"];
                const calcEfect = (estados) => {
                  let ef = 0, ca = 0;
                  for (const [k, v] of Object.entries(estados || {})) {
                    const kl = k.toLowerCase();
                    if (ESTADOS_EFECTIVOS.some(e => kl === e)) ef += v;
                    else if (ESTADOS_CANCELA_PIL.some(e => kl === e)) ca += v;
                  }
                  const tot = ef + ca;
                  return tot > 0 ? (ef / tot * 100) : 0;
                };
                pilotosNuevos.forEach((p, i) => {
                  const efect = calcEfect(p.estados).toFixed(1);
                  const punt = p.pctPunt !== null ? p.pctPunt.toFixed(1) : "";
                  const row = [
                    i+1,
                    `"${(p.nombre||"").replace(/"/g,'""')}"`,
                    p.id,
                    p.ciudad,
                    p.turnos,
                    ...estadosNuevos.map(e => p.estados[e] || 0),
                    `${efect}%`,
                    punt ? `${punt}%` : "",
                    `"${p.puntos.join(", ")}"`,
                  ];
                  csvRows.push(row.join(","));
                });
                const blob = new Blob(["\uFEFF"+csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `Pilotos_Nuevos_${trafMesSel}.csv`; a.click(); URL.revokeObjectURL(url);
              }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow hover:shadow-md transition"
                style={{ background: BRAND_GRADIENT }}>
                📥 Descargar CSV
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">Pilotos programados este mes que no aparecieron en {trafPrevKey}. Total: <b className="text-purple-600">{pilotosNuevos.length}</b></p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-purple-700 text-white">
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Piloto</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">ID</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Ciudad</th>
                    <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Turnos</th>
                    {estadosNuevos.map(e => (
                      <th key={e} className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">{e}</th>
                    ))}
                    <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">% Efectividad</th>
                    <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">% Puntualidad</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {pilotosNuevos.map((p, i) => (
                    <tr key={p.id} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-purple-50/30"} hover:bg-purple-50`}>
                      <td className="px-3 py-2 text-purple-400 font-bold">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{p.nombre || "Sin nombre"}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs font-mono truncate max-w-[120px]" title={p.id}>{p.id}</td>
                      <td className="px-3 py-2 text-gray-500">{p.ciudad}</td>
                      <td className="px-3 py-2 text-center font-bold">{p.turnos}</td>
                      {estadosNuevos.map(e => (
                        <td key={e} className="px-3 py-2 text-center">
                          {p.estados[e] ? (
                            <span className={`font-bold ${e.toUpperCase().includes("CANCEL") ? "text-orange-600" : e === "Confirmado" ? "text-green-600" : "text-gray-700"}`}>
                              {p.estados[e]}
                            </span>
                          ) : <span className="text-gray-200">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          const EFECT_ST = ["adicional", "confirmado", "reemplazo", "adicional tada"];
                          const CANCEL_ST = ["piloto cancela", "adicional cancela"];
                          let ef = 0, ca = 0;
                          for (const [k, v] of Object.entries(p.estados || {})) {
                            const kl = k.toLowerCase();
                            if (EFECT_ST.some(e => kl === e)) ef += v;
                            else if (CANCEL_ST.some(e => kl === e)) ca += v;
                          }
                          const efect = (ef + ca) > 0 ? (ef / (ef + ca) * 100) : 0;
                          return <span className={`font-bold ${efect >= 90 ? "text-green-600" : efect >= 70 ? "text-yellow-600" : "text-red-600"}`}>{efect.toFixed(0)}%</span>;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {p.pctPunt !== null ? (
                          <span className={`font-bold ${p.pctPunt >= 90 ? "text-green-600" : p.pctPunt >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                            {p.pctPunt.toFixed(0)}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {p.puntos.map(pt => (
                            <span key={pt} className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">{pt}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {trafHasRows && !trafPrevRows && trafPrevKey && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center text-purple-600 text-sm">
            Para ver pilotos nuevos, sube también el reporte de <b>{trafPrevKey}</b>.
          </div>
        )}
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
