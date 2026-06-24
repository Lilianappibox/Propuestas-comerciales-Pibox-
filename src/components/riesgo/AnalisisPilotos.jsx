import { useState, useMemo, useEffect } from "react";
import { loadIndex, idbLoadDrivers, loadMesDataAsync, MESES_ES, PIBOX_PURPLE } from "./utils";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const fmtM = (v) => "$" + Math.round(v).toLocaleString("es-CO");

export default function AnalisisPilotos() {
  const meses = useMemo(() => Object.values(loadIndex()).sort((a, b) => (a.key > b.key ? -1 : 1)), []);
  const [mesSel, setMesSel] = useState(meses[0]?.key || "");

  const prevKey = useMemo(() => {
    if (!mesSel) return null;
    const [y, m] = mesSel.split("-").map(Number);
    return `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  }, [mesSel]);
  const mesLabel = useMemo(() => { if (!mesSel) return ""; const [y, m] = mesSel.split("-").map(Number); return `${MESES_ES[m]} ${y}`; }, [mesSel]);
  const prevLabel = useMemo(() => { if (!prevKey) return ""; const [y, m] = prevKey.split("-").map(Number); return `${MESES_ES[m]} ${y}`; }, [prevKey]);

  const [driversActual, setDriversActual] = useState([]);
  const [driversPrev, setDriversPrev] = useState([]);
  const [loadingMsg, setLoadingMsg] = useState("");

  useEffect(() => {
    setDriversActual([]); setLoadingMsg("Cargando...");
    if (!mesSel) { setLoadingMsg(""); return; }
    idbLoadDrivers(mesSel).then(async d => {
      if (d && d.length > 0) { setDriversActual(d); setLoadingMsg(""); return; }
      // Fallback: drivers embebidos en mesData (exportados desde admin)
      const mesData = await loadMesDataAsync(mesSel);
      const embedded = mesData?.drivers || [];
      setDriversActual(embedded);
      setLoadingMsg(embedded.length > 0 ? "" : "Sin datos de pilotos. Re-sube el archivo en Configuración.");
    });
  }, [mesSel]);
  useEffect(() => {
    setDriversPrev([]);
    if (!prevKey) return;
    idbLoadDrivers(prevKey).then(async d => {
      if (d && d.length > 0) { setDriversPrev(d); return; }
      const mesData = await loadMesDataAsync(prevKey);
      setDriversPrev(mesData?.drivers || []);
    });
  }, [prevKey]);

  // Análisis
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
    for (const m of Object.values(loadIndex()).sort((a, b) => (a.key < b.key ? -1 : 1))) {
      tend.push({ mes: m.label, key: m.key, pilotos: m.totales?.totalDriversActivos || 0 });
    }
    return { T, totalS, totalC, totalX, totalG, avg, pctC, pctX, retenidos, perdidos, tasaRetencion, prevTotal: driversPrev.length, nuevosTotal: nuevos.length, franjas, porCiudad, rangos, topA, topX, topG, tend, allA: [...driversActual].sort((a, b) => b.s - a.s), allX: driversActual.filter(d => d.x > 0).sort((a, b) => b.x - a.x) };
  }, [driversActual, driversPrev]);

  const dlCsv = (rows, hdr, fn) => {
    const csv = [hdr.join(","), ...rows.map(r => r.map(c => typeof c === "string" && (c.includes(",") || c.includes('"')) ? `"${c.replace(/"/g, '""')}"` : c).join(","))];
    const b = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = fn; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (!meses.length) return (<div className="text-center py-20 text-gray-400"><p className="text-4xl mb-3">👤</p><p className="font-semibold">No hay datos cargados</p><p className="text-sm mt-1">Sube archivos en la pestaña Configuración.</p></div>);

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
          {driversPrev.length > 0 && <div className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: BRAND_GRADIENT }}>Comparando vs {prevLabel}</div>}
          {driversPrev.length === 0 && prevKey && <p className="text-xs text-gray-400">No hay datos de {prevLabel} para retención.</p>}
        </div>
      </div>

      {loadingMsg && <p className="text-center py-10 text-gray-400 text-sm">{loadingMsg}</p>}

      {analisis && (<>
        {/* KPIs */}
        <div className="rounded-2xl shadow-md p-5 text-white" style={{ background: BRAND_GRADIENT }}>
          <h3 className="text-sm font-bold mb-4">Análisis de Pilotos — {mesLabel}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { l: "Pilotos activos", v: analisis.T.toLocaleString(), i: "👤" },
              { l: "Servicios", v: analisis.totalS.toLocaleString(), i: "📋" },
              { l: "Prom. serv/piloto", v: analisis.avg.toFixed(1), i: "📊" },
              { l: "% Completado", v: `${analisis.pctC.toFixed(1)}%`, i: "✅" },
              { l: "% Cancelación", v: `${analisis.pctX.toFixed(1)}%`, i: "🚫" },
              { l: "GMV Total", v: fmtM(analisis.totalG), i: "💰" },
              { l: "Nuevos", v: analisis.nuevosTotal.toLocaleString(), i: "🆕" },
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
                    <div className="h-24 flex items-end justify-center mb-1"><div className="w-10 rounded-t-md" style={{ height: `${Math.max(pct, 5)}%`, background: t.key === mesSel ? PIBOX_PURPLE : "#DDD6FE" }} /></div>
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
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex"><div className="h-full bg-green-500" style={{ width: `${analisis.tasaRetencion}%` }} /><div className="h-full bg-red-400" style={{ width: `${100 - analisis.tasaRetencion}%` }} /></div>
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
              return (<div key={rango} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-2xl font-bold" style={{ color: colors[i] }}>{count.toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-600 mt-1">{rango} serv</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2"><div className="h-2 rounded-full" style={{ width: `${Math.max(pct, 4)}%`, background: colors[i] }} /></div>
                <p className="text-[10px] text-gray-400 mt-1">{pct.toFixed(0)}%</p>
              </div>);
            })}
          </div>
        </div>

        {/* Franjas horarias — heatmap */}
        {analisis.franjas.length > 0 && (() => {
          const RANGOS = [
            { label: "Madrugada",   sub: "00:00 – 05:59", inicio: 0,  fin: 5  },
            { label: "Amanecer",    sub: "06:00 – 08:59", inicio: 6,  fin: 8  },
            { label: "Mañana",      sub: "09:00 – 11:59", inicio: 9,  fin: 11 },
            { label: "Mediodía",    sub: "12:00 – 14:59", inicio: 12, fin: 14 },
            { label: "Tarde",       sub: "15:00 – 17:59", inicio: 15, fin: 17 },
            { label: "Noche",       sub: "18:00 – 20:59", inicio: 18, fin: 20 },
            { label: "Noche tarde", sub: "21:00 – 23:59", inicio: 21, fin: 23 },
          ];
          const data = RANGOS.map(r => ({
            ...r,
            count: analisis.franjas
              .filter(f => { const h = parseInt(f.hora); return h >= r.inicio && h <= r.fin; })
              .reduce((s, f) => s + f.pilotos, 0),
          }));
          const maxV = Math.max(...data.map(r => r.count), 1);
          const getColors = (count) => {
            const p = count / maxV;
            if (p === 0)    return { bg: "#F3F4F6", text: "#9CA3AF", sub: "#9CA3AF" };
            if (p <= 0.20)  return { bg: "#EDE9FE", text: "#5B21B6", sub: "#7C3AED" };
            if (p <= 0.40)  return { bg: "#C4B5FD", text: "#3B0764", sub: "#4C1D95" };
            if (p <= 0.60)  return { bg: "#A78BFA", text: "#fff",    sub: "rgba(255,255,255,.75)" };
            if (p <= 0.80)  return { bg: "#7C22D4", text: "#fff",    sub: "rgba(255,255,255,.75)" };
            return               { bg: "#4C1D95", text: "#fff",    sub: "rgba(255,255,255,.75)" };
          };
          return (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">📊 Pilotos por Franja Horaria</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {data.map(r => {
                  const c = getColors(r.count);
                  return (
                    <div key={r.label} style={{ background: c.bg, borderRadius: 12, padding: "16px 10px", textAlign: "center" }}>
                      <p style={{ color: c.text, fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                        {r.count > 0 ? r.count.toLocaleString("es-CO") : "—"}
                      </p>
                      {r.count > 0 && (
                        <p style={{ color: c.sub, fontSize: 10, fontWeight: 700, margin: "4px 0 2px" }}>
                          {(r.count / analisis.T * 100).toFixed(0)}% del total
                        </p>
                      )}
                      <p style={{ color: c.text, fontSize: 11, fontWeight: 700, margin: "6px 0 2px", opacity: r.count ? 1 : 0.5 }}>{r.label}</p>
                      <p style={{ color: c.sub, fontSize: 9, margin: 0, opacity: 0.85 }}>{r.sub}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
              <button onClick={() => dlCsv(analisis.allA.map((p, i) => [i + 1, p.n, p.id, p.ci, p.s, p.c, p.x, p.g]), ["#", "Piloto", "ID", "Ciudad", "Servicios", "Completados", "Cancelados", "GMV"], `Pilotos_Activos_${mesSel}.csv`)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-200">Todos ({analisis.allA.length})</button>
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
              <button onClick={() => dlCsv(analisis.allX.map((p, i) => [i + 1, p.n, p.id, p.ci, p.s, p.x, (p.s > 0 ? p.x / p.s * 100 : 0).toFixed(1) + "%"]), ["#", "Piloto", "ID", "Ciudad", "Servicios", "Cancelados", "% Cancel"], `Pilotos_Cancel_${mesSel}.csv`)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200">Todos ({analisis.allX.length})</button>
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
