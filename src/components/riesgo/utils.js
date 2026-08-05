// ── Constantes ────────────────────────────────────────────────────────────────
export const PIBOX_PURPLE = "#7C22D4";
export const PIBOX_PINK   = "#C026D3";
export const SEM_ROJO     = "#DC2626";
export const SEM_AMARILLO = "#D97706";
export const SEM_VERDE    = "#16A34A";

export const MESES_ES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
                          "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export const SK_INDEX = "pibox_riesgo_index";
export const SK_MES   = (k) => `pibox_riesgo_${k}`;

export const UMBRALES_DEFAULT = {
  gmv_caida_rojo:     -0.15,
  gmv_caida_amarillo: -0.05,
  cancel_rojo:         0.20,
  cancel_amarillo:     0.10,
  completado_rojo:     0.70,
  completado_amarillo: 0.85,
  expirado_rojo:       0.15,
  expirado_amarillo:   0.05,
};

export const SLA_DEFAULT = {
  rangos: [
    { label: "0–3 km",     maxKm: 3,  minutos: 35 },
    { label: "3,1–5 km",   maxKm: 5,  minutos: 45 },
    { label: "5,1–7 km",   maxKm: 7,  minutos: 50 },
    { label: "7,1–10 km",  maxKm: 10, minutos: 65 },
    { label: "10,1–17 km", maxKm: 17, minutos: 110 },
  ],
  nextDayHora: 18,
};
// Legacy — conservadas para que buildear no rompa imports existentes; no usar localStorage
export function getSLAConfig() { return { ...SLA_DEFAULT }; }
export function saveSLAConfig(_cfg) { /* no-op: ahora la config vive en React state */ }

export const mesKey = (anio, mes) => `${anio}-${String(mes).padStart(2,"0")}`;
export const labelMes = (anio, mes) => `${MESES_ES[mes]} ${anio}`;

// ── Datos iniciales para no-admin ──────────────────────────────────────────
let _riesgoInicial = null;
function getRiesgoInicial() {
  if (!_riesgoInicial) {
    try { _riesgoInicial = require("../../data/riesgoInicial.json"); } catch { _riesgoInicial = { index: {}, meses: {} }; }
  }
  return _riesgoInicial;
}

export function loadIndexReadonly() {
  return getRiesgoInicial().index || {};
}
export function loadMesDataReadonly(key) {
  return getRiesgoInicial().meses?.[key] || null;
}

// ── Índice de meses (Admin — localStorage) ────────────────────────────────────
export function loadIndex() {
  try { return JSON.parse(localStorage.getItem(SK_INDEX) || "{}"); }
  catch { return {}; }
}
export function saveIndex(idx) {
  localStorage.setItem(SK_INDEX, JSON.stringify(idx));
}
// ── Datos de mes: IndexedDB (sin límite) con fallback a localStorage ────────
const IDB_NAME = "pibox_riesgo_db";
const IDB_STORE_MES = "mesData";

function idbOpenMes() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 3);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("drivers")) db.createObjectStore("drivers");
      if (!db.objectStoreNames.contains(IDB_STORE_MES)) db.createObjectStore(IDB_STORE_MES);
      if (!db.objectStoreNames.contains("horasRows")) db.createObjectStore("horasRows");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Cache en memoria para evitar lecturas IDB repetidas
const _mesCache = {};

export function loadMesData(key) {
  // Primero cache, luego localStorage (legacy), IDB se carga async
  if (_mesCache[key]) return _mesCache[key];
  try {
    const ls = localStorage.getItem(SK_MES(key));
    if (ls) { const d = JSON.parse(ls); _mesCache[key] = d; return d; }
  } catch {}
  return null;
}

export async function loadMesDataAsync(key) {
  if (_mesCache[key]) return _mesCache[key];
  // Intentar localStorage primero (legacy)
  try {
    const ls = localStorage.getItem(SK_MES(key));
    if (ls) { const d = JSON.parse(ls); _mesCache[key] = d; return d; }
  } catch {}
  // Intentar IndexedDB
  try {
    const db = await idbOpenMes();
    const tx = db.transaction(IDB_STORE_MES, "readonly");
    const req = tx.objectStore(IDB_STORE_MES).get(key);
    const result = await new Promise(r => { req.onsuccess = () => r(req.result || null); req.onerror = () => r(null); });
    if (result) _mesCache[key] = result;
    return result;
  } catch { return null; }
}

export async function saveMesData(key, data) {
  _mesCache[key] = data;
  // Guardar en IndexedDB (sin límite)
  try {
    const db = await idbOpenMes();
    const tx = db.transaction(IDB_STORE_MES, "readwrite");
    tx.objectStore(IDB_STORE_MES).put(data, key);
    await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; });
  } catch (e) {
    console.warn("IDB save error, fallback to localStorage:", e);
    // Fallback a localStorage
    localStorage.setItem(SK_MES(key), JSON.stringify(data));
  }
  // Limpiar localStorage legacy si existe (liberar espacio)
  try { localStorage.removeItem(SK_MES(key)); } catch {}
}

export async function deleteMes(key) {
  const idx = loadIndex();
  delete idx[key];
  saveIndex(idx);
  delete _mesCache[key];
  localStorage.removeItem(SK_MES(key));
  try {
    const db = await idbOpenMes();
    const tx = db.transaction(IDB_STORE_MES, "readwrite");
    tx.objectStore(IDB_STORE_MES).delete(key);
  } catch {}
}
export function mesesDisponibles() {
  const idx = loadIndex();
  return Object.values(idx).sort((a,b) => a.key < b.key ? -1 : 1);
}

