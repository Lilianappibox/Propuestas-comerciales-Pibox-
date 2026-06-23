import React, { useState, useRef, useEffect } from "react";
import logoSrc from "../../assets/pibox-logo.png";
import { mesesDisponibles, idbLoadHorasRows } from "./utils";

const BRAND = "#7C22D4";
const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";

// ── Utilidades de fecha y formato ────────────────────────────────────────────
function parseDate(v) {
  if (!v && v !== 0) return "";
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86400 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${day}/${m}/${y}`;
  }
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${d}/${m}/${y}`;
  }
  const s = String(v).trim();
  const match = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return s;
}

function parseHHMMSS(v) {
  if (!v) return 0;
  const s = String(v).trim();
  const parts = s.split(":").map(Number);
  if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return 0;
}

const CITY_ABBR = {
  "barranquilla": "b/quilla", "barranquilla d.e.": "b/quilla",
  "bucaramanga": "b/manga",
  "barrancabermeja": "b/bermeja",
  "bogota": "bogotá", "bogotá": "bogotá", "bogotá d.c.": "bogotá",
  "medellin": "medellín", "medellín": "medellín",
  "cartagena": "c/gena", "cartagena de indias": "c/gena",
  "villavicencio": "villavo",
  "santa marta": "sta marta",
  "buenaventura": "b/ventura",
  "san jose del guaviare": "sjg",
  "florencia": "florencia",
  "popayan": "popayán", "popayán": "popayán",
  "cucuta": "cúcuta", "cúcuta": "cúcuta",
  "manizales": "manizales",
  "pereira": "pereira",
  "armenia": "armenia",
  "ibague": "ibagué", "ibagué": "ibagué",
  "neiva": "neiva",
  "pasto": "pasto",
  "monteria": "montería", "montería": "montería",
  "valledupar": "valledupar",
  "sincelejo": "sincelejo",
  "riohacha": "riohacha",
  "quibdo": "quibdó", "quibdó": "quibdó",
  "tunja": "tunja",
  "yopal": "yopal",
  "mocoa": "mocoa",
  "leticia": "leticia",
  "mitu": "mitú",
  "puerto carreno": "pto carreño",
  "inirida": "inírida",
  "san andres": "san andrés",
  "chia": "chía", "chía": "chía",
  "soacha": "soacha",
  "bello": "bello",
  "itagui": "itagüí", "itagüí": "itagüí",
  "envigado": "envigado",
  "soledad": "soledad",
  "palmira": "palmira",
  "buga": "buga",
  "tulua": "tuluá", "tuluá": "tuluá",
};
function abrevCiudad(nombre) {
  if (!nombre) return nombre;
  const lower = String(nombre).toLowerCase().trim();
  return CITY_ABBR[lower] || nombre;
}

const fmtCOP = (v) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
const fmtNum = (v) => new Intl.NumberFormat("es-CO").format(v);

// ── Print ────────────────────────────────────────────────────────────────────
function printSection(ref, title) {
  if (!ref?.current) return;
  const content = ref.current.cloneNode(true);
  for (const btn of content.querySelectorAll("button")) btn.remove();
  const win = window.open("", "_blank");
  if (!win) { alert("Permite ventanas emergentes para descargar el PDF"); return; }
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
    .map((s) => s.outerHTML)
    .join("\n");
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>${styles}
    <style>
      @page { size: A4 portrait; margin: 15mm; }
      body { margin: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .print-root { max-width: 100% !important; padding: 0 !important; }
      table { table-layout: fixed; width: 100% !important; font-size: 7.5px; border-collapse: collapse; }
      table th { font-size: 7px !important; padding: 3px 5px !important; }
      table td { padding: 3px 5px; word-wrap: break-word; overflow-wrap: break-word; }
      table td:first-child { font-size: 6.5px !important; white-space: nowrap; width: 52px; }
      table td.cell-driver { font-size: 6px !important; line-height: 1.3; }
      table th:first-child { width: 52px; }
      .kpi-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
      .section-card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10px; }
      .overflow-x-auto { overflow: visible !important; }
    </style></head><body><div class="print-root" style="max-width:680px;margin:0 auto;padding:8px">${content.innerHTML}</div></body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 600);
}

