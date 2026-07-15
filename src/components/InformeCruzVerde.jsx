import { useState, useEffect, useMemo, useRef } from "react";
import NotasTareasCruzVerde from "./NotasTareasCruzVerde";
import { publishToServer, fetchFromServer, clearFromServer } from "./serverSync";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line,
  ComposedChart, Area, ReferenceLine,
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

const SLA_DEFAULTS = {
  ranges: [
    { label: "0 – 3 km",     maxKm: 3,  min: 35  },
    { label: "3,1 – 5 km",   maxKm: 5,  min: 45  },
    { label: "5,1 – 7 km",   maxKm: 7,  min: 50  },
    { label: "7,1 – 10 km",  maxKm: 10, min: 65  },
    { label: "10,1 – 17 km", maxKm: 17, min: 110 },
  ],
  nextDayHora: 18,
};

const UMBRALES_CV_DEFAULTS = {
  mostrador: { sla_rojo: 85, sla_amarillo: 92, noPerf_rojo: 15, noPerf_amarillo: 8 },
  integ_sd:  { sla_rojo: 85, sla_amarillo: 92, noPerf_rojo: 15, noPerf_amarillo: 8 },
  integ_nd:  { sla_rojo: 85, sla_amarillo: 92, noPerf_rojo: 15, noPerf_amarillo: 8 },
};

function getSlaConfig() {
  try { return { ...SLA_DEFAULTS, ...JSON.parse(localStorage.getItem("pibox_cv_sla") || "{}") }; }
  catch { return SLA_DEFAULTS; }
}

function getUmbrales() {
  try { return { ...UMBRALES_CV_DEFAULTS, ...JSON.parse(localStorage.getItem("pibox_cv_umbrales") || "{}") }; }
  catch { return UMBRALES_CV_DEFAULTS; }
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
  const empresa = String(row.nombre_empresa || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // tipo_servicio viene del Excel; next_day viene de ClickHouse (misma info, distinto nombre)
  const tipo    = String(row.tipo_servicio || row.next_day || "").trim().toLowerCase();
  const esCruzVerde = empresa === "cruz verde integracion";
  if (esCruzVerde && tipo === "next day") return "integ_nd";
  if (esCruzVerde || isInteg(row.nombre_usuario)) return "integ_sd";
  return "mostrador";
}

// ── Normalización de direcciones ───────────────────────────────────────────
function normalizeDireccion(str) {
  return (str || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// ── Parseo de tiempo Excel ─────────────────────────────────────────────────
function excelTimeToMinutes(val) {
  if (val == null || val === "") return null;
  const str = String(val).toLowerCase().trim();
  if (str.includes("24 hora") || str.includes("24hora") || str === "24 hours") return "24h";
  // Texto "8:00:00 a.m." / "10:00 p.m."
  const ampm = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    const isPm = ampm[3].replace(/\./g, "").toLowerCase() === "pm";
    if (h === 12) h = isPm ? 12 : 0;
    else if (isPm) h += 12;
    return h * 60 + m;
  }
  // Serial numérico de Excel (0.333 = 8am)
  const num = parseFloat(val);
  if (!isNaN(num) && num >= 0 && num < 1) return Math.round(num * 24 * 60);
  return null;
}

function minutesToHHMM(min) {
  if (min === "24h" || min === null) return min === "24h" ? "24 Horas" : "—";
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── buildHorariosMap ───────────────────────────────────────────────────────
function buildHorariosMap(horarios) {
  const map = {};
  for (const h of (horarios || [])) {
    const key = normalizeDireccion(h.direccion);
    if (!key) continue;
    const toSlot = (ap, ci) => {
      const apertura = excelTimeToMinutes(ap);
      const cierre   = excelTimeToMinutes(ci);
      return apertura === "24h"
        ? { apertura: null, cierre: null, es24h: true }
        : { apertura: apertura ?? null, cierre: cierre === "24h" ? null : (cierre ?? null), es24h: false };
    };
    map[key] = {
      nombre: h.nombre || "",
      sucursal: h.sucursal || "",
      lv:   toSlot(h.lv_apertura,   h.lv_cierre),
      sab:  toSlot(h.sab_apertura,  h.sab_cierre),
      dom:  toSlot(h.dom_apertura,  h.dom_cierre),
      fest: toSlot(h.fest_apertura, h.fest_cierre),
    };
  }
  return map;
}

// ── procesarRows ───────────────────────────────────────────────────────────
function procesarRows(rawRows) {
  return rawRows.map((r) => {
    const linea = getLinea(r);
    const estado = (r.estado || "").trim();
    const km = parseFloat(r.distancia_km) || 0;
    let minutos = null;

    // Tiempo: desde "asignado" hasta "fecha de entrega" para todos los servicios Finalizado
    const fechaEntrega = r["fecha de entrega"] || r.fecha_de_entrega || r.llego_donde_el_cliente || "";
    if (r.asignado && fechaEntrega) {
      const t0 = new Date(r.asignado);
      const t1 = new Date(fechaEntrega);
      if (!isNaN(t0) && !isNaN(t1) && t1 > t0) {
        minutos = (t1 - t0) / 60000;
      }
    }

    // tsalida refleja el momento "asignado" (para cruce con horarios de tienda)
    const tsalida = r.asignado ? new Date(r.asignado).getTime() : null;
    const dayOfWeek = r.asignado ? new Date(r.asignado).getDay() : null;

    // Buscar idServicio: primero columnas conocidas, luego patrón hex24 en cualquier campo
    const MONGO_ID = /^[a-f0-9]{24}$/i;
    let idServicio = String(
      r.uuid_booking ?? r.id_servicio ?? r._id ?? r.booking_id ??
      r["id servicio"] ?? r["id de servicio"] ?? r.uuid ?? r.id_booking ??
      r.servicio_id ?? r.objectid ?? ""
    ).trim();
    if (!idServicio) {
      for (const v of Object.values(r)) {
        const s = String(v ?? "").trim();
        if (MONGO_ID.test(s)) { idServicio = s; break; }
      }
    }

    // Buscar numeroPaquete: primero columnas conocidas, luego patrón "PEDIDO" en cualquier campo
    let numeroPaquete = String(
      r.num_orden ?? r.numero_paquete ?? r.numero_orden ?? r.orden ?? r.guia ??
      r.referencia ?? r["número de paquete"] ?? r["numero de paquete"] ??
      r["número orden"] ?? r["numero orden"] ?? r["n° paquete"] ??
      r.pedido ?? r.numero_pedido ?? r["numero de pedido"] ?? r["número de pedido"] ?? ""
    ).trim();
    if (!numeroPaquete) {
      for (const v of Object.values(r)) {
        const s = String(v ?? "").trim();
        if (/^PEDIDO\s/i.test(s)) { numeroPaquete = s; break; }
      }
    }

    return {
      uuid:              r.uuid_booking || idServicio,
      idServicio,
      idPaquete:         String(r.id_paquete || "").trim(),
      numeroPaquete,
      fecha:             toDateStr(r.asignado || r.iniciado || r.salio_de_origen),
      mes:               toMesLabel(r.asignado || r.iniciado || r.salio_de_origen),
      estado,
      linea,
      ciudad:            (r.ciudad || "Sin ciudad").trim(),
      sucursal:          (r.nombre_usuario || "Sin sucursal").trim(),
      km,
      minutos,
      horaEntrega:       horaMin(fechaEntrega),
      horaAsignado:      horaMin(r.asignado),
      esDevolucion:      /^si$/i.test(String(r["finalizado fallido"] ?? r.finalizado_fallido ?? "").trim()),
      esPerfecto:        estado === "Finalizado",
      esNoCompletado:    isNoCompletado(estado),
      esCancelado:       isCancelado(estado),
      tsalida,
      dayOfWeek,
      direccionOrigen:   (r.direccion_origen || "").trim(),
      localidadOrigen:   (r.localidad_origen  || r["localidad origen"]  || r.barrio_origen  || r.localidad_recogida  || "").trim(),
      localidadDestino:  (r.localidad_destino || r["localidad destino"] || r.barrio_destino || r.localidad_entrega   || "").trim(),
      descripcion:       (r.descripcion || r["descripción"] || r.description || r.detalle || r.observacion || r.observaciones || "").trim(),
      // Campos para tarjeta de detalle de servicio
      iniciadoRaw:       r.asignado    ? String(r.asignado)    : "",
      finalizadoRaw:     fechaEntrega  ? String(fechaEntrega)  : "",
      fechaCancelacion:  r.fecha_devolucion_paquete ? String(r.fecha_devolucion_paquete) : "",
      nombrePiloto:      String(r.nombre_piloto ?? r.piloto ?? r.driver ?? "").trim(),
      idPiloto:          String(r.id_piloto ?? r.piloto_id ?? r.driver_id ?? "").trim(),
      // GMV — intenta múltiples nombres de columna posibles
      costo: parseFloat(
        r.costo_servicio ?? r.costo ?? r.gmv ?? r.valor_servicio ?? r.valor ??
        r["costo del servicio"] ?? r["valor del servicio"] ?? r["costo servicio"] ?? 0
      ) || 0,
    };
  });
}

// ── Festivos Colombia 2024-2026 ────────────────────────────────────────────
const FESTIVOS_CO = new Set([
  // 2024
  "2024-01-01","2024-01-08","2024-03-25","2024-03-28","2024-03-29","2024-04-01",
  "2024-05-01","2024-05-13","2024-06-03","2024-06-10","2024-07-01","2024-07-20",
  "2024-08-07","2024-08-19","2024-10-14","2024-11-04","2024-11-11","2024-12-08","2024-12-25",
  // 2025
  "2025-01-01","2025-01-06","2025-03-24","2025-04-17","2025-04-18","2025-05-01",
  "2025-06-02","2025-06-23","2025-06-30","2025-07-20","2025-08-07","2025-08-18",
  "2025-10-13","2025-11-03","2025-11-17","2025-12-08","2025-12-25",
  // 2026
  "2026-01-01","2026-01-12","2026-03-23","2026-04-02","2026-04-03","2026-05-01",
  "2026-05-18","2026-06-08","2026-06-15","2026-07-20","2026-08-07","2026-08-17",
  "2026-10-12","2026-11-02","2026-11-16","2026-12-08","2026-12-25",
]);

// Estados excluidos de todos los indicadores (comparación case-insensitive)
const ESTADOS_EXCLUIDOS_EXACT = new Set(["other", "optimizando"]);
function isEstadoExcluido(estado) {
  const s = (estado || "").toLowerCase().trim();
  if (ESTADOS_EXCLUIDOS_EXACT.has(s)) return true;
  // Excluye cualquier variante de "Status [N] - Sin clasificar"
  if (/^status\s*\[.*\]\s*-\s*sin clasificar$/i.test(s)) return true;
  return false;
}
// "No completado" y "Cancelado" se excluyen del indicador de No Perfectos pero permanecen en el total
function isNoCompletado(estado) {
  return /^no[\s-]?complet/i.test((estado || "").trim());
}
function isCancelado(estado) {
  return /cancel/i.test((estado || "").trim());
}

// ── computeRowSla ──────────────────────────────────────────────────────────
function computeRowSla(row, slaConfig, horariosMap) {
  const cfg = slaConfig || SLA_DEFAULTS;

  if (row.linea === "integ_nd") {
    const slaLimiteND = cfg.nextDayHora * 60;
    // hora de entrega real (fecha de entrega), no la de asignación
    const hora = row.horaEntrega;
    const slaCumplido = row.esPerfecto && hora !== null && hora <= slaLimiteND;
    return { slaCumplido: row.esPerfecto && hora !== null ? slaCumplido : null, slaLimite: slaLimiteND, minutosEfectivos: row.minutos };
  }

  // Same Day / Mostrador
  let slaLimite = null;
  for (const rng of cfg.ranges) {
    if (row.km <= rng.maxKm) { slaLimite = rng.min; break; }
  }

  if (slaLimite === null || row.minutos == null) {
    return { slaCumplido: null, slaLimite, minutosEfectivos: null };
  }

  let minutosEfectivos = row.minutos;

  // Para integ_sd: excluir servicios iniciados fuera del horario de la tienda
  if (row.linea === "integ_sd" && horariosMap && row.tsalida && row.direccionOrigen) {
    const key = normalizeDireccion(row.direccionOrigen);
    const store = horariosMap[key];
    if (store) {
      const t = new Date(row.tsalida);
      const dow = t.getDay();
      const dateStr = t.toISOString().slice(0, 10);
      const esFestivo = FESTIVOS_CO.has(dateStr);
      let slot;
      if (esFestivo)      slot = store.fest;
      else if (dow === 0) slot = store.dom;
      else if (dow === 6) slot = store.sab;
      else                slot = store.lv;
      if (slot && !slot.es24h) {
        const hm = t.getHours() * 60 + t.getMinutes();
        const fueraApertura = slot.apertura != null && hm < slot.apertura;
        const fueraCierre   = slot.cierre   != null && hm >= slot.cierre;
        if (fueraApertura || fueraCierre) {
          return { slaCumplido: null, slaLimite, minutosEfectivos: null, fueraHorario: true };
        }
      }
    }
  }

  const slaCumplido = row.esPerfecto ? minutosEfectivos <= slaLimite : null;
  return { slaCumplido, slaLimite, minutosEfectivos, fueraHorario: false };
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
function fmtDatetime(val) {
  if (!val || String(val).trim() === "") return "—";
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function fmtFull(n) { return "$" + Math.round(n || 0).toLocaleString("es-CO"); }
function fmtMCV(n) {
  const v = Math.abs(n || 0);
  if (v >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function GmvDiarioCV({ rows }) {
  const daily = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!r.fecha || !r.costo) continue;
      if (!map[r.fecha]) map[r.fecha] = { fecha: r.fecha, gmv: 0, servicios: 0 };
      map[r.fecha].gmv += r.costo;
      map[r.fecha].servicios++;
    }
    return Object.values(map)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(d => {
        const [, m, day] = d.fecha.split("-");
        return { ...d, label: `${day}/${m}` };
      });
  }, [rows]);

  if (!daily.length) return null;

  let acum = 0;
  const chartData = daily.map((d, i, arr) => {
    const ventana = arr.slice(Math.max(0, i - 6), i + 1);
    const ma7 = ventana.reduce((s, w) => s + w.gmv, 0) / ventana.length;
    acum += d.gmv;
    return { ...d, ma7, acum };
  });

  const avgGmv = chartData.reduce((s, d) => s + d.gmv, 0) / chartData.length;
  const topDia = chartData.reduce((m, d) => d.gmv > m.gmv ? d : m, chartData[0]);
  const minDia = chartData.reduce((m, d) => d.gmv < m.gmv ? d : m, chartData[0]);
  const step   = chartData.length <= 15 ? 1 : chartData.length <= 25 ? 3 : 5;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
      <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="font-bold text-gray-700 text-sm">📆 GMV Diario</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Barras: GMV del día · Línea: media móvil 7 días · {chartData.length} días con datos
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="rounded-xl px-3 py-1.5 border" style={{background:"#E0F7FA", borderColor:"#B2EBF2"}}>
            <span className="text-gray-500">Prom/día </span>
            <span className="font-bold" style={{color:C_TEAL}}>{fmtFull(avgGmv)}</span>
          </div>
          <div className="bg-green-50 rounded-xl px-3 py-1.5 border border-green-100">
            <span className="text-gray-500">Mejor día </span>
            <span className="font-bold text-green-700">{topDia.label} · {fmtFull(topDia.gmv)}</span>
          </div>
          <div className="bg-red-50 rounded-xl px-3 py-1.5 border border-red-100">
            <span className="text-gray-500">Menor día </span>
            <span className="font-bold text-red-600">{minDia.label} · {fmtFull(minDia.gmv)}</span>
          </div>
          <div className="bg-blue-50 rounded-xl px-3 py-1.5 border border-blue-100">
            <span className="text-gray-500">Acumulado </span>
            <span className="font-bold text-blue-700">{fmtFull(acum)}</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{top:8,right:60,left:0,bottom:20}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E0F7FA" vertical={false}/>
          <XAxis dataKey="label" tick={{fontSize:9}} angle={-45} textAnchor="end" height={45} interval={step - 1}/>
          <YAxis yAxisId="left" tick={{fontSize:9}} tickFormatter={fmtMCV} width={55}/>
          <YAxis yAxisId="right" orientation="right" tick={{fontSize:9}} tickFormatter={fmtMCV} width={55}/>
          <Tooltip
            content={({active, payload}) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload;
              return (
                <div className="bg-white border rounded-xl shadow-lg px-3 py-2.5 text-xs space-y-1 min-w-[180px]" style={{borderColor:"#B2EBF2"}}>
                  <p className="font-bold mb-1" style={{color:C_TEAL}}>📅 {d?.fecha}</p>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">GMV del día</span>
                    <span className="font-bold" style={{color:C_TEAL}}>{fmtFull(d?.gmv)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">MA-7</span>
                    <span className="font-bold" style={{color:C_CYAN}}>{fmtFull(d?.ma7)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Acumulado</span>
                    <span className="font-bold text-blue-600">{fmtFull(d?.acum)}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-1 mt-1 flex justify-between gap-4">
                    <span className="text-gray-500">Servicios</span>
                    <span className="font-semibold text-gray-700">{(d?.servicios||0).toLocaleString()}</span>
                  </div>
                </div>
              );
            }}
          />
          <Area yAxisId="right" dataKey="acum" fill="#DBEAFE" stroke="#93C5FD" strokeWidth={1.5} fillOpacity={0.4} dot={false} activeDot={false}/>
          <Bar yAxisId="left" dataKey="gmv" fill={C_TEAL} fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={28}/>
          <Line yAxisId="left" dataKey="ma7" stroke={C_CYAN} strokeWidth={2} dot={false} activeDot={{r:4, strokeWidth:0}} strokeDasharray="5 3"/>
          <ReferenceLine yAxisId="left" y={avgGmv} stroke="#9CA3AF" strokeDasharray="3 2" label={{value:"Prom.", position:"insideTopRight", fontSize:9, fill:"#9CA3AF"}}/>
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-4 mt-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{background:C_TEAL, opacity:0.85}}/>
          GMV diario
        </span>
        <span className="flex items-center gap-1">
          <span className="w-6 border-t-2 inline-block" style={{borderColor:C_CYAN, borderStyle:"dashed"}}/>
          Media móvil 7 días
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block bg-blue-200"/>
          GMV acumulado (eje der.)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-6 border-t inline-block border-gray-400" style={{borderStyle:"dashed"}}/>
          Promedio diario
        </span>
      </div>
    </div>
  );
}

function calcMetricas(rows) {
  const total    = rows.length;
  const entregados = rows.filter(r => r.esPerfecto && !r.fueraHorario).length;
  const slaDefined = rows.filter(r => r.slaCumplido !== null);
  const slaMet   = slaDefined.filter(r => r.slaCumplido).length;
  const devol    = rows.filter(r => r.esDevolucion).length;
  const noPerfectos = rows.filter(r => r.slaCumplido === false).length;
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
    .map(([k, v]) => ({ name: k, total: v.length, entregados: v.filter(r=>r.esPerfecto && !r.fueraHorario).length, slaMet: v.filter(r=>r.slaCumplido).length, slaDef: v.filter(r=>r.slaCumplido!==null).length, incumplidos: v.filter(r=>r.slaCumplido===false).length, cancelados: v.filter(r=>!r.esPerfecto).length }))
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
      entregados: rs.filter(r=>r.esPerfecto && !r.fueraHorario).length,
      sla: rs.filter(r=>r.slaCumplido!==null).length > 0
        ? Math.round(pct(rs.filter(r=>r.slaCumplido).length, rs.filter(r=>r.slaCumplido!==null).length)*100) : null,
    }));
}

function slaDistribucion(rows) {
  const met      = rows.filter(r => r.slaCumplido === true).length;
  const noMet    = rows.filter(r => r.slaCumplido === false).length;
  const cancel   = rows.filter(r => r.slaCumplido === null && !r.esPerfecto).length;
  const na       = rows.filter(r => r.slaCumplido === null && r.esPerfecto).length;
  return [
    { name: "Cumplido",               value: met,    color: C_GRN  },
    { name: "Incumplido",             value: noMet,  color: C_RED  },
    { name: "Cancelados / Expirados", value: cancel, color: C_AMB  },
    { name: "N.A",                    value: na,     color: C_GRAY },
  ].filter(d => d.value > 0);
}

function slaByRange(rows, ranges) {
  const cfg = ranges || SLA_DEFAULTS.ranges;
  const breakpoints = [0, ...cfg.map(r => r.maxKm)];
  const result = cfg.map((rng, i) => {
    const allInRange = rows.filter(r => r.km > breakpoints[i] && r.km <= rng.maxKm);
    const sub        = allInRange.filter(r => r.esPerfecto && r.minutos != null);
    const met        = sub.filter(r => r.slaCumplido === true).length;
    const incumplidos = allInRange.filter(r => r.slaCumplido === false).length;
    const cancelados  = allInRange.filter(r => !r.esPerfecto).length;
    const total      = sub.length;
    const avg        = total ? sub.reduce((a, b) => a + b.minutos, 0) / total : null;
    return { label: rng.label, lim: rng.maxKm, min: rng.min, total, met, pct: pct(met, total), avg, incumplidos, cancelados };
  });
  // Bucket > maxKm (N.A)
  const lastMax  = cfg[cfg.length - 1]?.maxKm || 17;
  const overAll  = rows.filter(r => r.km > lastMax);
  if (overAll.length > 0) {
    const overSub = overAll.filter(r => r.esPerfecto && r.minutos != null);
    result.push({
      label: `> ${lastMax} km`, lim: Infinity, min: null,
      total: overSub.length, met: 0, pct: 0,
      avg: overSub.length ? overSub.reduce((a, b) => a + b.minutos, 0) / overSub.length : null,
      incumplidos: overAll.filter(r => r.slaCumplido === false).length,
      cancelados:  overAll.filter(r => !r.esPerfecto).length,
    });
  }
  return result.filter(r => r.total > 0 || r.incumplidos > 0 || r.cancelados > 0);
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
            {showSla && <th className="text-right p-2 font-semibold">Incumplidos</th>}
            {showSla && <th className="text-right p-2 font-semibold">Cancelados / Exp.</th>}
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
                <td className="p-2 text-right font-semibold" style={{ color: d.incumplidos > 0 ? C_RED : C_GRAY }}>
                  {fmtNum(d.incumplidos)}
                </td>
              )}
              {showSla && (
                <td className="p-2 text-right font-semibold" style={{ color: d.cancelados > 0 ? C_AMB : C_GRAY }}>
                  {fmtNum(d.cancelados)}
                </td>
              )}
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

