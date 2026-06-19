import { useState, useMemo } from "react";
import { loadIndex, loadMesData, MESES_ES, PIBOX_PURPLE } from "./utils";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const fmtM = (v) => "$" + Math.round(v).toLocaleString("es-CO");

export default function AnalisisPilotos() {
  const meses = useMemo(() => {
    const idx = loadIndex();
    return Object.values(idx).sort((a, b) => (a.key > b.key ? -1 : 1));
  }, []);
  const [mesSel, setMesSel] = useState(meses[0]?.key || "");

  const prevKey = useMemo(() => {
    if (!mesSel) return null;
    const [y, m] = mesSel.split("-").map(Number);
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    return `${py}-${String(pm).padStart(2, "0")}`;
  }, [mesSel]);

  const mesLabel = useMemo(() => {
    if (!mesSel) return "";
    const [y, m] = mesSel.split("-").map(Number);
    return `${MESES_ES[m]} ${y}`;
  }, [mesSel]);
  const prevLabel = useMemo(() => {
    if (!prevKey) return "";
    const [y, m] = prevKey.split("-").map(Number);
    return `${MESES_ES[m]} ${y}`;
  }, [prevKey]);

  const dataActual = useMemo(() => mesSel ? loadMesData(mesSel) : null, [mesSel]);
  const dataPrev = useMemo(() => prevKey ? loadMesData(prevKey) : null, [prevKey]);
  const driversActual = dataActual?.drivers || [];
  const driversPrev = dataPrev?.drivers || [];

  const analisis = useMemo(() => {
    if (!driversActual.length) return null;
    const prevIds = new Set(driversPrev.map(d => d.id || d.nombre));
    const currentIds = new Set(driversActual.map(d => d.id || d.nombre));
    const retenidos = driversPrev.length > 0 ? [...prevIds].filter(id => currentIds.has(id)).length : 0;
    const perdidos = driversPrev.length > 0 ? driversPrev.length - retenidos : 0;
    const tasaRetencion = prevIds.size > 0 ? (retenidos / prevIds.size * 100) : 0;
    const nuevos = driversPrev.length > 0 ? driversActual.filter(d => !prevIds.has(d.id || d.nombre)) : [];
    const totalPilotos = driversActual.length;
    const totalServicios = driversActual.reduce((s, d) => s + d.servicios, 0);
    const totalCompletados = driversActual.reduce((s, d) => s + d.completados, 0);
    const totalCancelados = driversActual.reduce((s, d) => s + d.cancelados, 0);
    const totalGmv = driversActual.reduce((s, d) => s + d.gmv, 0);
    const avgServicios = totalPilotos > 0 ? totalServicios / totalPilotos : 0;
    const tasaCompletado = totalServicios > 0 ? (totalCompletados / totalServicios * 100) : 0;
    const tasaCancelacion = totalServicios > 0 ? (totalCancelados / totalServicios * 100) : 0;
    // Franjas horarias
    const horaMap = {};
    for (const d of driversActual) { for (const [h, c] of Object.entries(d.horas || {})) horaMap[h] = (horaMap[h] || 0) + c; }
    const franjas = Object.entries(horaMap).map(([h, servicios]) => ({ hora: `${String(h).padStart(2, "0")}:00`, servicios })).sort((a, b) => a.hora.localeCompare(b.hora));
    // Por ciudad
    const ciudadMap = {};
    for (const d of driversActual) {
      const c = d.ciudad || "Sin ciudad";
      if (!ciudadMap[c]) ciudadMap[c] = { pilotos: 0, servicios: 0, completados: 0, cancelados: 0, gmv: 0 };
      ciudadMap[c].pilotos++; ciudadMap[c].servicios += d.servicios; ciudadMap[c].completados += d.completados; ciudadMap[c].cancelados += d.cancelados; ciudadMap[c].gmv += d.gmv;
    }
    const porCiudad = Object.entries(ciudadMap).map(([ciudad, v]) => ({ ciudad, ...v, avgServ: v.pilotos > 0 ? v.servicios / v.pilotos : 0, tasaCompletado: v.servicios > 0 ? (v.completados / v.servicios * 100) : 0, tasaCancelacion: v.servicios > 0 ? (v.cancelados / v.servicios * 100) : 0 })).sort((a, b) => b.pilotos - a.pilotos);
    // Distribución
    const rangos = { "1-5 serv": 0, "6-15 serv": 0, "16-30 serv": 0, "31-60 serv": 0, "60+ serv": 0 };
    for (const d of driversActual) { if (d.servicios <= 5) rangos["1-5 serv"]++; else if (d.servicios <= 15) rangos["6-15 serv"]++; else if (d.servicios <= 30) rangos["16-30 serv"]++; else if (d.servicios <= 60) rangos["31-60 serv"]++; else rangos["60+ serv"]++; }
    const topActivos = [...driversActual].sort((a, b) => b.servicios - a.servicios).slice(0, 10);
    const topCanceladores = driversActual.filter(d => d.cancelados > 0).sort((a, b) => b.cancelados - a.cancelados).slice(0, 10);
    const topGmv = [...driversActual].sort((a, b) => b.gmv - a.gmv).slice(0, 10);
    // Tendencia
    const tendencia = [];
    const allMeses = Object.values(loadIndex()).sort((a, b) => (a.key < b.key ? -1 : 1));
    for (const m of allMeses) { const md = loadMesData(m.key); if (md?.drivers) tendencia.push({ mes: m.label, key: m.key, pilotos: md.drivers.length, servicios: md.totales?.servicios || 0 }); }
    return { totalPilotos, totalServicios, totalCompletados, totalCancelados, totalGmv, avgServicios, tasaCompletado, tasaCancelacion, retenidos, perdidos, tasaRetencion, prevTotal: driversPrev.length, nuevosTotal: nuevos.length, franjas, porCiudad, rangos, topActivos, topCanceladores, topGmv, tendencia, allActivos: [...driversActual].sort((a, b) => b.servicios - a.servicios), allCanceladores: driversActual.filter(d => d.cancelados > 0).sort((a, b) => b.cancelados - a.cancelados) };
  }, [driversActual, driversPrev]);

  const downloadCsv = (rows, hdr, filename) => {
    const csv = [hdr.join(","), ...rows.map(r => r.map(c => typeof c === "string" && (c.includes(",") || c.includes('"')) ? `"${c.replace(/"/g, '""')}"` : c).join(","))];
    const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (!meses.length) return (<div className="text-center py-20 text-gray-400"><p className="text-4xl mb-3">👤</p><p className="font-semibold">No hay datos cargados</p><p className="text-sm mt-1">Sube archivos en Configuración.</p></div>);

  return (
    <div className="space-y-6">
      {/* Selector */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Mes a analizar</label>
            <select value={mesSel} onChange={e => setMesSel(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {meses.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          {dataPrev && <div className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: BRAND_GRADIENT }}>Comparando vs {prevLabel}</div>}
          {!dataPrev && prevKey && <p className="text-xs text-gray-400">No hay datos de {prevLabel} para comparar retención.</p>}
        </div>
      </div>

      {!analisis && <p className="text-center py-10 text-gray-400 text-sm">No hay datos de pilotos para este mes. Re-sube el archivo en Configuración.</p>}

      {analisis && (<>
        {/* KPIs */}
        <div className="rounded-2xl shadow-md p-5 text-white" style={{ background: BRAND_GRADIENT }}>
          <h3 className="text-sm font-bold mb-4">Análisis de Pilotos — {mesLabel}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "Pilotos activos", value: analisis.totalPilotos, icon: "👤" },
              { label: "Servicios", value: analisis.totalServicios.toLocaleString(), icon: "📋" },
              { label: "Prom. serv/piloto", value: analisis.avgServicios.toFixed(1), icon: "📊" },
              { label: "% Completado", value: `${analisis.tasaCompletado.toFixed(1)}%`, icon: "✅" },
              { label: "% Cancelación", value: `${analisis.tasaCancelacion.toFixed(1)}%`, icon: "🚫" },
              { label: "GMV Total", value: fmtM(analisis.totalGmv), icon: "💰" },
              { label: "Nuevos", value: analisis.nuevosTotal, icon: "🆕" },
              { label: "Retención", value: `${analisis.tasaRetencion.toFixed(0)}%`, icon: "🔄" },
            ].map((kpi, i) => (
              <div key={i} className="bg-white/15 backdrop-blur rounded-xl p-2.5 text-center">
                <p className="text-base mb-0.5">{kpi.icon}</p>
                <p className="text-lg font-bold">{kpi.value}</p>
                <p className="text-[9px] opacity-80">{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tendencia */}
        {analisis.tendencia.length > 1 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Tendencia Mensual de Pilotos Activos</h3>
            <div className="overflow-x-auto">
              <div className="flex gap-3 min-w-max">
                {analisis.tendencia.map((t, i) => {
                  const max = Math.max(...analisis.tendencia.map(x => x.pilotos));
                  const pct = max > 0 ? (t.pilotos / max * 100) : 0;
                  const prev = i > 0 ? analisis.tendencia[i - 1].pilotos : null;
                  const diff = prev !== null ? t.pilotos - prev : null;
                  return (
                    <div key={i} className="text-center flex-1 min-w-[80px]">
                      <div className="h-24 flex items-end justify-center mb-1">
                        <div className="w-10 rounded-t-md" style={{ height: `${Math.max(pct, 5)}%`, background: t.key === mesSel ? PIBOX_PURPLE : "#DDD6FE" }} />
                      </div>
                      <p className="text-sm font-bold text-purple-700">{t.pilotos}</p>
                      {diff !== null && <p className={`text-[9px] font-semibold ${diff >= 0 ? "text-green-600" : "text-red-500"}`}>{diff >= 0 ? "+" : ""}{diff}</p>}
                      <p className="text-[9px] text-gray-400">{t.mes}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Rotación */}
        {dataPrev && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Rotación de Pilotos — {mesLabel} vs {prevLabel}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-purple-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-purple-700">{analisis.prevTotal}</p><p className="text-xs text-gray-500">Pilotos mes anterior</p></div>
              <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-green-600">{analisis.retenidos}</p><p className="text-xs text-gray-500">Retenidos</p></div>
              <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-red-600">{analisis.perdidos}</p><p className="text-xs text-gray-500">Perdidos</p></div>
              <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-blue-600">{analisis.nuevosTotal}</p><p className="text-xs text-gray-500">Nuevos</p></div>
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
            {Object.entries(analisis.rangos).map(([rango, count], idx) => {
              const pct = analisis.totalPilotos > 0 ? (count / analisis.totalPilotos * 100) : 0;
              const colors = ["#7C22D4", "#A855F7", "#C026D3", "#6366F1", "#EC4899"];
              return (
                <div key={rango} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <p className="text-2xl font-bold" style={{ color: colors[idx] }}>{count}</p>
                  <p className="text-xs font-semibold text-gray-600 mt-1">{rango}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2"><div className="h-2 rounded-full" style={{ width: `${Math.max(pct, 4)}%`, background: colors[idx] }} /></div>
                  <p className="text-[10px] text-gray-400 mt-1">{pct.toFixed(0)}%</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Franjas horarias */}
        {analisis.franjas.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Servicios por Franja Horaria</h3>
            <div className="flex gap-1 items-end" style={{ height: 120 }}>
              {analisis.franjas.map(f => {
                const max = Math.max(...analisis.franjas.map(x => x.servicios));
                const pct = max > 0 ? (f.servicios / max * 100) : 0;
                return (
                  <div key={f.hora} className="flex-1 text-center group relative">
                    <div className="mx-auto rounded-t" style={{ height: `${Math.max(pct, 3)}%`, minHeight: 2, background: PIBOX_PURPLE, maxWidth: 28 }} />
                    <p className="text-[8px] text-gray-400 mt-1">{f.hora.slice(0, 2)}</p>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">{f.hora}: {f.servicios.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Por ciudad */}
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
                    <td className="px-3 py-2 text-center font-bold text-purple-600">{c.pilotos}</td>
                    <td className="px-3 py-2 text-center">{c.servicios.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">{c.avgServ.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center"><span className={`font-bold ${c.tasaCompletado >= 90 ? "text-green-600" : c.tasaCompletado >= 75 ? "text-yellow-600" : "text-red-600"}`}>{c.tasaCompletado.toFixed(0)}%</span></td>
                    <td className="px-3 py-2 text-center"><span className={`font-bold ${c.tasaCancelacion > 15 ? "text-red-600" : c.tasaCancelacion > 8 ? "text-orange-600" : "text-green-600"}`}>{c.tasaCancelacion.toFixed(0)}%</span></td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmtM(c.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">Top 10 Más Activos</h3>
              <button onClick={() => downloadCsv(analisis.allActivos.map((p, i) => [i + 1, p.nombre, p.id, p.ciudad, p.servicios, p.completados, p.cancelados, Math.round(p.gmv)]), ["#", "Piloto", "ID", "Ciudad", "Servicios", "Completados", "Cancelados", "GMV"], `Pilotos_Activos_${mesSel}.csv`)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200">Descargar ({analisis.allActivos.length})</button>
            </div>
            <div className="space-y-1.5">
              {analisis.topActivos.map((p, i) => (
                <div key={p.id || p.nombre} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                  <span className="text-sm font-bold text-purple-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold text-gray-800 truncate">{p.nombre || p.id}</p><p className="text-[9px] text-gray-400">{p.ciudad}</p></div>
                  <p className="text-xs font-bold text-purple-700">{p.servicios}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">Top 10 Cancelaciones</h3>
              <button onClick={() => downloadCsv(analisis.allCanceladores.map((p, i) => [i + 1, p.nombre, p.id, p.ciudad, p.servicios, p.cancelados, (p.tasaCancelacion * 100).toFixed(1) + "%"]), ["#", "Piloto", "ID", "Ciudad", "Servicios", "Cancelados", "% Cancel"], `Pilotos_Canceladores_${mesSel}.csv`)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200">Descargar ({analisis.allCanceladores.length})</button>
            </div>
            <div className="space-y-1.5">
              {analisis.topCanceladores.map((p, i) => (
                <div key={p.id || p.nombre} className="flex items-center gap-2 bg-red-50/50 rounded-lg px-2 py-1.5">
                  <span className="text-sm font-bold text-red-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold text-gray-800 truncate">{p.nombre || p.id}</p><p className="text-[9px] text-gray-400">{p.ciudad}</p></div>
                  <div className="text-right"><p className="text-xs font-bold text-orange-600">{p.cancelados}/{p.servicios}</p><p className="text-[9px] font-bold text-red-600">{(p.tasaCancelacion * 100).toFixed(0)}%</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Top 10 GMV</h3>
            <div className="space-y-1.5">
              {analisis.topGmv.map((p, i) => (
                <div key={p.id || p.nombre} className="flex items-center gap-2 bg-green-50/50 rounded-lg px-2 py-1.5">
                  <span className="text-sm font-bold text-green-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold text-gray-800 truncate">{p.nombre || p.id}</p><p className="text-[9px] text-gray-400">{p.ciudad} · {p.servicios} serv</p></div>
                  <p className="text-xs font-bold text-green-700">{fmtM(p.gmv)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>)}
    </div>
  );
}
