import { useState, useMemo, useRef } from "react";
import XLSX from "../../utils/xlsxHelper";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";

// ── Currency parser ─────────────────────────────────────────────────────────
function parseCurrency(raw) {
  if (raw == null) return 0;
  let s = String(raw).replace(/\$/g, "").trim();
  if (!s) return 0;
  // Detect format: "29,900.00" (comma=thousands) vs "29.900,00" (dot=thousands)
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // "29.900,00" → dot=thousands, comma=decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // "29,900.00" or no ambiguity → comma=thousands
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ── Distance parser ─────────────────────────────────────────────────────────
function parseDistance(raw) {
  if (raw == null) return 0;
  let s = String(raw).trim();
  // Handle comma as decimal: "3,6" → 3.6 or "225,868" → 225.868
  // If there's only one comma and no dot, treat comma as decimal
  if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ── Status mapping ──────────────────────────────────────────────────────────
function mapStatus(raw) {
  if (!raw) return "other";
  const s = String(raw).trim().toLowerCase();
  if (s === "completado") return "completed";
  if (s === "expirado") return "expired";
  if (s.includes("cancelado")) return "canceled";
  return "other";
}

// ── Read XLSX file ──────────────────────────────────────────────────────────
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Format helpers ──────────────────────────────────────────────────────────
const fmtCOP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v) => (v * 100).toFixed(1) + "%";
const fmtNum = (v) => new Intl.NumberFormat("es-CO").format(v);

// ── Distance range ──────────────────────────────────────────────────────────
function distRange(km) {
  if (km < 3) return "<3 KM";
  if (km < 5) return "3-5 KM";
  if (km < 10) return "5-10 KM";
  if (km < 20) return "10-20 KM";
  return ">20 KM";
}
const DIST_ORDER = ["<3 KM", "3-5 KM", "5-10 KM", "10-20 KM", ">20 KM"];

// ── Print section ───────────────────────────────────────────────────────────
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
  for (const { wrapper, img } of snapshots) {
    wrapper._origHTML = wrapper.innerHTML;
    wrapper.innerHTML = "";
    wrapper.appendChild(img);
  }
  const content = ref.current.cloneNode(true);
  for (const { wrapper } of snapshots) {
    wrapper.innerHTML = wrapper._origHTML;
    delete wrapper._origHTML;
  }
  for (const btn of content.querySelectorAll("button")) btn.remove();
  for (const lbl of content.querySelectorAll("label")) {
    if (lbl.querySelector('input[type="file"]')) lbl.remove();
  }
  const win = window.open("", "_blank");
  if (!win) { alert("Permite ventanas emergentes para descargar el PDF"); return; }
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
  setTimeout(() => { win.print(); win.close(); }, 500);
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color = "#7C22D4" }) {
  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 p-4 flex items-center gap-3"
         style={{ borderLeft: `4px solid ${color}` }}>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

// ── Table component ─────────────────────────────────────────────────────────
function DataTable({ headers, rows, footer }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-white font-semibold"
                  style={{ background: "#7C22D4" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-purple-50/40"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="bg-purple-100 font-bold border-t-2 border-purple-200">
              {footer.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-800">{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── Process servicios ───────────────────────────────────────────────────────
function processServicios(rows) {
  let totalServicios = rows.length;
  let completados = 0, cancelados = 0, expirados = 0;
  let costoTotal = 0;
  const porSede = {};
  const porCentro = {};
  const porTipoServicio = {};
  const porTipoVehiculo = {};
  const porTipoCobro = {};
  const porDistancia = {};

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

    // Por sede
    if (!porSede[sede]) porSede[sede] = { servicios: 0, costo: 0 };
    porSede[sede].servicios++;
    porSede[sede].costo += costo;

    // Por centro de costo
    if (!porCentro[centro]) porCentro[centro] = { servicios: 0, costo: 0 };
    porCentro[centro].servicios++;
    porCentro[centro].costo += costo;

    // Por tipo servicio
    if (!porTipoServicio[tipoSvc]) porTipoServicio[tipoSvc] = { servicios: 0, costo: 0 };
    porTipoServicio[tipoSvc].servicios++;
    porTipoServicio[tipoSvc].costo += costo;

    // Por tipo vehículo
    if (!porTipoVehiculo[tipoVeh]) porTipoVehiculo[tipoVeh] = { completados: 0, expirados: 0, cancelados: 0, total: 0 };
    porTipoVehiculo[tipoVeh].total++;
    if (status === "completed") porTipoVehiculo[tipoVeh].completados++;
    else if (status === "expired") porTipoVehiculo[tipoVeh].expirados++;
    else if (status === "canceled") porTipoVehiculo[tipoVeh].cancelados++;

    // Por tipo cobro
    if (!porTipoCobro[tipoCobro]) porTipoCobro[tipoCobro] = { servicios: 0, costo: 0 };
    porTipoCobro[tipoCobro].servicios++;
    porTipoCobro[tipoCobro].costo += costo;

    // Por distancia
    const rng = distRange(dist);
    if (!porDistancia[rng]) porDistancia[rng] = 0;
    porDistancia[rng]++;
  }

  const efectividad = totalServicios > 0 ? completados / totalServicios : 0;

  return {
    totalServicios, completados, cancelados, expirados, costoTotal, efectividad,
    porSede, porCentro, porTipoServicio, porTipoVehiculo, porTipoCobro, porDistancia,
  };
}

// ── Process paquetes ────────────────────────────────────────────────────────
function processPaquetes(rows) {
  const total = rows.length;
  let entregados = 0, cancelados = 0, devueltos = 0;
  const porEstado = {};
  const porSede = {};
  let sumTiempoCreoReco = 0, countCreoReco = 0;
  let sumTiempoRecoEntr = 0, countRecoEntr = 0;

  for (const r of rows) {
    const estado = String(r["Estado"] || "").trim();
    const sede = r["Nombre de la sede"] || "Sin sede";

    if (!porEstado[estado]) porEstado[estado] = 0;
    porEstado[estado]++;

    const el = estado.toLowerCase();
    if (el === "entregado") entregados++;
    else if (el === "cancelado") cancelados++;
    else if (el === "devuelto") devueltos++;

    if (!porSede[sede]) porSede[sede] = 0;
    porSede[sede]++;

    // Time calculations
    const tCreacion = r["Hora de creación"];
    const tRecogida = r["Hora de recogida"];
    const tEntrega = r["Hora de entrega"];

    if (tCreacion && tRecogida) {
      const d1 = new Date(tCreacion);
      const d2 = new Date(tRecogida);
      if (!isNaN(d1) && !isNaN(d2) && d2 > d1) {
        sumTiempoCreoReco += (d2 - d1) / 60000; // minutes
        countCreoReco++;
      }
    }
    if (tRecogida && tEntrega) {
      const d1 = new Date(tRecogida);
      const d2 = new Date(tEntrega);
      if (!isNaN(d1) && !isNaN(d2) && d2 > d1) {
        sumTiempoRecoEntr += (d2 - d1) / 60000;
        countRecoEntr++;
      }
    }
  }

  const efectividad = total > 0 ? entregados / total : 0;
  const tasaDevolucion = total > 0 ? devueltos / total : 0;
  const avgCreoReco = countCreoReco > 0 ? sumTiempoCreoReco / countCreoReco : 0;
  const avgRecoEntr = countRecoEntr > 0 ? sumTiempoRecoEntr / countRecoEntr : 0;

  return {
    total, entregados, cancelados, devueltos, efectividad, tasaDevolucion,
    porEstado, porSede, avgCreoReco, avgRecoEntr,
  };
}

// ── Generate insights ───────────────────────────────────────────────────────
function generateInsights(svc, paq) {
  const positivos = [];
  const alertas = [];

  if (svc) {
    if (svc.efectividad >= 0.9) positivos.push(`Alta efectividad de servicios: ${fmtPct(svc.efectividad)} de servicios completados.`);
    else if (svc.efectividad >= 0.8) positivos.push(`Efectividad de servicios aceptable: ${fmtPct(svc.efectividad)}.`);
    else alertas.push(`Baja efectividad de servicios: solo ${fmtPct(svc.efectividad)} completados. Se requiere análisis de las causas de cancelación/expiración.`);

    if (svc.cancelados > 0) {
      const pctCanc = svc.cancelados / svc.totalServicios;
      if (pctCanc > 0.15) alertas.push(`Tasa de cancelación elevada: ${fmtPct(pctCanc)} (${fmtNum(svc.cancelados)} servicios cancelados).`);
      else positivos.push(`Tasa de cancelación controlada: ${fmtPct(pctCanc)}.`);
    }

    if (svc.expirados > 0) {
      const pctExp = svc.expirados / svc.totalServicios;
      if (pctExp > 0.1) alertas.push(`${fmtNum(svc.expirados)} servicios expirados (${fmtPct(pctExp)}). Revisar tiempos de asignación.`);
      else positivos.push(`Pocos servicios expirados: ${fmtPct(pctExp)}.`);
    }

    // Top sede
    const sedeEntries = Object.entries(svc.porSede).sort((a, b) => b[1].costo - a[1].costo);
    if (sedeEntries.length > 0) {
      const [topSede, topData] = sedeEntries[0];
      const pctSede = topData.costo / svc.costoTotal;
      positivos.push(`Sede principal: "${topSede}" concentra ${fmtPct(pctSede)} del costo total con ${fmtNum(topData.servicios)} servicios.`);
    }

    // Vehicle effectiveness
    const vehEntries = Object.entries(svc.porTipoVehiculo);
    for (const [veh, data] of vehEntries) {
      if (data.total >= 10) {
        const eff = data.completados / data.total;
        if (eff < 0.75) alertas.push(`Baja efectividad en vehículo "${veh}": ${fmtPct(eff)} (${data.total} servicios).`);
        else if (eff >= 0.95) positivos.push(`Excelente efectividad en vehículo "${veh}": ${fmtPct(eff)}.`);
      }
    }

    // Distance distribution
    const distEntries = Object.entries(svc.porDistancia);
    const shortRange = (svc.porDistancia["<3 KM"] || 0) + (svc.porDistancia["3-5 KM"] || 0);
    if (svc.totalServicios > 0 && shortRange / svc.totalServicios > 0.6) {
      positivos.push(`${fmtPct(shortRange / svc.totalServicios)} de servicios en distancias cortas (<5 KM), favoreciendo tiempos de entrega.`);
    }

    const longRange = svc.porDistancia[">20 KM"] || 0;
    if (svc.totalServicios > 0 && longRange / svc.totalServicios > 0.1) {
      alertas.push(`${fmtPct(longRange / svc.totalServicios)} de servicios en distancias largas (>20 KM). Considerar optimización de rutas.`);
    }
  }

  if (paq) {
    if (paq.efectividad >= 0.9) positivos.push(`Alta efectividad de entregas de paquetes: ${fmtPct(paq.efectividad)}.`);
    else alertas.push(`Efectividad de entregas de paquetes: ${fmtPct(paq.efectividad)}. Requiere atención.`);

    if (paq.tasaDevolucion > 0.05) alertas.push(`Tasa de devolución de paquetes: ${fmtPct(paq.tasaDevolucion)}. Revisar causas.`);
    else if (paq.total > 0) positivos.push(`Tasa de devolución de paquetes controlada: ${fmtPct(paq.tasaDevolucion)}.`);

    if (paq.avgCreoReco > 0) {
      const mins = Math.round(paq.avgCreoReco);
      if (mins > 60) alertas.push(`Tiempo promedio de recogida: ${mins} min. Considerar reducir tiempos de asignación.`);
      else positivos.push(`Tiempo promedio de recogida eficiente: ${mins} min.`);
    }

    if (paq.avgRecoEntr > 0) {
      const mins = Math.round(paq.avgRecoEntr);
      positivos.push(`Tiempo promedio de entrega (recogido a entregado): ${mins} min.`);
    }
  }

  // Pad to 5 each
  while (positivos.length < 5) positivos.push("Operación dentro de parámetros normales.");
  while (alertas.length < 5) alertas.push("Sin alertas adicionales identificadas.");

  return { positivos: positivos.slice(0, 5), alertas: alertas.slice(0, 5) };
}

// ── Format minutes to human readable ────────────────────────────────────────
function fmtMinutes(mins) {
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

// ═════════════════════════════════════════════════════════════════════════════
// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export default function InformeCliente() {
  const [cliente, setCliente] = useState("");
  const [fechaInforme, setFechaInforme] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [serviciosFile, setServiciosFile] = useState(null);
  const [paquetesFile, setPaquetesFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [svcData, setSvcData] = useState(null);
  const [paqData, setPaqData] = useState(null);

  const reportRef = useRef(null);

  const insights = useMemo(() => {
    if (!svcData && !paqData) return null;
    return generateInsights(svcData, paqData);
  }, [svcData, paqData]);

  const handleGenerar = async () => {
    if (!cliente.trim()) { setError("Ingresa el nombre del cliente."); return; }
    if (!serviciosFile && !paquetesFile) { setError("Sube al menos un archivo (servicios o paquetes)."); return; }
    setError("");
    setLoading(true);
    setSvcData(null);
    setPaqData(null);
    try {
      if (serviciosFile) {
        const rows = await readFile(serviciosFile);
        setSvcData(processServicios(rows));
      }
      if (paquetesFile) {
        const rows = await readFile(paquetesFile);
        setPaqData(processPaquetes(rows));
      }
    } catch (err) {
      setError("Error al procesar archivos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const hasReport = svcData || paqData;

  return (
    <div className="space-y-6">
      {/* ── Configuracion ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 print:hidden">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
               style={{ background: BRAND_GRADIENT }}>📋</div>
          <h2 className="text-sm font-bold text-gray-800">Configurar Informe de Cliente</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Nombre del cliente</label>
            <input type="text" value={cliente} onChange={e => setCliente(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Ej: Empresa ABC" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Fecha del informe</label>
            <input type="date" value={fechaInforme} onChange={e => setFechaInforme(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Periodo</label>
            <input type="text" value={periodo} onChange={e => setPeriodo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Ej: Mayo 2026" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Archivo de Servicios (.xlsx) — opcional</label>
            <input type="file" accept=".xlsx,.xls"
              onChange={e => setServiciosFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Archivo de Paquetes (.xlsx) — opcional</label>
            <input type="file" accept=".xlsx,.xls"
              onChange={e => setPaquetesFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
          </div>
        </div>

        {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

        <button onClick={handleGenerar} disabled={loading}
          className="px-6 py-2.5 rounded-lg text-white text-sm font-bold shadow hover:shadow-md transition disabled:opacity-50"
          style={{ background: BRAND_GRADIENT }}>
          {loading ? "Procesando..." : "Generar informe"}
        </button>
      </div>

      {/* ── Report ─────────────────────────────────────────────────────── */}
      {hasReport && (
        <div ref={reportRef} className="space-y-6">
          {/* Header */}
          <div className="rounded-2xl shadow-md p-5 text-white" style={{ background: BRAND_GRADIENT }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold">Informe Operacional — {cliente || "Cliente"}</h2>
              <button onClick={() => printSection(reportRef, `Informe ${cliente} — ${periodo}`)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold transition print:hidden">
                📄 Descargar PDF
              </button>
            </div>
            <p className="text-xs opacity-80">
              {periodo && `Periodo: ${periodo}`}
              {fechaInforme && ` · Fecha: ${fechaInforme}`}
            </p>
          </div>

          {/* ── A. Resumen ejecutivo ────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3">A. Resumen Ejecutivo</h3>
            {svcData && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
                <KpiCard label="Total servicios" value={fmtNum(svcData.totalServicios)} color="#7C22D4" />
                <KpiCard label="Completados" value={fmtNum(svcData.completados)} color="#16A34A" />
                <KpiCard label="Cancelados" value={fmtNum(svcData.cancelados)} color="#DC2626" />
                <KpiCard label="Expirados" value={fmtNum(svcData.expirados)} color="#F59E0B" />
                <KpiCard label="% Efectividad" value={fmtPct(svcData.efectividad)} color={svcData.efectividad >= 0.85 ? "#16A34A" : "#DC2626"} />
              </div>
            )}
            {paqData && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <KpiCard label="Total paquetes" value={fmtNum(paqData.total)} color="#7C22D4" />
                <KpiCard label="Entregados" value={fmtNum(paqData.entregados)} color="#16A34A" />
                <KpiCard label="Devueltos" value={fmtNum(paqData.devueltos)} color="#DC2626" />
                <KpiCard label="Cancelados" value={fmtNum(paqData.cancelados)} color="#F59E0B" />
                <KpiCard label="% Efectividad entregas" value={fmtPct(paqData.efectividad)} color={paqData.efectividad >= 0.85 ? "#16A34A" : "#DC2626"} />
              </div>
            )}
          </div>

          {/* ── B. Analisis de facturacion ──────────────────────────────── */}
          {svcData && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800">B. Analisis de Facturacion</h3>

              {/* Por sede */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Por sede</p>
                <DataTable
                  headers={["Sede", "Servicios", "Costo total", "% Participacion"]}
                  rows={Object.entries(svcData.porSede)
                    .sort((a, b) => b[1].costo - a[1].costo)
                    .map(([sede, d]) => [
                      sede,
                      fmtNum(d.servicios),
                      fmtCOP(d.costo),
                      fmtPct(svcData.costoTotal > 0 ? d.costo / svcData.costoTotal : 0),
                    ])}
                  footer={["Total", fmtNum(svcData.totalServicios), fmtCOP(svcData.costoTotal), "100.0%"]}
                />
              </div>

              {/* Por centro de costo */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Por centro de costo</p>
                <DataTable
                  headers={["Centro de costo", "Servicios", "Costo", "% Participacion"]}
                  rows={Object.entries(svcData.porCentro)
                    .sort((a, b) => b[1].costo - a[1].costo)
                    .map(([centro, d]) => [
                      centro,
                      fmtNum(d.servicios),
                      fmtCOP(d.costo),
                      fmtPct(svcData.costoTotal > 0 ? d.costo / svcData.costoTotal : 0),
                    ])}
                  footer={["Total", fmtNum(svcData.totalServicios), fmtCOP(svcData.costoTotal), "100.0%"]}
                />
              </div>

              {/* Por tipo de servicio */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Por tipo de servicio</p>
                <DataTable
                  headers={["Tipo de servicio", "Servicios", "Costo", "% Participacion"]}
                  rows={Object.entries(svcData.porTipoServicio)
                    .sort((a, b) => b[1].costo - a[1].costo)
                    .map(([tipo, d]) => [
                      tipo,
                      fmtNum(d.servicios),
                      fmtCOP(d.costo),
                      fmtPct(svcData.costoTotal > 0 ? d.costo / svcData.costoTotal : 0),
                    ])}
                  footer={["Total", fmtNum(svcData.totalServicios), fmtCOP(svcData.costoTotal), "100.0%"]}
                />
              </div>
            </div>
          )}

          {/* ── C. Analisis operacional ─────────────────────────────────── */}
          {svcData && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800">C. Analisis Operacional</h3>

              {/* Por tipo de vehiculo */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Por tipo de vehiculo</p>
                <DataTable
                  headers={["Tipo vehiculo", "Completados", "Expirados", "Cancelados", "% Efectividad"]}
                  rows={Object.entries(svcData.porTipoVehiculo)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([veh, d]) => [
                      veh,
                      fmtNum(d.completados),
                      fmtNum(d.expirados),
                      fmtNum(d.cancelados),
                      fmtPct(d.total > 0 ? d.completados / d.total : 0),
                    ])}
                />
              </div>

              {/* Por tipo de cobro */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Por tipo de cobro</p>
                <DataTable
                  headers={["Tipo de cobro", "Servicios", "Costo"]}
                  rows={Object.entries(svcData.porTipoCobro)
                    .sort((a, b) => b[1].costo - a[1].costo)
                    .map(([tipo, d]) => [
                      tipo,
                      fmtNum(d.servicios),
                      fmtCOP(d.costo),
                    ])}
                />
              </div>

              {/* Servicios por distancia */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Servicios por distancia</p>
                <DataTable
                  headers={["Rango", "Servicios", "% del total"]}
                  rows={DIST_ORDER.map(rng => [
                    rng,
                    fmtNum(svcData.porDistancia[rng] || 0),
                    fmtPct(svcData.totalServicios > 0 ? (svcData.porDistancia[rng] || 0) / svcData.totalServicios : 0),
                  ])}
                  footer={["Total", fmtNum(svcData.totalServicios), "100.0%"]}
                />
              </div>
            </div>
          )}

          {/* ── D. Analisis de paquetes ─────────────────────────────────── */}
          {paqData && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800">D. Analisis de Paquetes</h3>

              {/* Por estado */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Por estado</p>
                <DataTable
                  headers={["Estado", "Paquetes", "% del total"]}
                  rows={Object.entries(paqData.porEstado)
                    .sort((a, b) => b[1] - a[1])
                    .map(([estado, count]) => [
                      estado,
                      fmtNum(count),
                      fmtPct(paqData.total > 0 ? count / paqData.total : 0),
                    ])}
                  footer={["Total", fmtNum(paqData.total), "100.0%"]}
                />
              </div>

              {/* Por sede */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Por sede</p>
                <DataTable
                  headers={["Sede", "Paquetes", "% del total"]}
                  rows={Object.entries(paqData.porSede)
                    .sort((a, b) => b[1] - a[1])
                    .map(([sede, count]) => [
                      sede,
                      fmtNum(count),
                      fmtPct(paqData.total > 0 ? count / paqData.total : 0),
                    ])}
                  footer={["Total", fmtNum(paqData.total), "100.0%"]}
                />
              </div>

              {/* Metricas de paquetes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard label="Tasa de devolucion" value={fmtPct(paqData.tasaDevolucion)} color={paqData.tasaDevolucion > 0.05 ? "#DC2626" : "#16A34A"} />
                {paqData.avgCreoReco > 0 && (
                  <KpiCard label="Tiempo prom. creado a recogido" value={fmtMinutes(paqData.avgCreoReco)} color="#7C22D4" />
                )}
                {paqData.avgRecoEntr > 0 && (
                  <KpiCard label="Tiempo prom. recogido a entregado" value={fmtMinutes(paqData.avgRecoEntr)} color="#7C22D4" />
                )}
              </div>
            </div>
          )}

          {/* ── E. Insights automaticos ────────────────────────────────── */}
          {insights && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800">E. Insights Automaticos</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-green-800 mb-2">Aspectos positivos</p>
                  <ul className="space-y-1">
                    {insights.positivos.map((txt, i) => (
                      <li key={i} className="text-xs text-green-700 flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">+</span>
                        <span>{txt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-red-800 mb-2">Alertas y oportunidades</p>
                  <ul className="space-y-1">
                    {insights.alertas.map((txt, i) => (
                      <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">!</span>
                        <span>{txt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
