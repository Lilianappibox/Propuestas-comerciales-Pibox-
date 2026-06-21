import { useState, useMemo, useRef } from "react";
import XLSX from "../../utils/xlsxHelper";
import logoSrc from "../../assets/pibox-logo.png";

const BRAND = "#7C22D4";
const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const LS_KEY = "pibox_informes_clientes_log";

// ── Currency parser ─────────────────────────────────────────────────────────
function parseCurrency(raw) {
  if (raw == null) return 0;
  let s = String(raw).replace(/\$/g, "").trim();
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseDistance(raw) {
  if (raw == null) return 0;
  let s = String(raw).trim();
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function mapStatus(raw) {
  if (!raw) return "other";
  const s = String(raw).trim().toLowerCase();
  if (s === "completado") return "completed";
  if (s === "expirado") return "expired";
  if (s.includes("cancelado")) return "canceled";
  return "other";
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws, { defval: "" }));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const fmtCOP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v) => (v * 100).toFixed(1) + "%";
const fmtNum = (v) => new Intl.NumberFormat("es-CO").format(v);
function fmtMinutes(mins) {
  if (mins < 60) return `${Math.round(mins)} min`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}

function distRange(km) {
  if (km < 3) return "<3 KM";
  if (km < 5) return "3-5 KM";
  if (km < 10) return "5-10 KM";
  if (km < 20) return "10-20 KM";
  return ">20 KM";
}
const DIST_ORDER = ["<3 KM", "3-5 KM", "5-10 KM", "10-20 KM", ">20 KM"];

// ── Print ───────────────────────────────────────────────────────────────────
function printSection(ref, title) {
  if (!ref?.current) return;
  const svgContainers = ref.current.querySelectorAll(".recharts-wrapper");
  const snapshots = [];
  for (const wrapper of svgContainers) {
    const svg = wrapper.querySelector("svg");
    if (!svg) continue;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = document.createElement("img");
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
    img.style.cssText = `width:${svg.getAttribute("width") || wrapper.offsetWidth}px;height:${svg.getAttribute("height") || wrapper.offsetHeight}px;max-width:100%;`;
    snapshots.push({ wrapper, img });
  }
  for (const { wrapper, img } of snapshots) { wrapper._origHTML = wrapper.innerHTML; wrapper.innerHTML = ""; wrapper.appendChild(img); }
  const content = ref.current.cloneNode(true);
  for (const { wrapper } of snapshots) { wrapper.innerHTML = wrapper._origHTML; delete wrapper._origHTML; }
  for (const btn of content.querySelectorAll("button")) btn.remove();
  for (const lbl of content.querySelectorAll("label")) { if (lbl.querySelector('input[type="file"]')) lbl.remove(); }
  const win = window.open("", "_blank");
  if (!win) { alert("Permite ventanas emergentes para descargar el PDF"); return; }
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(s => s.outerHTML).join("\n");
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>${styles}
    <style>
      @page { size: A4 portrait; margin: 15mm; }
      body { margin: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .print-root { max-width: 100% !important; padding: 0 !important; }
      table { table-layout: fixed; width: 100% !important; font-size: 9px; border-collapse: collapse; }
      table th, table td { padding: 4px 6px; word-wrap: break-word; overflow-wrap: break-word; }
      .kpi-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
      .section-card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10px; }
      .recharts-wrapper, .recharts-surface { width: 100% !important; max-width: 100% !important; }
      svg { max-width: 100%; height: auto; }
      .overflow-x-auto { overflow: visible !important; }
    </style></head><body><div class="print-root" style="max-width:680px;margin:0 auto;padding:8px">${content.innerHTML}</div></body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 600);
}

// ── Process servicios ───────────────────────────────────────────────────────
function processServicios(rows) {
  let totalServicios = rows.length, completados = 0, cancelados = 0, expirados = 0, costoTotal = 0;
  const porSede = {}, porCentro = {}, porTipoServicio = {}, porTipoVehiculo = {}, porTipoCobro = {}, porDistancia = {};
  for (const r of rows) {
    const status = mapStatus(r["Estado"]);
    const costo = parseCurrency(r["Costo final"]);
    const dist = parseDistance(r["Distancia (KM)"]);
    const sede = r["Nombre de la sede"] || "Sin sede";
    const centro = r["Centro de costo"] || "Sin centro";
    const tipoSvc = r["Tipo de servicio"] || "Otro";
    const tipoVeh = r["Tipo de vehículo"] || "Otro";
    const tipoCobro = r["Tipo de cobro"] || "Otro";
    if (status === "completed") completados++;
    else if (status === "canceled") cancelados++;
    else if (status === "expired") expirados++;
    costoTotal += costo;
    if (!porSede[sede]) porSede[sede] = { servicios: 0, costo: 0 }; porSede[sede].servicios++; porSede[sede].costo += costo;
    if (!porCentro[centro]) porCentro[centro] = { servicios: 0, costo: 0 }; porCentro[centro].servicios++; porCentro[centro].costo += costo;
    if (!porTipoServicio[tipoSvc]) porTipoServicio[tipoSvc] = { servicios: 0, costo: 0 }; porTipoServicio[tipoSvc].servicios++; porTipoServicio[tipoSvc].costo += costo;
    if (!porTipoVehiculo[tipoVeh]) porTipoVehiculo[tipoVeh] = { completados: 0, expirados: 0, cancelados: 0, total: 0 };
    porTipoVehiculo[tipoVeh].total++;
    if (status === "completed") porTipoVehiculo[tipoVeh].completados++;
    else if (status === "expired") porTipoVehiculo[tipoVeh].expirados++;
    else if (status === "canceled") porTipoVehiculo[tipoVeh].cancelados++;
    if (!porTipoCobro[tipoCobro]) porTipoCobro[tipoCobro] = { servicios: 0, costo: 0 }; porTipoCobro[tipoCobro].servicios++; porTipoCobro[tipoCobro].costo += costo;
    const rng = distRange(dist); if (!porDistancia[rng]) porDistancia[rng] = 0; porDistancia[rng]++;
  }
  return { totalServicios, completados, cancelados, expirados, costoTotal, efectividad: totalServicios > 0 ? completados / totalServicios : 0, porSede, porCentro, porTipoServicio, porTipoVehiculo, porTipoCobro, porDistancia };
}

