import { useState, useMemo, useEffect, useRef } from "react";
import XLSX from "../../utils/xlsxHelper";

const LS_ACTUAL = "pibox_riesgo_pilotos_actual";
const LS_PREV   = "pibox_riesgo_pilotos_prev";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";

/* ─── slim columns we keep in localStorage ─── */
const KEEP = ["ID PILOTO","NOMBRE DE PILOTO","NOMBRE PILOTO","CIUDAD","ESTADO","PUNTO","PUNTUALIDAD","COLOCACION","COLOCACIÓN","SEMANA","DÍA","DIA","MES","INICIO DE TURNO"];

function slimRow(r) {
  const out = {};
  for (const k of KEEP) { if (r[k] !== undefined) out[k] = r[k]; }
  return out;
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const sheetName = wb.SheetNames.includes("DATA") ? "DATA" : wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Error leyendo archivo"));
    reader.readAsArrayBuffer(file);
  });
}

function detectMonth(rows) {
  for (const r of rows.slice(0, 50)) {
    const m = String(r["MES"] || "").trim();
    if (m) return m;
  }
  return "Desconocido";
}

function downloadCsv(csvRows, filename) {
  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AnalisisPilotos() {
  const [rows, setRows]         = useState(null);
  const [prevRows, setPrevRows] = useState(null);
  const [mesActual, setMesActual] = useState("");
  const [mesPrev, setMesPrev]     = useState("");
  const [loading, setLoading]     = useState("");
  const pdfRef = useRef(null);

  /* restore from localStorage */
  useEffect(() => {
    try {
      const a = localStorage.getItem(LS_ACTUAL);
      if (a) { const d = JSON.parse(a); setRows(d.rows); setMesActual(d.mes); }
      const p = localStorage.getItem(LS_PREV);
      if (p) { const d = JSON.parse(p); setPrevRows(d.rows); setMesPrev(d.mes); }
    } catch {}
  }, []);

  const handleUpload = async (file, which) => {
    if (!file) return;
    setLoading(which);
    try {
      const parsed = await parseExcel(file);
      const mes = detectMonth(parsed);
      const slim = parsed.map(slimRow);
      if (which === "actual") {
        setRows(slim); setMesActual(mes);
        localStorage.setItem(LS_ACTUAL, JSON.stringify({ rows: slim, mes }));
      } else {
        setPrevRows(slim); setMesPrev(mes);
        localStorage.setItem(LS_PREV, JSON.stringify({ rows: slim, mes }));
      }
    } catch (err) { alert("Error procesando archivo: " + err.message); }
    setLoading("");
  };

  /* ─── Analysis ─── */
  const analisis = useMemo(() => {
    if (!rows?.length || !prevRows?.length) return null;
    const prevIds = new Set();
    for (const r of prevRows) {
      const id = String(r["ID PILOTO"] || "").trim();
      if (id) prevIds.add(id);
    }
    const allCurrentIds = new Set();
    for (const r of rows) {
      const id = String(r["ID PILOTO"] || "").trim();
      if (id) allCurrentIds.add(id);
    }
    const pilotosPerdidos = new Set();
    for (const id of prevIds) { if (!allCurrentIds.has(id)) pilotosPerdidos.add(id); }

    const map = {};
    const porCiudad = {};
    let totalTurnosNuevos = 0, totalPuntSI = 0, totalPuntEval = 0, totalCancela = 0;

    for (const r of rows) {
      const id = String(r["ID PILOTO"] || "").trim();
      if (!id || prevIds.has(id)) continue;
      const nombre = String(r["NOMBRE DE PILOTO"] || r["NOMBRE PILOTO"] || "").trim();
      const ciudad = String(r["CIUDAD"] || "").trim();
      const estado = String(r["ESTADO"] || "").trim();
      const punto  = String(r["PUNTO"] || "").trim();
      const punt   = String(r["PUNTUALIDAD"] || "").trim().toUpperCase();
      const esCancela = estado.toUpperCase().includes("CANCEL") || estado.toUpperCase().includes("PILOTO CANCELA");

      if (!map[id]) map[id] = { id, nombre, ciudad, turnos: 0, puntSI: 0, puntTotal: 0, cancela: 0, estados: {}, puntos: new Set() };
      map[id].turnos++;
      totalTurnosNuevos++;
      if (estado) map[id].estados[estado] = (map[id].estados[estado] || 0) + 1;
      if (punto) map[id].puntos.add(punto);
      if (punt === "SI CUMPLE" || punt === "NO CUMPLE") { map[id].puntTotal++; totalPuntEval++; }
      if (punt === "SI CUMPLE") { map[id].puntSI++; totalPuntSI++; }
      if (esCancela) { map[id].cancela++; totalCancela++; }
      if (nombre && nombre.length > (map[id].nombre || "").length) map[id].nombre = nombre;
      if (ciudad) map[id].ciudad = ciudad;

      if (ciudad) {
        if (!porCiudad[ciudad]) porCiudad[ciudad] = { nuevos: new Set(), turnos: 0, puntSI: 0, puntTotal: 0, cancela: 0, confirmados: 0 };
        porCiudad[ciudad].nuevos.add(id);
        porCiudad[ciudad].turnos++;
        if (punt === "SI CUMPLE") porCiudad[ciudad].puntSI++;
        if (punt === "SI CUMPLE" || punt === "NO CUMPLE") porCiudad[ciudad].puntTotal++;
        if (esCancela) porCiudad[ciudad].cancela++;
        if (estado === "Confirmado") porCiudad[ciudad].confirmados++;
      }
    }

    const nuevos = Object.values(map).map(p => ({ ...p, puntos: [...p.puntos] }));
    const totalNuevos = nuevos.length;
    if (totalNuevos === 0) return null;

    const avgTurnos = totalTurnosNuevos / totalNuevos;
    const pctPuntGlobal = totalPuntEval > 0 ? (totalPuntSI / totalPuntEval * 100) : 0;
    const pctCancelaGlobal = totalTurnosNuevos > 0 ? (totalCancela / totalTurnosNuevos * 100) : 0;
    const retenidos = [...prevIds].filter(id => allCurrentIds.has(id)).length;
    const tasaRetencion = prevIds.size > 0 ? (retenidos / prevIds.size * 100) : 0;

    const rangos = { "1 turno": 0, "2-3 turnos": 0, "4-7 turnos": 0, "8-15 turnos": 0, "16+ turnos": 0 };
    for (const p of nuevos) {
      if (p.turnos === 1) rangos["1 turno"]++;
      else if (p.turnos <= 3) rangos["2-3 turnos"]++;
      else if (p.turnos <= 7) rangos["4-7 turnos"]++;
      else if (p.turnos <= 15) rangos["8-15 turnos"]++;
      else rangos["16+ turnos"]++;
    }

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

    const allCanceladores = nuevos.filter(p => p.cancela > 0)
      .map(p => ({ ...p, pctCancela: p.turnos > 0 ? (p.cancela / p.turnos * 100) : 0 }))
      .sort((a, b) => b.cancela - a.cancela);
    const topCanceladores = allCanceladores.slice(0, 5);

    const allActivos = [...nuevos].sort((a, b) => b.turnos - a.turnos)
      .map(p => ({ ...p, pctPunt: p.puntTotal > 0 ? (p.puntSI / p.puntTotal * 100) : null }));
    const topActivos = allActivos.slice(0, 5);

    return {
      totalNuevos, totalTurnosNuevos, avgTurnos, pctPuntGlobal, pctCancelaGlobal,
      pilotosPerdidos: pilotosPerdidos.size, tasaRetencion, prevTotal: prevIds.size,
      rangos, ciudadData, topCanceladores, topActivos, allActivos, allCanceladores,
    };
  }, [rows, prevRows]);

  /* ─── Render ─── */
  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">📂 Cargar datos de pilotos (toda la operación PIBOX)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Current month */}
          <div className="border-2 border-dashed border-purple-200 rounded-xl p-4 bg-purple-50/30 text-center">
            <p className="text-xs font-semibold text-purple-700 mb-2">Mes actual</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-purple-700 transition">
              {loading === "actual" ? "Procesando..." : "Seleccionar Excel"}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => handleUpload(e.target.files[0], "actual")} />
            </label>
            {rows && (
              <p className="text-xs text-gray-500 mt-2">
                <span className="font-bold text-purple-700">{mesActual}</span> — {rows.length.toLocaleString()} filas
              </p>
            )}
          </div>
          {/* Previous month */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/30 text-center">
            <p className="text-xs font-semibold text-gray-600 mb-2">Mes anterior</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-gray-700 transition">
              {loading === "prev" ? "Procesando..." : "Seleccionar Excel"}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => handleUpload(e.target.files[0], "prev")} />
            </label>
            {prevRows && (
              <p className="text-xs text-gray-500 mt-2">
                <span className="font-bold text-gray-700">{mesPrev}</span> — {prevRows.length.toLocaleString()} filas
              </p>
            )}
          </div>
        </div>
        {rows && prevRows && !analisis && (
          <p className="mt-3 text-xs text-orange-600 bg-orange-50 rounded-lg p-3 text-center">
            No se encontraron pilotos nuevos (ninguno en mes actual que no estuviera en mes anterior).
          </p>
        )}
        {rows && !prevRows && (
          <p className="mt-3 text-xs text-purple-600 bg-purple-50 rounded-lg p-3 text-center">
            Sube el archivo del mes anterior para ver el analisis de pilotos nuevos y rotacion.
          </p>
        )}
      </div>

      {/* ── Analysis Results ── */}
      {analisis && (
        <div ref={pdfRef} className="space-y-6">
          {/* KPI Banner */}
          <div className="rounded-2xl shadow-md p-5 text-white" style={{ background: BRAND_GRADIENT }}>
            <h3 className="text-sm font-bold mb-1">🆕 Analisis de Pilotos Nuevos — {mesActual}</h3>
            <p className="text-xs opacity-80 mb-4">Pilotos programados en {mesActual} que no aparecieron en {mesPrev}.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Pilotos nuevos",        value: analisis.totalNuevos,                      icon: "👤" },
                { label: "Turnos asignados",       value: analisis.totalTurnosNuevos,                icon: "📋" },
                { label: "Promedio turnos/piloto",  value: analisis.avgTurnos.toFixed(1),             icon: "📊" },
                { label: "Puntualidad",            value: `${analisis.pctPuntGlobal.toFixed(1)}%`,   icon: "⏱️" },
                { label: "Tasa cancelacion",       value: `${analisis.pctCancelaGlobal.toFixed(1)}%`,icon: "🚫" },
                { label: "Retencion mes ant.",     value: `${analisis.tasaRetencion.toFixed(1)}%`,   icon: "🔄" },
              ].map((kpi, i) => (
                <div key={i} className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
                  <p className="text-lg mb-0.5">{kpi.icon}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                  <p className="text-[10px] opacity-80">{kpi.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rotacion */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">🔄 Rotacion de Pilotos — {mesActual} vs {mesPrev}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-purple-700">{analisis.prevTotal}</p>
                <p className="text-xs text-gray-500">Pilotos mes anterior</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{analisis.prevTotal - analisis.pilotosPerdidos}</p>
                <p className="text-xs text-gray-500">Retenidos</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{analisis.pilotosPerdidos}</p>
                <p className="text-xs text-gray-500">Perdidos (no volvieron)</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{analisis.totalNuevos}</p>
                <p className="text-xs text-gray-500">Nuevos ingresaron</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${analisis.tasaRetencion}%` }} title={`Retencion: ${analisis.tasaRetencion.toFixed(1)}%`} />
                <div className="h-full bg-red-400 transition-all" style={{ width: `${100 - analisis.tasaRetencion}%` }} title={`Perdida: ${(100 - analisis.tasaRetencion).toFixed(1)}%`} />
              </div>
              <span className="font-bold text-green-600">{analisis.tasaRetencion.toFixed(0)}% retencion</span>
            </div>
          </div>

          {/* Distribucion por Actividad */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">📊 Distribucion de Pilotos Nuevos por Actividad</h3>
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(analisis.rangos).map(([rango, count], idx) => {
                const pct = analisis.totalNuevos > 0 ? (count / analisis.totalNuevos * 100) : 0;
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

          {/* Por Ciudad */}
          {analisis.ciudadData.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">📍 Pilotos Nuevos por Ciudad</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-purple-700 text-white">
                      {["Ciudad", "Nuevos", "Turnos", "Prom. Turnos/Piloto", "% Confirmado", "% Cancelacion", "% Puntualidad"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analisis.ciudadData.map((c, i) => (
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

          {/* Top 5 Activos + Top 5 Canceladores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analisis.topActivos.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700">🏆 Top 5 Pilotos Nuevos Mas Activos</h3>
                  <button onClick={() => {
                    try {
                      const csvRows = [["#","Piloto","ID","Ciudad","Turnos","Confirmados","Cancelaciones","% Puntualidad","Puntos"].join(",")];
                      (analisis.allActivos || []).forEach((p, i) => {
                        const nombre = String(p.nombre||"").replace(/"/g,'""');
                        const conf = (p.estados && p.estados["Confirmado"]) || 0;
                        const punt = p.pctPunt !== null && p.pctPunt !== undefined ? p.pctPunt.toFixed(1)+"%" : "";
                        const puntos = Array.isArray(p.puntos) ? p.puntos.join("; ") : "";
                        csvRows.push([i+1,`"${nombre}"`,`"${p.id||""}"`,`"${p.ciudad||""}"`,p.turnos||0,conf,p.cancela||0,punt,`"${puntos}"`].join(","));
                      });
                      downloadCsv(csvRows, `Pilotos_Nuevos_Activos_${mesActual.replace(/ /g,"_")}.csv`);
                    } catch(e) { alert("Error: " + e.message); }
                  }} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition">
                    📥 Descargar todos ({analisis.allActivos.length})
                  </button>
                </div>
                <div className="space-y-2">
                  {analisis.topActivos.map((p, i) => (
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

            {analisis.topCanceladores.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700">🚫 Top 5 Pilotos Nuevos que Mas Cancelan</h3>
                  <button onClick={() => {
                    try {
                      const csvRows = [["#","Piloto","ID","Ciudad","Turnos","Cancelaciones","No Cancela","% Cancelacion","Puntos"].join(",")];
                      (analisis.allCanceladores || []).forEach((p, i) => {
                        const nombre = String(p.nombre||"").replace(/"/g,'""');
                        const puntos = Array.isArray(p.puntos) ? p.puntos.join("; ") : "";
                        csvRows.push([i+1,`"${nombre}"`,`"${p.id||""}"`,`"${p.ciudad||""}"`,p.turnos||0,p.cancela||0,(p.turnos||0)-(p.cancela||0),p.pctCancela.toFixed(1)+"%",`"${puntos}"`].join(","));
                      });
                      downloadCsv(csvRows, `Pilotos_Nuevos_Canceladores_${mesActual.replace(/ /g,"_")}.csv`);
                    } catch(e) { alert("Error: " + e.message); }
                  }} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition">
                    📥 Descargar todos ({analisis.allCanceladores.length})
                  </button>
                </div>
                <div className="space-y-2">
                  {analisis.topCanceladores.map((p, i) => (
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
        </div>
      )}
    </div>
  );
}