// ── Buscador de métricas por ciudad / usuario ──────────────────────────────
function BuscadorMetricas({ rows, prevRows, prevMesLabel, sedeLabel = "Usuario" }) {
  const [tipo,     setTipo]     = useState("ciudad");
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState(null);
  const [focused,  setFocused]  = useState(false);

  const key = tipo === "ciudad" ? "ciudad" : "sucursal";

  const items = useMemo(() =>
    [...new Set(rows.map(r => r[key]))].filter(Boolean).sort(),
  [rows, key]);

  const shown = query.trim()
    ? items.filter(i => i.toLowerCase().includes(query.toLowerCase()))
    : items;

  const selRows     = selected ? rows.filter(r => r[key] === selected)     : [];
  const prevSelRows = selected ? (prevRows || []).filter(r => r[key] === selected) : [];

  const m  = selRows.length     ? calcMetricas(selRows)     : null;
  const mp = prevSelRows.length ? calcMetricas(prevSelRows) : null;

  const incumplidos     = selRows.filter(r => r.slaCumplido === false).length;
  const prevIncumplidos = prevSelRows.filter(r => r.slaCumplido === false).length;
  const cancelados      = selRows.filter(r => !r.esPerfecto).length;
  const prevCancelados  = prevSelRows.filter(r => !r.esPerfecto).length;

  const slaPct     = m  && m.slaDef  > 0 ? pct(m.slaMet,  m.slaDef)  : null;
  const prevSlaPct = mp && mp.slaDef > 0 ? pct(mp.slaMet, mp.slaDef) : null;

  function Chip({ curr, prev, lowerIsBetter, format }) {
    if (prev == null || prev === 0) return <span className="text-gray-400 text-xs ml-1">—</span>;
    const delta = curr - prev;
    const pctDelta = (delta / Math.abs(prev)) * 100;
    const good = lowerIsBetter ? delta < 0 : delta > 0;
    const color = delta === 0 ? C_GRAY : good ? C_GRN : C_RED;
    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "=";
    const label = format === "pct"
      ? `${arrow} ${Math.abs(pctDelta).toFixed(1)}pp`
      : `${arrow} ${Math.abs(pctDelta).toFixed(1)}%`;
    return <span className="text-xs font-bold ml-1" style={{ color }}>{label}</span>;
  }

  function MetCard({ label, value, prev, lowerIsBetter, color, format, sub }) {
    return (
      <div className="rounded-xl p-3 border" style={{ borderColor: color + "33", background: color + "0A" }}>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-extrabold" style={{ color }}>{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
        {mp != null && prev != null && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            <span>{typeof prev === "number" && format !== "pct" ? fmtNum(prev) : prev}</span>
            <Chip curr={typeof value === "string" ? parseFloat(value) : value}
                  prev={typeof prev === "string" ? parseFloat(prev) : prev}
                  lowerIsBetter={lowerIsBetter} format={format} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-sm font-bold text-gray-700 mb-3">🔍 Buscar métricas por ciudad o {sedeLabel.toLowerCase()}</p>

      {/* Toggle tipo */}
      <div className="flex gap-2 mb-3">
        {[{ v: "ciudad", label: "🏙️ Ciudad" }, { v: "sucursal", label: `🏪 ${sedeLabel}` }].map(t => (
          <button key={t.v} onClick={() => { setTipo(t.v); setSelected(null); setQuery(""); }}
            className="px-3 py-1 rounded-lg text-xs font-semibold border transition"
            style={tipo === t.v ? { background: C_TEAL, color: "#fff", border: "none" } : { borderColor: "#e5e7eb", color: "#4b5563" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Input búsqueda con desplegable completo */}
      <div className="relative">
        <input type="text" value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={`Haz clic o escribe para filtrar ${tipo === "ciudad" ? "ciudad" : sedeLabel.toLowerCase()}...`}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        {(focused || (query && !selected)) && shown.length > 0 && (
          <div className="absolute z-20 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto mt-1">
            {shown.map(item => (
              <button key={item}
                onMouseDown={() => { setSelected(item); setQuery(item); setFocused(false); }}
                className={`w-full text-left px-4 py-2 text-xs border-b border-gray-50 last:border-0 truncate transition-colors
                  ${item === selected ? "bg-teal-50 text-teal-700 font-semibold" : "hover:bg-teal-50 hover:text-teal-700"}`}>
                {item}
              </button>
            ))}
          </div>
        )}
        {query && !selected && shown.length === 0 && (
          <p className="text-xs text-gray-400 px-1 mt-1">Sin resultados para "{query}"</p>
        )}
      </div>

      {/* Métricas del seleccionado */}
      {selected && m && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-teal-700 truncate max-w-[70%]">{selected}</p>
            {prevMesLabel
              ? <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">vs {prevMesLabel}</span>
              : <span className="text-xs text-gray-300">Sin mes anterior cargado</span>
            }
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <MetCard label="Total servicios" value={m.total} prev={mp?.total}
              lowerIsBetter={false} color={C_TEAL} />
            <MetCard label="Entregados" value={m.entregados} prev={mp?.entregados}
              lowerIsBetter={false} color={C_GRN} />
            <MetCard label="% Entrega" value={fmtPct(pct(m.entregados, m.total))}
              prev={mp ? fmtPct(pct(mp.entregados, mp.total)) : null}
              lowerIsBetter={false} color={pct(m.entregados,m.total)>=0.95?C_GRN:pct(m.entregados,m.total)>=0.85?C_AMB:C_RED}
              format="pct" />
            <MetCard label="Incumplidos SLA" value={incumplidos} prev={mp != null ? prevIncumplidos : null}
              lowerIsBetter={true} color={C_RED} />
            <MetCard label="Cancelados / Exp." value={cancelados} prev={mp != null ? prevCancelados : null}
              lowerIsBetter={true} color={C_AMB} />
            {slaPct != null
              ? <MetCard label="% SLA Cumplido" value={fmtPct(slaPct)}
                  prev={prevSlaPct != null ? fmtPct(prevSlaPct) : null}
                  lowerIsBetter={false} color={slaPct>=0.95?C_GRN:slaPct>=0.85?C_AMB:C_RED}
                  format="pct"
                  sub={`${fmtNum(m.slaMet)} de ${fmtNum(m.slaDef)}`} />
              : <MetCard label="% SLA Cumplido" value="N.A" prev={null} color={C_GRAY} />
            }
          </div>
        </div>
      )}

      {selected && !m && (
        <p className="text-xs text-gray-400 mt-3">Sin datos para "{selected}"</p>
      )}
    </div>
  );
}

// ── Panel de una línea de negocio ──────────────────────────────────────────
function LineaPanel({ rows, linea, prevRows, prevMesLabel }) {
  const m = calcMetricas(rows);
  const tendencia = dailyTrend(rows);
  const byCiudad  = topN(rows, "ciudad", 12).map(d => ({ ...d, pct_sla: d.slaDef > 0 ? Math.round(pct(d.slaMet,d.slaDef)*100) : null }));
  const bySucursal = topN(rows, "sucursal", 10);
  const slaDist    = slaDistribucion(rows);
  const slaRanges  = slaByRange(rows);
  const isNextDay  = linea === "integ_nd";

  function descargarNoPerfectos() {
    const noPerfectos = rows.filter(r => r.slaCumplido === false);
    const data = noPerfectos.map(r => ({
      "Booking ID":          r.idServicio || r.uuid || "—",
      "Estado":              r.estado || "—",
      "Hora Asignado":       fmtDatetime(r.iniciadoRaw),
      "Tiempo efectivo":     r.minutos != null ? fmtMin(r.minutos) : "—",
      "Ciudad":              r.ciudad || "—",
      "Dirección de Origen": r.direccionOrigen || "—",
      "Sede":                r.sucursal || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 45 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "No Perfectos");
    const lineaLabel = linea === "mostrador" ? "mostrador" : linea === "integ_sd" ? "integ-sd" : "integ-nd";
    XLSX.writeFile(wb, `no-perfectos-${lineaLabel}.xlsx`);
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon="📦" label="Total servicios" value={fmtNum(m.total)} color={C_TEAL} />
        <KpiCard icon="✅" label="Entregados" value={fmtNum(m.entregados)} sub={fmtPct(pct(m.entregados, m.total))} color={C_GRN} />
        <KpiCard icon="⚠️" label="No perfectos" value={fmtNum(m.noPerfectos)} sub={m.slaDef > 0 ? `${fmtPct(pct(m.noPerfectos, m.slaDef))} de medidos` : "—"} color={C_RED} />
        {!isNextDay
          ? <KpiCard icon="⏱️" label="Tiempo prom." value={fmtMin(m.avgMin)} sub={m.slaDef > 0 ? `SLA ${fmtPct(pct(m.slaMet, m.slaDef))}` : "Sin SLA"} color={C_CYAN} />
          : <KpiCard icon="🕕" label="SLA ≤ 18:00" value={m.slaDef > 0 ? fmtPct(pct(m.slaMet, m.slaDef)) : "—"} sub={`${fmtNum(m.slaMet)} de ${fmtNum(m.slaDef)}`} color={C_CYAN} />
        }
        <KpiCard icon="🏙️" label="Ciudades" value={m.ciudades} color="#6366F1" />
        <KpiCard icon="🏪" label="Sucursales" value={m.sucursales} color="#A855F7" />
        <KpiCard icon="↩️" label="Devoluciones" value={fmtNum(m.devol)} sub={m.total>0?fmtPct(pct(m.devol,m.total)):undefined} color={C_AMB} />
        <KpiCard icon="📊" label="Servicios c/SLA" value={fmtNum(m.slaDef)} color={C_GRAY} />
      </div>

      {/* Descarga No Perfectos */}
      {m.noPerfectos > 0 && (
        <div className="flex justify-end">
          <button
            onClick={descargarNoPerfectos}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition hover:opacity-90"
            style={{ background: C_RED }}
          >
            ⬇ Descargar No Perfectos ({fmtNum(m.noPerfectos)})
          </button>
        </div>
      )}

      <GmvDiarioCV rows={rows} />

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

      {/* Distribución por estado + Top 5 expirados/cancelados (mostrador) */}
      {(() => {
        // Agrupar todos los estados
        const byEstado = Object.entries(
          rows.reduce((acc, r) => {
            const e = r.estado || "Sin estado";
            acc[e] = (acc[e] || 0) + 1;
            return acc;
          }, {})
        )
          .map(([estado, n]) => ({ estado, n }))
          .sort((a, b) => b.n - a.n);

        const estadoColor = (e) => {
          const l = e.toLowerCase();
          if (l.includes("finaliz") && !l.includes("fallid")) return C_GRN;
          if (l.includes("cancel"))  return C_AMB;
          if (l.includes("expir"))   return C_RED;
          if (l.includes("fallid"))  return "#EF4444";
          return C_GRAY;
        };

        // Top 5 expirados por usuario (mostrador)
        const expiradosRows = rows.filter(r => r.estado?.toLowerCase().includes("expir"));
        const topExpirados  = Object.entries(
          expiradosRows.reduce((acc, r) => { acc[r.sucursal] = (acc[r.sucursal] || 0) + 1; return acc; }, {})
        ).map(([s, n]) => ({ sucursal: s.length > 25 ? s.slice(0, 25) + "…" : s, n }))
          .sort((a, b) => b.n - a.n).slice(0, 5);

        // Top 5 cancelados por usuario (mostrador)
        const canceladosRows = rows.filter(r => r.estado?.toLowerCase().includes("cancel"));
        const topCancelados  = Object.entries(
          canceladosRows.reduce((acc, r) => { acc[r.sucursal] = (acc[r.sucursal] || 0) + 1; return acc; }, {})
        ).map(([s, n]) => ({ sucursal: s.length > 25 ? s.slice(0, 25) + "…" : s, n }))
          .sort((a, b) => b.n - a.n).slice(0, 5);

        const isMostrador = linea === "mostrador";
        const showTop5    = linea === "mostrador" || linea === "integ_sd" || linea === "integ_nd";
        const sedeTag     = isMostrador ? "usuarios" : "sedes";

        return (
          <div className={`grid gap-4 ${showTop5 ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
            {/* Distribución por estado */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-bold text-gray-700 mb-3">📋 Servicios por estado</p>
              {byEstado.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byEstado} layout="vertical" margin={{ left: 8 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="estado" width={130} tick={{ fontSize: 10 }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="n" name="Servicios" radius={[0, 3, 3, 0]}>
                      {byEstado.map((d, i) => <Cell key={i} fill={estadoColor(d.estado)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-sm">Sin datos</p>}
            </div>

            {/* Top 5 expirados por usuario/sede */}
            {showTop5 && (
              <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4">
                <p className="text-sm font-bold text-gray-700 mb-3">⏰ Top 5 {sedeTag} — Expirados</p>
                {topExpirados.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topExpirados} layout="vertical" margin={{ left: 8 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="sucursal" width={130} tick={{ fontSize: 9 }} />
                      <Tooltip content={<TT />} />
                      <Bar dataKey="n" name="Expirados" fill={C_RED} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-sm">Sin servicios expirados</p>}
              </div>
            )}

            {/* Top 5 cancelados por usuario/sede */}
            {showTop5 && (
              <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-4">
                <p className="text-sm font-bold text-gray-700 mb-3">❌ Top 5 {sedeTag} — Cancelados</p>
                {topCancelados.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topCancelados} layout="vertical" margin={{ left: 8 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="sucursal" width={130} tick={{ fontSize: 9 }} />
                      <Tooltip content={<TT />} />
                      <Bar dataKey="n" name="Cancelados" fill={C_AMB} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-sm">Sin servicios cancelados</p>}
              </div>
            )}
          </div>
        );
      })()}

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
                  <th className="text-right p-2">Con SLA</th>
                  <th className="text-right p-2">Cumplidos</th>
                  <th className="text-right p-2">Incumplidos</th>
                  <th className="text-right p-2">Cancelados / Exp.</th>
                  <th className="text-right p-2">% SLA</th>
                  <th className="text-right p-2">Prom. tiempo</th>
                </tr>
              </thead>
              <tbody>
                {slaRanges.map((r, i) => (
                  <tr key={i} className={i%2===0?"bg-white":"bg-gray-50"}>
                    <td className="p-2 font-medium">{r.label}</td>
                    <td className="p-2 text-right">{r.min ? `${r.min} min` : <span className="text-gray-400 text-xs font-semibold">N.A</span>}</td>
                    <td className="p-2 text-right">{fmtNum(r.total)}</td>
                    <td className="p-2 text-right text-green-700 font-semibold">{fmtNum(r.met)}</td>
                    <td className="p-2 text-right font-semibold" style={{ color: r.incumplidos > 0 ? C_RED : C_GRAY }}>{fmtNum(r.incumplidos)}</td>
                    <td className="p-2 text-right font-semibold" style={{ color: r.cancelados > 0 ? C_AMB : C_GRAY }}>{fmtNum(r.cancelados)}</td>
                    <td className="p-2 text-right font-semibold" style={{ color: r.min == null ? C_GRAY : r.pct>=0.95?C_GRN:r.pct>=0.85?C_AMB:C_RED }}>
                      {r.min != null ? fmtPct(r.pct) : <span className="text-gray-400 text-xs">N.A</span>}
                    </td>
                    <td className="p-2 text-right">{fmtMin(r.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Servicios iniciados fuera de horario (solo integ_sd) */}
      {linea === "integ_sd" && (() => {
        const fueraHorario = rows.filter(r => r.fueraHorario);
        if (!fueraHorario.length) return null;

        // Consolidado por ciudad + dirección
        const consolidado = [];
        const mapa = {};
        fueraHorario.forEach(r => {
          const k = `${r.ciudad}||${r.direccionOrigen || "Sin dirección"}`;
          if (!mapa[k]) {
            mapa[k] = { ciudad: r.ciudad, direccion: r.direccionOrigen || "Sin dirección", total: 0, finalizados: 0, expirados: 0, cancelados: 0 };
            consolidado.push(mapa[k]);
          }
          mapa[k].total += 1;
          const est = (r.estado || "").toLowerCase();
          if (est === "finalizado")          mapa[k].finalizados += 1;
          else if (est.includes("expir"))    mapa[k].expirados   += 1;
          else if (est.includes("cancel"))   mapa[k].cancelados  += 1;
        });
        consolidado.sort((a, b) => b.total - a.total);

        const descargarDetalle = () => {
          const data = fueraHorario.map(r => ({
            "ID Servicio":               r.idServicio || r.uuid || "—",
            "Hora Asignado":             fmtDatetime(r.iniciadoRaw),
            "Estado":                    r.estado || "—",
            "Fecha Cancelación Paquete": fmtDatetime(r.fechaCancelacion),
            "Fecha Finalizó Servicio":   fmtDatetime(r.finalizadoRaw),
            "Ciudad":                    r.ciudad,
            "Dirección de Origen":       r.direccionOrigen || "—",
          }));
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Fuera de Horario");
          XLSX.writeFile(wb, "fuera_de_horario_detalle.xlsx");
        };

        return (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 text-base">⚠️</span>
                <p className="text-sm font-bold text-amber-700">
                  Servicios asignados fuera de horario ({fueraHorario.length})
                </p>
              </div>
              <button
                onClick={descargarDetalle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition"
                style={{ background: C_TEAL }}
              >
                ⬇️ Descargar detalle
              </button>
            </div>
            <p className="text-xs text-amber-600 mb-3">
              Servicios asignados fuera del horario de atención de la tienda — excluidos del indicador de tiempos perfectos.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-amber-50 text-amber-800">
                    <th className="text-left p-2 font-semibold">Ciudad</th>
                    <th className="text-left p-2 font-semibold">Dirección</th>
                    <th className="text-center p-2 font-semibold">Total</th>
                    <th className="text-center p-2 font-semibold text-green-700">Finalizados</th>
                    <th className="text-center p-2 font-semibold text-red-600">Expirados</th>
                    <th className="text-center p-2 font-semibold text-amber-600">Cancelados</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidado.map((g, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-amber-50/40"}>
                      <td className="p-2 font-semibold text-gray-700">{g.ciudad}</td>
                      <td className="p-2 text-gray-600 max-w-[260px] truncate" title={g.direccion}>{g.direccion}</td>
                      <td className="p-2 text-center font-bold text-amber-700">{g.total}</td>
                      <td className="p-2 text-center font-semibold text-green-700">{g.finalizados || "—"}</td>
                      <td className="p-2 text-center font-semibold text-red-600">{g.expirados   || "—"}</td>
                      <td className="p-2 text-center font-semibold text-amber-600">{g.cancelados  || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Ranking por ciudad + Buscador de métricas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <TablaRanking rows={rows} groupKey="ciudad" title="🏙️ Ranking por ciudad" showSla={!isNextDay} />
        </div>
        <BuscadorMetricas rows={rows} prevRows={prevRows} prevMesLabel={prevMesLabel}
          sedeLabel={linea === "mostrador" ? "Usuario" : "Sede"} />
      </div>

      {/* Top 5 tiendas mostrador */}
      {linea === "mostrador" && (() => {
        // Agrupar por sucursal y calcular métricas
        const grp = groupBy(rows, "sucursal");
        const ranking = Object.entries(grp)
          .map(([nombre, rs]) => ({
            nombre,
            total:       rs.length,
            entregados:  rs.filter(r => r.esPerfecto && !r.fueraHorario).length,
            incumplidos: rs.filter(r => r.slaCumplido === false).length,
            cancelados:  rs.filter(r => !r.esPerfecto).length,
            slaMet:      rs.filter(r => r.slaCumplido === true).length,
            slaDef:      rs.filter(r => r.slaCumplido !== null).length,
            gmv:         rs.reduce((s, r) => s + (r.costo || 0), 0),
          }))
          .sort((a, b) => b.total - a.total);

        const top5 = ranking.slice(0, 5);
        const hasGmv = ranking.some(r => r.gmv > 0);

        function descargarRanking() {
          const headers = ["#", "Tienda / Usuario", "Total servicios", "Entregados",
            "% Entrega", "Incumplidos", "Cancelados / Exp.", "% SLA cumplido", "GMV ($)"];
          const dataRows = ranking.map((r, i) => [
            i + 1,
            r.nombre,
            r.total,
            r.entregados,
            (pct(r.entregados, r.total) * 100).toFixed(1) + "%",
            r.incumplidos,
            r.cancelados,
            r.slaDef > 0 ? (pct(r.slaMet, r.slaDef) * 100).toFixed(1) + "%" : "N.A",
            r.gmv > 0 ? r.gmv.toFixed(0) : "—",
          ]);
          const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
          ws["!cols"] = [6,38,18,16,12,14,18,16,14].map(w => ({ wch: w }));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Ranking Tiendas");
          XLSX.writeFile(wb, `ranking-tiendas-mostrador.xlsx`);
        }

        return (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-700">🏆 Top 5 tiendas — Mayor volumen</p>
              <button onClick={descargarRanking}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
                style={{ background: C_TEAL }}>
                ⬇ Descargar ranking completo
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-teal-50 text-teal-700">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Tienda / Usuario</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Entregados</th>
                    <th className="text-right p-2">% Entrega</th>
                    <th className="text-right p-2">Incumplidos</th>
                    <th className="text-right p-2">Cancelados / Exp.</th>
                    <th className="text-right p-2">% SLA</th>
                    {hasGmv && <th className="text-right p-2">GMV ($)</th>}
                  </tr>
                </thead>
                <tbody>
                  {top5.map((r, i) => (
                    <tr key={r.nombre} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-2 font-bold text-teal-600">{i + 1}</td>
                      <td className="p-2 font-medium text-gray-700 max-w-[160px] truncate" title={r.nombre}>{r.nombre}</td>
                      <td className="p-2 text-right font-semibold">{fmtNum(r.total)}</td>
                      <td className="p-2 text-right text-green-700 font-semibold">{fmtNum(r.entregados)}</td>
                      <td className="p-2 text-right font-semibold"
                        style={{ color: pct(r.entregados,r.total)>=0.95?C_GRN:pct(r.entregados,r.total)>=0.85?C_AMB:C_RED }}>
                        {fmtPct(pct(r.entregados, r.total))}
                      </td>
                      <td className="p-2 text-right font-semibold" style={{ color: r.incumplidos > 0 ? C_RED : C_GRAY }}>
                        {fmtNum(r.incumplidos)}
                      </td>
                      <td className="p-2 text-right font-semibold" style={{ color: r.cancelados > 0 ? C_AMB : C_GRAY }}>
                        {fmtNum(r.cancelados)}
                      </td>
                      <td className="p-2 text-right font-semibold"
                        style={{ color: r.slaDef===0?C_GRAY:pct(r.slaMet,r.slaDef)>=0.95?C_GRN:pct(r.slaMet,r.slaDef)>=0.85?C_AMB:C_RED }}>
                        {r.slaDef > 0 ? fmtPct(pct(r.slaMet, r.slaDef)) : "—"}
                      </td>
                      {hasGmv && (
                        <td className="p-2 text-right text-teal-700 font-semibold">
                          {r.gmv > 0 ? `$${fmtNum(Math.round(r.gmv))}` : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!hasGmv && (
              <p className="text-xs text-gray-400 mt-2 italic">
                * GMV no disponible — re-sube el archivo para incluirlo en la descarga.
              </p>
            )}
          </div>
        );
      })()}

      {/* Top 5 devoluciones por usuario / sede */}
      {(() => {
        const devolRows = rows.filter(r => r.esDevolucion);
        const sedeLabel = linea === "mostrador" ? "Usuario" : "Sede";

        // Agrupar devoluciones por sucursal
        const grp = {};
        devolRows.forEach(r => {
          const k = r.sucursal || "Sin " + sedeLabel.toLowerCase();
          if (!grp[k]) grp[k] = { nombre: k, total: 0, rows: [] };
          grp[k].total++;
          grp[k].rows.push(r);
        });
        const ranking = Object.values(grp).sort((a,b) => b.total - a.total);
        const top5    = ranking.slice(0, 5);

        const descargar = () => {
          const ws = XLSX.utils.json_to_sheet(devolRows.map(r => ({
            [sedeLabel]:         r.sucursal       || "—",
            "Ciudad":            r.ciudad         || "—",
            "ID Servicio":       r.idServicio     || "—",
            "Número paquete":    r.numeroPaquete  || "—",
            "Descripción":       r.descripcion    || "—",
            "Estado":            r.estado         || "—",
            "Fecha asignado":    r.iniciadoRaw    || "—",
            "Fecha entrega":     r.finalizadoRaw  || "—",
            "Fecha cancelación": r.fechaCancelacion || "—",
            "Piloto":            r.nombrePiloto   || "—",
          })));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Devoluciones");
          XLSX.writeFile(wb, `devoluciones-${linea}.xlsx`);
        };

        if (!devolRows.length) return null;
        return (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-gray-700">↩️ Ranking de devoluciones por {sedeLabel}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Mayor número de devoluciones — requieren atención</p>
              </div>
              <button onClick={descargar}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 transition-all">
                ⬇️ Descargar informe completo
              </button>
            </div>
            <div className="space-y-2">
              {top5.map((s, i) => {
                const pctDevol = pct(s.total, m.total);
                // Descripciones únicas de las devoluciones de esta sede
                const descs = [...new Set(s.rows.map(r => r.descripcion).filter(Boolean))].slice(0, 3);
                return (
                  <div key={s.nombre} className="rounded-xl px-4 py-3"
                    style={{ background:"#FEF2F2", border:"1px solid #EF444422" }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-extrabold w-7 text-center flex-shrink-0"
                        style={{ color: C_RED }}>#{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{s.nombre}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-extrabold" style={{ color: C_RED }}>{fmtNum(s.total)} dev.</p>
                        <p className="text-[11px] font-semibold text-gray-400">{fmtPct(pctDevol)} del total</p>
                      </div>
                    </div>
                    {descs.length > 0 && (
                      <div className="mt-2 ml-10 flex flex-wrap gap-1">
                        {descs.map((d, di) => (
                          <span key={di} className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-md px-2 py-0.5 truncate max-w-xs">
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {ranking.length > 5 && (
              <p className="text-[11px] text-gray-400 text-center mt-3">
                +{ranking.length - 5} {sedeLabel.toLowerCase()}s más · descarga el informe para ver el detalle completo
              </p>
            )}
          </div>
        );
      })()}

      <HeatmapDiaHora rows={rows} />
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
// ── HeatmapDiaHora ─────────────────────────────────────────────────────────
const DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const DOW_ORDER = [1,2,3,4,5,6,0]; // lunes→domingo

function HeatmapDiaHora({ rows }) {
  const matriz = useMemo(() => {
    const m = {};
    rows.forEach(r => {
      if (!r.tsalida) return;
      const d = new Date(r.tsalida);
      const dow = d.getDay();
      const h   = d.getHours();
      const k   = `${dow}_${h}`;
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [rows]);

  const horas = useMemo(() => {
    const hs = new Set();
    Object.keys(matriz).forEach(k => hs.add(Number(k.split("_")[1])));
    return [...hs].sort((a,b) => a-b);
  }, [matriz]);

  const maxVal = useMemo(() => Math.max(1, ...Object.values(matriz)), [matriz]);

  if (!horas.length) return null;

  const cellBg = (val) => {
    if (!val) return "transparent";
    const t = val / maxVal;
    if (t >= 0.85) return "#5B21B6";
    if (t >= 0.60) return "#7C3AED";
    if (t >= 0.40) return "#8B5CF6";
    if (t >= 0.20) return "#A78BFA";
    return "#DDD6FE";
  };
  const cellColor = (val) => {
    if (!val) return "inherit";
    const t = val / maxVal;
    return t >= 0.40 ? "#fff" : "#4C1D95";
  };

  function descargarDetalle() {
    const data = rows
      .filter(r => r.tsalida)
      .map(r => {
        const d = new Date(r.tsalida);
        const diaIdx = DOW_ORDER.indexOf(d.getDay());
        const dia  = diaIdx >= 0 ? DIAS[diaIdx] : "—";
        const hora = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
        return {
          "Día":                dia,
          "Booking ID":         r.idServicio || r.uuid || "—",
          "Hora":               hora,
          "Dirección de Origen": r.direccionOrigen || "—",
          "Sede":               r.sucursal || "—",
        };
      })
      .sort((a, b) => {
        const dA = DIAS.indexOf(a["Día"]);
        const dB = DIAS.indexOf(b["Día"]);
        if (dA !== dB) return dA - dB;
        return a["Hora"].localeCompare(b["Hora"]);
      });

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 45 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Servicios por Día y Hora");
    XLSX.writeFile(wb, "servicios-asignados-dia-hora.xlsx");
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-700">📊 Servicios asignados por día y hora</p>
        <button
          onClick={descargarDetalle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
          style={{ background: "#7C3AED" }}
        >
          ⬇ Descargar detalle
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="text-left p-2 text-gray-500 font-semibold whitespace-nowrap">Día / Hora</th>
              {horas.map(h => (
                <th key={h} className="p-2 text-gray-500 font-semibold text-center whitespace-nowrap">
                  {String(h).padStart(2,"0")}:00
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOW_ORDER.map((dow, di) => (
              <tr key={dow}>
                <td className="p-2 font-bold text-gray-700 whitespace-nowrap">{DIAS[di]}</td>
                {horas.map(h => {
                  const val = matriz[`${dow}_${h}`] || 0;
                  return (
                    <td key={h} className="p-1 text-center">
                      {val > 0 ? (
                        <span className="inline-flex items-center justify-center rounded-lg min-w-[2rem] px-2 py-1 font-bold"
                          style={{ background: cellBg(val), color: cellColor(val) }}>
                          {val}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResumenPanel({ rows, allRows }) {
  const lineas = [
    { key:"mostrador",  label:"Cruz Verde Mostrador", color:C_TEAL  },
    { key:"integ_sd",   label:"Integración Same Day", color:C_CYAN  },
    { key:"integ_nd",   label:"Integración Next Day", color:"#6366F1" },
  ];
  const mTotal = calcMetricas(rows);
  const byLinea = lineas.map(l => ({ ...l, rows: rows.filter(r=>r.linea===l.key), m: calcMetricas(rows.filter(r=>r.linea===l.key)) }));

  const pieData = byLinea.map(l => ({ name: l.label, value: l.m.total, color: l.color })).filter(d=>d.value>0);
  const byCiudad = topN(rows, "ciudad", 12);

  return (
    <div className="space-y-6">
      {/* KPIs globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon="📦" label="Total servicios" value={fmtNum(mTotal.total)} color={C_TEAL} />
        <KpiCard icon="✅" label="Entregados" value={fmtNum(mTotal.entregados)} sub={fmtPct(pct(mTotal.entregados, mTotal.total))} color={C_GRN} />
        <KpiCard icon="⚠️" label="No perfectos" value={fmtNum(mTotal.noPerfectos)} sub={mTotal.slaDef > 0 ? `${fmtPct(pct(mTotal.noPerfectos, mTotal.slaDef))} de medidos` : "—"} color={C_RED} />
        <KpiCard icon="⏱️" label="SLA global" value={mTotal.slaDef>0?fmtPct(pct(mTotal.slaMet,mTotal.slaDef)):"—"} sub={`${fmtNum(mTotal.slaMet)} de ${fmtNum(mTotal.slaDef)}`} color={C_CYAN} />
        <KpiCard icon="🏙️" label="Ciudades" value={mTotal.ciudades} color="#6366F1" />
        <KpiCard icon="🏪" label="Sucursales" value={mTotal.sucursales} color="#A855F7" />
        <KpiCard icon="↩️" label="Devoluciones" value={fmtNum(mTotal.devol)} sub={mTotal.total>0?fmtPct(pct(mTotal.devol,mTotal.total)):undefined} color={C_AMB} />
        <KpiCard icon="📊" label="Con SLA medido" value={fmtNum(mTotal.slaDef)} color={C_GRAY} />
      </div>

      <GmvDiarioCV rows={rows} />

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
      <HeatmapDiaHora rows={rows} />
      <BuscadorServicio rows={allRows || rows} />
    </div>
  );
}

// ── AdminPanel ─────────────────────────────────────────────────────────────
const SK_HORARIOS_SD = "pibox_cv_horarios_sd";
function loadHorariosSd() {
  try { return JSON.parse(localStorage.getItem(SK_HORARIOS_SD) || "null"); } catch { return null; }
}

function AdminPanel({ slaConfig, setSlaConfig, setHorariosMap, rows }) {
  // ── Sección 1: Directorio Cruz Verde ──
  const [dirUploadMsg, setDirUploadMsg] = useState(null);
  const [dirLoading,   setDirLoading]   = useState(false);
  const [directorio,   setDirectorio]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("pibox_cv_directorio") || "null"); } catch { return null; }
  });
  const [dirSearch, setDirSearch] = useState("");

  const handleDirectorioUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDirLoading(true); setDirUploadMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: "array" });

      // Hoja "Directorio Consolidado" (o primera hoja disponible)
      const ws = wb.Sheets["Directorio Consolidado"] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const tiendas = rows.map(r => ({
        codigo:       String(r["Cod. Suc"] ?? "").trim(),
        nombre:       String(r["Nombre Sucursal"] ?? "").trim(),
        departamento: String(r["Departamento"] ?? "").trim(),
        ciudad:       String(r["Ciudad"] ?? "").trim(),
        direccion:    String(r["Dirección"] ?? r["Direccion"] ?? "").trim(),
        correo:       String(r["Correo Sucursal"] ?? "").trim(),
        celular:      String(r["Celular Corporativo"] ?? "").trim(),
        lv_apertura:  String(r["Apertura\n  Lunes a viernes"] ?? r["Apertura Lunes a viernes"] ?? "").trim(),
        lv_cierre:    String(r["Cierre \n Lunes a viernes"]   ?? r["Cierre Lunes a viernes"]   ?? "").trim(),
        sab_apertura: String(r["Apertura \n Sábado"]  ?? r["Apertura Sábado"]  ?? "").trim(),
        sab_cierre:   String(r["Cierre \n Sábado"]    ?? r["Cierre Sábado"]    ?? "").trim(),
        dom_apertura: String(r["Apertura \n Domingo"] ?? r["Apertura Domingo"] ?? "").trim(),
        dom_cierre:   String(r["Cierre \n Domingo"]   ?? r["Cierre Domingo"]   ?? "").trim(),
        fest_apertura:String(r["Apertura \n Festivos"]?? r["Apertura Festivos"]?? "").trim(),
        fest_cierre:  String(r["Cierre \n Festivos"]  ?? r["Cierre Festivos"]  ?? "").trim(),
      })).filter(t => t.codigo || t.nombre);

      const newDir = { tiendas, horarios: directorio?.horarios || [], uploaded: new Date().toISOString() };
      localStorage.setItem("pibox_cv_directorio", JSON.stringify(newDir));
      setDirectorio(newDir);
      setDirUploadMsg({ ok: true, txt: `✅ ${tiendas.length} sucursales cargadas correctamente.` });
    } catch (err) {
      setDirUploadMsg({ ok: false, txt: `❌ Error al procesar: ${err.message}` });
    } finally {
      setDirLoading(false);
      e.target.value = "";
      setTimeout(() => setDirUploadMsg(null), 7000);
    }
  };

  const tiendas = directorio?.tiendas || [];
  const filteredTiendas = dirSearch.trim()
    ? tiendas.filter(t => {
        const q = dirSearch.toLowerCase();
        return t.codigo.toLowerCase().includes(q) ||
          t.nombre.toLowerCase().includes(q) ||
          t.ciudad.toLowerCase().includes(q) ||
          t.departamento.toLowerCase().includes(q) ||
          t.correo.toLowerCase().includes(q);
      })
    : tiendas;

  // ── Sección 2: Horarios Same Day ──
  const [horariosSd, setHorariosSd] = useState(() => loadHorariosSd());
  const [sdLoading, setSdLoading] = useState(false);
  const [sdMsg, setSdMsg] = useState(null);
  const [sdSearch, setSdSearch] = useState("");

  const handleHorariosSdUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSdLoading(true); setSdMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      // Hoja3 o primera hoja disponible
      const ws = wb.Sheets["Hoja3"] || wb.Sheets[wb.SheetNames[0]];
      // Leer como arrays para tomar la primera fila como headers reales
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (raw.length < 2) throw new Error("El archivo está vacío o no tiene datos.");
      // Primera fila = headers
      const headers = raw[0].map(h => String(h).trim());
      const col = (row, ...names) => {
        for (const n of names) {
          const idx = headers.findIndex(h => h.toLowerCase().replace(/[\s\r\n]+/g," ").includes(n.toLowerCase()));
          if (idx >= 0 && row[idx] !== "" && row[idx] !== undefined) return String(row[idx]).trim();
        }
        return "";
      };
      const horarios = raw.slice(1).map(row => ({
        direccion:    col(row, "DIRECCION TRUMP", "DIRECCION", "dirección trump"),
        sucursal:     col(row, "SUCURSAL", "sucursal"),
        nombre:       col(row, "NOMBRE TIENDA", "nombre tienda", "nombre"),
        lv_apertura:  col(row, "Apertura Lunes", "apertura lunes"),
        lv_cierre:    col(row, "Cierre Lunes",   "cierre lunes"),
        sab_apertura: col(row, "Apertura Sábado","apertura sab","apertura sabado"),
        sab_cierre:   col(row, "Cierre Sábado",  "cierre sab","cierre sabado"),
        dom_apertura: col(row, "Apertura Domingo","apertura dom"),
        dom_cierre:   col(row, "Cierre Domingo",  "cierre dom"),
        fest_apertura:col(row, "Apertura Festivos","apertura fest"),
        fest_cierre:  col(row, "Cierre Festivos",  "cierre fest"),
      })).filter(h => h.direccion);
      localStorage.setItem(SK_HORARIOS_SD, JSON.stringify({ horarios, uploaded: new Date().toISOString() }));
      setHorariosSd({ horarios, uploaded: new Date().toISOString() });
      setHorariosMap(buildHorariosMap(horarios));
      setSdMsg({ ok: true, txt: `✅ ${horarios.length} tiendas cargadas con horarios.` });
    } catch (err) {
      setSdMsg({ ok: false, txt: `❌ Error: ${err.message}` });
    } finally {
      setSdLoading(false);
      e.target.value = "";
      setTimeout(() => setSdMsg(null), 7000);
    }
  };

  // Alertas: direcciones en datos Same Day que no están en el directorio de horarios
  const horarios = horariosSd?.horarios || [];
  const horariosKeys = useMemo(() => new Set(horarios.map(h => normalizeDireccion(h.direccion))), [horarios]);
  const direccionesFaltantes = useMemo(() => {
    if (!rows?.length || !horarios.length) return [];
    const sdRows = rows.filter(r => r.linea === "integ_sd");
    const unique = [...new Set(sdRows.map(r => r.direccionOrigen).filter(Boolean))];
    return unique.filter(d => d && !horariosKeys.has(normalizeDireccion(d))).sort();
  }, [rows, horariosKeys]);

  const rowsSinHorario = useMemo(() => {
    if (!direccionesFaltantes.length || !rows?.length) return [];
    const faltantesSet = new Set(direccionesFaltantes.map(d => normalizeDireccion(d)));
    return rows.filter(r =>
      r.linea === "integ_sd" && r.direccionOrigen && faltantesSet.has(normalizeDireccion(r.direccionOrigen))
    );
  }, [rows, direccionesFaltantes]);

  // Filtro de búsqueda en tabla de horarios
  const filteredHorarios = sdSearch.trim()
    ? horarios.filter(h => {
        const q = sdSearch.toLowerCase();
        return h.direccion.toLowerCase().includes(q) || h.nombre.toLowerCase().includes(q) || String(h.sucursal).includes(q);
      })
    : horarios;

  // ── Sección 3: Configuración SLA ──
  const [localSla, setLocalSla] = useState(() => getSlaConfig());
  const [slaMsg,   setSlaMsg]   = useState(null);

  const handleSlaRangeChange = (idx, val) => {
    setLocalSla(prev => {
      const ranges = prev.ranges.map((r, i) => i === idx ? { ...r, min: parseInt(val) || 0 } : r);
      return { ...prev, ranges };
    });
  };
  const handleSlaNextDay = (val) => setLocalSla(prev => ({ ...prev, nextDayHora: parseInt(val) || 18 }));

  const saveSla = () => {
    localStorage.setItem("pibox_cv_sla", JSON.stringify(localSla));
    setSlaConfig(localSla);
    setSlaMsg({ ok: true, txt: "✅ Configuración SLA guardada." });
    setTimeout(() => setSlaMsg(null), 4000);
  };
  const restoreSla = () => {
    setLocalSla(SLA_DEFAULTS);
    localStorage.setItem("pibox_cv_sla", JSON.stringify(SLA_DEFAULTS));
    setSlaConfig(SLA_DEFAULTS);
    setSlaMsg({ ok: true, txt: "↩️ Valores restaurados por defecto." });
    setTimeout(() => setSlaMsg(null), 4000);
  };

  // ── Sección 4: Umbrales de riesgo ──
  const [umbrales,  setUmbrales]  = useState(() => getUmbrales());
  const [umbMsg,    setUmbMsg]    = useState(null);

  const handleUmbral = (linea, campo, val) => {
    setUmbrales(prev => ({
      ...prev,
      [linea]: { ...prev[linea], [campo]: parseInt(val) || 0 },
    }));
  };
  const saveUmbrales = () => {
    localStorage.setItem("pibox_cv_umbrales", JSON.stringify(umbrales));
    setUmbMsg({ ok: true, txt: "✅ Umbrales guardados." });
    setTimeout(() => setUmbMsg(null), 4000);
  };
  const restoreUmbrales = () => {
    setUmbrales(UMBRALES_CV_DEFAULTS);
    localStorage.setItem("pibox_cv_umbrales", JSON.stringify(UMBRALES_CV_DEFAULTS));
    setUmbMsg({ ok: true, txt: "↩️ Umbrales restaurados por defecto." });
    setTimeout(() => setUmbMsg(null), 4000);
  };

  const LINEAS_UMBRAL = [
    { key: "mostrador", label: "Cruz Verde Mostrador" },
    { key: "integ_sd",  label: "Integración Same Day" },
    { key: "integ_nd",  label: "Integración Next Day" },
  ];

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400";
  const cardCls  = "bg-white rounded-2xl shadow-md border border-gray-100 p-5";
  const btnPrimary = { background: BRAND, color: "#fff" };

  return (
    <div className="space-y-6">

      {/* ── Sección 1: Directorio Cruz Verde ── */}
      <div className={cardCls}>
        <p className="text-sm font-bold text-gray-700 mb-4">📒 Directorio Cruz Verde</p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Botón subir — sólo si no hay directorio cargado, o siempre visible para reemplazar */}
          <label className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold shadow transition ${dirLoading ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"}`}
            style={btnPrimary}>
            {dirLoading ? "⏳ Procesando..." : directorio ? "📂 Reemplazar directorio" : "📂 Subir DIRECTORIO SAME DAY CV.xlsx"}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleDirectorioUpload} disabled={dirLoading} />
          </label>

          {/* Botón eliminar */}
          {directorio && (
            <button
              onClick={() => {
                localStorage.removeItem("pibox_cv_directorio");
                setDirectorio(null);
                setDirSearch("");
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 hover:border-red-300 transition">
              🗑 Eliminar directorio
            </button>
          )}

          {tiendas.length > 0 && (
            <span className="text-xs text-teal-700 font-semibold bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              {tiendas.length} tiendas cargadas
            </span>
          )}
          {directorio?.uploaded && (
            <span className="text-xs text-gray-400">
              Actualizado: {new Date(directorio.uploaded).toLocaleDateString("es-CO")}
            </span>
          )}
        </div>
        {dirUploadMsg && (
          <p className={`text-sm font-semibold mb-3 ${dirUploadMsg.ok ? "text-green-600" : "text-red-600"}`}>{dirUploadMsg.txt}</p>
        )}

        {directorio && (
          <>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Buscar por código o nombre de sucursal, ciudad, NIT, KAM..."
                value={dirSearch}
                onChange={e => setDirSearch(e.target.value)}
                className={`${inputCls} w-full pl-9`}
              />
              {dirSearch && (
                <button onClick={() => setDirSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              )}
            </div>
            {tiendas.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                ⚠️ No se encontraron tiendas en el directorio cargado. Usa <strong>Reemplazar directorio</strong> para subir el archivo nuevamente.
              </p>
            )}
            {dirSearch && tiendas.length > 0 && (
              <p className="text-xs text-gray-400 mb-2">
                {filteredTiendas.length} resultado{filteredTiendas.length !== 1 ? "s" : ""} de {tiendas.length}
              </p>
            )}
            {tiendas.length > 0 && (
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto rounded-lg border border-gray-100">
                <table className="text-xs border-collapse" style={{ minWidth: "1100px", width: "100%" }}>
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-teal-50 text-teal-700">
                      <th className="text-left p-2 font-semibold whitespace-nowrap">Cod. Suc</th>
                      <th className="text-left p-2 font-semibold whitespace-nowrap">Nombre Sucursal</th>
                      <th className="text-left p-2 font-semibold whitespace-nowrap">Departamento</th>
                      <th className="text-left p-2 font-semibold whitespace-nowrap">Ciudad</th>
                      <th className="text-left p-2 font-semibold">Dirección</th>
                      <th className="text-left p-2 font-semibold whitespace-nowrap">Correo</th>
                      <th className="text-left p-2 font-semibold whitespace-nowrap">Celular</th>
                      <th className="text-left p-2 font-semibold whitespace-nowrap">L-V</th>
                      <th className="text-left p-2 font-semibold whitespace-nowrap">Sáb</th>
                      <th className="text-left p-2 font-semibold whitespace-nowrap">Dom</th>
                      <th className="text-left p-2 font-semibold whitespace-nowrap">Fest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTiendas.slice(0, 300).map((t, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="p-2 font-bold text-teal-700 whitespace-nowrap">{t.codigo}</td>
                        <td className="p-2 font-medium text-gray-800 whitespace-nowrap">{t.nombre}</td>
                        <td className="p-2 text-gray-600 whitespace-nowrap">{t.departamento}</td>
                        <td className="p-2 text-gray-600 whitespace-nowrap">{t.ciudad}</td>
                        <td className="p-2 text-gray-500">{t.direccion}</td>
                        <td className="p-2 text-gray-500 whitespace-nowrap">{t.correo}</td>
                        <td className="p-2 text-gray-500 whitespace-nowrap">{t.celular}</td>
                        <td className="p-2 text-gray-500 whitespace-nowrap">{t.lv_apertura && t.lv_cierre ? `${t.lv_apertura} – ${t.lv_cierre}` : "—"}</td>
                        <td className="p-2 text-gray-500 whitespace-nowrap">{t.sab_apertura && t.sab_cierre ? `${t.sab_apertura} – ${t.sab_cierre}` : "—"}</td>
                        <td className="p-2 text-gray-500 whitespace-nowrap">{t.dom_apertura && t.dom_cierre ? `${t.dom_apertura} – ${t.dom_cierre}` : "—"}</td>
                        <td className="p-2 text-gray-500 whitespace-nowrap">{t.fest_apertura && t.fest_cierre ? `${t.fest_apertura} – ${t.fest_cierre}` : "—"}</td>
                      </tr>
                    ))}
                    {filteredTiendas.length > 300 && (
                      <tr><td colSpan={11} className="p-2 text-center text-gray-400 text-xs">
                        Mostrando 300 de {filteredTiendas.length}. Refina la búsqueda para ver menos resultados.
                      </td></tr>
                    )}
                    {filteredTiendas.length === 0 && dirSearch && (
                      <tr><td colSpan={11} className="p-3 text-center text-gray-400">Sin resultados para "{dirSearch}"</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Sección 2: Horarios Tiendas Same Day ── */}
      <div className={cardCls}>
        <p className="text-sm font-bold text-gray-700 mb-1">🕐 Horarios Same Day — DIRECCION TRUMP</p>
        <p className="text-xs text-gray-400 mb-4">
          Ajusta el inicio del tiempo perfecto según la apertura de cada tienda. La clave de cruce es la columna <strong>DIRECCION TRUMP</strong>.
        </p>

        {/* Botones de acción */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold shadow transition ${sdLoading ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"}`}
            style={btnPrimary}>
            {sdLoading ? "⏳ Procesando..." : horariosSd ? "📂 Reemplazar horarios" : "📂 Subir DIRECTORIO SAME DAY CV.xlsx"}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleHorariosSdUpload} disabled={sdLoading} />
          </label>
          {horariosSd && (
            <button onClick={() => {
              localStorage.removeItem(SK_HORARIOS_SD);
              setHorariosSd(null);
              setHorariosMap({});
              setSdSearch("");
            }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 transition">
              🗑 Eliminar horarios
            </button>
          )}
          {horarios.length > 0 && (
            <span className="text-xs text-teal-700 font-semibold bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              {horarios.length} tiendas
            </span>
          )}
          {horariosSd?.uploaded && (
            <span className="text-xs text-gray-400">
              Actualizado: {new Date(horariosSd.uploaded).toLocaleDateString("es-CO")}
            </span>
          )}
        </div>
        {sdMsg && <p className={`text-sm font-semibold mb-3 ${sdMsg.ok ? "text-green-600" : "text-red-600"}`}>{sdMsg.txt}</p>}

        {/* Panel de alertas: direcciones faltantes */}
        {direccionesFaltantes.length > 0 && (
          <div className="mb-4 border border-amber-200 bg-amber-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <p className="text-xs font-bold text-amber-700">
                ⚠️ {direccionesFaltantes.length} direccion{direccionesFaltantes.length !== 1 ? "es" : ""} en datos Same Day sin horario registrado
              </p>
              <button
                onClick={() => {
                  const headers = ["Booking", "Ciudad", "Dirección", "Fecha", "Estado"];
                  const csvRows = rowsSinHorario.map(r => [
                    r.idServicio || r.uuid || "",
                    r.ciudad || "",
                    r.direccionOrigen || "",
                    r.fecha || "",
                    r.estado || "",
                  ]);
                  const escape = v => `"${String(v).replace(/"/g, '""')}"`;
                  const csv = [headers, ...csvRows].map(row => row.map(escape).join(",")).join("\n");
                  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "tiendas-sin-horario.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
                style={{ background: C_AMB }}
              >
                ⬇ Descargar servicios ({rowsSinHorario.length})
              </button>
            </div>
            <p className="text-xs text-amber-600 mb-2">
              Estas tiendas aparecen en los servicios pero no están en el directorio de horarios. Actualiza el archivo para incluirlas y que el tiempo perfecto se calcule correctamente.
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {direccionesFaltantes.map((d, i) => (
                <p key={i} className="text-xs text-amber-800 bg-amber-100 rounded px-2 py-1 font-mono">{d}</p>
              ))}
            </div>
          </div>
        )}
        {horarios.length > 0 && rows?.length > 0 && direccionesFaltantes.length === 0 && (
          <div className="mb-4 border border-green-200 bg-green-50 rounded-xl px-4 py-2">
            <p className="text-xs font-semibold text-green-700">✅ Todas las tiendas Same Day tienen horario registrado.</p>
          </div>
        )}

        {/* Tabla de horarios */}
        {horarios.length > 0 && (
          <>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input type="text" value={sdSearch} onChange={e => setSdSearch(e.target.value)}
                placeholder="Buscar por dirección, nombre o sucursal..."
                className={`${inputCls} w-full pl-9`} />
              {sdSearch && <button onClick={() => setSdSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">×</button>}
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-gray-100">
              <table className="text-xs border-collapse" style={{ minWidth: "900px", width: "100%" }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-teal-50 text-teal-700">
                    <th className="text-left p-2 font-semibold whitespace-nowrap">Suc.</th>
                    <th className="text-left p-2 font-semibold whitespace-nowrap">Nombre</th>
                    <th className="text-left p-2 font-semibold">DIRECCION TRUMP</th>
                    <th className="text-center p-2 font-semibold whitespace-nowrap">L-V</th>
                    <th className="text-center p-2 font-semibold whitespace-nowrap">Sáb</th>
                    <th className="text-center p-2 font-semibold whitespace-nowrap">Dom</th>
                    <th className="text-center p-2 font-semibold whitespace-nowrap">Fest</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHorarios.slice(0, 200).map((h, i) => {
                    const faltante = !horariosKeys.has(normalizeDireccion(h.direccion));
                    return (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="p-2 font-bold text-teal-700 whitespace-nowrap">{h.sucursal}</td>
                        <td className="p-2 text-gray-700 whitespace-nowrap">{h.nombre}</td>
                        <td className="p-2 text-gray-500 text-[11px]">{h.direccion}</td>
                        <td className="p-2 text-center text-gray-600 whitespace-nowrap text-[11px]">
                          {minutesToHHMM(excelTimeToMinutes(h.lv_apertura))}–{minutesToHHMM(excelTimeToMinutes(h.lv_cierre))}
                        </td>
                        <td className="p-2 text-center text-gray-600 whitespace-nowrap text-[11px]">
                          {minutesToHHMM(excelTimeToMinutes(h.sab_apertura))}–{minutesToHHMM(excelTimeToMinutes(h.sab_cierre))}
                        </td>
                        <td className="p-2 text-center text-gray-600 whitespace-nowrap text-[11px]">
                          {minutesToHHMM(excelTimeToMinutes(h.dom_apertura))}–{minutesToHHMM(excelTimeToMinutes(h.dom_cierre))}
                        </td>
                        <td className="p-2 text-center text-gray-600 whitespace-nowrap text-[11px]">
                          {minutesToHHMM(excelTimeToMinutes(h.fest_apertura))}–{minutesToHHMM(excelTimeToMinutes(h.fest_cierre))}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredHorarios.length === 0 && sdSearch && (
                    <tr><td colSpan={7} className="p-3 text-center text-gray-400">Sin resultados para "{sdSearch}"</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Sección 3: Configuración SLA ── */}
      <div className={cardCls}>
        <p className="text-sm font-bold text-gray-700 mb-4">⚙️ Configuración SLA</p>

        {/* Same Day ranges */}
        <p className="text-xs font-semibold text-gray-600 mb-2">Same Day — Rangos por distancia</p>
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-teal-50 text-teal-700">
                <th className="text-left p-2 font-semibold">Rango</th>
                <th className="text-right p-2 font-semibold">Tiempo perfecto (min)</th>
              </tr>
            </thead>
            <tbody>
              {localSla.ranges.map((rng, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="p-2 text-gray-700 font-medium">{rng.label}</td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={rng.min}
                      onChange={e => handleSlaRangeChange(i, e.target.value)}
                      className={`${inputCls} w-24 text-right`}
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-100 border-t border-gray-300">
                <td className="p-2 text-gray-500 font-medium italic">Superior a 17 km</td>
                <td className="p-2 text-right">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-500 tracking-wide">N.A — No Aplica</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Next Day hora límite */}
        <div className="flex items-center gap-3 mb-5">
          <label className="text-xs font-semibold text-gray-600">Next Day — Hora límite de entrega (antes de las XX:00)</label>
          <input
            type="number"
            min={1}
            max={23}
            value={localSla.nextDayHora}
            onChange={e => handleSlaNextDay(e.target.value)}
            className={`${inputCls} w-20 text-center`}
          />
          <span className="text-xs text-gray-500">:00</span>
        </div>

        {slaMsg && <p className={`text-sm font-semibold mb-3 ${slaMsg.ok ? "text-green-600" : "text-red-600"}`}>{slaMsg.txt}</p>}

        <div className="flex gap-2">
          <button onClick={saveSla}
            className="px-5 py-2 rounded-xl text-white text-sm font-bold shadow hover:opacity-90 transition"
            style={btnPrimary}>
            Guardar SLA
          </button>
          <button onClick={restoreSla}
            className="px-5 py-2 rounded-xl text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
            Restaurar valores
          </button>
        </div>
      </div>

      {/* ── Sección 4: Umbrales de riesgo ── */}
      <div className={cardCls}>
        <p className="text-sm font-bold text-gray-700 mb-4">🚦 Umbrales de Riesgo</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {LINEAS_UMBRAL.map(({ key, label }) => {
            const u = umbrales[key] || {};
            return (
              <div key={key} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-bold text-teal-700 mb-3">{label}</p>

                {/* % SLA cumplido */}
                <p className="text-xs font-semibold text-gray-600 mb-2">% SLA cumplido</p>
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-5">🔴</span>
                    <span className="text-xs text-gray-500 w-16">Rojo si &lt;</span>
                    <input type="number" min={0} max={100} value={u.sla_rojo ?? 85}
                      onChange={e => handleUmbral(key, "sla_rojo", e.target.value)}
                      className={`${inputCls} w-16 text-center`} />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-5">🟡</span>
                    <span className="text-xs text-gray-500 w-16">Amar. si &lt;</span>
                    <input type="number" min={0} max={100} value={u.sla_amarillo ?? 92}
                      onChange={e => handleUmbral(key, "sla_amarillo", e.target.value)}
                      className={`${inputCls} w-16 text-center`} />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                </div>

                {/* % No perfectos */}
                <p className="text-xs font-semibold text-gray-600 mb-2">% No perfectos</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-5">🔴</span>
                    <span className="text-xs text-gray-500 w-16">Rojo si &gt;</span>
                    <input type="number" min={0} max={100} value={u.noPerf_rojo ?? 15}
                      onChange={e => handleUmbral(key, "noPerf_rojo", e.target.value)}
                      className={`${inputCls} w-16 text-center`} />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-5">🟡</span>
                    <span className="text-xs text-gray-500 w-16">Amar. si &gt;</span>
                    <input type="number" min={0} max={100} value={u.noPerf_amarillo ?? 8}
                      onChange={e => handleUmbral(key, "noPerf_amarillo", e.target.value)}
                      className={`${inputCls} w-16 text-center`} />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {umbMsg && <p className={`text-sm font-semibold mb-3 ${umbMsg.ok ? "text-green-600" : "text-red-600"}`}>{umbMsg.txt}</p>}

        <div className="flex gap-2">
          <button onClick={saveUmbrales}
            className="px-5 py-2 rounded-xl text-white text-sm font-bold shadow hover:opacity-90 transition"
            style={btnPrimary}>
            Guardar Umbrales
          </button>
          <button onClick={restoreUmbrales}
            className="px-5 py-2 rounded-xl text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
            Restaurar valores
          </button>
        </div>
      </div>

    </div>
  );
}

// ── Panel Pilotos Cruz Verde ────────────────────────────────────────────────
function PilotosPanel({ rows, prevRows, prevMesLabel }) {
  const LINEAS = [
    { key: "mostrador", label: "Cruz Verde Mostrador", icon: "🏪", color: C_TEAL    },
    { key: "integ_sd",  label: "Integración Same Day",  icon: "⚡", color: C_CYAN    },
    { key: "integ_nd",  label: "Integración Next Day",  icon: "🌙", color: "#6366F1" },
  ];
  const [lineaSel, setLineaSel] = useState("mostrador");

  const linea        = LINEAS.find(l => l.key === lineaSel);
  const lineRows     = rows.filter(r => r.linea === lineaSel);
  const prevLineRows = (prevRows || []).filter(r => r.linea === lineaSel);

  // Clave del piloto: id_piloto si existe, sino nombre_piloto
  const pilotoKey = (r) => r.idPiloto || r.nombrePiloto || "";
  const hasPilotData = lineRows.some(r => pilotoKey(r));

  // Agrupar por piloto
  const groupBy = (rws) => {
    const m = {};
    rws.forEach(r => {
      const k = pilotoKey(r);
      if (!k) return;
      if (!m[k]) m[k] = { id: r.idPiloto || k, nombre: r.nombrePiloto || k, ciudad: r.ciudad || "—", servicios: [] };
      m[k].servicios.push(r);
    });
    return m;
  };
  const pilotoMap     = groupBy(lineRows);
  const prevPilotoMap = groupBy(prevLineRows);

  const toStats = ({ id, nombre, ciudad, servicios }) => ({
    id, nombre, ciudad,
    total:      servicios.length,
    entregados: servicios.filter(r => r.esPerfecto && !r.fueraHorario).length,
    cancelados: servicios.filter(r => !r.esPerfecto).length,
    slaMet:     servicios.filter(r => r.slaCumplido === true).length,
    slaDef:     servicios.filter(r => r.slaCumplido !== null).length,
    gmv:        servicios.reduce((s, r) => s + (r.costo || 0), 0),
  });

  const pilotos     = Object.values(pilotoMap).map(toStats).sort((a,b) => b.total - a.total);
  const prevPilotos = Object.values(prevPilotoMap).map(toStats);
  const prevIds     = new Set(prevPilotos.map(p => p.id));
  const currIds     = new Set(pilotos.map(p => p.id));

  // Rotación
  const nuevos    = pilotos.filter(p => !prevIds.has(p.id));
  const retenidos = pilotos.filter(p => prevIds.has(p.id));
  const perdidos  = prevPilotos.filter(p => !currIds.has(p.id));
  const tasaRet   = prevPilotos.length > 0 ? retenidos.length / prevPilotos.length * 100 : null;

  // Distribución por actividad
  const RANGOS_ACT = [
    { label: "1–5",   min: 1,  max: 5,        color: "#7C3AED" },
    { label: "6–15",  min: 6,  max: 15,       color: "#8B5CF6" },
    { label: "16–30", min: 16, max: 30,       color: "#A78BFA" },
    { label: "31–60", min: 31, max: 60,       color: "#C4B5FD" },
    { label: "60+",   min: 61, max: Infinity, color: "#5B21B6" },
  ];
  const distActividad = RANGOS_ACT.map(r => ({
    ...r,
    count: pilotos.filter(p => p.total >= r.min && p.total <= r.max).length,
  }));

  // Por ciudad — contar pilotos únicos por ciudad
  const ciudadMap = {};
  lineRows.forEach(r => {
    const c = r.ciudad || "Sin ciudad";
    const k = pilotoKey(r); if (!k) return;
    if (!ciudadMap[c]) ciudadMap[c] = { pilotos: new Set(), total: 0, entregados: 0, cancelados: 0 };
    ciudadMap[c].pilotos.add(k);
    ciudadMap[c].total++;
    if (r.esPerfecto && !r.fueraHorario) ciudadMap[c].entregados++;
    if (!r.esPerfecto) ciudadMap[c].cancelados++;
  });
  const porCiudad = Object.entries(ciudadMap)
    .map(([ciudad, v]) => ({ ciudad, nPilotos: v.pilotos.size, total: v.total, entregados: v.entregados, cancelados: v.cancelados,
      pctEnt: pct(v.entregados, v.total), pctCanc: pct(v.cancelados, v.total) }))
    .sort((a, b) => b.nPilotos - a.nPilotos);

  // Top 5 nuevos y top 5 más activos
  const top5Nuevos   = [...nuevos].sort((a, b) => b.total - a.total).slice(0, 5);
  const top5Activos  = [...pilotos].slice(0, 5); // ya ordenado desc
  const hasPrev      = prevLineRows.length > 0;
  const hasSla       = lineRows.some(r => r.slaCumplido !== null);

  // Descarga informe completo (todos los pilotos de la línea)
  const descargarInforme = () => {
    const allLineas = [
      { key: "mostrador", label: "Mostrador" },
      { key: "integ_sd",  label: "Same Day"  },
      { key: "integ_nd",  label: "Next Day"  },
    ];
    const data = [];
    allLineas.forEach(({ key, label }) => {
      const lr = rows.filter(r => r.linea === key);
      const gm = groupBy(lr);
      Object.values(gm).map(toStats).sort((a,b) => b.total - a.total).forEach(p => {
        data.push({
          "Tipo de servicio": label,
          "Nombre piloto":    p.nombre,
          "ID piloto":        p.id,
          "Ciudad":           p.ciudad,
          "Total servicios":  p.total,
          "Entregados":       p.entregados,
          "% Entrega":        (pct(p.entregados, p.total) * 100).toFixed(1) + "%",
          "Cancelados/Exp.":  p.cancelados,
          "% Cancelados":     (pct(p.cancelados, p.total) * 100).toFixed(1) + "%",
          "SLA Cumplido":     p.slaDef > 0 ? p.slaMet : "—",
          "SLA Definido":     p.slaDef > 0 ? p.slaDef : "—",
          "% SLA":            p.slaDef > 0 ? (pct(p.slaMet, p.slaDef) * 100).toFixed(1) + "%" : "—",
          "¿Piloto nuevo?":   hasPrev ? (prevIds.has(p.id) ? "No" : "Sí") : "—",
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pilotos Cruz Verde");
    XLSX.writeFile(wb, "pilotos_cruz_verde.xlsx");
  };

  if (!lineRows.length) return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-3xl mb-2">📭</p>
      <p className="text-sm">Sin datos para {linea?.label} en el mes seleccionado.</p>
    </div>
  );

  if (!hasPilotData) return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {LINEAS.map(l => (
          <button key={l.key} onClick={() => setLineaSel(l.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition"
            style={lineaSel === l.key ? { background: l.color, color: "#fff", border: "none" } : { borderColor: "#e5e7eb", color: "#4b5563" }}>
            {l.icon} {l.label}
          </button>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <p className="text-2xl mb-2">⚠️</p>
        <p className="text-sm font-semibold text-amber-700">El archivo no contiene las columnas <code className="bg-amber-100 px-1 rounded">nombre_piloto</code> / <code className="bg-amber-100 px-1 rounded">id_piloto</code>.</p>
        <p className="text-xs text-amber-600 mt-1">Vuelve a subir el Excel con esas columnas para activar el análisis de pilotos.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Selector de línea */}
      <div className="flex gap-2 flex-wrap">
        {LINEAS.map(l => (
          <button key={l.key} onClick={() => setLineaSel(l.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition"
            style={lineaSel === l.key ? { background: l.color, color: "#fff", border: "none" } : { borderColor: "#e5e7eb", color: "#4b5563" }}>
            {l.icon} {l.label}
          </button>
        ))}
      </div>

      {/* KPIs globales */}
      <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${linea.color} 0%, ${linea.color}CC 100%)` }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold">🚴 Análisis de Pilotos — {linea.label}{prevMesLabel ? ` · vs ${prevMesLabel}` : ""}</p>
          <button onClick={descargarInforme}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
            ⬇️ Descargar informe completo
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { l: "Pilotos activos", v: pilotos.length,                                                                              i: "👤" },
            { l: "Servicios",       v: fmtNum(lineRows.length),                                                                     i: "📋" },
            { l: "Prom. serv/piloto", v: pilotos.length > 0 ? (lineRows.length / pilotos.length).toFixed(1) : "—",                  i: "📊" },
            { l: "% Entregados",    v: fmtPct(pct(lineRows.filter(r=>r.esPerfecto&&!r.fueraHorario).length, lineRows.length)),      i: "✅" },
            { l: "Pilotos nuevos",  v: hasPrev ? nuevos.length : "—",                                                               i: "🆕" },
            { l: "Retención",       v: tasaRet != null ? `${tasaRet.toFixed(0)}%` : "—",                                            i: "🔄" },
          ].map((k, i) => (
            <div key={i} className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-lg mb-0.5">{k.i}</p>
              <p className="text-xl font-extrabold">{k.v}</p>
              <p className="text-[10px] opacity-80 mt-0.5">{k.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rotación */}
      {hasPrev ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-bold text-gray-700 mb-4">🔄 Rotación de Pilotos — vs {prevMesLabel}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Mes anterior", val: prevPilotos.length, bg: "bg-gray-50",  color: C_GRAY    },
              { label: "Retenidos",    val: retenidos.length,   bg: "bg-green-50", color: C_GRN     },
              { label: "Perdidos",     val: perdidos.length,    bg: "bg-red-50",   color: C_RED     },
              { label: "Nuevos",       val: nuevos.length,      bg: "bg-blue-50",  color: "#3B82F6" },
            ].map(({ label, val, bg, color }) => (
              <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
                <p className="text-2xl font-extrabold" style={{ color }}>{val}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
          {prevPilotos.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-500" style={{ width: `${tasaRet}%` }} />
                <div className="h-full bg-red-400"   style={{ width: `${100 - tasaRet}%` }} />
              </div>
              <span className="text-xs font-bold text-green-600 whitespace-nowrap">{tasaRet.toFixed(0)}% retención</span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400">Sube el archivo del mes anterior para ver rotación de pilotos.</p>
        </div>
      )}

      {/* Distribución por actividad */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-sm font-bold text-gray-700 mb-4">📊 Distribución de Pilotos Nuevos por Actividad</p>
        <div className="grid grid-cols-5 gap-3">
          {distActividad.map(r => {
            const p2 = pilotos.length > 0 ? (r.count / pilotos.length * 100) : 0;
            return (
              <div key={r.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-2xl font-extrabold" style={{ color: r.color }}>{r.count}</p>
                <p className="text-xs font-semibold text-gray-600 mt-1">{r.label} serv</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="h-2 rounded-full" style={{ width: `${Math.max(p2, 3)}%`, background: r.color }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{p2.toFixed(0)}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pilotos nuevos por ciudad */}
      {porCiudad.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-bold text-gray-700 mb-4">🏙️ Pilotos por Ciudad</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white" style={{ background: linea.color }}>
                  {["Ciudad", "Pilotos", "Servicios", "Prom/piloto", "% Entregados", "% Canc./Exp."].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porCiudad.map((c, i) => (
                  <tr key={c.ciudad} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-3 py-2 font-semibold text-gray-800">{c.ciudad}</td>
                    <td className="px-3 py-2 text-center font-bold" style={{ color: linea.color }}>{c.nPilotos}</td>
                    <td className="px-3 py-2 text-center">{fmtNum(c.total)}</td>
                    <td className="px-3 py-2 text-center">{c.nPilotos > 0 ? (c.total / c.nPilotos).toFixed(1) : "—"}</td>
                    <td className="px-3 py-2 text-center font-semibold" style={{ color: c.pctEnt >= 0.95 ? C_GRN : c.pctEnt >= 0.85 ? C_AMB : C_RED }}>
                      {fmtPct(c.pctEnt)}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold" style={{ color: c.pctCanc > 0.15 ? C_RED : c.pctCanc > 0.08 ? C_AMB : C_GRN }}>
                      {fmtPct(c.pctCanc)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top 5 más activos por tipo de servicio */}
      {(() => {
        const SECCIONES = [
          { key: "mostrador", label: "Cruz Verde Mostrador", icon: "🏪", color: C_TEAL    },
          { key: "integ_sd",  label: "Same Day",             icon: "⚡", color: C_CYAN    },
          { key: "integ_nd",  label: "Next Day",             icon: "🌙", color: "#6366F1" },
        ];
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm font-bold text-gray-700 mb-4">🏆 Top 5 Pilotos — {linea.label}</p>
            {(() => {
              const sec = SECCIONES.find(s => s.key === lineaSel);
              if (!sec) return null;
              const { label, icon, color } = sec;
              const lr  = rows.filter(r => r.linea === lineaSel);
              const gm  = groupBy(lr);
              const top = Object.values(gm).map(toStats).sort((a,b) => b.total - a.total).slice(0, 5);
              if (!top.length) return <p className="text-xs text-gray-400">Sin datos de pilotos para esta línea.</p>;
              return (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span>{icon}</span>
                    <p className="text-xs font-bold text-gray-700">{label}</p>
                  </div>
                  <div className="space-y-2">
                    {top.map((p, i) => {
                      const entPct = pct(p.entregados, p.total);
                      const slaPct = p.slaDef > 0 ? pct(p.slaMet, p.slaDef) : null;
                      const medal  = ["🥇","🥈","🥉","4️⃣","5️⃣"][i];
                      return (
                        <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                          <span className="text-lg w-7 text-center flex-shrink-0">{medal}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{p.nombre || p.id}</p>
                            <p className="text-[11px] text-gray-400">{p.ciudad} · ID: {p.id}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-extrabold" style={{ color }}>{fmtNum(p.total)} serv</p>
                            <p className="text-[11px] font-semibold" style={{ color: entPct >= 0.9 ? C_GRN : C_AMB }}>
                              {fmtPct(entPct)} entregados
                            </p>
                          </div>
                          {hasSla && slaPct !== null && (
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="text-[10px] text-gray-400">SLA</p>
                              <p className="text-xs font-bold" style={{ color: slaPct >= 0.9 ? C_GRN : C_RED }}>
                                {fmtPct(slaPct)}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Top 5 pilotos nuevos */}
      {hasPrev && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-bold text-gray-700 mb-4">🆕 Top 5 Pilotos Nuevos</p>
          {top5Nuevos.length > 0 ? (
            <div className="space-y-2">
              {top5Nuevos.map((p, i) => {
                const entPct = pct(p.entregados, p.total);
                const COLORS = ["#5B21B6","#7C3AED","#8B5CF6","#A78BFA","#C4B5FD"];
                return (
                  <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <span className="text-sm font-extrabold w-6 text-center" style={{ color: COLORS[i] }}>{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{p.nombre || p.id}</p>
                      <p className="text-[10px] text-gray-400">{p.ciudad} · ID: {p.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold" style={{ color: linea.color }}>{fmtNum(p.total)} serv</p>
                      <p className="text-[10px] font-semibold" style={{ color: entPct >= 0.9 ? C_GRN : C_AMB }}>
                        {fmtPct(entPct)} entregados
                      </p>
                    </div>
                    {hasSla && p.slaDef > 0 && (
                      <div className="text-right ml-2">
                        <p className="text-[10px] text-gray-400">SLA</p>
                        <p className="text-xs font-bold" style={{ color: pct(p.slaMet,p.slaDef) >= 0.9 ? C_GRN : C_RED }}>
                          {fmtPct(pct(p.slaMet,p.slaDef))}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-center text-blue-600 bg-blue-50 rounded-xl p-4 font-semibold">
              Sin pilotos nuevos — todos los pilotos activos ya estaban en {prevMesLabel}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Productividad Pilotos Integración ──────────────────────────────────────
function ProductividadPilotosPanel({ rows }) {
  const integRows = useMemo(
    () => rows.filter(r => r.linea === "integ_sd" || r.linea === "integ_nd"),
    [rows]
  );

  const ciudades = useMemo(
    () => [...new Set(integRows.map(r => r.ciudad).filter(Boolean))].sort(),
    [integRows]
  );

  const [filtPiloto,    setFiltPiloto]    = useState("");
  const [filtCiudad,    setFiltCiudad]    = useState("todas");
  const [filtDireccion, setFiltDireccion] = useState("");

  const filteredBase = useMemo(() => {
    let r = integRows;
    if (filtPiloto.trim())    r = r.filter(row => (row.nombrePiloto  || "").toLowerCase().includes(filtPiloto.trim().toLowerCase()));
    if (filtCiudad !== "todas") r = r.filter(row => row.ciudad === filtCiudad);
    if (filtDireccion.trim()) r = r.filter(row => (row.direccionOrigen || "").toLowerCase().includes(filtDireccion.trim().toLowerCase()));
    return r;
  }, [integRows, filtPiloto, filtCiudad, filtDireccion]);

  const dailyData = useMemo(() => {
    const map = {};
    for (const r of filteredBase) {
      if (!r.nombrePiloto || !r.fecha) continue;
      const key = `${r.nombrePiloto}||${r.fecha}||${r.ciudad || ""}`;
      if (!map[key]) map[key] = {
        piloto: r.nombrePiloto, fecha: r.fecha, ciudad: r.ciudad || "—",
        serviciosSet: new Set(), paquetes: 0,
        slaMet: 0, slaDef: 0, entregados: 0, total: 0,
        kmSum: 0, kmCount: 0,
        minHora: Infinity, maxHora: -Infinity,
      };
      const d = map[key];
      const bid = r.uuid || r.idServicio;
      if (bid) d.serviciosSet.add(bid);
      d.paquetes++;
      d.total++;
      if (r.esPerfecto && !r.fueraHorario) d.entregados++;
      if (r.slaCumplido === true)  d.slaMet++;
      if (r.slaCumplido !== null)  d.slaDef++;
      if (r.km > 0) { d.kmSum += r.km; d.kmCount++; }
      if (r.horaAsignado != null) { d.minHora = Math.min(d.minHora, r.horaAsignado); d.maxHora = Math.max(d.maxHora, r.horaAsignado); }
      if (r.horaEntrega  != null) d.maxHora = Math.max(d.maxHora, r.horaEntrega);
    }
    return Object.values(map).map(d => {
      const svs = d.serviciosSet.size;
      const horasOp = (d.minHora < Infinity && d.maxHora > -Infinity && d.maxHora > d.minHora)
        ? (d.maxHora - d.minHora) / 60 : null;
      return {
        piloto:        d.piloto,
        fecha:         d.fecha,
        ciudad:        d.ciudad,
        servicios:     svs,
        paquetes:      d.paquetes,
        bookings:      [...d.serviciosSet].join(";"),
        slaMet:        d.slaMet,  slaDef:    d.slaDef,
        entregados:    d.entregados, total:   d.total,
        slaPct:        d.slaDef  > 0 ? d.slaMet    / d.slaDef  : null,
        entregaPct:    d.total   > 0 ? d.entregados / d.total  : null,
        kmPromedio:    d.kmCount > 0 ? d.kmSum      / d.kmCount : null,
        horasOp,
        svPorHora:     horasOp != null && horasOp > 0 ? svs / horasOp : null,
      };
    }).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.piloto.localeCompare(b.piloto));
  }, [filteredBase]);

  const weeklyData = useMemo(() => {
    const getMondayStr = (dateStr) => {
      const d = new Date(dateStr + "T12:00:00");
      const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    };
    const map = {};
    for (const d of dailyData) {
      const monday = getMondayStr(d.fecha);
      const key = `${d.piloto}||${monday}`;
      if (!map[key]) map[key] = {
        piloto: d.piloto, semana: monday, dias: 0,
        servicios: 0, paquetes: 0,
        slaMet: 0, slaDef: 0, entregados: 0, total: 0,
        kmWSum: 0, kmWCount: 0,
        horasOpSum: 0, horasOpCount: 0,
      };
      const w = map[key];
      w.dias++;
      w.servicios  += d.servicios;
      w.paquetes   += d.paquetes;
      w.slaMet     += d.slaMet;
      w.slaDef     += d.slaDef;
      w.entregados += d.entregados;
      w.total      += d.total;
      if (d.kmPromedio != null && d.servicios > 0) {
        w.kmWSum   += d.kmPromedio * d.servicios;
        w.kmWCount += d.servicios;
      }
      if (d.horasOp != null) { w.horasOpSum += d.horasOp; w.horasOpCount++; }
    }
    return Object.values(map).map(w => ({
      piloto:      w.piloto,
      semana:      w.semana,
      dias:        w.dias,
      servicios:   w.servicios,
      paquetes:    w.paquetes,
      slaPct:      w.slaDef      > 0 ? w.slaMet    / w.slaDef      : null,
      entregaPct:  w.total       > 0 ? w.entregados / w.total       : null,
      kmPromedio:  w.kmWCount    > 0 ? w.kmWSum     / w.kmWCount    : null,
      svPorHora:   w.horasOpCount > 0 ? w.servicios / w.horasOpSum  : null,
    })).sort((a, b) => a.semana.localeCompare(b.semana) || a.piloto.localeCompare(b.piloto));
  }, [dailyData]);

  const DAY_LABELS = { 1:"Lunes", 2:"Martes", 3:"Miércoles", 4:"Jueves", 5:"Viernes", 6:"Sábado", 0:"Domingo" };
  const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];
  // Bucket 0 = "00:00" agrupa madrugada (horas 0-5); luego 06:00–23:00 individualmente
  const HOUR_BUCKETS = [
    { label: "00:00", hours: [0,1,2,3,4,5] },
    ...Array.from({ length: 18 }, (_, i) => ({ label: `${String(i+6).padStart(2,"0")}:00`, hours: [i+6] })),
  ];
  const hourToBucket = (h) => h <= 5 ? 0 : h - 5;

  const heatmapData = useMemo(() => {
    const countMap = {}; // { day: { bucketIdx: count } }
    for (const r of filteredBase) {
      if (r.horaAsignado == null) continue;
      const day = r.dayOfWeek ?? new Date((r.fecha || "") + "T12:00:00").getDay();
      const bi  = hourToBucket(Math.floor(r.horaAsignado / 60));
      if (!countMap[day]) countMap[day] = {};
      countMap[day][bi] = (countMap[day][bi] || 0) + 1;
    }
    const days   = DAYS_ORDER.filter(d => countMap[d]);
    const maxVal = Math.max(1, ...days.flatMap(d => HOUR_BUCKETS.map((_, i) => countMap[d]?.[i] ?? 0)));
    return { countMap, days, maxVal };
  }, [filteredBase]);

  const purpleHeat = (val, max) => {
    if (!val) return null;
    const t = Math.min(val / max, 1);
    const r = Math.round(237 + (76  - 237) * t);
    const g = Math.round(233 + (29  - 233) * t);
    const b = Math.round(254 + (149 - 254) * t);
    return `rgb(${r},${g},${b})`;
  };
  const heatTextColor = (val, max) =>
    (val && val / max > 0.45) ? "#fff" : "#4c1d95";

  const descargarHeatmap = () => {
    const esc = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
    const headers = ["Booking ID","Piloto","Fecha","Día","Hora","Ciudad","Estado"];
    const csvRows = filteredBase
      .filter(r => r.horaAsignado != null)
      .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || (a.horaAsignado ?? 0) - (b.horaAsignado ?? 0))
      .map(r => {
        const h = Math.floor(r.horaAsignado / 60);
        const m = r.horaAsignado % 60;
        const horaStr = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
        const dia = DAY_LABELS[r.dayOfWeek ?? new Date((r.fecha || "") + "T12:00:00").getDay()] || "";
        return [r.idServicio || r.uuid || "", r.nombrePiloto || "", r.fecha || "", dia, horaStr, r.ciudad || "", r.estado || ""];
      });
    const csv = [headers, ...csvRows].map(row => row.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "servicios-dia-hora-detalle.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const fmtSemana = (mondayStr) => {
    const d = new Date(mondayStr + "T12:00:00");
    const sun = new Date(d); sun.setDate(d.getDate() + 6);
    const fmt = (dt) => `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}`;
    return `${fmt(d)} – ${fmt(sun)}`;
  };

  const colorPct = (v) => v == null ? "#9ca3af" : v >= 0.95 ? C_GRN : v >= 0.85 ? C_AMB : C_RED;
  const fmtPctVal = (v) => v != null ? (v * 100).toFixed(1) + "%" : "—";
  const fmtKmVal  = (v) => v != null ? v.toFixed(1) + " km" : "—";

  const descargarDiario = () => {
    const headers = ["Piloto","Fecha","Ciudad","Servicios","Paquetes","% SLA","% Efectividad","Km Prom.","Bookings"];
    const csvRows = dailyData.map(d => [
      d.piloto, d.fecha, d.ciudad,
      d.servicios, d.paquetes,
      d.slaPct     != null ? (d.slaPct     * 100).toFixed(1) + "%" : "N/A",
      d.entregaPct != null ? (d.entregaPct * 100).toFixed(1) + "%" : "N/A",
      d.kmPromedio != null ? d.kmPromedio.toFixed(2) : "N/A",
      d.bookings || "",
    ]);
    const esc = v => `"${String(v).replace(/"/g,'""')}"`;
    const csv = [headers, ...csvRows].map(row => row.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "productividad-pilotos-integracion.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const thCls = "p-2 text-left font-semibold text-xs whitespace-nowrap";
  const tdCls = "p-2 text-xs";
  const anyFilter = filtPiloto || filtCiudad !== "todas" || filtDireccion;

  return (
    <div className="space-y-6">

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <p className="text-sm font-bold text-gray-700 mb-4">🔍 Filtros</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre de piloto</label>
            <input
              type="text" value={filtPiloto}
              onChange={e => setFiltPiloto(e.target.value)}
              placeholder="Buscar piloto..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ciudad</label>
            <select
              value={filtCiudad}
              onChange={e => setFiltCiudad(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
            >
              <option value="todas">Todas</option>
              {ciudades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Dirección origen</label>
            <input
              type="text" value={filtDireccion}
              onChange={e => setFiltDireccion(e.target.value)}
              placeholder="Buscar dirección..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
        </div>
        {anyFilter && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-teal-700 font-semibold">
              {filteredBase.length.toLocaleString()} servicios filtrados
            </span>
            <button
              onClick={() => { setFiltPiloto(""); setFiltCiudad("todas"); setFiltDireccion(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >Limpiar filtros</button>
          </div>
        )}
      </div>

      {/* Heatmap día/hora */}
      {heatmapData.days.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-sm font-bold text-gray-700">📊 Servicios asignados por día y hora</p>
            <button
              onClick={descargarHeatmap}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "#7c3aed" }}
            >
              ↓ Descargar detalle
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs" style={{ minWidth: "700px", width: "100%" }}>
              <thead>
                <tr>
                  <th className="p-2 text-left font-semibold text-gray-500 whitespace-nowrap w-[110px]">Día / Hora</th>
                  {HOUR_BUCKETS.map((b, i) => (
                    <th key={i} className="p-1 text-center font-semibold text-gray-400 whitespace-nowrap">
                      {b.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.days.map(day => (
                  <tr key={day}>
                    <td className="p-2 font-semibold text-gray-700 whitespace-nowrap">{DAY_LABELS[day]}</td>
                    {HOUR_BUCKETS.map((_, i) => {
                      const val = heatmapData.countMap[day]?.[i] ?? 0;
                      const bg  = purpleHeat(val, heatmapData.maxVal);
                      return (
                        <td key={i} className="p-1 text-center">
                          {val > 0 ? (
                            <span
                              className="inline-flex items-center justify-center rounded-lg font-semibold"
                              style={{
                                background: bg,
                                color: heatTextColor(val, heatmapData.maxVal),
                                minWidth: "36px", height: "28px", fontSize: "11px", padding: "0 4px",
                              }}
                            >
                              {val}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla diaria */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p className="text-sm font-bold text-gray-700">📅 Productividad diaria por piloto</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {dailyData.length} registros · Same Day + Next Day integración
            </p>
          </div>
          <button
            onClick={descargarDiario}
            disabled={!dailyData.length}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: C_TEAL }}
          >
            ⬇ Descargar CSV
          </button>
        </div>
        {dailyData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin datos para los filtros seleccionados.</p>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-lg border border-gray-100">
            <table className="border-collapse" style={{ minWidth: "860px", width: "100%" }}>
              <thead className="sticky top-0 z-10 bg-teal-50 text-teal-700">
                <tr>
                  <th className={thCls}>Piloto</th>
                  <th className={thCls}>Fecha</th>
                  <th className={thCls}>Ciudad</th>
                  <th className={`${thCls} text-right`}>Servicios</th>
                  <th className={`${thCls} text-right`}>Paquetes</th>
                  <th className={`${thCls} text-right`}>% SLA</th>
                  <th className={`${thCls} text-right`}>% Efectividad</th>
                  <th className={`${thCls} text-right`}>Km prom.</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map((d, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={`${tdCls} font-medium text-gray-800 max-w-[200px] truncate`} title={d.piloto}>{d.piloto || "—"}</td>
                    <td className={`${tdCls} whitespace-nowrap text-gray-600`}>{d.fecha}</td>
                    <td className={`${tdCls} text-gray-600`}>{d.ciudad}</td>
                    <td className={`${tdCls} text-right font-bold`}>{d.servicios}</td>
                    <td className={`${tdCls} text-right text-gray-700`}>{d.paquetes}</td>
                    <td className={`${tdCls} text-right font-semibold`} style={{ color: colorPct(d.slaPct) }}>
                      {fmtPctVal(d.slaPct)}
                    </td>
                    <td className={`${tdCls} text-right font-semibold`} style={{ color: colorPct(d.entregaPct) }}>
                      {fmtPctVal(d.entregaPct)}
                    </td>
                    <td className={`${tdCls} text-right text-gray-600`}>{fmtKmVal(d.kmPromedio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabla semanal */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <div className="mb-4">
          <p className="text-sm font-bold text-gray-700">📆 Resumen semanal por piloto</p>
          <p className="text-xs text-gray-400 mt-0.5">Sumatoria de los registros diarios agrupados por semana</p>
        </div>
        {weeklyData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin datos para los filtros seleccionados.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="border-collapse w-full">
              <thead className="bg-teal-50 text-teal-700">
                <tr>
                  <th className={thCls}>Piloto</th>
                  <th className={thCls}>Semana</th>
                  <th className={`${thCls} text-center`}>Días op.</th>
                  <th className={`${thCls} text-right`}>Servicios</th>
                  <th className={`${thCls} text-right`}>Paquetes</th>
                  <th className={`${thCls} text-right`}>% SLA</th>
                  <th className={`${thCls} text-right`}>% Efectividad</th>
                  <th className={`${thCls} text-right`}>Km prom.</th>
                </tr>
              </thead>
              <tbody>
                {weeklyData.map((w, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={`${tdCls} font-medium text-gray-800 max-w-[200px] truncate`} title={w.piloto}>{w.piloto || "—"}</td>
                    <td className={`${tdCls} whitespace-nowrap font-semibold`} style={{ color: C_TEAL }}>{fmtSemana(w.semana)}</td>
                    <td className={`${tdCls} text-center text-gray-600`}>{w.dias}</td>
                    <td className={`${tdCls} text-right font-bold`}>{w.servicios}</td>
                    <td className={`${tdCls} text-right text-gray-700`}>{w.paquetes}</td>
                    <td className={`${tdCls} text-right font-semibold`} style={{ color: colorPct(w.slaPct) }}>
                      {fmtPctVal(w.slaPct)}
                    </td>
                    <td className={`${tdCls} text-right font-semibold`} style={{ color: colorPct(w.entregaPct) }}>
                      {fmtPctVal(w.entregaPct)}
                    </td>
                    <td className={`${tdCls} text-right text-gray-600`}>{fmtKmVal(w.kmPromedio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Buscador por ID de servicio o número de paquete ───────────────────────
function BuscadorServicio({ rows }) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState(null);

  const lineaLabel = { mostrador: "Mostrador", integ_sd: "Integ. Same Day", integ_nd: "Integ. Next Day" };

  // Rango de fechas de los datos cargados
  const fechasInfo = useMemo(() => {
    const fechas = rows.map(r => r.fecha).filter(Boolean).sort();
    if (!fechas.length) return null;
    return { desde: fechas[0], hasta: fechas[fechas.length - 1], total: rows.length };
  }, [rows]);

  function buscar(q) {
    const term = q.trim().toLowerCase();
    if (!term) { setResults(null); return; }
    const found = rows.filter(r =>
      (r.idServicio    && r.idServicio.toLowerCase().includes(term)) ||
      (r.idPaquete     && r.idPaquete.toLowerCase().includes(term))  ||
      (r.numeroPaquete && r.numeroPaquete.toLowerCase().includes(term)) ||
      (r.uuid          && r.uuid.toLowerCase().includes(term))
    ).slice(0, 15);
    setResults(found);
  }

  function slaLabel(row) {
    if (row.slaCumplido === true)  return { txt: "✅ Cumplido",     cls: "bg-green-100 text-green-700" };
    if (row.slaCumplido === false) return { txt: "❌ Incumplido",   cls: "bg-red-100 text-red-700"   };
    if (!row.esPerfecto)           return { txt: "⛔ No entregado", cls: "bg-amber-100 text-amber-700" };
    return                                { txt: "⚪ N.A",          cls: "bg-gray-100 text-gray-500"  };
  }

  function estadoColor(e) {
    const l = (e || "").toLowerCase();
    if (l.includes("finaliz") && !l.includes("fallid")) return "bg-green-100 text-green-700";
    if (l.includes("cancel"))  return "bg-amber-100 text-amber-700";
    if (l.includes("expir") || l.includes("fallid")) return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-500";
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-teal-100 p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-bold text-gray-700">🔎 Buscar servicio por ID o número de paquete</p>
        {fechasInfo && (
          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-0.5">
            {fechasInfo.total.toLocaleString()} servicios · {fechasInfo.desde} → {fechasInfo.hasta}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value.trim()) setResults(null); }}
          onKeyDown={e => e.key === "Enter" && buscar(query)}
          placeholder="Escribe el ID de servicio o número de paquete/orden..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <button
          onClick={() => buscar(query)}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-bold transition hover:opacity-90"
          style={{ background: C_TEAL }}>
          Buscar
        </button>
        {results !== null && (
          <button onClick={() => { setQuery(""); setResults(null); }}
            className="px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
            ✕
          </button>
        )}
      </div>

      {/* Sin resultados */}
      {results !== null && results.length === 0 && (
        <div className="mt-4 text-center py-4 space-y-1">
          <p className="text-sm text-gray-400">No se encontraron servicios con ese ID o número de paquete.</p>
          {fechasInfo && (
            <p className="text-xs text-gray-400">
              Los datos cargados cubren del <strong>{fechasInfo.desde}</strong> al <strong>{fechasInfo.hasta}</strong> ({fechasInfo.total.toLocaleString()} servicios).
              Si el servicio es de otra fecha, vuelve a consultar ClickHouse con el rango correcto.
            </p>
          )}
          {!fechasInfo && (
            <p className="text-xs text-gray-400">No hay datos cargados. Consulta ClickHouse primero.</p>
          )}
        </div>
      )}

      {/* Resultados */}
      {results && results.length > 0 && (
        <div className="mt-4 space-y-3">
          {results.length > 1 && (
            <p className="text-xs text-gray-500">{results.length} resultado{results.length > 1 ? "s" : ""} encontrado{results.length > 1 ? "s" : ""}</p>
          )}
          {results.map((r, i) => {
            const sla   = slaLabel(r);
            const estCls = estadoColor(r.estado);
            return (
              <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50 hover:bg-teal-50/30 transition">
                {/* Cabecera */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {r.idServicio && (
                    <span className="font-mono text-xs font-bold text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
                      🆔 {r.idServicio}
                    </span>
                  )}
                  {r.numeroPaquete && (
                    <span className="font-mono text-xs font-bold text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
                      📦 {r.numeroPaquete}
                    </span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estCls}`}>{r.estado}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sla.cls}`}>{sla.txt}</span>
                  <span className="text-xs text-gray-400 ml-auto">{lineaLabel[r.linea] || r.linea}</span>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Tiempo servicio</p>
                    <p className="text-sm font-bold text-gray-700">{fmtMin(r.minutos)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Límite SLA</p>
                    <p className="text-sm font-bold" style={{ color: r.slaLimite ? C_TEAL : C_GRAY }}>
                      {r.slaLimite
                        ? r.linea === "integ_nd"
                          ? `hasta las ${String(Math.floor(r.slaLimite / 60)).padStart(2,"0")}:${String(r.slaLimite % 60).padStart(2,"0")}`
                          : `${r.slaLimite} min`
                        : "N.A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Distancia</p>
                    <p className="text-sm font-bold text-gray-700">{r.km ? `${r.km.toFixed(1)} km` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Fecha</p>
                    <p className="text-sm font-bold text-gray-700">{r.fecha || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Ciudad</p>
                    <p className="text-sm font-medium text-gray-700 truncate">{r.ciudad}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Usuario / Tienda</p>
                    <p className="text-sm font-medium text-gray-700 truncate">{r.sucursal}</p>
                  </div>
                  {r.iniciadoRaw && (
                    <div>
                      <p className="text-xs text-gray-400">Asignado</p>
                      <p className="text-sm font-medium text-gray-700">{fmtDatetime(r.iniciadoRaw)}</p>
                    </div>
                  )}
                  {r.finalizadoRaw && (
                    <div>
                      <p className="text-xs text-gray-400">Fecha entrega</p>
                      <p className="text-sm font-medium text-gray-700">{fmtDatetime(r.finalizadoRaw)}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Constantes de meses ────────────────────────────────────────────────────
const MESES_LABEL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ── Panel Análisis Entregas ────────────────────────────────────────────────
const LINEAS_ENT = [
  { key:"mostrador", label:"Cruz Verde Mostrador", short:"Mostrador", icon:"🏪", color:C_TEAL    },
  { key:"integ_sd",  label:"Integración Same Day",  short:"Same Day",  icon:"⚡", color:C_CYAN    },
  { key:"integ_nd",  label:"Integración Next Day",  short:"Next Day",  icon:"🌙", color:"#6366F1" },
];

function EntregasPanel({ rows }) {
  const [lineaSel,  setLineaSel]  = useState("todas");
  const [ciudadSel, setCiudadSel] = useState(null);      // null = todas las ciudades
  const [vista,     setVista]     = useState("ciudad");  // "ciudad" | "origen" | "destino"
  const [sortCol,   setSortCol]   = useState("total");
  const [busq,      setBusq]      = useState("");

  // Filas filtradas por línea
  const lineRows = lineaSel === "todas" ? rows : rows.filter(r => r.linea === lineaSel);

  // Lista de ciudades disponibles (ordenada)
  const ciudades = [...new Set(lineRows.map(r => r.ciudad || "Sin ciudad"))].filter(Boolean).sort();

  // Filas filtradas por ciudad (solo para vistas origen/destino)
  const cityRows = ciudadSel ? lineRows.filter(r => (r.ciudad || "Sin ciudad") === ciudadSel) : lineRows;

  // ── Función de agrupación ──────────────────────────────────────────────
  const buildStats = (rws, keyFn) => {
    const m = {};
    rws.forEach(r => {
      const k = keyFn(r) || "Sin dato";
      if (!m[k]) m[k] = {
        nombre:k, total:0, entregados:0, cancelados:0, expirados:0,
        slaMet:0, slaDef:0, minsList:[],
        lineas:{ mostrador:0, integ_sd:0, integ_nd:0 },
      };
      const d = m[k];
      d.total++;
      d.lineas[r.linea] = (d.lineas[r.linea]||0) + 1;
      if (r.esPerfecto)               d.entregados++;
      if (/cancelad/i.test(r.estado)) d.cancelados++;
      if (/expirad/i.test(r.estado))  d.expirados++;
      if (r.slaCumplido === true)     d.slaMet++;
      if (r.slaCumplido !== null)     d.slaDef++;
      if (r.minutos > 0)              d.minsList.push(r.minutos);
    });
    return Object.values(m).map(d => ({
      ...d,
      entPct: pct(d.entregados, d.total),
      slaPct: d.slaDef > 0 ? pct(d.slaMet, d.slaDef) : null,
      avgMin: d.minsList.length ? d.minsList.reduce((a,b)=>a+b,0)/d.minsList.length : null,
    }));
  };

  const sortFn = (col) => (a, b) => {
    if (col==="entPct") return (b.entPct||0)-(a.entPct||0);
    if (col==="slaPct") return (b.slaPct??-1)-(a.slaPct??-1);
    if (col==="avgMin") return (b.avgMin??-1)-(a.avgMin??-1);
    return (b[col]||0)-(a[col]||0);
  };

  // Stats según la vista activa
  const activeRows = vista === "ciudad" ? lineRows : cityRows;
  const keyFn = vista==="ciudad" ? r=>r.ciudad||"Sin ciudad"
              : vista==="origen" ? r=>r.localidadOrigen||"Sin localidad"
              :                    r=>r.localidadDestino||"Sin localidad";

  const allStats = buildStats(activeRows, keyFn);
  const filtered = allStats
    .filter(d => !busq || d.nombre.toLowerCase().includes(busq.toLowerCase()))
    .sort(sortFn(sortCol));

  const hasSla   = activeRows.some(r => r.slaCumplido !== null);
  const totScope = activeRows.length;
  const entScope = activeRows.filter(r => r.esPerfecto).length;
  const canScope = activeRows.filter(r => /cancelad/i.test(r.estado)).length;
  const expScope = activeRows.filter(r => /expirad/i.test(r.estado)).length;
  const slaMetS  = activeRows.filter(r => r.slaCumplido === true).length;
  const slaDefS  = activeRows.filter(r => r.slaCumplido !== null).length;

  const noLocalidad = vista !== "ciudad" && !cityRows.some(r => r.localidadOrigen || r.localidadDestino);

  const COLS = [
    ["total","Total"],["entPct","% Entrega"],["cancelados","Cancel."],
    ["expirados","Expir."],["slaPct","% SLA"],["avgMin","T. prom"],
  ];

  const SortBtn = ({ col, lbl }) => (
    <button onClick={() => setSortCol(col)}
      className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all ${sortCol===col?"bg-teal-600 text-white":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
      {lbl}
    </button>
  );

  const TablaEntregas = ({ stats, showLineas, emptyMsg }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400">
            <th className="text-left py-2 px-2 font-semibold">
              {vista==="ciudad"?"Ciudad":vista==="origen"?"Localidad Origen":"Localidad Destino"}
            </th>
            {showLineas && <th className="text-left py-2 px-2 font-semibold">Líneas</th>}
            <th className="text-right py-2 px-2 font-semibold">Total</th>
            <th className="text-right py-2 px-2 font-semibold">Entregados</th>
            <th className="text-right py-2 px-2 font-semibold">% Entrega</th>
            <th className="text-right py-2 px-2 font-semibold">Cancelados</th>
            <th className="text-right py-2 px-2 font-semibold">Expirados</th>
            {hasSla && <th className="text-right py-2 px-2 font-semibold">% SLA</th>}
            <th className="text-right py-2 px-2 font-semibold">T. prom.</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((d, i) => (
            <tr key={d.nombre}
              className={`${i%2===0?"bg-gray-50/40":""} ${vista==="ciudad"?"cursor-pointer hover:bg-teal-50 transition-colors":""}`}
              onClick={() => {
                if (vista !== "ciudad") return;
                setCiudadSel(d.nombre);
                setVista("origen");
                setBusq("");
                setSortCol("total");
              }}>
              <td className="py-2 px-2 font-semibold text-gray-700 max-w-[200px]">
                <div className="flex items-center gap-1.5">
                  <p className="truncate">{d.nombre}</p>
                  {vista==="ciudad" && <span className="text-gray-300 text-[10px]">→</span>}
                </div>
              </td>
              {showLineas && (
                <td className="py-2 px-2">
                  <div className="flex gap-1 flex-wrap">
                    {LINEAS_ENT.map(l => d.lineas[l.key]>0 && (
                      <span key={l.key} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{background:`${l.color}20`,color:l.color}}>
                        {l.icon}{fmtNum(d.lineas[l.key])}
                      </span>
                    ))}
                  </div>
                </td>
              )}
              <td className="py-2 px-2 text-right font-bold text-gray-800">{fmtNum(d.total)}</td>
              <td className="py-2 px-2 text-right font-semibold" style={{color:C_GRN}}>{fmtNum(d.entregados)}</td>
              <td className="py-2 px-2 text-right font-bold"
                style={{color:d.entPct>=0.95?C_GRN:d.entPct>=0.85?C_AMB:C_RED}}>{fmtPct(d.entPct)}</td>
              <td className="py-2 px-2 text-right" style={{color:C_RED}}>{fmtNum(d.cancelados)}</td>
              <td className="py-2 px-2 text-right" style={{color:C_AMB}}>{fmtNum(d.expirados)}</td>
              {hasSla && (
                <td className="py-2 px-2 text-right font-bold"
                  style={{color:d.slaPct===null?C_GRAY:d.slaPct>=0.95?C_GRN:d.slaPct>=0.80?C_AMB:C_RED}}>
                  {d.slaPct!==null?fmtPct(d.slaPct):"—"}
                </td>
              )}
              <td className="py-2 px-2 text-right text-gray-500">
                {d.avgMin?`${Math.round(d.avgMin)} min`:"—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!stats.length && <p className="text-xs text-gray-400 text-center py-6">{emptyMsg||"Sin resultados."}</p>}
    </div>
  );

  if (!rows.length) return <div className="text-center py-16 text-gray-400 text-sm">Sin datos cargados.</div>;

  return (
    <div className="space-y-5">

      {/* Selector de línea */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tipo de servicio</p>
        <div className="flex flex-wrap gap-2">
          {[{key:"todas",label:"Todas las líneas",icon:"🔍",color:C_TEAL},...LINEAS_ENT].map(l => (
            <button key={l.key}
              onClick={() => { setLineaSel(l.key); setCiudadSel(null); setVista("ciudad"); setBusq(""); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
              style={lineaSel===l.key?{background:l.color,color:"#fff",borderColor:l.color}:{borderColor:"#e5e7eb",color:"#4b5563",background:"#fff"}}>
              {l.icon} {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs del scope actual */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {label:"Total",      value:fmtNum(totScope), color:"#1f2937"},
          {label:"Entregados", value:fmtNum(entScope), color:C_GRN, sub:fmtPct(pct(entScope,totScope))},
          {label:"Cancelados", value:fmtNum(canScope), color:C_RED, sub:fmtPct(pct(canScope,totScope))},
          {label:"Expirados",  value:fmtNum(expScope), color:C_AMB, sub:fmtPct(pct(expScope,totScope))},
          ...(hasSla?[{label:"% SLA",value:fmtPct(pct(slaMetS,slaDefS)),color:pct(slaMetS,slaDefS)>=0.9?C_GRN:C_RED,sub:`${fmtNum(slaMetS)}/${fmtNum(slaDefS)}`}]:[]),
          {label:vista==="ciudad"?"Ciudades":vista==="origen"?"Loc. Origen":"Loc. Destino", value:fmtNum(allStats.length), color:"#6366F1"},
        ].map((k,i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 text-center">
            <p className="text-[11px] text-gray-400 mb-1">{k.label}</p>
            <p className="text-lg font-extrabold" style={{color:k.color}}>{k.value}</p>
            {k.sub && <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Panel principal con breadcrumb + navegación */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

        {/* Breadcrumb de navegación */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => { setVista("ciudad"); setCiudadSel(null); setBusq(""); setSortCol("total"); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${vista==="ciudad"?"bg-teal-600 text-white":"text-teal-600 hover:bg-teal-50"}`}>
            🏙️ Ciudades
          </button>

          {ciudadSel && (
            <>
              <span className="text-gray-300 text-sm">›</span>
              <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5">
                <span className="text-xs font-bold text-teal-700">{ciudadSel}</span>
                <button
                  onClick={() => { setCiudadSel(null); setVista("ciudad"); setBusq(""); setSortCol("total"); }}
                  className="ml-1 text-teal-400 hover:text-teal-700 text-xs font-bold leading-none">✕</button>
              </div>
              <span className="text-gray-300 text-sm">›</span>
              <div className="flex gap-1">
                <button
                  onClick={() => { setVista("origen"); setBusq(""); setSortCol("total"); }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${vista==="origen"?"bg-teal-600 text-white border-teal-600":"border-gray-200 text-gray-600 hover:border-teal-300"}`}>
                  📍 Loc. Origen
                </button>
                <button
                  onClick={() => { setVista("destino"); setBusq(""); setSortCol("total"); }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${vista==="destino"?"bg-teal-600 text-white border-teal-600":"border-gray-200 text-gray-600 hover:border-teal-300"}`}>
                  🏁 Loc. Destino
                </button>
              </div>
            </>
          )}

          {vista==="ciudad" && (
            <p className="ml-auto text-[11px] text-gray-400">Haz clic en una ciudad para ver sus localidades</p>
          )}
        </div>

        {/* Controles de búsqueda y orden */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input value={busq} onChange={e => setBusq(e.target.value)}
            placeholder={`Buscar ${vista==="ciudad"?"ciudad":"localidad"}...`}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-teal-400 w-44" />
          <div className="flex flex-wrap gap-1">
            {COLS.map(([col,lbl]) => <SortBtn key={col} col={col} lbl={lbl} />)}
          </div>
          <span className="ml-auto text-[11px] text-gray-400">{filtered.length} registros</span>
        </div>

        {/* Tabla o aviso sin datos */}
        {noLocalidad ? (
          <div className="text-center py-10 text-sm text-gray-400 bg-gray-50 rounded-xl">
            <p className="font-semibold">Sin datos de localidad en el archivo cargado.</p>
            <p className="text-xs mt-1">Verifica que el Excel incluya columnas <code>localidad_origen</code> / <code>localidad_destino</code>.</p>
          </div>
        ) : (
          <TablaEntregas stats={filtered} showLineas={lineaSel==="todas"} />
        )}
      </div>

    </div>
  );
}

// ── Panel Insight ───────────────────────────────────────────────────────────
const LINEAS_INSIGHT = [
  { key: "mostrador", label: "Cruz Verde Mostrador", short: "Mostrador", icon: "🏪", color: C_TEAL,    hasSla: false },
  { key: "integ_sd",  label: "Integración Same Day",  short: "Same Day",  icon: "⚡", color: C_CYAN,    hasSla: true  },
  { key: "integ_nd",  label: "Integración Next Day",  short: "Next Day",  icon: "🌙", color: "#6366F1", hasSla: true  },
];

function InsightPanel({ rows, prevRows }) {
  const [lineaSel, setLineaSel] = useState("todas");

  const lineRows     = lineaSel === "todas" ? rows     : rows.filter(r => r.linea === lineaSel);
  const prevLineRows = lineaSel === "todas" ? (prevRows||[]) : (prevRows||[]).filter(r => r.linea === lineaSel);
  const hasPrev      = prevLineRows.length > 0;

  // ── Stats por línea ───────────────────────────────────────────────────────
  const lineStats = LINEAS_INSIGHT.map(({ key, label, short, icon, color, hasSla }) => {
    const lr = rows.filter(r => r.linea === key);
    const total      = lr.length;
    const entregados = lr.filter(r => r.esPerfecto).length;
    const cancelados = lr.filter(r => /cancelad/i.test(r.estado)).length;
    const expirados  = lr.filter(r => /expirad/i.test(r.estado)).length;
    const slaMet     = lr.filter(r => r.slaCumplido === true).length;
    const slaDef     = lr.filter(r => r.slaCumplido !== null).length;
    const minsList   = lr.filter(r => r.minutos > 0).map(r => r.minutos);
    const avgMin     = minsList.length ? minsList.reduce((a,b)=>a+b,0)/minsList.length : 0;
    const gmvTotal   = lr.reduce((s,r) => s + (r.costo||0), 0);
    return { key, label, short, icon, color, hasSla, total, entregados, cancelados, expirados, slaMet, slaDef, avgMin, gmvTotal };
  });

  // ── Stats por ciudad ──────────────────────────────────────────────────────
  const buildCiudadStats = (rws) => {
    const m = {};
    rws.forEach(r => {
      const c = r.ciudad || "Sin ciudad";
      if (!m[c]) m[c] = { ciudad: c, total: 0, entregados: 0, cancelados: 0, expirados: 0, slaMet: 0, slaDef: 0 };
      const d = m[c]; d.total++;
      if (r.esPerfecto) d.entregados++;
      if (/cancelad/i.test(r.estado)) d.cancelados++;
      if (/expirad/i.test(r.estado)) d.expirados++;
      if (r.slaCumplido === true) d.slaMet++;
      if (r.slaCumplido !== null) d.slaDef++;
    });
    return Object.values(m).map(d => ({
      ...d,
      entPct: pct(d.entregados, d.total),
      slaPct: d.slaDef > 0 ? pct(d.slaMet, d.slaDef) : null,
    }));
  };

  const ciudadStats     = buildCiudadStats(lineRows);
  const prevCiudadStats = buildCiudadStats(prevLineRows);
  const con5            = ciudadStats.filter(c => c.total >= 5);

  // ── Stats por piloto ──────────────────────────────────────────────────────
  const buildPilotoStats = (rws) => {
    const m = {};
    rws.forEach(r => {
      const k = r.idPiloto || r.nombrePiloto;
      if (!k) return;
      if (!m[k]) m[k] = { id: r.idPiloto||k, nombre: r.nombrePiloto||k, ciudad: r.ciudad||"—", total:0, entregados:0, slaMet:0, slaDef:0 };
      const d = m[k]; d.total++;
      if (r.esPerfecto) d.entregados++;
      if (r.slaCumplido === true) d.slaMet++;
      if (r.slaCumplido !== null) d.slaDef++;
    });
    return Object.values(m).map(d => ({ ...d, entPct: pct(d.entregados,d.total), slaPct: d.slaDef>0 ? pct(d.slaMet,d.slaDef) : null }));
  };

  const pilotoStats = buildPilotoStats(lineRows).filter(p => p.total >= 3);
  const hasPilotos  = pilotoStats.length > 0;

  // candidatos con SLA definido para "bajo SLA"
  const pilotosConSla   = pilotoStats.filter(p => p.slaPct !== null && p.slaDef >= 3);
  const pilotoDestacado = [...pilotoStats].sort((a,b) => b.entregados - a.entregados)[0];
  const pilotoBajoSla   = [...pilotosConSla].sort((a,b) => (a.slaPct??1) - (b.slaPct??1))[0];

  // ── Comparativa ciudades vs mes anterior ─────────────────────────────────
  const prevCiudadMap = Object.fromEntries(prevCiudadStats.map(c => [c.ciudad, c]));
  const ciudadConCambio = ciudadStats
    .map(c => {
      const prev = prevCiudadMap[c.ciudad];
      const delta = prev ? c.total - prev.total : null;
      return { ...c, delta };
    })
    .filter(c => c.total >= 3);

  const ciudadCrecimiento = hasPrev
    ? [...ciudadConCambio].filter(c => c.delta !== null).sort((a,b) => (b.delta||0)-(a.delta||0))[0]
    : null;
  const ciudadCaida = hasPrev
    ? [...ciudadConCambio].filter(c => c.delta !== null).sort((a,b) => (a.delta||0)-(b.delta||0))[0]
    : null;

  const ciudadMejorSla  = [...con5].filter(c => c.slaPct !== null).sort((a,b) => (b.slaPct??0)-(a.slaPct??0))[0];
  const ciudadPeorSla   = [...con5].filter(c => c.slaPct !== null).sort((a,b) => (a.slaPct??1)-(b.slaPct??1))[0];

  // ── Clasificar insights por línea ─────────────────────────────────────────
  const positivos   = [];
  const porMejorar  = [];

  // Solo incluir la línea seleccionada (o todas si es "todas")
  const lineStatsFiltradas = lineaSel === "todas" ? lineStats : lineStats.filter(l => l.key === lineaSel);

  lineStatsFiltradas.forEach(({ label, icon, hasSla, total, entregados, cancelados, expirados, slaMet, slaDef, avgMin }) => {
    if (!total) return;
    const entPct = pct(entregados, total);
    const slaPct = slaDef > 0 ? pct(slaMet, slaDef) : null;
    const canPct = pct(cancelados, total);
    const expPct = pct(expirados,  total);

    if (entPct >= 0.97) positivos.push(`${icon} ${label}: tasa de entrega excelente (${fmtPct(entPct)} — ${fmtNum(entregados)} servicios entregados).`);
    else if (entPct >= 0.93) positivos.push(`${icon} ${label}: buena tasa de entrega (${fmtPct(entPct)}).`);
    else if (entPct < 0.85) porMejorar.push(`${icon} ${label}: tasa de entrega baja (${fmtPct(entPct)}). Revisar causas de no entrega.`);
    else porMejorar.push(`${icon} ${label}: tasa de entrega en ${fmtPct(entPct)} — hay margen de mejora.`);

    if (slaPct !== null) {
      if (slaPct >= 0.95) positivos.push(`${icon} ${label}: cumplimiento SLA excelente (${fmtPct(slaPct)}).`);
      else if (slaPct >= 0.88) positivos.push(`${icon} ${label}: SLA en buen nivel (${fmtPct(slaPct)}).`);
      else if (slaPct < 0.80) porMejorar.push(`${icon} ${label}: SLA crítico (${fmtPct(slaPct)}). Acción inmediata requerida.`);
      else porMejorar.push(`${icon} ${label}: SLA en ${fmtPct(slaPct)} — requiere atención.`);
    }

    if (canPct <= 0.02) positivos.push(`${icon} ${label}: cancelaciones muy bajas (${fmtPct(canPct)}).`);
    else if (canPct > 0.05) porMejorar.push(`${icon} ${label}: alta tasa de cancelaciones (${fmtPct(canPct)} — ${fmtNum(cancelados)} servicios).`);

    if (expPct > 0.05) porMejorar.push(`${icon} ${label}: alta tasa de expirados (${fmtPct(expPct)} — ${fmtNum(expirados)} servicios).`);

    if (avgMin > 0 && entPct >= 0.95) positivos.push(`${icon} ${label}: tiempo promedio de servicio eficiente (${Math.round(avgMin)} min).`);
  });

  // Ciudades en insights generales
  const bestCiudadEnt = [...con5].sort((a,b) => b.entPct - a.entPct)[0];
  const worstCiudadEnt= [...con5].sort((a,b) => a.entPct - b.entPct)[0];
  if (bestCiudadEnt && bestCiudadEnt.entPct >= 0.95)
    positivos.push(`🏙️ Ciudad con mayor eficiencia de entrega: ${bestCiudadEnt.ciudad} (${fmtPct(bestCiudadEnt.entPct)} — ${fmtNum(bestCiudadEnt.total)} servicios).`);
  if (worstCiudadEnt && worstCiudadEnt !== bestCiudadEnt && worstCiudadEnt.entPct < 0.90)
    porMejorar.push(`🏙️ Ciudad con menor entrega: ${worstCiudadEnt.ciudad} (${fmtPct(worstCiudadEnt.entPct)} — ${fmtNum(worstCiudadEnt.total)} servicios).`);

  // ── Tarjeta insight helper ────────────────────────────────────────────────
  const InsightCard = ({ icon, titulo, color, bg, badge, children }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3"
      style={{ borderTop:`4px solid ${color}` }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <p className="text-sm font-bold text-gray-800">{titulo}</p>
        {badge && <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background:`${color}20`, color }}>{badge}</span>}
      </div>
      {children}
    </div>
  );

  const ItemLista = ({ txt, color }) => (
    <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background:`${color}12`, borderLeft:`3px solid ${color}` }}>
      <p className="text-xs text-gray-700 leading-relaxed">{txt}</p>
    </div>
  );

  const KpiRow = ({ label, value, color, sub }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400">{label}</p>
      <div className="text-right">
        <p className="text-sm font-extrabold" style={{ color }}>{value}</p>
        {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );

  if (!rows.length) return <div className="text-center py-16 text-gray-400 text-sm">Sin datos cargados.</div>;

  return (
    <div className="space-y-6">

      {/* Selector de línea */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Filtrar por tipo de servicio</p>
        <div className="flex flex-wrap gap-2">
          {[{ key:"todas", label:"Todas las líneas", icon:"🔍", color: C_TEAL }, ...LINEAS_INSIGHT].map(l => (
            <button key={l.key} onClick={() => setLineaSel(l.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
              style={lineaSel === l.key
                ? { background: l.color, color:"#fff", borderColor: l.color }
                : { borderColor:"#e5e7eb", color:"#4b5563", background:"#fff" }}>
              {l.icon} {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparativa entre las 3 líneas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {lineStats.map(({ key, label, short, icon, color, hasSla, total, entregados, cancelados, expirados, slaMet, slaDef, avgMin, gmvTotal }) => {
          const entPct = pct(entregados, total);
          const slaPct = slaDef > 0 ? pct(slaMet, slaDef) : null;
          return (
            <div key={key} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
              style={{ borderTop:`4px solid ${color}` }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className="text-xs font-bold text-gray-800">{short}</p>
                  <p className="text-[10px] text-gray-400">{label}</p>
                </div>
              </div>
              {!total ? <p className="text-xs text-gray-400 py-4 text-center">Sin datos</p> : (
                <div className="space-y-2.5">
                  <KpiRow label="Total servicios" value={fmtNum(total)} color="#1f2937" />
                  <KpiRow label="% Entrega" value={fmtPct(entPct)} color={entPct>=0.95?C_GRN:entPct>=0.85?C_AMB:C_RED} sub={`${fmtNum(entregados)} entregados`} />
                  <div className="bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width:`${Math.min(100,entPct*100).toFixed(1)}%`, background:color }} />
                  </div>
                  <KpiRow label="Cancelados"    value={fmtNum(cancelados)} color={C_RED} sub={fmtPct(pct(cancelados,total))} />
                  <KpiRow label="Expirados"     value={fmtNum(expirados)}  color={C_AMB} sub={fmtPct(pct(expirados,total))} />
                  {hasSla && slaPct !== null && <KpiRow label="% SLA" value={fmtPct(slaPct)} color={slaPct>=0.95?C_GRN:slaPct>=0.80?C_AMB:C_RED} />}
                  {avgMin > 0 && <KpiRow label="Tiempo promedio" value={`${Math.round(avgMin)} min`} color={C_GRAY} />}
                  {gmvTotal > 0 && <KpiRow label="GMV total" value={`$${fmtNum(Math.round(gmvTotal))}`} color={C_TEAL} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Sección Positivos / Por mejorar ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightCard icon="✅" titulo="Positivos" color={C_GRN} badge={`${positivos.length} hallazgos`}>
          {positivos.length > 0
            ? <div className="space-y-2">{positivos.map((t,i) => <ItemLista key={i} txt={t} color={C_GRN} />)}</div>
            : <p className="text-xs text-gray-400 text-center py-4">Sin destacados aún.</p>}
        </InsightCard>
        <InsightCard icon="⚠️" titulo="Por mejorar" color={C_AMB} badge={`${porMejorar.length} alertas`}>
          {porMejorar.length > 0
            ? <div className="space-y-2">{porMejorar.map((t,i) => <ItemLista key={i} txt={t} color={C_AMB} />)}</div>
            : <p className="text-xs text-gray-400 text-center py-4">Sin alertas — ¡todo en orden!</p>}
        </InsightCard>
      </div>

      {/* ── Sección Pilotos ───────────────────────────────────────────────── */}
      {hasPilotos && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InsightCard icon="🚴" titulo="Piloto Destacado" color={C_GRN} badge="Mayor actividad">
            {pilotoDestacado ? (
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-gray-800 truncate">🥇 {pilotoDestacado.nombre || pilotoDestacado.id}</p>
                <p className="text-xs text-gray-400">{pilotoDestacado.ciudad} · ID: {pilotoDestacado.id}</p>
                <div className="mt-3 space-y-1.5">
                  <KpiRow label="Total servicios"  value={fmtNum(pilotoDestacado.total)}     color="#1f2937" />
                  <KpiRow label="Entregados"        value={fmtNum(pilotoDestacado.entregados)} color={C_GRN} sub={fmtPct(pilotoDestacado.entPct)} />
                  {pilotoDestacado.slaPct !== null && <KpiRow label="% SLA" value={fmtPct(pilotoDestacado.slaPct)} color={pilotoDestacado.slaPct>=0.9?C_GRN:C_AMB} />}
                </div>
              </div>
            ) : <p className="text-xs text-gray-400">Sin datos de pilotos.</p>}
          </InsightCard>

          <InsightCard icon="🔴" titulo="Piloto con Bajo SLA" color={C_RED} badge="Requiere atención">
            {pilotoBajoSla ? (
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-gray-800 truncate">⚠️ {pilotoBajoSla.nombre || pilotoBajoSla.id}</p>
                <p className="text-xs text-gray-400">{pilotoBajoSla.ciudad} · ID: {pilotoBajoSla.id}</p>
                <div className="mt-3 space-y-1.5">
                  <KpiRow label="Total servicios"  value={fmtNum(pilotoBajoSla.total)}     color="#1f2937" />
                  <KpiRow label="Entregados"        value={fmtNum(pilotoBajoSla.entregados)} color={C_GRN} sub={fmtPct(pilotoBajoSla.entPct)} />
                  <KpiRow label="% SLA"             value={fmtPct(pilotoBajoSla.slaPct)}    color={pilotoBajoSla.slaPct<0.80?C_RED:C_AMB} />
                  <KpiRow label="SLA incumplidos"   value={fmtNum(pilotoBajoSla.slaDef - pilotoBajoSla.slaMet)} color={C_RED} />
                </div>
              </div>
            ) : <p className="text-xs text-gray-400">No hay pilotos con SLA definido.</p>}
          </InsightCard>
        </div>
      )}

      {/* ── Sección Ciudades ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Crecimiento */}
        <InsightCard icon="📈" titulo="Ciudad: Crecimiento" color={C_GRN} badge={hasPrev ? "vs mes anterior" : "Sin comparativa"}>
          {hasPrev && ciudadCrecimiento && ciudadCrecimiento.delta > 0 ? (
            <div className="space-y-1.5">
              <p className="text-sm font-extrabold text-gray-800">{ciudadCrecimiento.ciudad}</p>
              <KpiRow label="Servicios actuales" value={fmtNum(ciudadCrecimiento.total)} color={C_GRN} />
              <KpiRow label="Crecimiento"         value={`+${fmtNum(ciudadCrecimiento.delta)} serv`} color={C_GRN} />
              <KpiRow label="% Entrega"           value={fmtPct(ciudadCrecimiento.entPct)} color={ciudadCrecimiento.entPct>=0.95?C_GRN:C_AMB} />
            </div>
          ) : <p className="text-xs text-gray-400 text-center py-3">{hasPrev ? "Sin crecimiento registrado." : "Carga el mes anterior para comparar."}</p>}
        </InsightCard>

        {/* Caída */}
        <InsightCard icon="📉" titulo="Ciudad: Caída" color={C_RED} badge={hasPrev ? "vs mes anterior" : "Sin comparativa"}>
          {hasPrev && ciudadCaida && ciudadCaida.delta < 0 ? (
            <div className="space-y-1.5">
              <p className="text-sm font-extrabold text-gray-800">{ciudadCaida.ciudad}</p>
              <KpiRow label="Servicios actuales" value={fmtNum(ciudadCaida.total)} color="#1f2937" />
              <KpiRow label="Caída"              value={`${fmtNum(ciudadCaida.delta)} serv`} color={C_RED} />
              <KpiRow label="% Entrega"          value={fmtPct(ciudadCaida.entPct)} color={ciudadCaida.entPct>=0.95?C_GRN:C_AMB} />
            </div>
          ) : <p className="text-xs text-gray-400 text-center py-3">{hasPrev ? "Sin caídas registradas." : "Carga el mes anterior para comparar."}</p>}
        </InsightCard>

        {/* Mejor SLA */}
        <InsightCard icon="🏅" titulo="Ciudad: Mejor SLA" color={C_TEAL} badge="Top SLA">
          {ciudadMejorSla ? (
            <div className="space-y-1.5">
              <p className="text-sm font-extrabold text-gray-800">{ciudadMejorSla.ciudad}</p>
              <KpiRow label="% SLA"             value={fmtPct(ciudadMejorSla.slaPct)} color={C_GRN} />
              <KpiRow label="Servicios con SLA" value={`${fmtNum(ciudadMejorSla.slaMet)} / ${fmtNum(ciudadMejorSla.slaDef)}`} color={C_TEAL} />
              <KpiRow label="Total servicios"   value={fmtNum(ciudadMejorSla.total)} color="#1f2937" />
            </div>
          ) : <p className="text-xs text-gray-400 text-center py-3">Sin datos de SLA por ciudad.</p>}
        </InsightCard>

        {/* Peor SLA */}
        <InsightCard icon="🚨" titulo="Ciudad: Peor SLA" color={C_RED} badge="Requiere acción">
          {ciudadPeorSla && ciudadPeorSla !== ciudadMejorSla ? (
            <div className="space-y-1.5">
              <p className="text-sm font-extrabold text-gray-800">{ciudadPeorSla.ciudad}</p>
              <KpiRow label="% SLA"              value={fmtPct(ciudadPeorSla.slaPct)} color={ciudadPeorSla.slaPct<0.80?C_RED:C_AMB} />
              <KpiRow label="SLA incumplidos"    value={fmtNum(ciudadPeorSla.slaDef - ciudadPeorSla.slaMet)} color={C_RED} />
              <KpiRow label="Total servicios"    value={fmtNum(ciudadPeorSla.total)} color="#1f2937" />
            </div>
          ) : <p className="text-xs text-gray-400 text-center py-3">Sin datos suficientes.</p>}
        </InsightCard>
      </div>

    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────
const TABS = [
  { id:"resumen",    label:"Resumen",              icon:"📊",  adminOnly: false },
  { id:"mostrador",  label:"Cruz Verde Mostrador",  icon:"🏪",  adminOnly: false },
  { id:"integ_sd",   label:"Integración Same Day",  icon:"⚡",  adminOnly: false },
  { id:"integ_nd",   label:"Integración Next Day",  icon:"📅",  adminOnly: false },
  { id:"pilotos",       label:"Pilotos Cruz Verde",              icon:"🚴",  adminOnly: false, hiddenForEmails: new Set(["jhon.potier@cruzverde.com.co"]) },
  { id:"prod_pilotos", label:"Productividad Pilotos Integración", icon:"📈", adminOnly: false, hiddenForEmails: new Set(["jhon.potier@cruzverde.com.co"]) },
  { id:"entregas",   label:"Análisis Entregas",     icon:"📦",  adminOnly: false },
  { id:"admin",      label:"Administrativo",        icon:"🔧",  adminOnly: true  },
  { id:"insight",    label:"Insight",               icon:"💡",  adminOnly: false },
  { id:"notas",      label:"Notas y Tareas",        icon:"📝",  adminOnly: false },
];

// ── Componente principal ───────────────────────────────────────────────────
export default function InformeCruzVerde({ isAdmin }) {
  const now = new Date();
  const [tab,        setTab]        = useState("resumen");
  const [index,      setIndex]      = useState(() => loadIndex());
  const [mesSel,     setMesSel]     = useState("");
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState(null);
  const [filtCiudad,    setFiltCiudad]    = useState("todas");
  const [filtLinea,     setFiltLinea]     = useState("todas");
  const [filtFechaIni,  setFiltFechaIni]  = useState("");
  const [filtFechaFin,  setFiltFechaFin]  = useState("");
  const [filtTiendas,   setFiltTiendas]   = useState([]);
  const [tiendaDropOpen, setTiendaDropOpen] = useState(false);
  const [tiendaBusq,    setTiendaBusq]    = useState("");
  const tiendaRef = useRef(null);
  const [filtDirecciones,  setFiltDirecciones]  = useState([]);
  const [dirDropOpen,      setDirDropOpen]       = useState(false);
  const [dirBusq,          setDirBusq]           = useState("");
  const dirRef = useRef(null);
  // Upload year/month selectors
  const [upAnio,  setUpAnio]  = useState(now.getFullYear());
  const [upMesN,  setUpMesN]  = useState(now.getMonth() + 1);

  // SLA config state
  const [slaConfig,    setSlaConfig]    = useState(() => getSlaConfig());
  const [horariosMap,  setHorariosMap]  = useState({});
  const [prevRows,     setPrevRows]     = useState([]);
  const [publishing,   setPublishing]   = useState(false);
  const [publishMsg,   setPublishMsg]   = useState(null);
  const [loadingServer, setLoadingServer] = useState(false);

  // ── ClickHouse integration ──
  const [chDesde,    setChDesde]    = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; });
  const [chHasta,    setChHasta]    = useState(() => new Date().toISOString().slice(0,10));
  const [chStatus,   setChStatus]   = useState("idle");   // idle | running | done | error
  const [chError,    setChError]    = useState(null);
  const [chMsg,      setChMsg]      = useState(null);
  const [chPollRef,  setChPollRef]  = useState(null);

  // No-admin: cargar snapshot publicado desde el servidor.
  // Solo sobreescribe un mes en IDB si el servidor tiene datos más nuevos que
  // los locales, para no pisar datos cargados localmente desde ClickHouse.
  useEffect(() => {
    if (isAdmin) return;
    setLoadingServer(true);
    fetchFromServer("cruz_verde").then(async (snap) => {
      if (!snap?.ok || !snap?.data?.index) { setLoadingServer(false); return; }
      const d = snap.data;
      // Merge índice: preservar entradas locales más nuevas
      const localIdx = loadIndex();
      const mergedIdx = { ...d.index };
      for (const [k, serverEntry] of Object.entries(d.index || {})) {
        const localEntry = localIdx[k];
        if (localEntry?.fecha && serverEntry?.fecha &&
            new Date(localEntry.fecha) > new Date(serverEntry.fecha)) {
          mergedIdx[k] = localEntry; // conservar local más nuevo
        }
      }
      saveIndex(mergedIdx);
      // Guardar filas: solo sobreescribir si servidor es más nuevo
      await Promise.all(Object.entries(d.meses || {}).map(async ([k, v]) => {
        const localData = await idbLoad(k);
        const serverFecha  = new Date(v?.fecha || 0).getTime();
        const localFecha   = new Date(localData?.fecha || 0).getTime();
        if (!localData || serverFecha > localFecha) await idbSave(k, v);
      }));
      if (d.directorio) localStorage.setItem("pibox_cv_directorio", JSON.stringify(d.directorio));
      if (d.horariosSd) localStorage.setItem(SK_HORARIOS_SD, JSON.stringify(d.horariosSd));
      if (d.sla) localStorage.setItem("pibox_cv_sla", JSON.stringify(d.sla));
      if (d.umbrales) localStorage.setItem("pibox_cv_umbrales", JSON.stringify(d.umbrales));
      setIndex(mergedIdx);
      if (d.horariosSd?.horarios?.length) setHorariosMap(buildHorariosMap(d.horariosSd.horarios));
      setLoadingServer(false);
    }).catch(() => setLoadingServer(false));
  }, [isAdmin]);

  // Load horarios on mount — prioriza el nuevo SK_HORARIOS_SD, cae al antiguo si no existe
  useEffect(() => {
    try {
      const sd = JSON.parse(localStorage.getItem(SK_HORARIOS_SD) || "null");
      if (sd?.horarios?.length) {
        setHorariosMap(buildHorariosMap(sd.horarios));
        return;
      }
      // Fallback: antiguo directorio.horarios
      const dir = JSON.parse(localStorage.getItem("pibox_cv_directorio") || "null");
      if (dir?.horarios?.length) setHorariosMap(buildHorariosMap(dir.horarios));
    } catch { /* ignore */ }
  }, []);

  // Auto-seleccionar mes más reciente al cargar
  useEffect(() => {
    const meses = Object.keys(index).sort().reverse();
    if (!mesSel && meses.length) setMesSel(meses[0]);
  }, [index]);

  // Cargar filas del mes seleccionado
  useEffect(() => {
    if (!mesSel) { setRows([]); return; }
    idbLoad(mesSel).then(data =>
      setRows((data?.rows || []).filter(r => !isEstadoExcluido(r.estado)))
    );
  }, [mesSel]);

  // Mes anterior: el mes inmediatamente anterior al seleccionado en el índice
  const prevMesSel = useMemo(() => {
    const sorted = Object.keys(index).sort();
    const idx = sorted.indexOf(mesSel);
    return idx > 0 ? sorted[idx - 1] : null;
  }, [index, mesSel]);

  // Cargar y enriquecer filas del mes anterior
  useEffect(() => {
    if (!prevMesSel) { setPrevRows([]); return; }
    idbLoad(prevMesSel).then(data => {
      const enriched = (data?.rows || [])
        .filter(r => !isEstadoExcluido(r.estado))
        .map(row => ({ ...row, ...computeRowSla(row, slaConfig, horariosMap) }));
      setPrevRows(enriched);
    });
  }, [prevMesSel, slaConfig, horariosMap]);

  // Filtros derivados con SLA computado dinámicamente
  const filteredRows = useMemo(() => {
    let r = rows;
    if (filtLinea  !== "todas") r = r.filter(row => row.linea   === filtLinea);
    if (filtCiudad !== "todas") r = r.filter(row => row.ciudad  === filtCiudad);
    if (filtFechaIni) r = r.filter(row => row.fecha >= filtFechaIni);
    if (filtFechaFin) r = r.filter(row => row.fecha <= filtFechaFin);
    if (filtTiendas.length > 0) r = r.filter(row => filtTiendas.includes(row.sucursal || row.direccionOrigen));
    if (filtDirecciones.length > 0) r = r.filter(row => filtDirecciones.includes(row.direccionOrigen));
    return r.map(row => ({ ...row, ...computeRowSla(row, slaConfig, horariosMap) }));
  }, [rows, filtLinea, filtCiudad, filtFechaIni, filtFechaFin, filtTiendas, filtDirecciones, slaConfig, horariosMap]);

  const ciudades = useMemo(() => [...new Set(rows.map(r => r.ciudad))].filter(Boolean).sort(), [rows]);

  // Tiendas disponibles según Línea + Ciudad seleccionadas (sin filtro de tienda para no crear ciclo)
  const tiendas = useMemo(() => {
    let r = rows;
    if (filtLinea  !== "todas") r = r.filter(row => row.linea  === filtLinea);
    if (filtCiudad !== "todas") r = r.filter(row => row.ciudad === filtCiudad);
    return [...new Set(r.map(row => row.sucursal || row.direccionOrigen))].filter(Boolean).sort();
  }, [rows, filtLinea, filtCiudad]);

  const tiendasFiltradas = tiendas.filter(t => t.toLowerCase().includes(tiendaBusq.toLowerCase()));

  // Direcciones de origen disponibles según Línea + Ciudad
  const direcciones = useMemo(() => {
    let r = rows;
    if (filtLinea  !== "todas") r = r.filter(row => row.linea  === filtLinea);
    if (filtCiudad !== "todas") r = r.filter(row => row.ciudad === filtCiudad);
    return [...new Set(r.map(row => row.direccionOrigen))].filter(Boolean).sort();
  }, [rows, filtLinea, filtCiudad]);

  const direccionesFiltradas = direcciones.filter(d => d.toLowerCase().includes(dirBusq.toLowerCase()));

  // Limpiar tiendas seleccionadas que ya no existen al cambiar Línea o Ciudad
  useEffect(() => {
    if (filtTiendas.length > 0) {
      const validas = filtTiendas.filter(t => tiendas.includes(t));
      if (validas.length !== filtTiendas.length) setFiltTiendas(validas);
    }
  }, [tiendas]);

  // Limpiar direcciones seleccionadas que ya no existen al cambiar Línea o Ciudad
  useEffect(() => {
    if (filtDirecciones.length > 0) {
      const validas = filtDirecciones.filter(d => direcciones.includes(d));
      if (validas.length !== filtDirecciones.length) setFiltDirecciones(validas);
    }
  }, [direcciones]);

  useEffect(() => {
    const handler = e => {
      if (tiendaRef.current && !tiendaRef.current.contains(e.target)) setTiendaDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = e => {
      if (dirRef.current && !dirRef.current.contains(e.target)) setDirDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Todas las filas del mes enriquecidas con SLA (sin filtros de linea/ciudad) — para buscador por ID
  const allEnrichedRows = useMemo(() =>
    rows.map(row => ({ ...row, ...computeRowSla(row, slaConfig, horariosMap) })),
  [rows, slaConfig, horariosMap]);

  // ── Cargar desde ClickHouse ──
  const loadFromClickHouse = async () => {
    if (chStatus === "running") return;
    if (chPollRef) { clearTimeout(chPollRef); setChPollRef(null); }
    setChStatus("running");
    setChError(null);
    setChMsg("Iniciando consulta ClickHouse…");

    const csrf = window.__RAILS_CSRF_TOKEN__ || document.querySelector('meta[name="csrf-token"]')?.content || "";
    const params = `desde=${chDesde}&hasta=${chHasta}`;

    const handleDone = async (data) => {
      const rawRows = data.data || [];
      if (!rawRows.length) {
        setChStatus("done");
        setChMsg(`⚠️ Sin datos para el rango ${chDesde} – ${chHasta}`);
        return;
      }
      const processed = procesarRows(rawRows).filter(r => !isEstadoExcluido(r.estado));
      const d0 = new Date(chDesde + "T12:00:00");
      const mesKey = `${MESES_LABEL[d0.getMonth()]} ${d0.getFullYear()}`;
      const fmtD = (s) => s.split("-").reverse().join("/");
      const chLabel = `${fmtD(chDesde)} – ${fmtD(chHasta)}`;
      await idbSave(mesKey, { rows: processed, archivo: "ClickHouse", fecha: new Date().toISOString(), total: processed.length });
      const newIdx = { ...loadIndex(), [mesKey]: { archivo: "ClickHouse", fecha: new Date().toISOString(), total: processed.length, label: chLabel } };
      saveIndex(newIdx);
      setIndex(newIdx);
      setMesSel(mesKey);
      setChStatus("done");
      setChMsg(`✅ ${rawRows.length.toLocaleString()} registros cargados (${chDesde} → ${chHasta})`);
    };

    const poll = async (attempts = 0) => {
      if (attempts > 120) {
        setChStatus("error");
        setChError("La consulta tardó demasiado. Intenta con un rango de fechas menor.");
        return;
      }
      try {
        const r = await fetch(`/api/cruz_verde/status?${params}`, { headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (d.status === "done") {
          await handleDone(d);
        } else if (d.status === "error") {
          setChStatus("error");
          setChError(d.error || "Error en ClickHouse");
        } else {
          const elapsed = attempts * 5;
          setChMsg(`⏳ Consultando ClickHouse… ${elapsed}s (puede tardar hasta 3 min)`);
          const tid = setTimeout(() => poll(attempts + 1), 5000);
          setChPollRef(tid);
        }
      } catch (e) {
        setChStatus("error");
        setChError(e.message);
      }
    };

    try {
      const r = await fetch(`/api/cruz_verde/consulta?${params}`, {
        headers: { "X-CSRF-Token": csrf, Accept: "application/json" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.status === "done") {
        await handleDone(d);
      } else if (d.status === "error") {
        setChStatus("error");
        setChError(d.error || "Error en ClickHouse");
      } else {
        setChMsg("⏳ Consultando ClickHouse… (puede tardar hasta 3 min)");
        const tid = setTimeout(() => poll(1), 5000);
        setChPollRef(tid);
      }
    } catch (e) {
      setChStatus("error");
      setChError(e.message);
    }
  };

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
      if (!rawRows[0].nombre_usuario && !rawRows[0].nombre_empresa && !rawRows[0].estado)
        throw new Error("Formato no reconocido. ¿Es el archivo 'Cruz verde [mes].xlsx'?");
      const processed = procesarRows(rawRows).filter(r => !isEstadoExcluido(r.estado));
      const mesKey    = `${MESES_LABEL[upMesN - 1]} ${upAnio}`;
      await idbSave(mesKey, { rows: processed, archivo: file.name, fecha: new Date().toISOString(), total: processed.length });
      const newIdx = { ...index, [mesKey]: { archivo: file.name, fecha: new Date().toISOString(), total: processed.length } };
      saveIndex(newIdx);
      setIndex(newIdx);
      setMesSel(mesKey);
      const nd = processed.filter(r => r.linea === "integ_nd").length;
      const sd = processed.filter(r => r.linea === "integ_sd").length;
      const mo = processed.filter(r => r.linea === "mostrador").length;
      setUploadMsg({ ok: true, txt: `✅ ${mesKey}: ${processed.length.toLocaleString()} registros — Mostrador: ${mo} · Same Day: ${sd} · Next Day: ${nd}` });
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

  // Visible tabs
  const currentEmail = (window.__RAILS_USER__?.email || "").toLowerCase().trim();
  const visibleTabs = TABS.filter(t => {
    if (t.adminOnly && !isAdmin) return false;
    if (t.hiddenForEmails?.has(currentEmail)) return false;
    return true;
  });

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
            </div>
            {loadingServer && (
              <span className="text-xs text-teal-600 font-medium animate-pulse shrink-0 ml-2">⏳ Sincronizando con el servidor…</span>
            )}
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                {publishMsg && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${publishMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {publishMsg.txt}
                  </span>
                )}
                <button disabled={publishing} onClick={async () => {
                  if (!confirm("¿Limpiar los datos publicados? Los usuarios del equipo verán el módulo vacío.")) return;
                  setPublishing(true); setPublishMsg(null);
                  try {
                    await clearFromServer("cruz_verde");
                    setPublishMsg({ ok: true, txt: "🗑️ Datos del equipo eliminados" });
                  } catch (err) {
                    setPublishMsg({ ok: false, txt: `❌ Error: ${err.message}` });
                  } finally {
                    setPublishing(false);
                    setTimeout(() => setPublishMsg(null), 6000);
                  }
                }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition shrink-0 ${publishing ? "opacity-60 cursor-not-allowed bg-gray-400" : "bg-gray-500 hover:bg-gray-600"}`}>
                  🗑️ Limpiar publicación
                </button>
                <button disabled={publishing} onClick={async () => {
                  setPublishing(true); setPublishMsg(null);
                  try {
                    const idx = loadIndex();
                    // Campos mínimos para gráficas y métricas — excluye strings largos
                    // (descripcion, iniciadoRaw, finalizadoRaw, uuid, idPiloto, etc.)
                    // que solo usa el admin para búsqueda interna y no caben en el payload.
                    const SLIM = new Set(['fecha','mes','linea','ciudad','sucursal','km',
                      'minutos','horaEntrega','esPerfecto','esDevolucion','estado','costo',
                      'dayOfWeek','localidadOrigen','localidadDestino','nombrePiloto',
                      'tsalida','direccionOrigen']);
                    const slimRow = (r) => { const s = {}; for (const k of SLIM) if (k in r) s[k] = r[k]; return s; };
                    const allData = {
                      index: idx,
                      meses: {},
                      directorio: JSON.parse(localStorage.getItem("pibox_cv_directorio") || "null"),
                      horariosSd: JSON.parse(localStorage.getItem(SK_HORARIOS_SD) || "null"),
                      sla: JSON.parse(localStorage.getItem("pibox_cv_sla") || "{}"),
                      umbrales: JSON.parse(localStorage.getItem("pibox_cv_umbrales") || "{}"),
                    };
                    await Promise.all(Object.keys(idx).map(async (key) => {
                      const d = await idbLoad(key);
                      if (d) allData.meses[key] = { ...d, rows: (d.rows || []).map(slimRow) };
                    }));
                    const result = await publishToServer("cruz_verde", allData);
                    setPublishMsg({ ok: true, txt: `✅ Publicado – ${new Date(result.published_at).toLocaleString("es-CO")}` });
                  } catch (err) {
                    setPublishMsg({ ok: false, txt: `❌ Error: ${err.message}` });
                  } finally {
                    setPublishing(false);
                    setTimeout(() => setPublishMsg(null), 6000);
                  }
                }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition shrink-0 ${publishing ? "opacity-60 cursor-not-allowed bg-teal-400" : "bg-teal-600 hover:bg-teal-700"}`}>
                  {publishing ? "⏳ Publicando…" : "🌐 Publicar para el equipo"}
                </button>
              </div>
            )}
          </div>

          {/* Filtros de mes + línea + ciudad */}
          {meses.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">📅 Mes a analizar</label>
                <select value={mesSel}
                  onChange={e => { setMesSel(e.target.value); setFiltFechaIni(""); setFiltFechaFin(""); }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                  {meses.map(m => <option key={m} value={m}>{index[m]?.label || m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Línea</label>
                <select value={filtLinea} onChange={e => setFiltLinea(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                  <option value="todas">Todas</option>
                  <option value="mostrador">Mostrador</option>
                  <option value="integ_sd">Same Day</option>
                  <option value="integ_nd">Next Day</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Ciudad</label>
                <select value={filtCiudad} onChange={e => setFiltCiudad(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                  <option value="todas">Todas</option>
                  {ciudades.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Desde</label>
                <input type="date" value={filtFechaIni} onChange={e => setFiltFechaIni(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Hasta</label>
                <input type="date" value={filtFechaFin} onChange={e => setFiltFechaFin(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div ref={tiendaRef} className="relative">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Filtro por tienda</label>
                  <button
                    onClick={() => setTiendaDropOpen(v => !v)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 min-w-[150px] flex items-center justify-between gap-2"
                  >
                    <span className="truncate max-w-[120px]">
                      {filtTiendas.length === 0 ? "Todas" : `${filtTiendas.length} tienda${filtTiendas.length > 1 ? "s" : ""}`}
                    </span>
                    <span className="text-gray-400 text-xs">▾</span>
                  </button>
                  {tiendaDropOpen && (
                    <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl w-80 max-h-72 flex flex-col">
                      <div className="p-2 border-b border-gray-100">
                        <input
                          type="text"
                          value={tiendaBusq}
                          onChange={e => setTiendaBusq(e.target.value)}
                          placeholder="Buscar tienda..."
                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {filtTiendas.length > 0 && (
                          <button
                            onClick={() => setFiltTiendas([])}
                            className="w-full text-left text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 border-b border-gray-100"
                          >
                            ✕ Limpiar selección ({filtTiendas.length})
                          </button>
                        )}
                        {tiendasFiltradas.map(t => (
                          <label key={t} className="flex items-center gap-2 px-3 py-1.5 hover:bg-teal-50 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={filtTiendas.includes(t)}
                              onChange={() => setFiltTiendas(prev =>
                                prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                              )}
                              className="accent-teal-600 flex-shrink-0"
                            />
                            <span className="truncate">{t}</span>
                          </label>
                        ))}
                        {tiendasFiltradas.length === 0 && (
                          <p className="text-xs text-gray-400 px-3 py-3 text-center">Sin resultados</p>
                        )}
                      </div>
                    </div>
                  )}
              </div>
              <div ref={dirRef} className="relative">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Dirección origen</label>
                <button
                  onClick={() => setDirDropOpen(v => !v)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 min-w-[150px] flex items-center justify-between gap-2"
                >
                  <span className="truncate max-w-[120px]">
                    {filtDirecciones.length === 0 ? "Todas" : `${filtDirecciones.length} dirección${filtDirecciones.length > 1 ? "es" : ""}`}
                  </span>
                  <span className="text-gray-400 text-xs">▾</span>
                </button>
                {dirDropOpen && (
                  <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl w-80 max-h-72 flex flex-col">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        type="text"
                        value={dirBusq}
                        onChange={e => setDirBusq(e.target.value)}
                        placeholder="Buscar dirección..."
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {filtDirecciones.length > 0 && (
                        <button
                          onClick={() => setFiltDirecciones([])}
                          className="w-full text-left text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 border-b border-gray-100"
                        >
                          ✕ Limpiar selección ({filtDirecciones.length})
                        </button>
                      )}
                      {direccionesFiltradas.map(d => (
                        <label key={d} className="flex items-center gap-2 px-3 py-1.5 hover:bg-teal-50 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={filtDirecciones.includes(d)}
                            onChange={() => setFiltDirecciones(prev =>
                              prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                            )}
                            className="accent-teal-600 flex-shrink-0"
                          />
                          <span className="truncate">{d}</span>
                        </label>
                      ))}
                      {direccionesFiltradas.length === 0 && (
                        <p className="text-xs text-gray-400 px-3 py-3 text-center">Sin resultados</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {(filtFechaIni || filtFechaFin) && (
                <div className="self-end pb-1">
                  <button onClick={() => { setFiltFechaIni(""); setFiltFechaFin(""); }}
                    className="text-xs text-gray-400 hover:text-red-500 transition" title="Limpiar fechas">
                    ✕ fechas
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sub-tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {visibleTabs.map(t => (
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
        {rows.length === 0 && !loading && tab !== "admin" && tab !== "notas" && (
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
            {tab === "resumen"    && <ResumenPanel rows={filteredRows} allRows={allEnrichedRows} />}
            {tab === "mostrador"  && <LineaPanel rows={tabRows} linea="mostrador"
              prevRows={prevRows.filter(r => r.linea === "mostrador")} prevMesLabel={prevMesSel} />}
            {tab === "integ_sd"   && <LineaPanel rows={tabRows} linea="integ_sd"
              prevRows={prevRows.filter(r => r.linea === "integ_sd")}  prevMesLabel={prevMesSel} />}
            {tab === "integ_nd"   && <LineaPanel rows={tabRows} linea="integ_nd"
              prevRows={prevRows.filter(r => r.linea === "integ_nd")}  prevMesLabel={prevMesSel} />}
            {tab === "pilotos" && (
              <PilotosPanel rows={filteredRows} prevRows={prevRows} prevMesLabel={prevMesSel} />
            )}
            {tab === "prod_pilotos" && (
              <ProductividadPilotosPanel rows={filteredRows} />
            )}
            {tab === "entregas" && (
              <EntregasPanel rows={filteredRows} />
            )}
            {tab === "insight" && (
              <InsightPanel rows={filteredRows} prevRows={prevRows} />
            )}
          </>
        )}

        {/* Panel Notas y Tareas — siempre visible, sin necesitar datos */}
        {tab === "notas" && <NotasTareasCruzVerde isAdmin={isAdmin} />}

        {/* Panel Administrativo */}
        {tab === "admin" && isAdmin && (
          <AdminPanel
            slaConfig={slaConfig}
            setSlaConfig={setSlaConfig}
            setHorariosMap={setHorariosMap}
            rows={rows}
          />
        )}

        {/* ── Panel: ClickHouse ── */}
        {tab !== "admin" && tab !== "insight" && tab !== "entregas" && tab !== "notas" && (
          <div className="bg-white rounded-2xl shadow-md border border-teal-100 p-5">
            <h3 className="font-bold text-gray-700 text-sm mb-1">⚡ Cargar desde ClickHouse</h3>
            <p className="text-xs text-gray-400 mb-4">Ejecuta el reporte en tiempo real. Puede tardar hasta 3 minutos.</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Desde</label>
                <input type="date" value={chDesde} onChange={e => setChDesde(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Hasta</label>
                <input type="date" value={chHasta} onChange={e => setChHasta(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <button
                onClick={loadFromClickHouse}
                disabled={chStatus === "running"}
                className={`px-5 py-2 rounded-xl text-white text-sm font-bold shadow transition ${chStatus === "running" ? "opacity-60 cursor-not-allowed bg-teal-400" : "bg-teal-600 hover:bg-teal-700"}`}>
                {chStatus === "running" ? "⏳ Consultando…" : "⚡ Consultar ClickHouse"}
              </button>
            </div>
            {(chMsg || chError) && (
              <p className={`mt-3 text-sm font-semibold ${chStatus === "error" ? "text-red-600" : chStatus === "done" ? "text-green-600" : "text-teal-600 animate-pulse"}`}>
                {chStatus === "error" ? `❌ ${chError}` : chMsg}
              </p>
            )}
          </div>
        )}

        {/* ── Panel: Subir nuevo mes ── */}
        {isAdmin && tab !== "admin" && tab !== "insight" && tab !== "entregas" && tab !== "notas" && (
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
        )}

        {/* Lista de meses para no-admin (sin uploader ni botón eliminar) */}
        {!isAdmin && tab !== "admin" && tab !== "insight" && tab !== "entregas" && tab !== "notas" && meses.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 mb-2">Meses cargados ({meses.length})</p>
            <div className="flex flex-wrap gap-2">
              {meses.map(m => (
                <button key={m} onClick={() => setMesSel(m)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                    mesSel === m ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-teal-50"
                  }`}
                  style={mesSel === m ? { background: C_TEAL } : {}}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