// ── Procesamiento del Excel ───────────────────────────────────────────────────
export function procesarDatos(rows, slaConfig = null) {
  // Normaliza valores de filas
  const toNum = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.-]/g,"")); return isNaN(n)?0:n; };
  const toStr = (v) => String(v ?? "").trim();

  // Mapear por empresa y por ciudad
  const empMap = {};
  const globalWeekly = {};
  const globalDaily  = {};
  const opDailyMap   = {}; // op → dateStr → { gmv, servicios, completados }
  const cityMap = {};
  const sla = slaConfig || SLA_DEFAULT;

  for (const row of rows) {
    const empresa   = toStr(row["company"] || row["Company"] || "Sin empresa");
    const companyId = toStr(row["company_id"] || row["Company_id"] || "");
    const bookingId = toStr(row["booking_id"] || row["BOOKING_ID"] || "");
    const city     = toStr(row["city"]    || row["City"]    || "Sin ciudad");
    const sede     = toStr(row["sede"]    || "Sin sede");
    const op       = toStr(row["operation_type"] || "Otro");
    const status   = toStr(row["service_status"] || "");
    const gmv      = toNum(row["gmv"]);
    const cost     = toNum(row["service_cost"]);
    const pkgs     = toNum(row["packages"]);
    const exec     = toStr(row["account_manager"] || "Sin asignar");
    const relaunched = toNum(row["num_total_relaunched_count"]);
    const distance = toNum(row["distance"]); // en metros
    const returnedPkgs = toNum(row["returned_packages"]);
    const serviceType = toStr(row["service_type"] || row["SERVICE_TYPE"] || "");
    const isNextDay = serviceType.toLowerCase().includes("next");
    const dtTimeRaw = toStr(row["dt_time"] || "");
    const dtHourMatch = dtTimeRaw.match(/^(\d{1,2}):/);
    const dtHour = dtHourMatch ? parseInt(dtHourMatch[1]) : -1;
    // Tiempos (HH:MM:SS → minutos)
    const parseTime = (v) => { const m = String(v||"").match(/^(\d+):(\d+):(\d+)/); return m ? Number(m[1])*60+Number(m[2])+Number(m[3])/60 : 0; };
    const tAsignacion = parseTime(row["assignation_time"]);
    const tLlegada = parseTime(row["arrival_duration"]);
    const tRecogida = parseTime(row["picked-up_time"]);
    const tRuta = parseTime(row["route_time"]);
    const tTotal = parseTime(row["total_service_time"]);
    const driverId   = toStr(row["driver_id"] || row["DRIVER_ID"] || row["driverId"] || "");
    const driverName = toStr(row["driver_name"] || row["DRIVER_NAME"] || row["driverName"] || "");
    const usuario  = toStr(row["passenger_name"]  || "Sin usuario");

    // Estas deben declararse ANTES del try-catch para estar disponibles dentro de él
    const esCompletado       = status === "Completed";
    const esCancelado        = status.startsWith("Canceled");
    const esExpirado         = status === "Expired";
    const esCancelPax        = status === "Canceled by Passenger";
    const esCancelConductor  = status === "Canceled by Driver";

    // Semana del mes (1–5): qué semana dentro del mes calendario
    let semana = 0;
    let semanaLabel = "";
    try {
      // Añadir T12:00:00 para evitar que strings ISO de fecha pura se parseen
      // como UTC midnight (= día anterior en Colombia UTC-5).
      const rawDate = String(row["date"] ?? "");
      const d = new Date(rawDate.length === 10 ? rawDate + "T12:00:00" : rawDate);
      if (!isNaN(d.getTime())) {
        const dia = d.getDate();                     // 1-31
        semana = Math.ceil(dia / 7);                 // 1,2,3,4,5
        const mesN = d.getMonth() + 1;
        const anioN = d.getFullYear();
        const diaFin = Math.min(dia - ((dia-1)%7) + 6,
          new Date(anioN, mesN, 0).getDate());
        const diaIni = dia - ((dia-1)%7) + 1;
        semanaLabel = `${String(diaIni).padStart(2,"0")}/${String(mesN).padStart(2,"0")}–${String(diaFin).padStart(2,"0")}/${String(mesN).padStart(2,"0")}`;
        // daily global
        const dateStr  = d.toISOString().slice(0, 10);
        const diaLabel = `${String(dia).padStart(2,"0")}/${String(mesN).padStart(2,"0")}`;
        if (!globalDaily[dateStr]) globalDaily[dateStr] = { date: dateStr, dia, label: diaLabel, gmv: 0, servicios: 0, completados: 0, cancelados: 0, expirados: 0 };
        globalDaily[dateStr].gmv += gmv;
        globalDaily[dateStr].servicios++;
        if (esCompletado) globalDaily[dateStr].completados++;
        if (esCancelado)  globalDaily[dateStr].cancelados++;
        if (esExpirado)   globalDaily[dateStr].expirados++;
        // daily por tipo de operación
        if (!opDailyMap[op]) opDailyMap[op] = {};
        if (!opDailyMap[op][dateStr]) opDailyMap[op][dateStr] = { date: dateStr, dia, label: diaLabel, gmv: 0, servicios: 0, completados: 0 };
        opDailyMap[op][dateStr].gmv += gmv;
        opDailyMap[op][dateStr].servicios++;
        if (esCompletado) opDailyMap[op][dateStr].completados++;
      }
    } catch {}

    if (!empMap[empresa]) {
      empMap[empresa] = {
        empresa, companyId: companyId, total:0, completados:0, cancelados:0, expirados:0,
        canceladosPax:0, canceladosConductor:0, tiempoCancelPax:0, nTiempoCancelPax:0,
        cancelPaxBookings:[],
        tiempoExpirado:0, nTiempoExp:0,
        gmv:0, paquetes:0, service_cost:0, ejecutivo: exec,
        relanzamientos:0, devueltos:0, distancias:{}, distanciasOnDemand:{},
        onDemandOTTotal:0, onDemandOTOnTime:0, onDemandOTNoAplica:0,
        sinDistanciaOD: [],
        ciudades: {}, ops: {}, weekly: {}, usuarios: {}, sedes: {}, driversPorOp: {},
        cancelacionesTipo: {},
      };
    }
    const e = empMap[empresa];
    if (companyId && !e.companyId) e.companyId = companyId;
    e.total++;
    if (esCompletado) e.completados++;
    if (esCancelado)  { e.cancelados++; e.cancelacionesTipo[status] = (e.cancelacionesTipo[status]||0)+1; }
    if (esExpirado)   e.expirados++;
    if (esCancelPax) {
      e.canceladosPax++;
      if (bookingId) e.cancelPaxBookings.push(bookingId);
      if (tTotal > 0) { e.tiempoCancelPax += tTotal; e.nTiempoCancelPax++; }
    }
    if (esCancelConductor) e.canceladosConductor++;
    if (esExpirado && tTotal > 0) { e.tiempoExpirado += tTotal; e.nTiempoExp++; }
    e.gmv          += gmv;
    e.service_cost += cost;
    e.paquetes     += pkgs;
    e.relanzamientos += relaunched;
    e.devueltos    += returnedPkgs;
    // Distancia en km con tiempos
    const distKm = distance > 0 ? distance / 1000 : 0;
    const dRng = distKm < 3 ? "0-3 km" : distKm < 5 ? "3-5 km" : distKm < 10 ? "5-10 km" : "Más de 10 km";
    if (distKm > 0) {
      if (!e.distancias[dRng]) e.distancias[dRng] = { total: 0, completados: 0, canceladosConductor: 0, expirados: 0, relanzamientos: 0, tAsignacion: 0, tLlegada: 0, tRecogida: 0, tRuta: 0, tTotal: 0, nTiempos: 0 };
      const dr = e.distancias[dRng];
      dr.total++;
      if (esCompletado)      dr.completados++;
      if (esCancelConductor) dr.canceladosConductor++;
      if (esExpirado)        dr.expirados++;
      dr.relanzamientos += relaunched;
      if (tTotal > 0) { dr.tAsignacion += tAsignacion; dr.tLlegada += tLlegada; dr.tRecogida += tRecogida; dr.tRuta += tRuta; dr.tTotal += tTotal; dr.nTiempos++; }
      // Solo On Demand
      if (op.toLowerCase() === "on demand") {
        if (!e.distanciasOnDemand[dRng]) e.distanciasOnDemand[dRng] = { total: 0, completados: 0, canceladosConductor: 0, expirados: 0, relanzamientos: 0, tAsignacion: 0, tLlegada: 0, tRecogida: 0, tRuta: 0, tTotal: 0, nTiempos: 0, otTotal: 0, otOnTime: 0, otNoAplica: 0 };
        const dod = e.distanciasOnDemand[dRng];
        dod.total++;
        if (esCompletado)      dod.completados++;
        if (esCancelConductor) dod.canceladosConductor++;
        if (esExpirado)        dod.expirados++;
        dod.relanzamientos += relaunched;
        if (tTotal > 0) { dod.tAsignacion += tAsignacion; dod.tLlegada += tLlegada; dod.tRecogida += tRecogida; dod.tRuta += tRuta; dod.tTotal += tTotal; dod.nTiempos++; }
        if (esCompletado) {
          let dOt = false, dOtOn = false;
          if (isNextDay) { if (dtHour >= 0) { dOt = true; dOtOn = dtHour < sla.nextDayHora; } }
          else if (tTotal > 0) { const r = sla.rangos; if (distKm <= r[0].maxKm) { dOt=true; dOtOn=tTotal<=r[0].minutos; } else if (distKm <= r[1].maxKm) { dOt=true; dOtOn=tTotal<=r[1].minutos; } else if (distKm <= r[2].maxKm) { dOt=true; dOtOn=tTotal<=r[2].minutos; } else if (distKm <= r[3].maxKm) { dOt=true; dOtOn=tTotal<=r[3].minutos; } else if (distKm <= r[4].maxKm) { dOt=true; dOtOn=tTotal<=r[4].minutos; } }
          if (dOt) { dod.otTotal++; if (dOtOn) dod.otOnTime++; } else dod.otNoAplica++;
        }
      }
    }
    if (distKm === 0 && op.toLowerCase() === "on demand") {
      e.sinDistanciaOD.push({ fecha: toStr(row["date"]), empresa, ciudad: city, sede, operacion: op, estado: status, gmv, costo: cost, paquetes: pkgs, usuario, conductor: driverName, ejecutivo: exec, relanzamientos: relaunched });
    }
    if (exec && exec !== "Sin asignar") e.ejecutivo = exec;

    // por usuario (passenger_name)
    if (!e.usuarios[usuario]) e.usuarios[usuario] = {total:0,completados:0,gmv:0,relanzamientos:0,devueltos:0};
    e.usuarios[usuario].total++;
    e.usuarios[usuario].relanzamientos += relaunched;
    e.usuarios[usuario].devueltos += returnedPkgs;
    if (esCompletado) { e.usuarios[usuario].completados++; e.usuarios[usuario].gmv += gmv; }

    // por sede
    if (!e.sedes[sede]) e.sedes[sede] = {total:0,completados:0,gmv:0,relanzamientos:0,devueltos:0};
    e.sedes[sede].total++;
    e.sedes[sede].relanzamientos += relaunched;
    e.sedes[sede].devueltos += returnedPkgs;
    if (esCompletado) { e.sedes[sede].completados++; e.sedes[sede].gmv += gmv; }

    // ciudades
    if (!e.ciudades[city]) e.ciudades[city] = { gmv:0, count:0 };
    e.ciudades[city].gmv   += gmv;
    e.ciudades[city].count++;

    // ops — almacena métricas por tipo de operación
    if (!e.ops[op]) e.ops[op] = { total: 0, gmv: 0, completados: 0, cancelados: 0, paquetes: 0, relanzamientos: 0, devueltos: 0, canceladosPax: 0, expirados: 0 };
    if (typeof e.ops[op] === "number") e.ops[op] = { total: e.ops[op], gmv: 0, completados: 0, cancelados: 0, paquetes: 0, relanzamientos: 0, devueltos: 0, canceladosPax: 0, expirados: 0 };
    e.ops[op].total++;
    e.ops[op].gmv += gmv;
    e.ops[op].paquetes += pkgs;
    e.ops[op].relanzamientos += relaunched;
    e.ops[op].devueltos += returnedPkgs;
    if (esCompletado)  e.ops[op].completados++;
    if (esCancelado)   e.ops[op].cancelados++;
    if (esCancelPax)   e.ops[op].canceladosPax++;
    if (esExpirado)    e.ops[op].expirados++;

    // drivers por operación en empresa
    const driverKeyEmp = driverId || driverName;
    if (driverKeyEmp) {
      if (!e.driversPorOp[op]) e.driversPorOp[op] = { drivers: new Set(), servicios: 0 };
      e.driversPorOp[op].drivers.add(driverKeyEmp);
      e.driversPorOp[op].servicios++;
    }

    // weekly por empresa
    if (semana > 0) {
      if (!e.weekly[semana]) e.weekly[semana] = { gmv:0,servicios:0,completados:0,cancelados:0,canceladosConductor:0,expirados:0,paquetes:0,label:semanaLabel };
      e.weekly[semana].gmv        += gmv;
      e.weekly[semana].servicios++;
      e.weekly[semana].paquetes   += pkgs;
      if (esCompletado)       e.weekly[semana].completados++;
      if (esCancelado)        e.weekly[semana].cancelados++;
      if (esCancelConductor)  e.weekly[semana].canceladosConductor++;
      if (esExpirado)         e.weekly[semana].expirados++;
    }

    // weekly global
    if (semana > 0) {
      if (!globalWeekly[semana]) globalWeekly[semana] = { gmv:0,servicios:0,completados:0,cancelados:0,canceladosConductor:0,expirados:0,label:semanaLabel };
      globalWeekly[semana].gmv += gmv;
      globalWeekly[semana].servicios++;
      if (esCompletado)       globalWeekly[semana].completados++;
      if (esCancelado)        globalWeekly[semana].cancelados++;
      if (esCancelConductor)  globalWeekly[semana].canceladosConductor++;
      if (esExpirado)         globalWeekly[semana].expirados++;
    }

    // ── Agregación por ciudad ─────────────────────────────────────────────
    const locality    = toStr(row["locality"]      || row["Locality"] || "Sin localidad");
    const estadoBk    = toStr(row["estado_booking"] || row["estado_Booking"] || status || "Sin estado");

    if (!cityMap[city]) cityMap[city] = {
      city, total:0, gmv:0, paquetes:0, completados:0, cancelados:0, expirados:0, canceladosConductor:0,
      localidades:{}, ops:{}, estados:{}, weekly:{}, driversPorOp:{},
      onDemandOTTotal:0, onDemandOTOnTime:0, onDemandOTNoAplica:0,
    };
    const cv = cityMap[city];

    // On Time SLA — solo On Demand completados
    if (op.toLowerCase().includes("on demand") && esCompletado) {
      let applicable = false, onTime = false;
      if (isNextDay) {
        if (dtHour >= 0) { applicable = true; onTime = dtHour < sla.nextDayHora; }
      } else if (distKm > 0 && tTotal > 0) {
        const r = sla.rangos;
        if      (distKm <= r[0].maxKm) { applicable = true; onTime = tTotal <= r[0].minutos; }
        else if (distKm <= r[1].maxKm) { applicable = true; onTime = tTotal <= r[1].minutos; }
        else if (distKm <= r[2].maxKm) { applicable = true; onTime = tTotal <= r[2].minutos; }
        else if (distKm <= r[3].maxKm) { applicable = true; onTime = tTotal <= r[3].minutos; }
        else if (distKm <= r[4].maxKm) { applicable = true; onTime = tTotal <= r[4].minutos; }
      }
      if (applicable) {
        e.onDemandOTTotal++;  if (onTime) e.onDemandOTOnTime++;
        cv.onDemandOTTotal++; if (onTime) cv.onDemandOTOnTime++;
      } else {
        e.onDemandOTNoAplica++;
        cv.onDemandOTNoAplica++;
      }
    }
    cv.total++;  cv.gmv += gmv;  cv.paquetes += pkgs;

    // Drivers por tipo de operación en esta ciudad
    const driverKeyCv = driverId || driverName;
    if (driverKeyCv) {
      if (!cv.driversPorOp[op]) cv.driversPorOp[op] = { drivers: new Set(), servicios: 0 };
      cv.driversPorOp[op].drivers.add(driverKeyCv);
      cv.driversPorOp[op].servicios++;
    }
    if (esCompletado)      cv.completados++;
    if (esCancelado)       cv.cancelados++;
    if (esExpirado)        cv.expirados++;
    if (esCancelConductor) cv.canceladosConductor++;

    if (!cv.localidades[locality]) cv.localidades[locality] = {total:0,paquetes:0,gmv:0,completados:0,cancelados:0};
    const lv = cv.localidades[locality];
    lv.total++; lv.paquetes += pkgs; lv.gmv += gmv;
    if (esCompletado) lv.completados++;
    if (esCancelado)  lv.cancelados++;

    if (!cv.ops[op]) cv.ops[op] = {total:0,paquetes:0,gmv:0};
    cv.ops[op].total++; cv.ops[op].paquetes += pkgs; cv.ops[op].gmv += gmv;

    if (!cv.estados[estadoBk]) cv.estados[estadoBk] = {total:0,paquetes:0};
    cv.estados[estadoBk].total++; cv.estados[estadoBk].paquetes += pkgs;

    if (semana > 0) {
      if (!cv.weekly[semana]) cv.weekly[semana] = {gmv:0,servicios:0,paquetes:0,completados:0,cancelados:0,canceladosConductor:0,expirados:0,label:semanaLabel};
      cv.weekly[semana].gmv += gmv; cv.weekly[semana].servicios++;
      cv.weekly[semana].paquetes += pkgs;
      if (esCompletado)       cv.weekly[semana].completados++;
      if (esCancelado)        cv.weekly[semana].cancelados++;
      if (esCancelConductor)  cv.weekly[semana].canceladosConductor++;
      if (esExpirado)         cv.weekly[semana].expirados++;
    }
  }

  // Convertir a arrays serializables
  const empresas = Object.values(empMap).map(e => {
    const denomEfOp = e.completados + (e.canceladosConductor||0) + e.expirados;
    const tc = denomEfOp > 0 ? e.completados / denomEfOp : 0;  // Efectividad Operativa
    const tca= e.total > 0 ? e.cancelados/e.total  : 0;
    const te = e.total > 0 ? e.expirados/e.total   : 0;

    const ciudadTop = Object.entries(e.ciudades)
      .sort((a,b)=>b[1].count-a[1].count)[0]?.[0] || "";

    const topCiudades = Object.entries(e.ciudades)
      .map(([city,v])=>({city, gmv:v.gmv, count:v.count}))
      .sort((a,b)=>b.gmv-a.gmv).slice(0,30);

    const topOps = Object.entries(e.ops)
      .map(([op, v]) => ({ op, count: typeof v === "object" ? v.total : v }))
      .sort((a,b) => b.count - a.count);

    const weekly = Object.entries(e.weekly)
      .map(([s,v])=>({
        semana: Number(s),
        label: v.label || `S${s}`,
        gmv:v.gmv, servicios:v.servicios, paquetes:v.paquetes,
        completados:v.completados, cancelados:v.cancelados,
        canceladosConductor: v.canceladosConductor||0, expirados: v.expirados||0,
        tasa_completado: (v.completados+(v.canceladosConductor||0)+(v.expirados||0))>0 ? v.completados/(v.completados+(v.canceladosConductor||0)+(v.expirados||0)) : 0,
        tasa_cancelacion: v.servicios>0 ? v.cancelados/v.servicios : 0,
      }))
      .sort((a,b)=>a.semana-b.semana);

    const topUsuarios = Object.entries(e.usuarios)
      .map(([u,v])=>({usuario:u, ...v}))
      .sort((a,b)=>b.total-a.total)
      .slice(0,20);

    const topSedes = Object.entries(e.sedes)
      .map(([s,v])=>({sede:s, ...v}))
      .sort((a,b)=>b.total-a.total)
      .slice(0,20);

    // Drivers por operación en esta empresa
    const empDriversPorOp = Object.entries(e.driversPorOp)
      .map(([op, v]) => ({ op, driversActivos: v.drivers.size, servicios: v.servicios, promServPorDriver: v.drivers.size > 0 ? Math.round(v.servicios / v.drivers.size) : 0 }))
      .sort((a, b) => b.driversActivos - a.driversActivos);
    const empTotalDrivers = new Set();
    Object.values(e.driversPorOp).forEach(v => v.drivers.forEach(d => empTotalDrivers.add(d)));

    return {
      empresa: e.empresa, companyId: e.companyId, total: e.total,
      completados: e.completados, cancelados: e.cancelados, expirados: e.expirados,
      canceladosPax: e.canceladosPax, canceladosConductor: e.canceladosConductor||0,
      cancelPaxBookings: e.cancelPaxBookings || [],
      avgTiempoCancelPax: e.nTiempoCancelPax > 0 ? e.tiempoCancelPax / e.nTiempoCancelPax : null,
      avgTiempoExpirado:  e.nTiempoExp       > 0 ? e.tiempoExpirado  / e.nTiempoExp       : null,
      gmv: e.gmv, service_cost: e.service_cost, paquetes: e.paquetes,
      ciudad: ciudadTop, ejecutivo: e.ejecutivo,
      relanzamientos: e.relanzamientos, devueltos: e.devueltos, distancias: e.distancias, distanciasOnDemand: e.distanciasOnDemand, sinDistanciaOD: e.sinDistanciaOD,
      tasa_completado: tc, tasa_cancelacion: tca, tasa_expirado: te,
      onTimePct: e.onDemandOTTotal > 0 ? e.onDemandOTOnTime / e.onDemandOTTotal : null,
      onDemandCompletados: e.onDemandOTTotal,
      onDemandOnTime: e.onDemandOTOnTime,
      onDemandNoAplica: e.onDemandOTNoAplica || 0,
      topCiudades, topOps, weekly, topUsuarios, topSedes,
      driversPorOp: empDriversPorOp, totalDrivers: empTotalDrivers.size,
      ops: e.ops,
      cancelacionesTipo: e.cancelacionesTipo,
    };
  });

  // ── Agregados globales: tipo operación, status, vehículo, drivers, línea ──
  const globalOps = {};
  const globalStatus = {};
  const globalVehicle = {};
  const vehicleByOp  = {}; // op → vh → { total, gmv }
  const globalLinea = {};
  const driversPorOp = {}; // op → Set de driver IDs únicos
  const driversGlobal = new Set();
  for (const row of rows) {
    const op = toStr(row["operation_type"] || row["OPERATION TYPE"] || "Otro");
    const st = toStr(row["service_status"] || row["Service Status"] || "Sin estado");
    const vh = toStr(row["vehicle_type"] || row["vehicleType"] || row["Vehicle Type"] || row["tipo_vehiculo"] || "Sin vehículo");
    const linea = toStr(row["service_type"] || row["SERVICE_TYPE"] || "Sin línea");
    const gmv = toNum(row["gmv"]);
    const driverId = toStr(row["driver_id"] || row["DRIVER_ID"] || row["driverId"] || "");
    const driverName = toStr(row["driver_name"] || row["DRIVER_NAME"] || row["driverName"] || "");
    const driverKey = driverId || driverName;

    if (!globalOps[op]) globalOps[op] = { total: 0, gmv: 0 };
    globalOps[op].total++; globalOps[op].gmv += gmv;
    if (!globalStatus[st]) globalStatus[st] = { total: 0, gmv: 0 };
    globalStatus[st].total++; globalStatus[st].gmv += gmv;
    if (!globalVehicle[vh]) globalVehicle[vh] = { total: 0, gmv: 0 };
    globalVehicle[vh].total++; globalVehicle[vh].gmv += gmv;
    // Vehículo por tipo de operación
    if (vh && vh !== "Sin vehículo") {
      if (!vehicleByOp[op]) vehicleByOp[op] = {};
      if (!vehicleByOp[op][vh]) vehicleByOp[op][vh] = { total: 0, gmv: 0 };
      vehicleByOp[op][vh].total++; vehicleByOp[op][vh].gmv += gmv;
    }
    if (!globalLinea[linea]) globalLinea[linea] = { total: 0, gmv: 0 };
    globalLinea[linea].total++; globalLinea[linea].gmv += gmv;

    // Drivers únicos por tipo de operación
    if (driverKey) {
      driversGlobal.add(driverKey);
      if (!driversPorOp[op]) driversPorOp[op] = { drivers: new Set(), servicios: 0 };
      driversPorOp[op].drivers.add(driverKey);
      driversPorOp[op].servicios++;
    }
  }
  // porVehiculoByOp: op → array de { name, total, gmv }
  const porVehiculoByOp = {};
  for (const [op, vhMap] of Object.entries(vehicleByOp)) {
    porVehiculoByOp[op] = Object.entries(vhMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
  }
  const porTipoOp = Object.entries(globalOps).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
  const porLinea  = Object.entries(globalLinea).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
  const porStatus = Object.entries(globalStatus).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
  // Excluir "Sin vehículo" (ClickHouse a veces no provee este campo)
  const porVehiculo = Object.entries(globalVehicle)
    .filter(([name]) => name && name !== "Sin vehículo")
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);
  const driversPorTipoOp = Object.entries(driversPorOp)
    .map(([op, v]) => ({ op, driversActivos: v.drivers.size, servicios: v.servicios, promServPorDriver: v.drivers.size > 0 ? Math.round(v.servicios / v.drivers.size) : 0 }))
    .sort((a, b) => b.driversActivos - a.driversActivos);
  const totalDriversActivos = driversGlobal.size;

  // totales globales
  const totalGmv = rows.reduce((s,r)=>s+toNum(r["gmv"]),0);
  const topCiudadesGlobal = (() => {
    const cm = {};
    for (const row of rows) {
      const c = toStr(row["city"] || "Sin ciudad");
      if (!cm[c]) cm[c] = { gmv: 0, servicios: 0, paquetes: 0 };
      cm[c].gmv += toNum(row["gmv"]);
      cm[c].servicios++;
      cm[c].paquetes += toNum(row["packages"]);
    }
    return Object.entries(cm).map(([city, v]) => ({ city, gmv: v.gmv, servicios: v.servicios, paquetes: v.paquetes }))
      .sort((a, b) => b.gmv - a.gmv).slice(0, 12);
  })();

  const dailyArr = Object.values(globalDaily).sort((a, b) => a.date.localeCompare(b.date));
  // Daily agrupado por tipo de operación para filtrado en MetricasRiesgo
  const dailyByOp = {};
  for (const [op, dateMap] of Object.entries(opDailyMap)) {
    dailyByOp[op] = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  const weeklyGlobal = Object.entries(globalWeekly)
    .map(([s,v])=>({
      semana: Number(s),
      label: v.label || `S${s}`,
      gmv:v.gmv, servicios:v.servicios,
      completados:v.completados, canceladosConductor:v.canceladosConductor||0, expirados:v.expirados||0,
      tasa_completado: (v.completados+(v.canceladosConductor||0)+(v.expirados||0))>0 ? v.completados/(v.completados+(v.canceladosConductor||0)+(v.expirados||0)) : 0,
      tasa_cancelacion: v.servicios>0?v.cancelados/v.servicios:0,
    }))
    .sort((a,b)=>a.semana-b.semana);

  // Serializar ciudades
  const ciudades = Object.values(cityMap).map(cv => {
    const localidades = Object.entries(cv.localidades)
      .map(([loc,v])=>({loc, ...v,
        tasa_completado: v.total>0?v.completados/v.total:0,
        tasa_cancelacion: v.total>0?v.cancelados/v.total:0,
      }))
      .sort((a,b)=>b.paquetes-a.paquetes).slice(0,20);

    const ops = Object.entries(cv.ops)
      .map(([op,v])=>({op, ...v}))
      .sort((a,b)=>b.total-a.total);

    const estados = Object.entries(cv.estados)
      .map(([estado,v])=>({estado, ...v}))
      .sort((a,b)=>b.total-a.total);

    const weekly = Object.entries(cv.weekly)
      .map(([s,v])=>({
        semana:Number(s), label:v.label||`S${s}`,
        gmv:v.gmv, servicios:v.servicios, paquetes:v.paquetes,
        completados:v.completados, cancelados:v.cancelados,
        canceladosConductor:v.canceladosConductor||0, expirados:v.expirados||0,
        tasa_completado: (v.completados+(v.canceladosConductor||0)+(v.expirados||0))>0 ? v.completados/(v.completados+(v.canceladosConductor||0)+(v.expirados||0)) : 0,
        tasa_cancelacion: v.servicios>0?v.cancelados/v.servicios:0,
      }))
      .sort((a,b)=>a.semana-b.semana);

    // Serializar drivers por operación (Sets → números)
    const driversPorOp = Object.entries(cv.driversPorOp)
      .map(([op, v]) => ({ op, driversActivos: v.drivers.size, servicios: v.servicios, promServPorDriver: v.drivers.size > 0 ? Math.round(v.servicios / v.drivers.size) : 0 }))
      .sort((a, b) => b.driversActivos - a.driversActivos);
    const totalDriversCiudad = new Set();
    Object.values(cv.driversPorOp).forEach(v => v.drivers.forEach(d => totalDriversCiudad.add(d)));

    return {
      city: cv.city, total: cv.total, gmv: cv.gmv, paquetes: cv.paquetes,
      completados: cv.completados, cancelados: cv.cancelados, expirados: cv.expirados,
      tasa_completado: (cv.completados+(cv.canceladosConductor||0)+cv.expirados)>0 ? cv.completados/(cv.completados+(cv.canceladosConductor||0)+cv.expirados) : 0,
      tasa_cancelacion: cv.total>0?cv.cancelados/cv.total:0,
      localidades, ops, estados, weekly, driversPorOp,
      totalDrivers: totalDriversCiudad.size,
      onTimePct: cv.onDemandOTTotal > 0 ? cv.onDemandOTOnTime / cv.onDemandOTTotal : null,
      onDemandCompletados: cv.onDemandOTTotal,
      onDemandOnTime: cv.onDemandOTOnTime,
      onDemandNoAplica: cv.onDemandOTNoAplica || 0,
    };
  }).sort((a,b)=>b.paquetes-a.paquetes);

  // ── Detalle por piloto ──────────────────────────────────────────────────
  const pilotoMap = {};
  for (const row of rows) {
    const dId = toStr(row["driver_id"] || row["DRIVER_ID"] || row["driverId"] || "");
    const dNm = toStr(row["driver_name"] || row["DRIVER_NAME"] || row["driverName"] || "");
    const dk = dId || dNm;
    if (!dk) continue;
    const city = toStr(row["city"] || row["City"] || "");
    const st = toStr(row["service_status"] || "");
    const gmv = toNum(row["gmv"]);
    const op = toStr(row["operation_type"] || row["OPERATION_TYPE"] || "");
    const tel = toStr(row["driver_phone"] || row["phone"] || row["telefono"] || row["driver_mobile"] || "");
    const rawDate = toStr(row["date"] || "");
    const dtTime = toStr(row["dt_time"] || "");
    let hora = -1;
    const hmMatch = dtTime.match(/^(\d{1,2}):/);
    if (hmMatch) hora = parseInt(hmMatch[1]);
    else { try { const rd = String(row["date"] ?? ""); const d = new Date(rd.length === 10 ? rd + "T12:00:00" : rd); if (!isNaN(d.getTime())) hora = d.getHours(); } catch {} }
    if (!pilotoMap[dk]) pilotoMap[dk] = { id: dId, n: dNm, ci: city, s: 0, c: 0, x: 0, g: 0, hp: {}, ops: {}, ultimaFecha: "", tel: "" };
    const p = pilotoMap[dk];
    p.s++;
    if (st === "Completed") p.c++;
    if (st.startsWith("Canceled")) p.x++;
    p.g += gmv;
    if (hora >= 0) p.hp[hora] = (p.hp[hora] || 0) + 1;
    if (dNm && dNm.length > (p.n || "").length) p.n = dNm;
    if (city) p.ci = city;
    if (op) p.ops[op] = (p.ops[op] || 0) + 1;
    if (rawDate && rawDate > p.ultimaFecha) p.ultimaFecha = rawDate;
    if (tel && !p.tel) p.tel = tel;
  }
  const drivers = Object.values(pilotoMap).map(p => {
    let h = -1, mx = 0;
    for (const [hr, cnt] of Object.entries(p.hp)) { if (cnt > mx) { mx = cnt; h = Number(hr); } }
    const ops = Object.entries(p.ops).sort((a, b) => b[1] - a[1]).map(([op]) => op).join(", ");
    return { id: p.id, n: p.n, ci: p.ci, s: p.s, c: p.c, x: p.x, g: Math.round(p.g), h, ops, ultimaFecha: p.ultimaFecha, tel: p.tel };
  });

  return {
    empresas,
    ciudades,
    drivers,
    totales: {
      servicios: rows.length,
      gmv: totalGmv,
      n_empresas: empresas.length,
      topCiudades: topCiudadesGlobal,
      weekly: weeklyGlobal,
      daily:  dailyArr,
      dailyByOp,
      porTipoOp,
      porLinea,
      porStatus,
      porVehiculo,
      porVehiculoByOp,
      driversPorTipoOp,
      totalDriversActivos,
    }
  };
}

