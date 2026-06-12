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

// ── Índice de meses ───────────────────────────────────────────────────────────
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

  // Mapear por empresa
  const empMap = {};
  const globalWeekly = {};

  for (const row of rows) {
    const empresa  = toStr(row["company"] || row["Company"] || "Sin empresa");
    const city     = toStr(row["city"]    || row["City"]    || "Sin ciudad");
    const sede     = toStr(row["sede"]    || "");
    const op       = toStr(row["operation_type"] || "Otro");
    const status   = toStr(row["service_status"] || "");
    const gmv      = toNum(row["gmv"]);
    const pkgs     = toNum(row["packages"]);
    const exec     = toStr(row["account_manager"] || "Sin asignar");

    // semana del año
    let semana = 0;
    try {
      const d = new Date(row["date"]);
      if (!isNaN(d)) {
        const jan1 = new Date(d.getFullYear(), 0, 1);
        semana = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      }
    } catch {}

    const esCompletado = status === "Completed";
    const esCancelado  = status.startsWith("Canceled");
    const esExpirado   = status === "Expired";

    if (!empMap[empresa]) {
      empMap[empresa] = {
        empresa, total:0, completados:0, cancelados:0, expirados:0,
        gmv:0, paquetes:0, ejecutivo: exec,
        ciudades: {}, ops: {}, weekly: {},
      };
    }
    const e = empMap[empresa];
    e.total++;
    if (esCompletado) e.completados++;
    if (esCancelado)  e.cancelados++;
    if (esExpirado)   e.expirados++;
    e.gmv      += gmv;
    e.paquetes += pkgs;
    if (exec && exec !== "Sin asignar") e.ejecutivo = exec;

    // ciudades
    if (!e.ciudades[city]) e.ciudades[city] = { gmv:0, count:0 };
    e.ciudades[city].gmv   += gmv;
    e.ciudades[city].count++;

    // ops
    if (!e.ops[op]) e.ops[op] = 0;
    e.ops[op]++;

    // weekly por empresa
    if (semana > 0) {
      if (!e.weekly[semana]) e.weekly[semana] = { gmv:0,servicios:0,completados:0,cancelados:0,paquetes:0 };
      e.weekly[semana].gmv        += gmv;
      e.weekly[semana].servicios++;
      e.weekly[semana].paquetes   += pkgs;
      if (esCompletado) e.weekly[semana].completados++;
      if (esCancelado)  e.weekly[semana].cancelados++;
    }

    // weekly global
    if (semana > 0) {
      if (!globalWeekly[semana]) globalWeekly[semana] = { gmv:0,servicios:0,completados:0,cancelados:0 };
      globalWeekly[semana].gmv += gmv;
      globalWeekly[semana].servicios++;
      if (esCompletado) globalWeekly[semana].completados++;
      if (esCancelado)  globalWeekly[semana].cancelados++;
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
        semana:Number(s),
        gmv:v.gmv, servicios:v.servicios, paquetes:v.paquetes,
        completados:v.completados, cancelados:v.cancelados,
        tasa_completado: v.servicios>0 ? v.completados/v.servicios : 0,
        tasa_cancelacion: v.servicios>0 ? v.cancelados/v.servicios : 0,
      }))
      .sort((a,b)=>a.semana-b.semana);

    return {
      empresa: e.empresa, total: e.total,
      completados: e.completados, cancelados: e.cancelados, expirados: e.expirados,
      gmv: e.gmv, paquetes: e.paquetes,
      ciudad: ciudadTop, ejecutivo: e.ejecutivo,
      tasa_completado: tc, tasa_cancelacion: tca, tasa_expirado: te,
      topCiudades, topOps, weekly,
    };
  });

  // totales globales
  const totalGmv = rows.reduce((s,r)=>s+toNum(r["gmv"]),0);
  const topCiudadesGlobal = (() => {
    const cm = {};
    for (const row of rows) {
      const c = toStr(row["city"] || "Sin ciudad");
      if (!cm[c]) cm[c] = 0;
      cm[c] += toNum(row["gmv"]);
    }
    return Object.entries(cm).map(([city,gmv])=>({city,gmv}))
      .sort((a,b)=>b.gmv-a.gmv).slice(0,12);
  })();

  const weeklyGlobal = Object.entries(globalWeekly)
    .map(([s,v])=>({
      semana:Number(s), gmv:v.gmv, servicios:v.servicios,
      tasa_completado: v.servicios>0?v.completados/v.servicios:0,
      tasa_cancelacion: v.servicios>0?v.cancelados/v.servicios:0,
    }))
    .sort((a,b)=>a.semana-b.semana);

  return {
    empresas,
    totales: {
      servicios: rows.length,
      gmv: totalGmv,
      n_empresas: empresas.length,
      topCiudades: topCiudadesGlobal,
      weekly: weeklyGlobal,
    }
  };
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
export const fmtPct = (n) => `${(n*100).toFixed(1)}%`;
