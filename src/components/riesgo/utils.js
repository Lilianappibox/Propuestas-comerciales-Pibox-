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
export function loadMesData(key) {
  try { return JSON.parse(localStorage.getItem(SK_MES(key)) || "null"); }
  catch { return null; }
}
export function saveMesData(key, data) {
  localStorage.setItem(SK_MES(key), JSON.stringify(data));
}
export function deleteMes(key) {
  const idx = loadIndex();
  delete idx[key];
  saveIndex(idx);
  localStorage.removeItem(SK_MES(key));
}
export function mesesDisponibles() {
  const idx = loadIndex();
  return Object.values(idx).sort((a,b) => a.key < b.key ? -1 : 1);
}

// ── Procesamiento del Excel ───────────────────────────────────────────────────
export function procesarDatos(rows) {
  // Normaliza valores de filas
  const toNum = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.-]/g,"")); return isNaN(n)?0:n; };
  const toStr = (v) => String(v ?? "").trim();

  // Mapear por empresa y por ciudad
  const empMap = {};
  const globalWeekly = {};
  const cityMap = {};

  for (const row of rows) {
    const empresa  = toStr(row["company"] || row["Company"] || "Sin empresa");
    const city     = toStr(row["city"]    || row["City"]    || "Sin ciudad");
    const sede     = toStr(row["sede"]    || "Sin sede");
    const op       = toStr(row["operation_type"] || "Otro");
    const status   = toStr(row["service_status"] || "");
    const gmv      = toNum(row["gmv"]);
    const cost     = toNum(row["service_cost"]);
    const pkgs     = toNum(row["packages"]);
    const exec     = toStr(row["account_manager"] || "Sin asignar");
    const driverId   = toStr(row["driver_id"] || row["DRIVER_ID"] || row["driverId"] || "");
    const driverName = toStr(row["driver_name"] || row["DRIVER_NAME"] || row["driverName"] || "");
    const usuario  = toStr(row["passenger_name"]  || "Sin usuario");

    // Semana del mes (1–5): qué semana dentro del mes calendario
    let semana = 0;
    let semanaLabel = "";
    try {
      const d = new Date(row["date"]);
      if (!isNaN(d.getTime())) {
        const dia = d.getDate();                     // 1-31
        semana = Math.ceil(dia / 7);                 // 1,2,3,4,5
        const mesN = d.getMonth() + 1;
        const anioN = d.getFullYear();
        const diaFin = Math.min(dia - ((dia-1)%7) + 6,
          new Date(anioN, mesN, 0).getDate());
        const diaIni = dia - ((dia-1)%7) + 1;
        semanaLabel = `${String(diaIni).padStart(2,"0")}/${String(mesN).padStart(2,"0")}–${String(diaFin).padStart(2,"0")}/${String(mesN).padStart(2,"0")}`;
      }
    } catch {}

    const esCompletado = status === "Completed";
    const esCancelado  = status.startsWith("Canceled");
    const esExpirado   = status === "Expired";

    if (!empMap[empresa]) {
      empMap[empresa] = {
        empresa, total:0, completados:0, cancelados:0, expirados:0,
        gmv:0, paquetes:0, service_cost:0, ejecutivo: exec,
        ciudades: {}, ops: {}, weekly: {}, usuarios: {}, sedes: {}, driversPorOp: {},
      };
    }
    const e = empMap[empresa];
    e.total++;
    if (esCompletado) e.completados++;
    if (esCancelado)  e.cancelados++;
    if (esExpirado)   e.expirados++;
    e.gmv          += gmv;
    e.service_cost += cost;
    e.paquetes     += pkgs;
    if (exec && exec !== "Sin asignar") e.ejecutivo = exec;

    // por usuario (passenger_name)
    if (!e.usuarios[usuario]) e.usuarios[usuario] = {total:0,completados:0,gmv:0};
    e.usuarios[usuario].total++;
    if (esCompletado) { e.usuarios[usuario].completados++; e.usuarios[usuario].gmv += gmv; }

    // por sede
    if (!e.sedes[sede]) e.sedes[sede] = {total:0,completados:0,gmv:0};
    e.sedes[sede].total++;
    if (esCompletado) { e.sedes[sede].completados++; e.sedes[sede].gmv += gmv; }

    // ciudades
    if (!e.ciudades[city]) e.ciudades[city] = { gmv:0, count:0 };
    e.ciudades[city].gmv   += gmv;
    e.ciudades[city].count++;

    // ops
    if (!e.ops[op]) e.ops[op] = 0;
    e.ops[op]++;

    // drivers por operación en empresa
    const driverKeyEmp = driverId || driverName;
    if (driverKeyEmp) {
      if (!e.driversPorOp[op]) e.driversPorOp[op] = { drivers: new Set(), servicios: 0 };
      e.driversPorOp[op].drivers.add(driverKeyEmp);
      e.driversPorOp[op].servicios++;
    }

    // weekly por empresa
    if (semana > 0) {
      if (!e.weekly[semana]) e.weekly[semana] = { gmv:0,servicios:0,completados:0,cancelados:0,paquetes:0,label:semanaLabel };
      e.weekly[semana].gmv        += gmv;
      e.weekly[semana].servicios++;
      e.weekly[semana].paquetes   += pkgs;
      if (esCompletado) e.weekly[semana].completados++;
      if (esCancelado)  e.weekly[semana].cancelados++;
    }

    // weekly global
    if (semana > 0) {
      if (!globalWeekly[semana]) globalWeekly[semana] = { gmv:0,servicios:0,completados:0,cancelados:0,label:semanaLabel };
      globalWeekly[semana].gmv += gmv;
      globalWeekly[semana].servicios++;
      if (esCompletado) globalWeekly[semana].completados++;
      if (esCancelado)  globalWeekly[semana].cancelados++;
    }

    // ── Agregación por ciudad ─────────────────────────────────────────────
    const locality    = toStr(row["locality"]      || row["Locality"] || "Sin localidad");
    const estadoBk    = toStr(row["estado_booking"] || row["estado_Booking"] || status || "Sin estado");

    if (!cityMap[city]) cityMap[city] = {
      city, total:0, gmv:0, paquetes:0, completados:0, cancelados:0, expirados:0,
      localidades:{}, ops:{}, estados:{}, weekly:{}, driversPorOp:{},
    };
    const cv = cityMap[city];
    cv.total++;  cv.gmv += gmv;  cv.paquetes += pkgs;

    // Drivers por tipo de operación en esta ciudad
    const driverKeyCv = driverId || driverName;
    if (driverKeyCv) {
      if (!cv.driversPorOp[op]) cv.driversPorOp[op] = { drivers: new Set(), servicios: 0 };
      cv.driversPorOp[op].drivers.add(driverKeyCv);
      cv.driversPorOp[op].servicios++;
    }
    if (esCompletado) cv.completados++;
    if (esCancelado)  cv.cancelados++;
    if (esExpirado)   cv.expirados++;

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
      if (!cv.weekly[semana]) cv.weekly[semana] = {gmv:0,servicios:0,paquetes:0,completados:0,cancelados:0,label:semanaLabel};
      cv.weekly[semana].gmv += gmv; cv.weekly[semana].servicios++;
      cv.weekly[semana].paquetes += pkgs;
      if (esCompletado) cv.weekly[semana].completados++;
      if (esCancelado)  cv.weekly[semana].cancelados++;
    }
  }

  // Convertir a arrays serializables
  const empresas = Object.values(empMap).map(e => {
    const tc = e.total > 0 ? e.completados/e.total : 0;
    const tca= e.total > 0 ? e.cancelados/e.total  : 0;
    const te = e.total > 0 ? e.expirados/e.total   : 0;

    const ciudadTop = Object.entries(e.ciudades)
      .sort((a,b)=>b[1].count-a[1].count)[0]?.[0] || "";

    const topCiudades = Object.entries(e.ciudades)
      .map(([city,v])=>({city, gmv:v.gmv, count:v.count}))
      .sort((a,b)=>b.gmv-a.gmv).slice(0,8);

    const topOps = Object.entries(e.ops)
      .map(([op,count])=>({op, count}))
      .sort((a,b)=>b.count-a.count);

    const weekly = Object.entries(e.weekly)
      .map(([s,v])=>({
        semana: Number(s),
        label: v.label || `S${s}`,
        gmv:v.gmv, servicios:v.servicios, paquetes:v.paquetes,
        completados:v.completados, cancelados:v.cancelados,
        tasa_completado: v.servicios>0 ? v.completados/v.servicios : 0,
        tasa_cancelacion: v.servicios>0 ? v.cancelados/v.servicios : 0,
      }))
      .sort((a,b)=>a.semana-b.semana);

    const topUsuarios = Object.entries(e.usuarios)
      .map(([u,v])=>({usuario:u, ...v}))
      .sort((a,b)=>b.gmv-a.gmv)
      .slice(0,30);

    const topSedes = Object.entries(e.sedes)
      .map(([s,v])=>({sede:s, ...v}))
      .sort((a,b)=>b.gmv-a.gmv);

    // Drivers por operación en esta empresa
    const empDriversPorOp = Object.entries(e.driversPorOp)
      .map(([op, v]) => ({ op, driversActivos: v.drivers.size, servicios: v.servicios, promServPorDriver: v.drivers.size > 0 ? Math.round(v.servicios / v.drivers.size) : 0 }))
      .sort((a, b) => b.driversActivos - a.driversActivos);
    const empTotalDrivers = new Set();
    Object.values(e.driversPorOp).forEach(v => v.drivers.forEach(d => empTotalDrivers.add(d)));

    return {
      empresa: e.empresa, total: e.total,
      completados: e.completados, cancelados: e.cancelados, expirados: e.expirados,
      gmv: e.gmv, service_cost: e.service_cost, paquetes: e.paquetes,
      ciudad: ciudadTop, ejecutivo: e.ejecutivo,
      tasa_completado: tc, tasa_cancelacion: tca, tasa_expirado: te,
      topCiudades, topOps, weekly, topUsuarios, topSedes,
      driversPorOp: empDriversPorOp, totalDrivers: empTotalDrivers.size,
    };
  });

  // ── Agregados globales: tipo operación, status, vehículo, drivers ──
  const globalOps = {};
  const globalStatus = {};
  const globalVehicle = {};
  const driversPorOp = {}; // op → Set de driver IDs únicos
  const driversGlobal = new Set();
  for (const row of rows) {
    const op = toStr(row["operation_type"] || row["OPERATION TYPE"] || "Otro");
    const st = toStr(row["service_status"] || row["Service Status"] || "Sin estado");
    const vh = toStr(row["vehicle_type"] || row["vehicleType"] || row["Vehicle Type"] || row["tipo_vehiculo"] || "Sin vehículo");
    const gmv = toNum(row["gmv"]);
    const driverId = toStr(row["driver_id"] || row["DRIVER_ID"] || row["driverId"] || "");
    const driverName = toStr(row["driver_name"] || row["DRIVER_NAME"] || row["driverName"] || "");
    const driverKey = driverId || driverName; // usar ID si existe, si no nombre

    if (!globalOps[op]) globalOps[op] = { total: 0, gmv: 0 };
    globalOps[op].total++; globalOps[op].gmv += gmv;
    if (!globalStatus[st]) globalStatus[st] = { total: 0, gmv: 0 };
    globalStatus[st].total++; globalStatus[st].gmv += gmv;
    if (!globalVehicle[vh]) globalVehicle[vh] = { total: 0, gmv: 0 };
    globalVehicle[vh].total++; globalVehicle[vh].gmv += gmv;

    // Drivers únicos por tipo de operación
    if (driverKey) {
      driversGlobal.add(driverKey);
      if (!driversPorOp[op]) driversPorOp[op] = { drivers: new Set(), servicios: 0 };
      driversPorOp[op].drivers.add(driverKey);
      driversPorOp[op].servicios++;
    }
  }
  const porTipoOp = Object.entries(globalOps).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
  const porStatus = Object.entries(globalStatus).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
  const porVehiculo = Object.entries(globalVehicle).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
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

  const weeklyGlobal = Object.entries(globalWeekly)
    .map(([s,v])=>({
      semana: Number(s),
      label: v.label || `S${s}`,
      gmv:v.gmv, servicios:v.servicios,
      tasa_completado: v.servicios>0?v.completados/v.servicios:0,
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
        tasa_completado: v.servicios>0?v.completados/v.servicios:0,
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
      tasa_completado: cv.total>0?cv.completados/cv.total:0,
      tasa_cancelacion: cv.total>0?cv.cancelados/cv.total:0,
      localidades, ops, estados, weekly, driversPorOp,
      totalDrivers: totalDriversCiudad.size,
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
    const dtTime = toStr(row["dt_time"] || "");
    let hora = -1;
    const hmMatch = dtTime.match(/^(\d{1,2}):/);
    if (hmMatch) hora = parseInt(hmMatch[1]);
    else { try { const d = new Date(row["date"]); if (!isNaN(d.getTime())) hora = d.getHours(); } catch {} }
    if (!pilotoMap[dk]) pilotoMap[dk] = { id: dId, n: dNm, ci: city, s: 0, c: 0, x: 0, g: 0, hp: {} };
    const p = pilotoMap[dk];
    p.s++;
    if (st === "Completed") p.c++;
    if (st.startsWith("Canceled")) p.x++;
    p.g += gmv;
    if (hora >= 0) p.hp[hora] = (p.hp[hora] || 0) + 1;
    if (dNm && dNm.length > (p.n || "").length) p.n = dNm;
    if (city) p.ci = city;
  }
  const drivers = Object.values(pilotoMap).map(p => {
    let h = -1, mx = 0;
    for (const [hr, cnt] of Object.entries(p.hp)) { if (cnt > mx) { mx = cnt; h = Number(hr); } }
    return { id: p.id, n: p.n, ci: p.ci, s: p.s, c: p.c, x: p.x, g: Math.round(p.g), h };
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
      porTipoOp,
      porStatus,
      porVehiculo,
      driversPorTipoOp,
      totalDriversActivos,
    }
  };
}

// ── IndexedDB para drivers (evita exceder localStorage) ──────────────────
const IDB_NAME = "pibox_riesgo_db";
const IDB_STORE = "drivers";
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function idbSaveDrivers(mesKey, drivers) {
  try { const db = await idbOpen(); const tx = db.transaction(IDB_STORE, "readwrite"); tx.objectStore(IDB_STORE).put(drivers, mesKey); await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; }); } catch (e) { console.warn("IDB save drivers:", e); }
}
export async function idbLoadDrivers(mesKey) {
  try { const db = await idbOpen(); const tx = db.transaction(IDB_STORE, "readonly"); const req = tx.objectStore(IDB_STORE).get(mesKey); return new Promise(r => { req.onsuccess = () => r(req.result || null); req.onerror = () => r(null); }); } catch { return null; }
}
export async function idbDeleteDrivers(mesKey) {
  try { const db = await idbOpen(); const tx = db.transaction(IDB_STORE, "readwrite"); tx.objectStore(IDB_STORE).delete(mesKey); } catch {}
}

// ── Score de riesgo ───────────────────────────────────────────────────────────
export function calcularScore(kpi, kpiPrev, umb = UMBRALES_DEFAULT) {
  let pts = 100;
  const factores = [];

  if (kpi.tasa_completado < umb.completado_rojo) {
    pts -= 25; factores.push(`Completado bajo (${(kpi.tasa_completado*100).toFixed(0)}%)`);
  } else if (kpi.tasa_completado < umb.completado_amarillo) {
    pts -= 12; factores.push(`Completado moderado (${(kpi.tasa_completado*100).toFixed(0)}%)`);
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