// ── IndexedDB para drivers ──────────────────────────────────────────────
export async function idbSaveDrivers(mesKey, drivers) {
  try { const db = await idbOpenMes(); const tx = db.transaction("drivers", "readwrite"); tx.objectStore("drivers").put(drivers, mesKey); await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; }); } catch (e) { console.warn("IDB save drivers:", e); }
}
export async function idbLoadDrivers(mesKey) {
  try { const db = await idbOpenMes(); const tx = db.transaction("drivers", "readonly"); const req = tx.objectStore("drivers").get(mesKey); return new Promise(r => { req.onsuccess = () => r(req.result || null); req.onerror = () => r(null); }); } catch { return null; }
}
export async function idbDeleteDrivers(mesKey) {
  try { const db = await idbOpenMes(); const tx = db.transaction("drivers", "readwrite"); tx.objectStore("drivers").delete(mesKey); } catch {}
}

// ── IndexedDB para filas crudas Horas/OnDemand ─────────────────────────────
export async function idbSaveHorasRows(key, rows) {
  try { const db = await idbOpenMes(); const tx = db.transaction("horasRows", "readwrite"); tx.objectStore("horasRows").put(rows, key); await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; }); } catch (e) { console.warn("IDB save horasRows:", e); }
}
export async function idbLoadHorasRows(key) {
  try { const db = await idbOpenMes(); const tx = db.transaction("horasRows", "readonly"); const req = tx.objectStore("horasRows").get(key); return new Promise(r => { req.onsuccess = () => r(req.result || null); req.onerror = () => r(null); }); } catch { return null; }
}
export async function idbDeleteHorasRows(key) {
  try { const db = await idbOpenMes(); const tx = db.transaction("horasRows", "readwrite"); tx.objectStore("horasRows").delete(key); } catch {}
}

