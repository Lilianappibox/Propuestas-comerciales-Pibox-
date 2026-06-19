import { useState, useMemo } from "react";
import XLSX from "../../utils/xlsxHelper";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const PIBOX_PURPLE = "#7C22D4";
const fmtM = (v) => "$" + Math.round(v).toLocaleString("es-CO");
const SK = (k) => `pibox_pilotos_${k}`;
const SK_IDX = "pibox_pilotos_index";

function processFile(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  if (!rows.length) throw new Error("Archivo vacío");
  const toStr = v => (v == null ? "" : String(v).trim());
  const toNum = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
  const dMap = {};
  for (const r of rows) {
    const id = toStr(r.driver_id || r.DRIVER_ID || r.driverId || "");
    const nm = toStr(r.driver_name || r.DRIVER_NAME || r.driverName || "");
    const dk = id || nm;
    if (!dk) continue;
    const city = toStr(r.city || r.City || "");
    const st = toStr(r.service_status || "");
    const gmv = toNum(r.gmv);
    const dtTime = toStr(r.dt_time || "");
    let hora = -1;
    const hm = dtTime.match(/^(\d{1,2}):/);
    if (hm) hora = parseInt(hm[1]);
    if (!dMap[dk]) dMap[dk] = { id, nombre: nm, ciudad: city, s: 0, c: 0, x: 0, g: 0, hp: {} };
    const p = dMap[dk];
    p.s++;
    if (st === "Completed") p.c++;
    if (st.startsWith("Canceled")) p.x++;
    p.g += gmv;
    if (hora >= 0) p.hp[hora] = (p.hp[hora] || 0) + 1;
    if (nm && nm.length > (p.nombre || "").length) p.nombre = nm;
    if (city) p.ciudad = city;
  }
  return Object.values(dMap).map(p => {
    let hp = -1, mx = 0;
    for (const [h, c] of Object.entries(p.hp)) { if (c > mx) { mx = c; hp = Number(h); } }
    return { id: p.id, n: p.nombre, ci: p.ciudad, s: p.s, c: p.c, x: p.x, g: Math.round(p.g), h: hp };
  });
}