// ── Proceso principal ────────────────────────────────────────────────────────
function processHoras(rows) {
  function isCompletado(r) {
    const s = String(r["estado_booking"] || r["service_status"] || "").toLowerCase().trim();
    return s === "completado" || s === "completed";
  }

  const horasComp = [], horasNoComp = [];
  const paqComp = [], paqNoComp = [];

  for (const r of rows) {
    const opType = String(r["operation_type"] || "").trim().toLowerCase();
    const esTurno = opType === "horas" || opType === "bavaria paquetes tada";
    const esTarea = opType === "on demand";
    if (!esTurno && !esTarea) continue;

    const date = parseDate(r["date"]);
    const sede = String(r["passenger_name"] || "Sin sede").trim();
    const driver = String(r["driver_name"] || "Sin conductor").trim();
    const gmv = parseFloat(r["gmv"]) || 0;
    const packages = parseInt(r["packages"]) || parseInt(r["cant_stops"]) || 0;
    const bookingId = String(r["booking_id"] || "");
    const city = String(r["city"] || "");
    const estadoRaw = String(r["estado_booking"] || r["service_status"] || "").trim();
    const cancelacion = String(r["cancelacion"] || "").trim();
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

  const odByDateDriver = {};
  for (const r of paqComp) {
    const key = `${r.date}||${r.driver}`;
    if (!odByDateDriver[key]) odByDateDriver[key] = { tareas: 0, paquetes: 0 };
    odByDateDriver[key].tareas++;
    odByDateDriver[key].paquetes += r.packages;
  }

  const turnosByKey = {};
  for (const r of horasComp) {
    const key = `${r.date}||${r.driver}||${r.sede}`;
    if (!turnosByKey[key]) turnosByKey[key] = { date: r.date, driver: r.driver, sede: r.sede, servicios: 0, gmv: 0, horasTrabajadas: 0 };
    turnosByKey[key].servicios++;
    turnosByKey[key].gmv += r.gmv;
    turnosByKey[key].horasTrabajadas += r.horasTrabajadas;
  }

  const byDateSede = {};
  for (const t of Object.values(turnosByKey)) {
    const sedKey = `${t.date}||${t.sede}`;
    const od = odByDateDriver[`${t.date}||${t.driver}`] || { tareas: 0, paquetes: 0 };
    if (!byDateSede[sedKey]) byDateSede[sedKey] = { date: t.date, sede: t.sede, drivers: {}, gmvTotal: 0, tareasTotal: 0, paquetesTotal: 0, serviciosCount: 0 };
    const e = byDateSede[sedKey];
    e.gmvTotal += t.gmv;
    e.tareasTotal += od.tareas;
    e.paquetesTotal += od.paquetes;
    e.serviciosCount += t.servicios;
    if (!e.drivers[t.driver]) e.drivers[t.driver] = { tareas: 0, paquetes: 0, gmv: 0, servicios: 0 };
    e.drivers[t.driver].tareas += od.tareas;
    e.drivers[t.driver].paquetes += od.paquetes;
    e.drivers[t.driver].gmv += t.gmv;
    e.drivers[t.driver].servicios += t.servicios;
  }

  const driverStats = {};
  for (const t of Object.values(turnosByKey)) {
    const od = odByDateDriver[`${t.date}||${t.driver}`] || { tareas: 0, paquetes: 0 };
    if (!driverStats[t.driver]) driverStats[t.driver] = { driver: t.driver, servicios: 0, tareas: 0, paquetes: 0, gmvTotal: 0, horasTrabajadas: 0 };
    driverStats[t.driver].servicios += t.servicios;
    driverStats[t.driver].tareas += od.tareas;
    driverStats[t.driver].paquetes += od.paquetes;
    driverStats[t.driver].gmvTotal += t.gmv;
    driverStats[t.driver].horasTrabajadas += t.horasTrabajadas;
  }

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
  const totalTareas = paqComp.length;
  const totalPackages = paqComp.reduce((s, r) => s + r.packages, 0);
  const costoPorPaquete = totalPackages > 0 ? totalGMV / totalPackages : 0;
  const totalHoras = horasComp.reduce((s, r) => s + r.horasTrabajadas, 0);
  const valorPorHora = totalHoras > 0 ? totalGMV / totalHoras : 0;

  const sedeStats = {};
  for (const t of Object.values(turnosByKey)) {
    const od = odByDateDriver[`${t.date}||${t.driver}`] || { tareas: 0, paquetes: 0 };
    if (!sedeStats[t.sede]) sedeStats[t.sede] = { sede: t.sede, serviciosHoras: 0, tareas: 0, packagesHoras: 0, gmv: 0, horas: 0, soloHoras: true };
    sedeStats[t.sede].serviciosHoras += t.servicios;
    sedeStats[t.sede].tareas += od.tareas;
    sedeStats[t.sede].packagesHoras += od.paquetes;
    sedeStats[t.sede].gmv += t.gmv;
    sedeStats[t.sede].horas += t.horasTrabajadas;
    if (od.tareas > 0) sedeStats[t.sede].soloHoras = false;
  }
  const sedeArr = Object.values(sedeStats);

  const insightsSede = [];
  if (sedeArr.length > 0) {
    const conHoras = sedeArr.filter((s) => s.horas > 0);
    if (conHoras.length > 0) {
      const masProductiva = conHoras.reduce((a, b) =>
        b.packagesHoras / b.horas > a.packagesHoras / a.horas ? b : a
      );
      insightsSede.push({ tipo: "top", texto: `La sede más productiva es "${masProductiva.sede}" con ${(masProductiva.packagesHoras / masProductiva.horas).toFixed(1)} tareas On Demand por hora de turno.` });
    }
    const mayorGMV = sedeArr.reduce((a, b) => (b.gmv > a.gmv ? b : a));
    insightsSede.push({ tipo: "gmv", texto: `"${mayorGMV.sede}" genera el mayor GMV: ${fmtCOP(mayorGMV.gmv)} con ${fmtNum(mayorGMV.serviciosHoras)} turnos y ${fmtNum(mayorGMV.packagesHoras)} tareas OD.` });
    const soloHorasSedes = sedeArr.filter((s) => s.soloHoras && s.serviciosHoras > 0);
    if (soloHorasSedes.length > 0)
      insightsSede.push({ tipo: "info", texto: `${soloHorasSedes.length === 1 ? `La sede "${soloHorasSedes[0].sede}" opera` : `${soloHorasSedes.length} sedes operan`} solo con turnos por horas, sin tareas On Demand registradas: ${soloHorasSedes.map((s) => s.sede).join(", ")}.` });
    const mixtas = sedeArr.filter((s) => !s.soloHoras && s.serviciosHoras > 0);
    if (mixtas.length > 0)
      insightsSede.push({ tipo: "info", texto: `${mixtas.length === 1 ? `"${mixtas[0].sede}" combina` : `${mixtas.length} sedes combinan`} turnos por horas con tareas On Demand: ${mixtas.map((s) => s.sede).join(", ")}.` });
    const masSvc = sedeArr.reduce((a, b) => (b.serviciosHoras > a.serviciosHoras ? b : a));
    insightsSede.push({ tipo: "top", texto: `"${masSvc.sede}" tiene el mayor número de turnos: ${fmtNum(masSvc.serviciosHoras)} turnos con ${fmtNum(masSvc.packagesHoras)} tareas OD.` });
    const conPaq = sedeArr.filter((s) => s.packagesHoras > 0);
    if (conPaq.length > 1) {
      const mejorCosto = conPaq.reduce((a, b) =>
        b.gmv / b.packagesHoras < a.gmv / a.packagesHoras ? b : a
      );
      insightsSede.push({ tipo: "eficiencia", texto: `Mejor costo por tarea OD: "${mejorCosto.sede}" con ${fmtCOP(mejorCosto.gmv / mejorCosto.packagesHoras)}/tarea.` });
    }
    const masHoras = sedeArr.reduce((a, b) => (b.horas > a.horas ? b : a));
    if (masHoras.horas > 0)
      insightsSede.push({ tipo: "info", texto: `"${masHoras.sede}" acumula más horas de turno: ${masHoras.horas.toFixed(1)} h en ${fmtNum(masHoras.serviciosHoras)} turnos.` });
  }

  return {
    horasComp, horasNoComp, paqComp, paqNoComp,
    byDateSede, driverStats,
    noCompHorasPorEstado, noCompPaqPorEstado,
    totalGMV, totalPackages, totalServicios, totalTareas,
    costoPorPaquete, totalHoras, valorPorHora,
    sedeStats, sedeArr, insightsSede,
    totalNoCompHoras: horasNoComp.length,
    totalNoCompPaq: paqNoComp.length,
  };
}

// ── Sub-componentes ──────────────────────────────────────────────────────────
function SectionHeader({ children, color }) {
  const bg = color || BRAND_GRADIENT;
  return (
    <div className="section-card" style={{ background: bg, borderRadius: 10, padding: "8px 16px", marginBottom: 12 }}>
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
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ background: BRAND, color: "#fff", padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#faf5ff" }}>
              {row.map((cell, ci) => {
                const isCls = cell && typeof cell === "object" && !React.isValidElement(cell) && "v" in cell;
                return (
                  <td key={ci} className={isCls ? cell.cls : undefined}
                    style={{ padding: "6px 10px", color: "#374151", borderBottom: "1px solid #f3f4f6" }}>
                    {isCls ? cell.v : cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr style={{ background: "#ede9fe", fontWeight: 700, borderTop: "2px solid #c4b5fd" }}>
              {footer.map((cell, ci) => (
                <td key={ci} style={{ padding: "8px 10px", color: "#1f2937" }}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function EmpresasHoras() {
  const [meses, setMeses] = useState([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(""); // key del mes
  const [allRows, setAllRows] = useState(null);
  const [empresasConHoras, setEmpresasConHoras] = useState([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);
  const reportRef = useRef(null);

  // Cargar lista de meses disponibles al montar
  useEffect(() => {
    const lista = mesesDisponibles();
    setMeses(lista);
    if (lista.length === 1) setMesSeleccionado(lista[0].key);
  }, []);

  // Cargar filas del mes seleccionado
  const handleCargarMes = async (key) => {
    setMesSeleccionado(key);
    setAllRows(null); setEmpresasConHoras([]); setEmpresaSeleccionada(""); setReportData(null); setError("");
    if (!key) return;
    setLoading(true);
    try {
      const rows = await idbLoadHorasRows(key);
      if (!rows || rows.length === 0) {
        setError("Este mes no tiene datos de servicios por Horas. Vuelve a subir el archivo en Configuración para que se guarden los datos de horas.");
        setLoading(false);
        return;
      }

      // Identificar empresas con AL MENOS UN turno Horas
      const empresasTurnosMap = {};
      for (const r of rows) {
        const opType = String(r["operation_type"] || "").trim().toLowerCase();
        const company = String(r["company"] || "Sin empresa").trim();
        if (opType === "horas" || opType === "bavaria paquetes tada") {
          if (!empresasTurnosMap[company]) empresasTurnosMap[company] = 0;
          empresasTurnosMap[company]++;
        }
      }

      const lista = Object.entries(empresasTurnosMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, turnos]) => ({ name, turnos }));

      setAllRows(rows);
      setEmpresasConHoras(lista);
      if (lista.length === 1) setEmpresaSeleccionada(lista[0].name);
      else setEmpresaSeleccionada("");
    } catch (err) {
      setError("Error al cargar datos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerar = () => {
    if (!allRows) { setError("Selecciona un mes primero."); return; }
    setError("");
    let rowsFiltradas;
    if (empresaSeleccionada) {
      rowsFiltradas = allRows.filter((r) => String(r["company"] || "Sin empresa").trim() === empresaSeleccionada);
    } else {
      const nombresConHoras = new Set(empresasConHoras.map((e) => e.name));
      rowsFiltradas = allRows.filter((r) => nombresConHoras.has(String(r["company"] || "Sin empresa").trim()));
    }
    setReportData(processHoras(rowsFiltradas));
  };

  const handleLimpiar = () => {
    setMesSeleccionado(""); setAllRows(null); setEmpresasConHoras([]);
    setEmpresaSeleccionada(""); setReportData(null); setError("");
  };

  const tituloEmpresa = empresaSeleccionada || "Todas las empresas con Horas";
  const mesLabel = meses.find((m) => m.key === mesSeleccionado)?.label || "";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* ── Panel de selección ──────────────────────────────────────────── */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 24, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: BRAND_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            ⏱️
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1f2937", margin: 0 }}>
              Empresas con Servicios por Horas
            </h2>
            <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
              Analiza los datos subidos en Configuración — empresas con al menos un turno por horas
            </p>
          </div>
        </div>

        {/* Selector de mes */}
        {meses.length === 0 ? (
          <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "#92400e" }}>
            No hay meses cargados. Ve a la pestaña <strong>Configuración</strong> y sube un archivo de servicios primero.
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>
                Selecciona el mes a analizar
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {meses.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => handleCargarMes(m.key)}
                    style={{
                      padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      border: mesSeleccionado === m.key ? "2px solid #7C22D4" : "1px solid #d1d5db",
                      background: mesSeleccionado === m.key ? "#ede9fe" : "#fff",
                      color: mesSeleccionado === m.key ? "#7C22D4" : "#374151",
                      cursor: "pointer",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <p style={{ fontSize: 13, color: BRAND, marginBottom: 12 }}>Cargando datos del mes...</p>
            )}

            {/* Empresas encontradas */}
            {empresasConHoras.length > 0 && (
              <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 10 }}>
                  {empresasConHoras.length === 1
                    ? "1 empresa encontrada con servicios por Horas"
                    : `${empresasConHoras.length} empresas encontradas con servicios por Horas`}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {empresasConHoras.length > 1 && (
                    <button
                      onClick={() => setEmpresaSeleccionada("")}
                      style={{
                        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: empresaSeleccionada === "" ? "2px solid #7C22D4" : "1px solid #d1d5db",
                        background: empresaSeleccionada === "" ? "#ede9fe" : "#fff",
                        color: empresaSeleccionada === "" ? "#7C22D4" : "#374151",
                        cursor: "pointer",
                      }}
                    >
                      Todas ({empresasConHoras.reduce((s, e) => s + e.turnos, 0)} turnos)
                    </button>
                  )}
                  {empresasConHoras.map((emp) => (
                    <button
                      key={emp.name}
                      onClick={() => setEmpresaSeleccionada(emp.name)}
                      style={{
                        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: empresaSeleccionada === emp.name ? "2px solid #7C22D4" : "1px solid #d1d5db",
                        background: empresaSeleccionada === emp.name ? "#ede9fe" : "#fff",
                        color: empresaSeleccionada === emp.name ? "#7C22D4" : "#374151",
                        cursor: "pointer",
                        maxWidth: 280, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap",
                      }}
                      title={emp.name}
                    >
                      {emp.name} ({fmtNum(emp.turnos)} turnos)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 12, fontSize: 13, color: "#dc2626" }}>
                {error}
              </div>
            )}

            {empresasConHoras.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={handleGenerar}
                  style={{ background: BRAND_GRADIENT, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Generar análisis
                </button>
                <button
                  onClick={handleLimpiar}
                  style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Limpiar
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Reporte ─────────────────────────────────────────────────────── */}
      {reportData && (
        <div ref={reportRef} style={{ fontFamily: "'Segoe UI',system-ui,sans-serif" }}>

          {/* Header */}
          <div style={{ background: BRAND_GRADIENT, borderRadius: 14, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <img src={logoSrc} alt="Pibox" style={{ height: 36, marginBottom: 10, filter: "brightness(0) invert(1)" }} />
                <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
                  Análisis de Servicios por Horas
                </h1>
                <p style={{ color: "rgba(255,255,255,.85)", fontSize: 13, margin: "0 0 2px" }}>{tituloEmpresa}</p>
                <p style={{ color: "rgba(255,255,255,.7)", fontSize: 11, margin: 0 }}>
                  {mesLabel} · {empresaSeleccionada
                    ? `${empresasConHoras.find((e) => e.name === empresaSeleccionada)?.turnos ?? ""} turnos`
                    : `${empresasConHoras.length} empresas · ${empresasConHoras.reduce((s, e) => s + e.turnos, 0)} turnos totales`}
                </p>
              </div>
              <button
                className="no-print"
                onClick={() => printSection(reportRef, `Análisis Horas - ${tituloEmpresa} - ${mesLabel}`)}
                style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(4px)" }}
              >
                Descargar PDF
              </button>
            </div>
          </div>

          {/* KPIs */}
          <SectionHeader>Productividad — Solo completados</SectionHeader>
          <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 14 }}>
            <KpiCard label="Turnos completados (Horas)" value={fmtNum(reportData.totalServicios)} color="#16a34a" />
            <KpiCard label="Tareas On Demand" value={fmtNum(reportData.totalTareas)} color="#7C22D4" />
            <KpiCard label="Paquetes entregados" value={fmtNum(reportData.totalPackages)} color="#6366f1" />
            <KpiCard label="GMV total (turnos)" value={fmtCOP(reportData.totalGMV)} color="#16a34a" />
            <KpiCard label="Horas trabajadas" value={reportData.totalHoras.toFixed(1) + " h"} color="#0891b2" />
            <KpiCard label="Valor por hora (GMV/hora)" value={fmtCOP(reportData.valorPorHora)} color="#0891b2" />
            <KpiCard label="Costo por paquete (GMV/paq)" value={fmtCOP(reportData.costoPorPaquete)} color="#f59e0b" />
            {reportData.totalNoCompHoras > 0 && (
              <KpiCard label="Turnos no completados" value={fmtNum(reportData.totalNoCompHoras)} color="#dc2626" />
            )}
            {reportData.totalNoCompPaq > 0 && (
              <KpiCard label="Tareas OD no completadas" value={fmtNum(reportData.totalNoCompPaq)} color="#dc2626" />
            )}
          </div>

          {/* Tabla por fecha y sede */}
          <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>
            Por fecha y sede — turnos, tareas On Demand y paquetes (completados)
          </p>
          <DataTable
            headers={["Fecha", "Sede / Cliente", "Conductor", "Turnos", "Tareas OD", "Paquetes", "GMV", "Costo/Paq"]}
            rows={Object.entries(reportData.byDateSede)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .flatMap(([, e]) =>
                Object.entries(e.drivers)
                  .sort((a, b) => b[1].paquetes - a[1].paquetes)
                  .map(([driver, d]) => [
                    e.date,
                    abrevCiudad(e.sede),
                    { v: driver, cls: "cell-driver" },
                    fmtNum(d.servicios),
                    fmtNum(d.tareas),
                    fmtNum(d.paquetes),
                    fmtCOP(d.gmv),
                    fmtCOP(d.paquetes > 0 ? d.gmv / d.paquetes : 0),
                  ])
              )}
            footer={["Total", "", "", fmtNum(reportData.totalServicios), fmtNum(reportData.totalTareas), fmtNum(reportData.totalPackages), fmtCOP(reportData.totalGMV), fmtCOP(reportData.costoPorPaquete)]}
          />

          {/* Productividad por conductor */}
          <div style={{ height: 14 }} />
          <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Productividad por conductor</p>
          <DataTable
            headers={["Conductor", "Turnos", "Tareas OD", "Paquetes", "Paq/turno", "GMV", "Costo/paq"]}
            rows={Object.values(reportData.driverStats)
              .sort((a, b) => b.paquetes - a.paquetes)
              .map((d) => [
                { v: d.driver, cls: "cell-driver" },
                fmtNum(d.servicios),
                fmtNum(d.tareas),
                fmtNum(d.paquetes),
                d.servicios > 0 ? (d.paquetes / d.servicios).toFixed(1) : "0",
                fmtCOP(d.gmvTotal),
                fmtCOP(d.paquetes > 0 ? d.gmvTotal / d.paquetes : 0),
              ])}
            footer={["Total", fmtNum(reportData.totalServicios), fmtNum(reportData.totalTareas), fmtNum(reportData.totalPackages), reportData.totalServicios > 0 ? (reportData.totalPackages / reportData.totalServicios).toFixed(1) : "0", fmtCOP(reportData.totalGMV), fmtCOP(reportData.costoPorPaquete)]}
          />

          {/* Comportamiento por Sede */}
          {reportData.insightsSede?.length > 0 && (
            <>
              <div style={{ height: 20 }} />
              <div style={{ background: "linear-gradient(135deg,#0891b2 0%,#6366f1 100%)", borderRadius: 10, padding: "8px 16px", marginBottom: 12 }}>
                <h3 style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0 }}>Comportamiento por Sede / Cliente</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10, marginBottom: 8 }}>
                {reportData.insightsSede.map((ins, i) => {
                  const colors = {
                    top:        { bg: "#eff6ff", border: "#bfdbfe", left: "#2563eb", text: "#1d4ed8", icon: "★" },
                    gmv:        { bg: "#f0fdf4", border: "#bbf7d0", left: "#16a34a", text: "#15803d", icon: "$" },
                    eficiencia: { bg: "#fefce8", border: "#fde68a", left: "#d97706", text: "#92400e", icon: "⚡" },
                    info:       { bg: "#faf5ff", border: "#e9d5ff", left: "#7C22D4", text: "#6b21a8", icon: "●" },
                  };
                  const c = colors[ins.tipo] || colors.info;
                  return (
                    <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 16px", borderLeft: `4px solid ${c.left}` }}>
                      <p style={{ fontSize: 12, color: c.text, margin: 0, lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 700, marginRight: 6 }}>{c.icon}</span>
                        {ins.texto}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div style={{ height: 10 }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 6 }}>Resumen por sede</p>
              <DataTable
                headers={["Sede / Cliente", "Turnos", "Tareas OD", "Paquetes", "Paq/hora", "GMV", "Costo/paq", "Tipo"]}
                rows={reportData.sedeArr
                  .filter((s) => s.serviciosHoras > 0)
                  .sort((a, b) => b.gmv - a.gmv)
                  .map((s) => [
                    abrevCiudad(s.sede),
                    fmtNum(s.serviciosHoras),
                    fmtNum(s.tareas),
                    fmtNum(s.packagesHoras),
                    s.horas > 0 ? (s.packagesHoras / s.horas).toFixed(1) : "—",
                    fmtCOP(s.gmv),
                    s.packagesHoras > 0 ? fmtCOP(s.gmv / s.packagesHoras) : "—",
                    s.soloHoras ? "Solo turnos" : "Turnos + OD",
                  ])}
              />
            </>
          )}

          {/* No Completados */}
          {(reportData.totalNoCompHoras > 0 || reportData.totalNoCompPaq > 0) && (
            <>
              <div style={{ height: 20 }} />
              <div style={{ background: "linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)", borderRadius: 10, padding: "8px 16px", marginBottom: 12 }}>
                <h3 style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0 }}>Servicios No Completados</h3>
              </div>

              {reportData.totalNoCompHoras > 0 && (
                <>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>
                    Turnos (Horas) no completados ({fmtNum(reportData.totalNoCompHoras)})
                  </p>
                  <DataTable
                    headers={["Estado", "Cantidad", "GMV"]}
                    rows={Object.entries(reportData.noCompHorasPorEstado).sort((a, b) => b[1].count - a[1].count).map(([estado, d]) => [estado, fmtNum(d.count), fmtCOP(d.gmv)])}
                    footer={["Total", fmtNum(reportData.totalNoCompHoras), fmtCOP(Object.values(reportData.noCompHorasPorEstado).reduce((s, d) => s + d.gmv, 0))]}
                  />
                  <div style={{ height: 10 }} />
                  <DataTable
                    headers={["Fecha", "Sede", "Conductor", "Estado"]}
                    rows={reportData.horasNoComp.sort((a, b) => a.date.localeCompare(b.date)).map((r) => [r.date, abrevCiudad(r.sede), { v: r.driver, cls: "cell-driver" }, r.estadoRaw])}
                  />
                </>
              )}

              {reportData.totalNoCompPaq > 0 && (
                <>
                  <div style={{ height: 14 }} />
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>
                    Tareas On Demand no completadas ({fmtNum(reportData.totalNoCompPaq)})
                  </p>
                  <DataTable
                    headers={["Estado", "Registros", "Paquetes"]}
                    rows={Object.entries(reportData.noCompPaqPorEstado).sort((a, b) => b[1].count - a[1].count).map(([estado, d]) => [estado, fmtNum(d.count), fmtNum(d.packages)])}
                    footer={["Total", fmtNum(reportData.totalNoCompPaq), fmtNum(reportData.paqNoComp.reduce((s, r) => s + r.packages, 0))]}
                  />
                  <div style={{ height: 10 }} />
                  <DataTable
                    headers={["Fecha", "Sede", "Conductor", "Paquetes", "Estado"]}
                    rows={reportData.paqNoComp.sort((a, b) => a.date.localeCompare(b.date)).map((r) => [r.date, abrevCiudad(r.sede), { v: r.driver, cls: "cell-driver" }, fmtNum(r.packages), r.estadoRaw])}
                  />
                </>
              )}
            </>
          )}

          {/* Firma */}
          <div style={{ height: 40 }} />
          <div style={{ borderTop: "2px solid #E9D5FF", paddingTop: 20, textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>
              Este análisis fue generado por la plataforma PIBOX.
            </p>
          </div>
          <div style={{ height: 24 }} />
        </div>
      )}
    </div>
  );
}