// ── Score de riesgo ───────────────────────────────────────────────────────────
export function calcularScore(kpi, kpiPrev, umb = UMBRALES_DEFAULT) {
  let pts = 100;
  const factores = [];

  if (kpi.tasa_completado < umb.completado_rojo) {
    pts -= 25; factores.push(`Ef. Operativa baja (${(kpi.tasa_completado*100).toFixed(0)}%)`);
  } else if (kpi.tasa_completado < umb.completado_amarillo) {
    pts -= 12; factores.push(`Ef. Operativa moderada (${(kpi.tasa_completado*100).toFixed(0)}%)`);
  }

  if (kpi.tasa_cancelacion > umb.cancel_rojo) {
    pts -= 25; factores.push(`Cancelaciones altas (${(kpi.tasa_cancelacion*100).toFixed(0)}%)`);
  } else if (kpi.tasa_cancelacion > umb.cancel_amarillo) {
    pts -= 12; factores.push(`Cancelaciones moderadas (${(kpi.tasa_cancelacion*100).toFixed(0)}%)`);
  }

  if (kpi.tasa_expirado > umb.expirado_rojo) {
    pts -= 10; factores.push(`Expirados altos (${(kpi.tasa_expirado*100).toFixed(0)}%)`);
  } else if (kpi.tasa_expirado > umb.expirado_amarillo) {
    pts -= 5;  factores.push(`Expirados moderados (${(kpi.tasa_expirado*100).toFixed(0)}%)`);
  }

  if (kpiPrev) {
    if (kpiPrev.gmv > 0) {
      const varGmv = (kpi.gmv - kpiPrev.gmv) / kpiPrev.gmv;
      if (varGmv < umb.gmv_caida_rojo) {
        pts -= 30; factores.push(`GMV cayó ${(varGmv*100).toFixed(0)}% vs mes anterior`);
      } else if (varGmv < umb.gmv_caida_amarillo) {
        pts -= 15; factores.push(`GMV bajó ${(varGmv*100).toFixed(0)}% vs mes anterior`);
      }
    }
  } else if (kpi.gmv === 0) {
    pts -= 20; factores.push("GMV = $0");
  }

  pts = Math.max(0, Math.min(100, pts));
  const color    = pts >= 75 ? "verde" : pts >= 50 ? "amarillo" : "rojo";
  const semaforo = pts >= 75 ? "🟢 Verde" : pts >= 50 ? "🟡 Amarillo" : "🔴 Rojo";
  const semColor = pts >= 75 ? SEM_VERDE  : pts >= 50 ? SEM_AMARILLO   : SEM_ROJO;

  return { score: pts, color, semaforo, semColor, factores };
}

// ── Formateadores ─────────────────────────────────────────────────────────────
export const fmtCOP = (n) =>
  new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
export const fmtM = (n) => {
  if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
};

// Cifra completa con separadores de miles
export const fmtFull = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(n);
export const fmtPct = (n) => `${(n*100).toFixed(1)}%`;