function loadIdx() { try { return JSON.parse(localStorage.getItem(SK_IDX) || "{}"); } catch { return {}; } }
function loadMes(k) { try { return JSON.parse(localStorage.getItem(SK(k)) || "null"); } catch { return null; } }

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function AnalisisPilotos() {
  const [idx, setIdx] = useState(loadIdx);
  const mesKeys = Object.keys(idx).sort().reverse();
  const [mesSel, setMesSel] = useState(mesKeys[0] || "");
  const [anio, setAnio] = useState(2026);
  const [mesNum, setMesNum] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const prevKey = useMemo(() => {
    if (!mesSel) return null;
    const [y, m] = mesSel.split("-").map(Number);
    return `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  }, [mesSel]);
  const mesLabel = useMemo(() => { if (!mesSel) return ""; const [y, m] = mesSel.split("-").map(Number); return `${MESES[m]} ${y}`; }, [mesSel]);
  const prevLabel = useMemo(() => { if (!prevKey) return ""; const [y, m] = prevKey.split("-").map(Number); return `${MESES[m]} ${y}`; }, [prevKey]);

  const driversActual = useMemo(() => loadMes(mesSel) || [], [mesSel, idx]);
  const driversPrev = useMemo(() => prevKey ? loadMes(prevKey) || [] : [], [prevKey, idx]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const drivers = processFile(wb);
      const key = `${anio}-${String(mesNum).padStart(2, "0")}`;
      localStorage.setItem(SK(key), JSON.stringify(drivers));
      const newIdx = { ...idx, [key]: { archivo: file.name, pilotos: drivers.length, fecha: new Date().toISOString() } };
      localStorage.setItem(SK_IDX, JSON.stringify(newIdx));
      setIdx(newIdx);
      setMesSel(key);
    } catch (err) { setError(err.message); }
    setLoading(false); e.target.value = "";
  };

  const handleDelete = (key) => {
    if (!confirm(`¿Eliminar ${key}?`)) return;
    localStorage.removeItem(SK(key));
    const newIdx = { ...idx }; delete newIdx[key];
    localStorage.setItem(SK_IDX, JSON.stringify(newIdx));
    setIdx(newIdx);
    const remaining = Object.keys(newIdx).sort().reverse();
    setMesSel(remaining[0] || "");
  };

  // ── Análisis ──
  const analisis = useMemo(() => {
    if (!driversActual.length) return null;
    const prevIds = new Set(driversPrev.map(d => d.id || d.n));
    const currentIds = new Set(driversActual.map(d => d.id || d.n));
    const retenidos = driversPrev.length > 0 ? [...prevIds].filter(id => currentIds.has(id)).length : 0;
    const perdidos = driversPrev.length > 0 ? driversPrev.length - retenidos : 0;
    const tasaRetencion = prevIds.size > 0 ? (retenidos / prevIds.size * 100) : 0;
    const nuevos = driversPrev.length > 0 ? driversActual.filter(d => !prevIds.has(d.id || d.n)) : [];
    const T = driversActual.length;
    const totalS = driversActual.reduce((a, d) => a + d.s, 0);
    const totalC = driversActual.reduce((a, d) => a + d.c, 0);
    const totalX = driversActual.reduce((a, d) => a + d.x, 0);
    const totalG = driversActual.reduce((a, d) => a + d.g, 0);
    const avg = T > 0 ? totalS / T : 0;
    const pctC = totalS > 0 ? (totalC / totalS * 100) : 0;
    const pctX = totalS > 0 ? (totalX / totalS * 100) : 0;
    // Franjas
    const hm = {};
    for (const d of driversActual) { if (d.h >= 0) hm[d.h] = (hm[d.h] || 0) + 1; }
    const franjas = Object.entries(hm).map(([h, p]) => ({ hora: `${String(h).padStart(2, "0")}:00`, pilotos: p })).sort((a, b) => a.hora.localeCompare(b.hora));
    // Ciudad
    const cm = {};
    for (const d of driversActual) {
      const c = d.ci || "Sin ciudad";
      if (!cm[c]) cm[c] = { pilotos: 0, s: 0, c: 0, x: 0, g: 0 };
      cm[c].pilotos++; cm[c].s += d.s; cm[c].c += d.c; cm[c].x += d.x; cm[c].g += d.g;
    }
    const porCiudad = Object.entries(cm).map(([ciudad, v]) => ({ ciudad, ...v, avg: v.pilotos > 0 ? v.s / v.pilotos : 0, pctC: v.s > 0 ? (v.c / v.s * 100) : 0, pctX: v.s > 0 ? (v.x / v.s * 100) : 0 })).sort((a, b) => b.pilotos - a.pilotos);
    // Rangos
    const rangos = { "1-5": 0, "6-15": 0, "16-30": 0, "31-60": 0, "60+": 0 };
    for (const d of driversActual) { if (d.s <= 5) rangos["1-5"]++; else if (d.s <= 15) rangos["6-15"]++; else if (d.s <= 30) rangos["16-30"]++; else if (d.s <= 60) rangos["31-60"]++; else rangos["60+"]++; }
    const topA = [...driversActual].sort((a, b) => b.s - a.s).slice(0, 10);
    const topX = driversActual.filter(d => d.x > 0).sort((a, b) => b.x - a.x).slice(0, 10);
    const topG = [...driversActual].sort((a, b) => b.g - a.g).slice(0, 10);
    // Tendencia
    const tend = [];
    for (const k of Object.keys(idx).sort()) { const d = loadMes(k); if (d) { const [y, m] = k.split("-").map(Number); tend.push({ mes: `${MESES[m]} ${y}`, key: k, pilotos: d.length }); } }
    return { T, totalS, totalC, totalX, totalG, avg, pctC, pctX, retenidos, perdidos, tasaRetencion, prevTotal: driversPrev.length, nuevosTotal: nuevos.length, franjas, porCiudad, rangos, topA, topX, topG, tend, allA: [...driversActual].sort((a, b) => b.s - a.s), allX: driversActual.filter(d => d.x > 0).sort((a, b) => b.x - a.x) };
  }, [driversActual, driversPrev, idx]);

  const dlCsv = (rows, hdr, fn) => {
    const csv = [hdr.join(","), ...rows.map(r => r.map(c => typeof c === "string" && (c.includes(",") || c.includes('"')) ? `"${c.replace(/"/g, '""')}"` : c).join(","))];
    const b = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = fn; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Subir archivo de operaciones</h3>
        <p className="text-xs text-gray-400 mb-3">Sube el mismo archivo Excel de operaciones que usas en Configuración. Se extraen solo los datos de pilotos.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Año</label>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Mes</label>
            <select value={mesNum} onChange={e => setMesNum(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold shadow hover:shadow-lg transition" style={{ background: BRAND_GRADIENT }}>
              {loading ? "Procesando..." : "Seleccionar archivo"}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={loading} />
            </label>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {mesKeys.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">Meses cargados ({mesKeys.length})</p>
            <div className="flex flex-wrap gap-2">
              {mesKeys.map(k => {
                const info = idx[k];
                const [y, m] = k.split("-").map(Number);
                return (
                  <div key={k} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${k === mesSel ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                    <button onClick={() => setMesSel(k)}>{MESES[m]} {y}</button>
                    <span className="opacity-60">{info?.pilotos} pilotos</span>
                    <button onClick={() => handleDelete(k)} className="text-red-300 hover:text-red-500 ml-1">✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selector */}
      {mesKeys.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Mes a analizar</label>
              <select value={mesSel} onChange={e => setMesSel(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                {mesKeys.map(k => { const [y, m] = k.split("-").map(Number); return <option key={k} value={k}>{MESES[m]} {y}</option>; })}
              </select>
            </div>
            {driversPrev.length > 0 && <div className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: BRAND_GRADIENT }}>Comparando vs {prevLabel}</div>}
            {driversPrev.length === 0 && prevKey && <p className="text-xs text-gray-400">Sube {prevLabel} para ver retención.</p>}
          </div>
        </div>
      )}

      {!analisis && mesKeys.length > 0 && <p className="text-center py-10 text-gray-400 text-sm">No hay datos de pilotos para este mes.</p>}

      {analisis && (<>
        {/* KPIs */}
        <div className="rounded-2xl shadow-md p-5 text-white" style={{ background: BRAND_GRADIENT }}>
          <h3 className="text-sm font-bold mb-4">Análisis de Pilotos — {mesLabel}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { l: "Pilotos activos", v: analisis.T, i: "👤" },
              { l: "Servicios", v: analisis.totalS.toLocaleString(), i: "📋" },
              { l: "Prom. serv/piloto", v: analisis.avg.toFixed(1), i: "📊" },
              { l: "% Completado", v: `${analisis.pctC.toFixed(1)}%`, i: "✅" },
              { l: "% Cancelación", v: `${analisis.pctX.toFixed(1)}%`, i: "🚫" },
              { l: "GMV Total", v: fmtM(analisis.totalG), i: "💰" },
              { l: "Nuevos", v: analisis.nuevosTotal, i: "🆕" },
              { l: "Retención", v: `${analisis.tasaRetencion.toFixed(0)}%`, i: "🔄" },
            ].map((k, i) => (
              <div key={i} className="bg-white/15 backdrop-blur rounded-xl p-2.5 text-center">
                <p className="text-base mb-0.5">{k.i}</p><p className="text-lg font-bold">{k.v}</p><p className="text-[9px] opacity-80">{k.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tendencia */}
        {analisis.tend.length > 1 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Tendencia Mensual de Pilotos</h3>
            <div className="overflow-x-auto"><div className="flex gap-3 min-w-max">
              {analisis.tend.map((t, i) => {
                const max = Math.max(...analisis.tend.map(x => x.pilotos));
                const pct = max > 0 ? (t.pilotos / max * 100) : 0;
                const prev = i > 0 ? analisis.tend[i - 1].pilotos : null;
                const diff = prev !== null ? t.pilotos - prev : null;
                return (
                  <div key={i} className="text-center flex-1 min-w-[80px]">
                    <div className="h-24 flex items-end justify-center mb-1">
                      <div className="w-10 rounded-t-md" style={{ height: `${Math.max(pct, 5)}%`, background: t.key === mesSel ? PIBOX_PURPLE : "#DDD6FE" }} />
                    </div>
                    <p className="text-sm font-bold text-purple-700">{t.pilotos.toLocaleString()}</p>
                    {diff !== null && <p className={`text-[9px] font-semibold ${diff >= 0 ? "text-green-600" : "text-red-500"}`}>{diff >= 0 ? "+" : ""}{diff}</p>}
                    <p className="text-[9px] text-gray-400">{t.mes}</p>
                  </div>
                );
              })}
            </div></div>
          </div>
        )}

        {/* Rotación */}
        {driversPrev.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Rotación — {mesLabel} vs {prevLabel}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-purple-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-purple-700">{analisis.prevTotal.toLocaleString()}</p><p className="text-xs text-gray-500">Mes anterior</p></div>
              <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-green-600">{analisis.retenidos.toLocaleString()}</p><p className="text-xs text-gray-500">Retenidos</p></div>
              <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-red-600">{analisis.perdidos.toLocaleString()}</p><p className="text-xs text-gray-500">Perdidos</p></div>
              <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-blue-600">{analisis.nuevosTotal.toLocaleString()}</p><p className="text-xs text-gray-500">Nuevos</p></div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-500" style={{ width: `${analisis.tasaRetencion}%` }} />
                <div className="h-full bg-red-400" style={{ width: `${100 - analisis.tasaRetencion}%` }} />
              </div>
              <span className="font-bold text-green-600">{analisis.tasaRetencion.toFixed(0)}% retención</span>
            </div>
          </div>
        )}

        {/* Distribución */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Distribución por Actividad</h3>
          <div className="grid grid-cols-5 gap-3">
            {Object.entries(analisis.rangos).map(([rango, count], i) => {
              const pct = analisis.T > 0 ? (count / analisis.T * 100) : 0;
              const colors = ["#7C22D4", "#A855F7", "#C026D3", "#6366F1", "#EC4899"];
              return (
                <div key={rango} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <p className="text-2xl font-bold" style={{ color: colors[i] }}>{count.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-gray-600 mt-1">{rango} serv</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2"><div className="h-2 rounded-full" style={{ width: `${Math.max(pct, 4)}%`, background: colors[i] }} /></div>
                  <p className="text-[10px] text-gray-400 mt-1">{pct.toFixed(0)}%</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Franjas */}
        {analisis.franjas.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Pilotos por Hora Pico</h3>
            <div className="flex gap-1 items-end" style={{ height: 120 }}>
              {analisis.franjas.map(f => {
                const max = Math.max(...analisis.franjas.map(x => x.pilotos));
                const pct = max > 0 ? (f.pilotos / max * 100) : 0;
                return (
                  <div key={f.hora} className="flex-1 text-center group relative">
                    <div className="mx-auto rounded-t" style={{ height: `${Math.max(pct, 3)}%`, minHeight: 2, background: PIBOX_PURPLE, maxWidth: 28 }} />
                    <p className="text-[8px] text-gray-400 mt-1">{f.hora.slice(0, 2)}</p>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">{f.hora}: {f.pilotos} pilotos</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ciudad */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Pilotos por Ciudad</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-purple-700 text-white">
                {["Ciudad", "Pilotos", "Servicios", "Prom/Piloto", "% Completado", "% Cancelación", "GMV"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {analisis.porCiudad.map((c, i) => (
                  <tr key={c.ciudad} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-purple-50/30"}`}>
                    <td className="px-3 py-2 font-semibold text-gray-800">{c.ciudad}</td>
                    <td className="px-3 py-2 text-center font-bold text-purple-600">{c.pilotos.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">{c.s.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">{c.avg.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center"><span className={`font-bold ${c.pctC >= 90 ? "text-green-600" : c.pctC >= 75 ? "text-yellow-600" : "text-red-600"}`}>{c.pctC.toFixed(0)}%</span></td>
                    <td className="px-3 py-2 text-center"><span className={`font-bold ${c.pctX > 15 ? "text-red-600" : c.pctX > 8 ? "text-orange-600" : "text-green-600"}`}>{c.pctX.toFixed(0)}%</span></td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmtM(c.g)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tops */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">Top 10 Más Activos</h3>
              <button onClick={() => dlCsv(analisis.allA.map((p, i) => [i + 1, p.n, p.id, p.ci, p.s, p.c, p.x, p.g]), ["#", "Piloto", "ID", "Ciudad", "Servicios", "Completados", "Cancelados", "GMV"], `Pilotos_Activos_${mesSel}.csv`)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-200">Descargar ({analisis.allA.length})</button>
            </div>
            <div className="space-y-1.5">{analisis.topA.map((p, i) => (
              <div key={p.id || p.n} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                <span className="text-sm font-bold text-purple-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold text-gray-800 truncate">{p.n || p.id}</p><p className="text-[9px] text-gray-400">{p.ci}</p></div>
                <p className="text-xs font-bold text-purple-700">{p.s}</p>
              </div>
            ))}</div>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">Top 10 Cancelaciones</h3>
              <button onClick={() => dlCsv(analisis.allX.map((p, i) => [i + 1, p.n, p.id, p.ci, p.s, p.x, (p.s > 0 ? p.x / p.s * 100 : 0).toFixed(1) + "%"]), ["#", "Piloto", "ID", "Ciudad", "Servicios", "Cancelados", "% Cancel"], `Pilotos_Cancel_${mesSel}.csv`)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200">Descargar ({analisis.allX.length})</button>
            </div>
            <div className="space-y-1.5">{analisis.topX.map((p, i) => (
              <div key={p.id || p.n} className="flex items-center gap-2 bg-red-50/50 rounded-lg px-2 py-1.5">
                <span className="text-sm font-bold text-red-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold text-gray-800 truncate">{p.n || p.id}</p><p className="text-[9px] text-gray-400">{p.ci}</p></div>
                <div className="text-right"><p className="text-xs font-bold text-orange-600">{p.x}/{p.s}</p><p className="text-[9px] font-bold text-red-600">{(p.s > 0 ? p.x / p.s * 100 : 0).toFixed(0)}%</p></div>
              </div>
            ))}</div>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Top 10 GMV</h3>
            <div className="space-y-1.5">{analisis.topG.map((p, i) => (
              <div key={p.id || p.n} className="flex items-center gap-2 bg-green-50/50 rounded-lg px-2 py-1.5">
                <span className="text-sm font-bold text-green-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold text-gray-800 truncate">{p.n || p.id}</p><p className="text-[9px] text-gray-400">{p.ci} · {p.s} serv</p></div>
                <p className="text-xs font-bold text-green-700">{fmtM(p.g)}</p>
              </div>
            ))}</div>
          </div>
        </div>
      </>)}
    </div>
  );
}
