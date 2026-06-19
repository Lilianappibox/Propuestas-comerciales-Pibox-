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
  const [histOpen, setHistOpen] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());
  const reportRef = useRef(null);
  const svcFileRef = useRef(null);
  const paqFileRef = useRef(null);

  const insights = useMemo(() => (svcData || paqData) ? generateInsights(svcData, paqData) : null, [svcData, paqData]);
  const hasReport = svcData || paqData;

  const handleGenerar = async () => {
    if (!cliente.trim()) { setError("Ingresa el nombre del cliente."); return; }
    if (!serviciosFile && !paquetesFile) { setError("Sube al menos un archivo (servicios o paquetes)."); return; }
    setError(""); setLoading(true); setSvcData(null); setPaqData(null);
    try {
      if (serviciosFile) setSvcData(processServicios(await readFile(serviciosFile)));
      if (paquetesFile) setPaqData(processPaquetes(await readFile(paquetesFile)));
    } catch (err) { setError("Error al procesar archivos: " + err.message); } finally { setLoading(false); }
  };

  const handleLimpiar = () => {
    setCliente(""); setFechaInforme(""); setPeriodo("");
    setServiciosFile(null); setPaquetesFile(null);
    setSvcData(null); setPaqData(null); setError("");
    if (svcFileRef.current) svcFileRef.current.value = "";
    if (paqFileRef.current) paqFileRef.current.value = "";
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
      svcData, paqData,
    };
    setHistory(saveToHistory(entry));
  };

  const handleLoadHistory = (entry) => {
    setCliente(entry.cliente || ""); setFechaInforme(entry.fecha || ""); setPeriodo(entry.periodo || "");
    if (entry.svcData) setSvcData(entry.svcData); else setSvcData(null);
    if (entry.paqData) setPaqData(entry.paqData); else setPaqData(null);
    setServiciosFile(null); setPaquetesFile(null);
    if (svcFileRef.current) svcFileRef.current.value = "";
    if (paqFileRef.current) paqFileRef.current.value = "";
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
                  Digital Network Colombia S.A.S.
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

          {/* F. Insights (positive only) */}
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

          <div style={{ height: 24 }} />
        </div>
      )}
    </div>
  );
}