// ── Process servicios por horas ─────────────────────────────────────────────
function processHoras(rows) {
  function parseDate(v) {
    if (!v && v !== 0) return "";
    // Número serial de Excel (ej: 46144) → convertir a fecha UTC
    if (typeof v === "number") {
      const d = new Date((v - 25569) * 86400 * 1000);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${day}/${m}/${y}`;
    }
    // Objeto Date de XLSX con cellDates:true
    if (v instanceof Date) {
      const y = v.getUTCFullYear();
      const m = String(v.getUTCMonth() + 1).padStart(2, "0");
      const d = String(v.getUTCDate()).padStart(2, "0");
      return `${d}/${m}/${y}`;
    }
    // String "2026-05-20 00:00:00" o "2026-05-20T00:00:00"
    const s = String(v).trim();
    const match = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return s;
  }
  function isCompletado(r) {
    const s = String(r["estado_booking"] || r["service_status"] || "").toLowerCase().trim();
    return s === "completado" || s === "completed";
  }

  // Separar por operation_type Y por estado completado
  // "Horas"     → turno por horas (reemplaza is_per_hour=true)
  // "On Demand" → tareas dentro del turno (reemplaza is_per_hour=false)
  const horasComp = [], horasNoComp = [];
  const paqComp = [], paqNoComp = [];

  function parseHHMMSS(v) {
    if (!v) return 0;
    const s = String(v).trim();
    const parts = s.split(":").map(Number);
    if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return 0;
  }

  for (const r of rows) {
    const opType = String(r["operation_type"] || "").trim().toLowerCase();
    const esTurno = opType === "horas";           // turno por horas
    const esTarea = opType === "on demand";        // tarea dentro del turno
    if (!esTurno && !esTarea) continue;            // ignorar otros tipos

    const date = parseDate(r["date"]);
    const sede = String(r["passenger_name"] || "Sin sede").trim();
    const driver = String(r["driver_name"] || "Sin conductor").trim();
    const gmv = parseFloat(r["gmv"]) || 0;
    const packages = parseInt(r["packages"]) || parseInt(r["cant_stops"]) || 0;
    const bookingId = String(r["booking_id"] || "");
    const city = String(r["city"] || "");
    const estadoRaw = String(r["estado_booking"] || r["service_status"] || "").trim();
    const cancelacion = String(r["cancelation"] || r["cancelacion"] || "").trim();
    const horasTrabajadas = parseHHMMSS(r["route_time"]);

    const entry = { date, sede, driver, gmv, packages, bookingId, city, estadoRaw, cancelacion, horasTrabajadas };

    if (esTurno) {
      if (isCompletado(r)) horasComp.push(entry);
      else horasNoComp.push(entry);
    } else {
      if (isCompletado(r)) paqComp.push(entry);
      else paqNoComp.push(entry);
    }
  }

  // === PRODUCTIVIDAD: solo completados ===
  // Paso 1: contar tareas On Demand (completadas) por date+driver
  // Cada fila On Demand = 1 tarea entregada dentro del turno
  const odByDateDriver = {};
  for (const r of paqComp) {
    const key = `${r.date}||${r.driver}`;
    if (!odByDateDriver[key]) odByDateDriver[key] = 0;
    odByDateDriver[key]++;   // cada fila On Demand = 1 tarea
  }

  // Paso 2: agregar turnos (Horas) por date+driver+sede (evitar duplicados)
  const turnosByKey = {};
  for (const r of horasComp) {
    const key = `${r.date}||${r.driver}||${r.sede}`;
    if (!turnosByKey[key]) turnosByKey[key] = { date: r.date, driver: r.driver, sede: r.sede, servicios: 0, gmv: 0, horasTrabajadas: 0 };
    turnosByKey[key].servicios++;
    turnosByKey[key].gmv += r.gmv;
    turnosByKey[key].horasTrabajadas += r.horasTrabajadas;
  }

  // Paso 3: byDateSede — paquetes = On Demand del mismo date+driver
  const byDateSede = {};
  for (const t of Object.values(turnosByKey)) {
    const sedKey = `${t.date}||${t.sede}`;
    const paquetes = odByDateDriver[`${t.date}||${t.driver}`] || 0;
    if (!byDateSede[sedKey]) byDateSede[sedKey] = { date: t.date, sede: t.sede, drivers: {}, gmvTotal: 0, packagesTotal: 0, serviciosCount: 0 };
    const e = byDateSede[sedKey];
    e.gmvTotal += t.gmv;
    e.packagesTotal += paquetes;
    e.serviciosCount += t.servicios;
    if (!e.drivers[t.driver]) e.drivers[t.driver] = { packages: 0, gmv: 0, servicios: 0 };
    e.drivers[t.driver].packages += paquetes;
    e.drivers[t.driver].gmv += t.gmv;
    e.drivers[t.driver].servicios += t.servicios;
  }

  // Productividad por conductor
  const driverStats = {};
  for (const t of Object.values(turnosByKey)) {
    const paquetes = odByDateDriver[`${t.date}||${t.driver}`] || 0;
    if (!driverStats[t.driver]) driverStats[t.driver] = { driver: t.driver, servicios: 0, packagesTotal: 0, gmvTotal: 0, horasTrabajadas: 0 };
    driverStats[t.driver].servicios += t.servicios;
    driverStats[t.driver].packagesTotal += paquetes;
    driverStats[t.driver].gmvTotal += t.gmv;
    driverStats[t.driver].horasTrabajadas += t.horasTrabajadas;
  }

  // === NO COMPLETADOS: agrupados por estado y tipo ===
  const noCompHorasPorEstado = {};
  for (const r of horasNoComp) {
    const key = r.estadoRaw || "Sin estado";
    if (!noCompHorasPorEstado[key]) noCompHorasPorEstado[key] = { count: 0, gmv: 0, rows: [] };
    noCompHorasPorEstado[key].count++;
    noCompHorasPorEstado[key].gmv += r.gmv;
    noCompHorasPorEstado[key].rows.push(r);
  }
  const noCompPaqPorEstado = {};
  for (const r of paqNoComp) {
    const key = r.estadoRaw || "Sin estado";
    if (!noCompPaqPorEstado[key]) noCompPaqPorEstado[key] = { count: 0, packages: 0, rows: [] };
    noCompPaqPorEstado[key].count++;
    noCompPaqPorEstado[key].packages += r.packages;
    noCompPaqPorEstado[key].rows.push(r);
  }

  const totalGMV = horasComp.reduce((s, r) => s + r.gmv, 0);
  const totalServicios = horasComp.length;
  const totalPackages = paqComp.length;              // cada fila On Demand = 1 tarea entregada
  const totalPaqComp = totalPackages;
  const costoPorPaquete = totalPackages > 0 ? totalGMV / totalPackages : 0;
  const totalHoras = horasComp.reduce((s, r) => s + r.horasTrabajadas, 0);
  const valorPorHora = totalHoras > 0 ? totalGMV / totalHoras : 0;

  // === Análisis por passenger_name (sede) — basado en turnosByKey + odByDateDriver ===
  const sedeStats = {};
  for (const t of Object.values(turnosByKey)) {
    const paquetes = odByDateDriver[`${t.date}||${t.driver}`] || 0;
    if (!sedeStats[t.sede]) sedeStats[t.sede] = { sede: t.sede, serviciosHoras: 0, packagesHoras: 0, gmv: 0, horas: 0, soloHoras: true };
    sedeStats[t.sede].serviciosHoras += t.servicios;
    sedeStats[t.sede].packagesHoras += paquetes;
    sedeStats[t.sede].gmv += t.gmv;
    sedeStats[t.sede].horas += t.horasTrabajadas;
    if (paquetes > 0) sedeStats[t.sede].soloHoras = false;
  }
  // Añadir sedes que solo aparecen en no completados (para tracking)
  const sedeArr = Object.values(sedeStats);

  // Insights por sede
  const insightsSede = [];
  if (sedeArr.length > 0) {
    // Más productiva: mayor paquetes/hora
    const conHoras = sedeArr.filter(s => s.horas > 0);
    if (conHoras.length > 0) {
      const masProductiva = conHoras.reduce((a, b) => (b.packagesHoras / b.horas > a.packagesHoras / a.horas ? b : a));
      insightsSede.push({ tipo: "top", texto: `La sede más productiva es "${masProductiva.sede}" con ${(masProductiva.packagesHoras / masProductiva.horas).toFixed(1)} tareas On Demand por hora de turno.` });
    }
    // Mayor GMV
    const mayorGMV = sedeArr.reduce((a, b) => (b.gmv > a.gmv ? b : a));
    insightsSede.push({ tipo: "gmv", texto: `"${mayorGMV.sede}" genera el mayor GMV: ${fmtCOP(mayorGMV.gmv)} con ${fmtNum(mayorGMV.serviciosHoras)} turnos y ${fmtNum(mayorGMV.packagesHoras)} tareas OD.` });
    // Solo turnos (no tienen tareas On Demand)
    const soloHorasSedes = sedeArr.filter(s => s.soloHoras && s.serviciosHoras > 0);
    if (soloHorasSedes.length > 0)
      insightsSede.push({ tipo: "info", texto: `${soloHorasSedes.length === 1 ? `La sede "${soloHorasSedes[0].sede}" opera` : `${soloHorasSedes.length} sedes operan`} solo con turnos por horas, sin tareas On Demand registradas: ${soloHorasSedes.map(s => s.sede).join(", ")}.` });
    // Sedes con turnos + tareas On Demand
    const mixtas = sedeArr.filter(s => !s.soloHoras && s.serviciosHoras > 0);
    if (mixtas.length > 0)
      insightsSede.push({ tipo: "info", texto: `${mixtas.length === 1 ? `"${mixtas[0].sede}" combina` : `${mixtas.length} sedes combinan`} turnos por horas con tareas On Demand: ${mixtas.map(s => s.sede).join(", ")}.` });
    // Mayor cantidad de turnos
    const masSvc = sedeArr.reduce((a, b) => (b.serviciosHoras > a.serviciosHoras ? b : a));
    insightsSede.push({ tipo: "top", texto: `"${masSvc.sede}" tiene el mayor número de turnos: ${fmtNum(masSvc.serviciosHoras)} turnos con ${fmtNum(masSvc.packagesHoras)} tareas OD.` });
    // Mejor costo por tarea OD (menor = más eficiente)
    const conPaq = sedeArr.filter(s => s.packagesHoras > 0);
    if (conPaq.length > 1) {
      const mejorCosto = conPaq.reduce((a, b) => (b.gmv / b.packagesHoras < a.gmv / a.packagesHoras ? b : a));
      insightsSede.push({ tipo: "eficiencia", texto: `Mejor costo por tarea OD: "${mejorCosto.sede}" con ${fmtCOP(mejorCosto.gmv / mejorCosto.packagesHoras)}/tarea.` });
    }
    // Sede con más horas acumuladas
    const masHoras = sedeArr.reduce((a, b) => (b.horas > a.horas ? b : a));
    if (masHoras.horas > 0)
      insightsSede.push({ tipo: "info", texto: `"${masHoras.sede}" acumula más horas de turno: ${masHoras.horas.toFixed(1)} h en ${fmtNum(masHoras.serviciosHoras)} turnos.` });
  }

  return {
    horasComp, horasNoComp, paqComp, paqNoComp,
    byDateSede, driverStats,
    noCompHorasPorEstado, noCompPaqPorEstado,
    totalGMV, totalPackages, totalServicios, totalPaqComp,
    costoPorPaquete, totalHoras, valorPorHora,
    sedeStats, sedeArr, insightsSede,
    totalNoCompHoras: horasNoComp.length,
    totalNoCompPaq: paqNoComp.length,
  };
}

// ── Process paquetes ────────────────────────────────────────────────────────
function processPaquetes(rows) {
  const total = rows.length;
  let entregados = 0, cancelados = 0, devueltos = 0;
  const porEstado = {}, porSede = {};
  let sumCR = 0, countCR = 0, sumRE = 0, countRE = 0;
  for (const r of rows) {
    const estado = String(r["Estado"] || "").trim();
    const sede = r["Nombre de la sede"] || "Sin sede";
    if (!porEstado[estado]) porEstado[estado] = 0; porEstado[estado]++;
    const el = estado.toLowerCase();
    if (el === "entregado") entregados++; else if (el === "cancelado") cancelados++; else if (el === "devuelto") devueltos++;
    if (!porSede[sede]) porSede[sede] = 0; porSede[sede]++;
    const tC = r["Hora de creación"], tR = r["Hora de recogida"], tE = r["Hora de entrega"];
    if (tC && tR) { const d1 = new Date(tC), d2 = new Date(tR); if (!isNaN(d1) && !isNaN(d2) && d2 > d1) { sumCR += (d2 - d1) / 60000; countCR++; } }
    if (tR && tE) { const d1 = new Date(tR), d2 = new Date(tE); if (!isNaN(d1) && !isNaN(d2) && d2 > d1) { sumRE += (d2 - d1) / 60000; countRE++; } }
  }
  return { total, entregados, cancelados, devueltos, efectividad: total > 0 ? entregados / total : 0, tasaDevolucion: total > 0 ? devueltos / total : 0, porEstado, porSede, avgCreoReco: countCR > 0 ? sumCR / countCR : 0, avgRecoEntr: countRE > 0 ? sumRE / countRE : 0 };
}

// ── Generate POSITIVE-only insights ─────────────────────────────────────────
function generateInsights(svc, paq) {
  const positivos = [];
  if (svc) {
    if (svc.efectividad >= 0.9) positivos.push(`Alta efectividad de servicios: ${fmtPct(svc.efectividad)} de servicios completados.`);
    else if (svc.efectividad >= 0.8) positivos.push(`Efectividad de servicios aceptable: ${fmtPct(svc.efectividad)}.`);
    if (svc.cancelados > 0) { const p = svc.cancelados / svc.totalServicios; if (p <= 0.15) positivos.push(`Tasa de cancelacion controlada: ${fmtPct(p)}.`); }
    if (svc.expirados > 0) { const p = svc.expirados / svc.totalServicios; if (p <= 0.1) positivos.push(`Pocos servicios expirados: ${fmtPct(p)}.`); }
    const sedeEntries = Object.entries(svc.porSede).sort((a, b) => b[1].costo - a[1].costo);
    if (sedeEntries.length > 0) { const [topSede, topData] = sedeEntries[0]; positivos.push(`Sede principal: "${topSede}" concentra ${fmtPct(topData.costo / (svc.costoTotal || 1))} del costo total con ${fmtNum(topData.servicios)} servicios.`); }
    for (const [veh, data] of Object.entries(svc.porTipoVehiculo)) { if (data.total >= 10 && data.completados / data.total >= 0.95) positivos.push(`Excelente efectividad en vehiculo "${veh}": ${fmtPct(data.completados / data.total)}.`); }
    const shortRange = (svc.porDistancia["<3 KM"] || 0) + (svc.porDistancia["3-5 KM"] || 0);
    if (svc.totalServicios > 0 && shortRange / svc.totalServicios > 0.6) positivos.push(`${fmtPct(shortRange / svc.totalServicios)} de servicios en distancias cortas (<5 KM), favoreciendo tiempos de entrega.`);
    if (svc.costoTotal > 0) positivos.push(`Facturacion total del periodo: ${fmtCOP(svc.costoTotal)}.`);
  }
  if (paq) {
    if (paq.efectividad >= 0.9) positivos.push(`Alta efectividad de entregas de paquetes: ${fmtPct(paq.efectividad)}.`);
    if (paq.total > 0 && paq.tasaDevolucion <= 0.05) positivos.push(`Tasa de devolucion de paquetes controlada: ${fmtPct(paq.tasaDevolucion)}.`);
    if (paq.avgCreoReco > 0 && paq.avgCreoReco <= 60) positivos.push(`Tiempo promedio de recogida eficiente: ${Math.round(paq.avgCreoReco)} min.`);
    if (paq.avgRecoEntr > 0) positivos.push(`Tiempo promedio de entrega (recogido a entregado): ${Math.round(paq.avgRecoEntr)} min.`);
  }
  if (positivos.length === 0) positivos.push("Operacion dentro de parametros normales.");
  return positivos.slice(0, 8);
}

// ── localStorage helpers ────────────────────────────────────────────────────
function loadHistory() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }
function saveToHistory(entry) { const hist = loadHistory(); hist.unshift(entry); if (hist.length > 50) hist.length = 50; localStorage.setItem(LS_KEY, JSON.stringify(hist)); return hist; }

// ── Sub-components ──────────────────────────────────────────────────────────
function SectionHeader({ children }) {
  return (
    <div className="section-card" style={{ background: BRAND_GRADIENT, borderRadius: 10, padding: "8px 16px", marginBottom: 12 }}>
      <h3 style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0 }}>{children}</h3>
    </div>
  );
}

function KpiCard({ label, value, color = BRAND }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", borderLeft: `5px solid ${color}`, padding: "14px 16px" }}>
      <p style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: "#1f2937", margin: "4px 0 0" }}>{value}</p>
    </div>
  );
}

function DataTable({ headers, rows, footer }) {
  return (
    <div className="overflow-x-auto section-card" style={{ borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr>{headers.map((h, i) => <th key={i} style={{ background: BRAND, color: "#fff", padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#faf5ff" }}>
              {row.map((cell, ci) => <td key={ci} style={{ padding: "6px 10px", color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr style={{ background: "#ede9fe", fontWeight: 700, borderTop: "2px solid #c4b5fd" }}>
              {footer.map((cell, ci) => <td key={ci} style={{ padding: "8px 10px", color: "#1f2937" }}>{cell}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
const RAZONES_SOCIALES = ["Digital Network Colombia S.A.S.", "Digital Platforms Colombia S.A.S."];

export default function InformeCliente({ currentUser }) {
  const [cliente, setCliente] = useState("");
  const [fechaInforme, setFechaInforme] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [razonSocial, setRazonSocial] = useState(RAZONES_SOCIALES[0]);
  const [serviciosFile, setServiciosFile] = useState(null);
  const [paquetesFile, setPaquetesFile] = useState(null);
  const [horasFile, setHorasFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [svcData, setSvcData] = useState(null);
  const [paqData, setPaqData] = useState(null);
  const [horasData, setHorasData] = useState(null);
  const [histOpen, setHistOpen] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());
  const reportRef = useRef(null);
  const svcFileRef = useRef(null);
  const paqFileRef = useRef(null);
  const horasFileRef = useRef(null);

  const insights = useMemo(() => (svcData || paqData) ? generateInsights(svcData, paqData) : null, [svcData, paqData]);
  const hasReport = svcData || paqData || horasData;

  const handleGenerar = async () => {
    if (!cliente.trim()) { setError("Ingresa el nombre del cliente."); return; }
    if (!serviciosFile && !paquetesFile && !horasFile) { setError("Sube al menos un archivo (servicios, paquetes o servicios por horas)."); return; }
    setError(""); setLoading(true); setSvcData(null); setPaqData(null); setHorasData(null);
    try {
      if (serviciosFile) setSvcData(processServicios(await readFile(serviciosFile)));
      if (paquetesFile) setPaqData(processPaquetes(await readFile(paquetesFile)));
      if (horasFile) setHorasData(processHoras(await readFile(horasFile)));
    } catch (err) { setError("Error al procesar archivos: " + err.message); } finally { setLoading(false); }
  };

  const handleLimpiar = () => {
    setCliente(""); setFechaInforme(""); setPeriodo(""); setRazonSocial(RAZONES_SOCIALES[0]);
    setServiciosFile(null); setPaquetesFile(null); setHorasFile(null);
    setSvcData(null); setPaqData(null); setHorasData(null); setError("");
    if (svcFileRef.current) svcFileRef.current.value = "";
    if (paqFileRef.current) paqFileRef.current.value = "";
    if (horasFileRef.current) horasFileRef.current.value = "";
  };

  const handleGuardar = () => {
    if (!hasReport) return;
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      cliente: cliente || "Sin nombre",
      fecha: fechaInforme,
      periodo: periodo || "Sin periodo",
      timestamp: new Date().toISOString(),
      svcSummary: svcData ? { total: svcData.totalServicios, completados: svcData.completados, costoTotal: svcData.costoTotal, efectividad: svcData.efectividad } : null,
      paqSummary: paqData ? { total: paqData.total, entregados: paqData.entregados, efectividad: paqData.efectividad, tasaDevolucion: paqData.tasaDevolucion } : null,
      horasSummary: horasData ? { totalServicios: horasData.totalServicios, totalPackages: horasData.totalPackages, totalGMV: horasData.totalGMV, costoPorPaquete: horasData.costoPorPaquete } : null,
      svcData, paqData, horasData,
    };
    setHistory(saveToHistory(entry));
  };

  const handleLoadHistory = (entry) => {
    setCliente(entry.cliente || ""); setFechaInforme(entry.fecha || ""); setPeriodo(entry.periodo || "");
    if (entry.svcData) setSvcData(entry.svcData); else setSvcData(null);
    if (entry.paqData) setPaqData(entry.paqData); else setPaqData(null);
    if (entry.horasData) setHorasData(entry.horasData); else setHorasData(null);
    setServiciosFile(null); setPaquetesFile(null); setHorasFile(null);
    if (svcFileRef.current) svcFileRef.current.value = "";
    if (paqFileRef.current) paqFileRef.current.value = "";
    if (horasFileRef.current) horasFileRef.current.value = "";
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* ── Config Panel ─────────────────────────────────────────────── */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 24, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: BRAND_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>IC</div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1f2937", margin: 0 }}>Configurar Informe de Cliente</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Nombre del cliente</label>
            <input type="text" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Ej: Empresa ABC"
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Fecha del informe</label>
            <input type="date" value={fechaInforme} onChange={e => setFechaInforme(e.target.value)}
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Periodo</label>
            <input type="text" value={periodo} onChange={e => setPeriodo(e.target.value)} placeholder="Ej: Mayo 2026"
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Razón Social</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {RAZONES_SOCIALES.map(rs => (
              <label key={rs} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: razonSocial === rs ? "2px solid #7C22D4" : "1px solid #d1d5db", background: razonSocial === rs ? "#F3E8FF" : "#fff", cursor: "pointer", fontSize: 13, fontWeight: razonSocial === rs ? 600 : 400, color: razonSocial === rs ? "#7C22D4" : "#374151" }}>
                <input type="radio" name="razonSocial" checked={razonSocial === rs} onChange={() => setRazonSocial(rs)} style={{ accentColor: "#7C22D4" }} />
                {rs}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Archivo de Servicios (.xlsx)</label>
            <input ref={svcFileRef} type="file" accept=".xlsx,.xls" onChange={e => setServiciosFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Archivo de Paquetes (.xlsx)</label>
            <input ref={paqFileRef} type="file" accept=".xlsx,.xls" onChange={e => setPaquetesFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
          </div>
        </div>

        {/* Horas file */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, background: "#7C22D4", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>H</div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#7C22D4", display: "block", margin: 0 }}>
              Analisis Servicios por Horas (.xlsx) — reporte con columna <code style={{ background: "#f3e8ff", padding: "1px 4px", borderRadius: 3 }}>operation_type</code>
            </label>
          </div>
          <input ref={horasFileRef} type="file" accept=".xlsx,.xls" onChange={e => setHorasFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
          {horasFile && <p style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>Archivo cargado: {horasFile.name}</p>}
        </div>

        {error && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={handleGenerar} disabled={loading}
            style={{ background: BRAND_GRADIENT, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
            {loading ? "Procesando..." : "Generar informe"}
          </button>
          {hasReport && (
            <>
              <button onClick={handleGuardar}
                style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Guardar reporte
              </button>
              <button onClick={handleLimpiar}
                style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Limpiar reporte
              </button>
            </>
          )}
          {!hasReport && (
            <button onClick={handleLimpiar}
              style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── History ──────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="no-print" style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 24, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <button onClick={() => setHistOpen(!histOpen)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#1f2937" }}>
            <span>Historial de reportes ({history.length})</span>
            <span style={{ fontSize: 16 }}>{histOpen ? "\u25B2" : "\u25BC"}</span>
          </button>
          {histOpen && (
            <div style={{ padding: "0 20px 14px", maxHeight: 260, overflowY: "auto" }}>
              {history.map((h) => (
                <div key={h.id} onClick={() => handleLoadHistory(h)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, marginBottom: 4, cursor: "pointer", border: "1px solid #f3f4f6", fontSize: 12 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#faf5ff"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div>
                    <span style={{ fontWeight: 700, color: BRAND }}>{h.cliente}</span>
                    <span style={{ color: "#9ca3af", marginLeft: 8 }}>{h.periodo}</span>
                  </div>
                  <span style={{ color: "#9ca3af", fontSize: 11 }}>{new Date(h.timestamp).toLocaleDateString("es-CO")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Report ───────────────────────────────────────────────────── */}
      {hasReport && (
        <div ref={reportRef} style={{ fontFamily: "'Segoe UI',system-ui,sans-serif" }}>

          {/* A. Header */}
          <div style={{ background: BRAND_GRADIENT, borderRadius: 14, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <img src={logoSrc} alt="Pibox" style={{ height: 36, marginBottom: 10, filter: "brightness(0) invert(1)" }} />
                <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Informe Operacional</h1>
                <p style={{ color: "rgba(255,255,255,.85)", fontSize: 13, margin: "0 0 2px" }}>{cliente || "Cliente"}</p>
                <p style={{ color: "rgba(255,255,255,.7)", fontSize: 11, margin: 0 }}>
                  {razonSocial}
                  {periodo && ` \u00B7 ${periodo}`}
                  {fechaInforme && ` \u00B7 ${fechaInforme}`}
                </p>
              </div>
              <button className="no-print" onClick={() => printSection(reportRef, `Informe ${cliente} - ${periodo}`)}
                style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(4px)" }}>
                Descargar PDF
              </button>
            </div>
          </div>

          {/* B. Resumen Ejecutivo */}
          <SectionHeader>Resumen Ejecutivo</SectionHeader>
          {svcData && (
            <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 14 }}>
              <KpiCard label="Total servicios" value={fmtNum(svcData.totalServicios)} />
              <KpiCard label="Completados" value={fmtNum(svcData.completados)} color="#16a34a" />
              <KpiCard label="Cancelados" value={fmtNum(svcData.cancelados)} color="#dc2626" />
              <KpiCard label="Expirados" value={fmtNum(svcData.expirados)} color="#f59e0b" />
              <KpiCard label="Efectividad" value={fmtPct(svcData.efectividad)} color={svcData.efectividad >= 0.85 ? "#16a34a" : "#dc2626"} />
              <KpiCard label="Facturacion total" value={fmtCOP(svcData.costoTotal)} />
            </div>
          )}
          {paqData && (
            <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 14 }}>
              <KpiCard label="Total paquetes" value={fmtNum(paqData.total)} />
              <KpiCard label="Entregados" value={fmtNum(paqData.entregados)} color="#16a34a" />
              <KpiCard label="Devueltos" value={fmtNum(paqData.devueltos)} color="#dc2626" />
              <KpiCard label="Cancelados" value={fmtNum(paqData.cancelados)} color="#f59e0b" />
              <KpiCard label="Efectividad entregas" value={fmtPct(paqData.efectividad)} color={paqData.efectividad >= 0.85 ? "#16a34a" : "#dc2626"} />
              {paqData.avgCreoReco > 0 && <KpiCard label="Tiempo prom. recogida" value={fmtMinutes(paqData.avgCreoReco)} />}
            </div>
          )}

          {/* C. Analisis de Facturacion */}
          {svcData && (
            <>
              <SectionHeader>Analisis de Facturacion</SectionHeader>
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Por sede</p>
              <DataTable
                headers={["Sede", "Servicios", "Costo total", "% Participacion"]}
                rows={Object.entries(svcData.porSede).sort((a, b) => b[1].costo - a[1].costo)
                  .map(([s, d]) => [s, fmtNum(d.servicios), fmtCOP(d.costo), fmtPct(svcData.costoTotal > 0 ? d.costo / svcData.costoTotal : 0)])}
                footer={["Total", fmtNum(svcData.totalServicios), fmtCOP(svcData.costoTotal), "100.0%"]}
              />
              <div style={{ height: 14 }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Por centro de costo</p>
              <DataTable
                headers={["Centro de costo", "Servicios", "Costo", "% Participacion"]}
                rows={Object.entries(svcData.porCentro).sort((a, b) => b[1].costo - a[1].costo)
                  .map(([c, d]) => [c, fmtNum(d.servicios), fmtCOP(d.costo), fmtPct(svcData.costoTotal > 0 ? d.costo / svcData.costoTotal : 0)])}
                footer={["Total", fmtNum(svcData.totalServicios), fmtCOP(svcData.costoTotal), "100.0%"]}
              />
              <div style={{ height: 14 }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Por tipo de servicio</p>
              <DataTable
                headers={["Tipo de servicio", "Servicios", "Costo", "% Participacion"]}
                rows={Object.entries(svcData.porTipoServicio).sort((a, b) => b[1].costo - a[1].costo)
                  .map(([t, d]) => [t, fmtNum(d.servicios), fmtCOP(d.costo), fmtPct(svcData.costoTotal > 0 ? d.costo / svcData.costoTotal : 0)])}
                footer={["Total", fmtNum(svcData.totalServicios), fmtCOP(svcData.costoTotal), "100.0%"]}
              />
            </>
          )}

          {/* D. Analisis Operacional */}
          {svcData && (
            <>
              <div style={{ height: 8 }} />
              <SectionHeader>Analisis Operacional</SectionHeader>
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Por tipo de vehiculo</p>
              <DataTable
                headers={["Tipo vehiculo", "Completados", "Expirados", "Cancelados", "% Efectividad"]}
                rows={Object.entries(svcData.porTipoVehiculo).sort((a, b) => b[1].total - a[1].total)
                  .map(([v, d]) => [v, fmtNum(d.completados), fmtNum(d.expirados), fmtNum(d.cancelados), fmtPct(d.total > 0 ? d.completados / d.total : 0)])}
              />
              <div style={{ height: 14 }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Por tipo de cobro</p>
              <DataTable
                headers={["Tipo de cobro", "Servicios", "Costo"]}
                rows={Object.entries(svcData.porTipoCobro).sort((a, b) => b[1].costo - a[1].costo)
                  .map(([t, d]) => [t, fmtNum(d.servicios), fmtCOP(d.costo)])}
              />
              <div style={{ height: 14 }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Servicios por distancia</p>
              <DataTable
                headers={["Rango", "Servicios", "% del total"]}
                rows={DIST_ORDER.map(rng => [rng, fmtNum(svcData.porDistancia[rng] || 0), fmtPct(svcData.totalServicios > 0 ? (svcData.porDistancia[rng] || 0) / svcData.totalServicios : 0)])}
                footer={["Total", fmtNum(svcData.totalServicios), "100.0%"]}
              />
            </>
          )}

          {/* E. Analisis de Paquetes */}
          {paqData && (
            <>
              <div style={{ height: 8 }} />
              <SectionHeader>Analisis de Paquetes</SectionHeader>
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Por estado</p>
              <DataTable
                headers={["Estado", "Paquetes", "% del total"]}
                rows={Object.entries(paqData.porEstado).sort((a, b) => b[1] - a[1])
                  .map(([e, c]) => [e, fmtNum(c), fmtPct(paqData.total > 0 ? c / paqData.total : 0)])}
                footer={["Total", fmtNum(paqData.total), "100.0%"]}
              />
              <div style={{ height: 14 }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Por sede</p>
              <DataTable
                headers={["Sede", "Paquetes", "% del total"]}
                rows={Object.entries(paqData.porSede).sort((a, b) => b[1] - a[1])
                  .map(([s, c]) => [s, fmtNum(c), fmtPct(paqData.total > 0 ? c / paqData.total : 0)])}
                footer={["Total", fmtNum(paqData.total), "100.0%"]}
              />
              <div style={{ height: 14 }} />
              <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                <KpiCard label="Tasa de devolucion" value={fmtPct(paqData.tasaDevolucion)} color={paqData.tasaDevolucion > 0.05 ? "#dc2626" : "#16a34a"} />
                {paqData.avgCreoReco > 0 && <KpiCard label="Tiempo prom. creado a recogido" value={fmtMinutes(paqData.avgCreoReco)} />}
                {paqData.avgRecoEntr > 0 && <KpiCard label="Tiempo prom. recogido a entregado" value={fmtMinutes(paqData.avgRecoEntr)} />}
              </div>
            </>
          )}

          {/* F. Analisis Servicios por Horas — COMPLETADOS */}
          {horasData && (
            <>
              <div style={{ height: 8 }} />
              <SectionHeader>Analisis de Servicios por Horas — Productividad (Completados)</SectionHeader>

              {/* KPIs solo completados */}
              <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 14 }}>
                <KpiCard label="Turnos completados (Horas)" value={fmtNum(horasData.totalServicios)} color="#16a34a" />
                <KpiCard label="Tareas On Demand entregadas" value={fmtNum(horasData.totalPackages)} color="#7C22D4" />
                <KpiCard label="GMV total (turnos)" value={fmtCOP(horasData.totalGMV)} color="#16a34a" />
                <KpiCard label="Horas trabajadas" value={horasData.totalHoras.toFixed(1) + " h"} color="#6366f1" />
                <KpiCard label="Valor por hora (GMV/hora)" value={fmtCOP(horasData.valorPorHora)} color="#0891b2" />
                <KpiCard label="Costo por tarea OD (GMV/tarea)" value={fmtCOP(horasData.costoPorPaquete)} color="#f59e0b" />
                {horasData.totalNoCompHoras > 0 && <KpiCard label="Turnos no completados" value={fmtNum(horasData.totalNoCompHoras)} color="#dc2626" />}
                {horasData.totalNoCompPaq > 0 && <KpiCard label="Tareas OD no completadas" value={fmtNum(horasData.totalNoCompPaq)} color="#dc2626" />}
              </div>

              {/* Por fecha y sede — solo completados */}
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Por fecha y sede — turnos y tareas On Demand (completados)</p>
              <DataTable
                headers={["Fecha", "Sede / Cliente", "Conductor", "Turnos", "Tareas OD", "GMV", "Costo/Tarea"]}
                rows={Object.entries(horasData.byDateSede)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .flatMap(([, e]) =>
                    Object.entries(e.drivers)
                      .sort((a, b) => b[1].packages - a[1].packages)
                      .map(([driver, d]) => [
                        e.date, e.sede, driver,
                        fmtNum(d.servicios), fmtNum(d.packages), fmtCOP(d.gmv),
                        fmtCOP(d.packages > 0 ? d.gmv / d.packages : 0),
                      ])
                  )}
                footer={["Total", "", "", fmtNum(horasData.totalServicios), fmtNum(horasData.totalPackages), fmtCOP(horasData.totalGMV), fmtCOP(horasData.costoPorPaquete)]}
              />

              {/* Productividad por conductor */}
              <div style={{ height: 14 }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Productividad por conductor</p>
              <DataTable
                headers={["Conductor", "Turnos", "Tareas OD", "Tareas/turno", "GMV", "Costo/tarea"]}
                rows={Object.values(horasData.driverStats)
                  .sort((a, b) => b.packagesTotal - a.packagesTotal)
                  .map(d => [
                    d.driver, fmtNum(d.servicios), fmtNum(d.packagesTotal),
                    (d.servicios > 0 ? (d.packagesTotal / d.servicios).toFixed(1) : "0"),
                    fmtCOP(d.gmvTotal),
                    fmtCOP(d.packagesTotal > 0 ? d.gmvTotal / d.packagesTotal : 0),
                  ])}
                footer={["Total", fmtNum(horasData.totalServicios), fmtNum(horasData.totalPackages), (horasData.totalServicios > 0 ? (horasData.totalPackages / horasData.totalServicios).toFixed(1) : "0"), fmtCOP(horasData.totalGMV), fmtCOP(horasData.costoPorPaquete)]}
              />

              {/* Insights por sede */}
              {horasData.insightsSede?.length > 0 && (
                <>
                  <div style={{ height: 20 }} />
                  <div style={{ background: "linear-gradient(135deg,#0891b2 0%,#6366f1 100%)", borderRadius: 10, padding: "8px 16px", marginBottom: 12 }}>
                    <h3 style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0 }}>Comportamiento por Sede / Cliente</h3>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10, marginBottom: 8 }}>
                    {horasData.insightsSede.map((ins, i) => {
                      const colors = { top: { bg: "#eff6ff", border: "#bfdbfe", left: "#2563eb", text: "#1d4ed8", icon: "★" }, gmv: { bg: "#f0fdf4", border: "#bbf7d0", left: "#16a34a", text: "#15803d", icon: "$" }, eficiencia: { bg: "#fefce8", border: "#fde68a", left: "#d97706", text: "#92400e", icon: "⚡" }, info: { bg: "#faf5ff", border: "#e9d5ff", left: "#7C22D4", text: "#6b21a8", icon: "●" } };
                      const c = colors[ins.tipo] || colors.info;
                      return (
                        <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 16px", borderLeft: `4px solid ${c.left}` }}>
                          <p style={{ fontSize: 12, color: c.text, margin: 0, lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 700, marginRight: 6 }}>{c.icon}</span>{ins.texto}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tabla resumen por sede */}
                  <div style={{ height: 10 }} />
                  <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Resumen por sede</p>
                  <DataTable
                    headers={["Sede / Cliente", "Turnos", "Tareas OD", "Horas turno", "OD/hora", "GMV", "Costo/tarea", "Tipo"]}
                    rows={horasData.sedeArr
                      .filter(s => s.serviciosHoras > 0)
                      .sort((a, b) => b.gmv - a.gmv)
                      .map(s => [
                        s.sede,
                        fmtNum(s.serviciosHoras),
                        fmtNum(s.packagesHoras),
                        s.horas.toFixed(1) + " h",
                        s.horas > 0 ? (s.packagesHoras / s.horas).toFixed(1) : "—",
                        fmtCOP(s.gmv),
                        s.packagesHoras > 0 ? fmtCOP(s.gmv / s.packagesHoras) : "—",
                        s.soloHoras ? "Solo turnos" : "Turnos + OD",
                      ])}
                  />
                </>
              )}

              {/* NO COMPLETADOS */}
              {(horasData.totalNoCompHoras > 0 || horasData.totalNoCompPaq > 0) && (
                <>
                  <div style={{ height: 20 }} />
                  <div style={{ background: "linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)", borderRadius: 10, padding: "8px 16px", marginBottom: 12 }}>
                    <h3 style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0 }}>Servicios No Completados</h3>
                  </div>

                  {/* Horas no completadas */}
                  {horasData.totalNoCompHoras > 0 && (
                    <>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>
                        Turnos (Horas) no completados ({fmtNum(horasData.totalNoCompHoras)})
                      </p>
                      <DataTable
                        headers={["Estado", "Cantidad", "GMV"]}
                        rows={Object.entries(horasData.noCompHorasPorEstado)
                          .sort((a, b) => b[1].count - a[1].count)
                          .map(([estado, d]) => [estado, fmtNum(d.count), fmtCOP(d.gmv)])}
                        footer={["Total", fmtNum(horasData.totalNoCompHoras), fmtCOP(Object.values(horasData.noCompHorasPorEstado).reduce((s, d) => s + d.gmv, 0))]}
                      />
                      <div style={{ height: 10 }} />
                      <DataTable
                        headers={["Fecha", "Sede", "Conductor", "Estado"]}
                        rows={horasData.horasNoComp
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map(r => [r.date, r.sede, r.driver, r.estadoRaw])}
                      />
                    </>
                  )}

                  {/* Paquetes no completados */}
                  {horasData.totalNoCompPaq > 0 && (
                    <>
                      <div style={{ height: 14 }} />
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>
                        Tareas On Demand no completadas ({fmtNum(horasData.totalNoCompPaq)})
                      </p>
                      <DataTable
                        headers={["Estado", "Registros", "Paquetes"]}
                        rows={Object.entries(horasData.noCompPaqPorEstado)
                          .sort((a, b) => b[1].count - a[1].count)
                          .map(([estado, d]) => [estado, fmtNum(d.count), fmtNum(d.packages)])}
                        footer={["Total", fmtNum(horasData.totalNoCompPaq), fmtNum(horasData.paqNoComp.reduce((s, r) => s + r.packages, 0))]}
                      />
                      <div style={{ height: 10 }} />
                      <DataTable
                        headers={["Fecha", "Sede", "Conductor", "Paquetes", "Estado"]}
                        rows={horasData.paqNoComp
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map(r => [r.date, r.sede, r.driver, fmtNum(r.packages), r.estadoRaw])}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* G. Insights (positive only) */}
          {insights && (
            <>
              <div style={{ height: 8 }} />
              <SectionHeader>Insights</SectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10 }}>
                {insights.map((txt, i) => (
                  <div key={i} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", borderLeft: "4px solid #16a34a" }}>
                    <p style={{ fontSize: 12, color: "#15803d", margin: 0, lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700, marginRight: 6 }}>+</span>{txt}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Firma */}
          <div style={{ height: 40 }} />
          <div style={{ borderTop: "2px solid #E9D5FF", paddingTop: 20, textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 16px 0" }}>Este informe fue generado por la plataforma PIBOX.</p>
            <div style={{ display: "inline-block", textAlign: "center", minWidth: 250 }}>
              <div style={{ borderBottom: "2px solid #7C22D4", marginBottom: 8, height: 40 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1f2937", margin: "0 0 2px 0" }}>{currentUser?.nombre || "Ejecutivo PIBOX"}</p>
              <p style={{ fontSize: 12, color: "#7C22D4", fontWeight: 600, margin: "0 0 2px 0" }}>{currentUser?.cargo || currentUser?.rol || "KAM"}</p>
              <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{razonSocial}</p>
            </div>
          </div>
          <div style={{ height: 24 }} />
        </div>
      )}
    </div>
  );
}
