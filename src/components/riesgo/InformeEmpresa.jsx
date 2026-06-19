import { useState, useRef, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  loadMesData, mesesDisponibles, calcularScore, fmtM, fmtPct, fmtCOP, fmtFull,
  PIBOX_PURPLE, PIBOX_PINK, SEM_ROJO, SEM_AMARILLO, SEM_VERDE,
  UMBRALES_DEFAULT, labelMes,
} from "./utils";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const COLORS = [PIBOX_PURPLE, PIBOX_PINK, "#A855F7","#6366F1","#EC4899","#8B5CF6"];

// ── Tabla siempre visible ────────────────────────────────────────────────────
function TablaUsuariosSedes({ empData, prevData, mesLabel, prevLabel }) {
  const usuarios     = empData?.topUsuarios || [];
  const sedes        = empData?.topSedes    || [];
  const prevUsuarios = prevData?.topUsuarios || [];
  const prevSedes    = prevData?.topSedes    || [];
  const sinDatos     = !usuarios.length && !sedes.length;

  const thStyle  = { background: PIBOX_PURPLE };
  const rowEven  = "bg-white";
  const rowOdd   = "bg-purple-50/40";
  const tfootRow = "bg-purple-100 font-bold border-t-2 border-purple-200";

  // Celda de variación de costo vs mes anterior
  function DeltaGMV({ curr, prevList, matchKey }) {
    const prevItem = prevList.find(p => (p.usuario ?? p.sede) === matchKey);
    if (!prevItem || !prevLabel) return <td className="px-3 py-2 text-right text-gray-300">—</td>;
    const prevCost = prevItem.gmv || 0;
    if (prevCost === 0) return <td className="px-3 py-2 text-right text-gray-400 text-xs">Sin prev.</td>;
    const delta = (curr - prevCost) / prevCost;
    const isUp  = delta >= 0;
    return (
      <td className="px-3 py-2 text-right font-bold whitespace-nowrap"
          style={{ color: isUp ? SEM_VERDE : SEM_ROJO }}>
        {isUp ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
      </td>
    );
  }

  function Tabla({ titulo, icono, filas, prevFilas, keyField, borderColor }) {
    const totalCostAct  = filas.reduce((s, f) => s + f.gmv, 0);
    const totalCostPrev = prevFilas.reduce((s, f) => s + f.gmv, 0);
    const totalDelta    = prevLabel && totalCostPrev > 0
      ? (totalCostAct - totalCostPrev) / totalCostPrev : null;

    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between"
             style={{ borderLeft: `4px solid ${borderColor}` }}>
          <div className="flex items-center gap-2">
            <span className="text-base">{icono}</span>
            <h4 className="font-bold text-gray-700 text-sm">{titulo}</h4>
          </div>
          {prevLabel && (
            <span className="text-xs text-gray-400">▲▼ vs {prevLabel}</span>
          )}
        </div>

        {filas.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            <p className="text-2xl mb-2">📭</p>
            <p className="font-medium text-gray-500 mb-1">Sin datos disponibles</p>
            <p className="text-xs">Ve a <b>⚙️ Configuración</b>, elimina <b>{mesLabel}</b><br/>
              y vuelve a subir el archivo Excel.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={thStyle} className="text-white">
                  <th className="px-3 py-2.5 text-left font-semibold">{keyField}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Completados</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-3 py-2.5 text-right font-semibold">%</th>
                  <th className="px-3 py-2.5 text-right font-semibold">GMV</th>
                  <th className="px-3 py-2.5 text-right font-semibold">▲▼ vs mes ant.</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  const nombre = f.usuario ?? f.sede;
                  return (
                    <tr key={i} className={i % 2 === 0 ? rowEven : rowOdd}>
                      <td className="px-3 py-2 font-medium text-gray-700 max-w-[160px] truncate">{nombre}</td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: SEM_VERDE }}>
                        {f.completados.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">{f.total.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold" style={{ color: SEM_VERDE }}>
                        {f.total > 0 ? fmtPct(f.completados / f.total) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: PIBOX_PURPLE }}>
                        {fmtFull(f.gmv)}
                      </td>
                      <DeltaGMV curr={f.gmv} prevList={prevFilas} matchKey={nombre}/>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={tfootRow + " text-xs"}>
                  <td className="px-3 py-2 text-purple-800">Total</td>
                  <td className="px-3 py-2 text-right" style={{ color: SEM_VERDE }}>
                    {filas.reduce((s, f) => s + f.completados, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {filas.reduce((s, f) => s + f.total, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: SEM_VERDE }}>
                    {fmtPct(filas.reduce((s,f)=>s+f.completados,0) / Math.max(filas.reduce((s,f)=>s+f.total,0),1))}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: PIBOX_PURPLE }}>
                    {fmtFull(totalCostAct)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold"
                      style={{ color: totalDelta !== null ? (totalDelta >= 0 ? SEM_VERDE : SEM_ROJO) : "#9CA3AF" }}>
                    {totalDelta !== null
                      ? `${totalDelta >= 0 ? "▲" : "▼"} ${Math.abs(totalDelta * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sinDatos && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-5 py-4 text-sm text-amber-800 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <b>Para ver estas tablas debes re-subir el archivo.</b><br/>
            <span className="text-amber-700">
              Ve a <b>⚙️ Configuración</b> → 🗑️ elimina <b>{mesLabel}</b> → súbelo de nuevo.
            </span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Tabla titulo="Por usuario" icono="👤"
               filas={usuarios} prevFilas={prevUsuarios}
               keyField="Usuario" borderColor={PIBOX_PURPLE}/>
        <Tabla titulo="Por sede" icono="🏢"
               filas={sedes} prevFilas={prevSedes}
               keyField="Sede" borderColor={PIBOX_PINK}/>
      </div>
    </div>
  );
}

function getUmbrales() {
  try { return {...UMBRALES_DEFAULT,...JSON.parse(localStorage.getItem("pibox_riesgo_umbrales")||"{}")}; }
  catch { return UMBRALES_DEFAULT; }
}

const fmtDate = () => new Date().toLocaleDateString("es-CO",{day:"2-digit",month:"long",year:"numeric"});

export default function InformeEmpresa() {
  const meses   = mesesDisponibles();
  const umb     = getUmbrales();

  const [mesKey, setMesKey]     = useState(meses[meses.length-1]?.key||"");
  const [empresasSel, setEmpresasSel] = useState([]);
  const [buscarEmp, setBuscarEmp] = useState("");

  const idxActual   = meses.findIndex(m=>m.key===mesKey);
  const mesPrevMeta = idxActual > 0 ? meses[idxActual-1] : null;

  const dataMes  = useMemo(()=>mesKey?loadMesData(mesKey):null,       [mesKey]);
  const dataPrev = useMemo(()=>mesPrevMeta?loadMesData(mesPrevMeta.key):null, [mesPrevMeta]);

  const empresas = useMemo(()=>dataMes?.empresas?.map(e=>e.empresa).sort()||[], [dataMes]);
  const empresasFiltradas = useMemo(() => !buscarEmp ? empresas : empresas.filter(e => e.toLowerCase().includes(buscarEmp.toLowerCase())), [empresas, buscarEmp]);

  const toggleEmpresa = (e) => setEmpresasSel(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  // Compatibilidad: primera empresa seleccionada como referencia, merge si varias
  const empresa = empresasSel[0] || "";

  const empData = useMemo(() => {
    if (!empresasSel.length || !dataMes?.empresas) return null;
    const selected = dataMes.empresas.filter(e => empresasSel.includes(e.empresa));
    if (!selected.length) return null;
    if (selected.length === 1) return selected[0];
    // Merge múltiples empresas
    const m = { empresa: empresasSel.join(", "), total: 0, completados: 0, cancelados: 0, expirados: 0, gmv: 0, paquetes: 0, service_cost: 0, ejecutivo: selected[0].ejecutivo, ciudad: selected.map(e => e.ciudad).filter((v, i, a) => a.indexOf(v) === i).join(", "), topCiudades: [], topOps: [], weekly: [], topUsuarios: [], topSedes: [], totalDrivers: 0, tasa_completado: 0, tasa_cancelacion: 0, tasa_expirado: 0 };
    const cityMap = {}, opMap = {}, weekMap = {}, userMap = {}, sedeMap = {};
    for (const e of selected) {
      m.total += e.total; m.completados += e.completados; m.cancelados += e.cancelados; m.expirados += e.expirados; m.gmv += e.gmv; m.paquetes += e.paquetes; m.service_cost += e.service_cost; m.totalDrivers += e.totalDrivers || 0;
      for (const c of (e.topCiudades || [])) { if (!cityMap[c.city]) cityMap[c.city] = { ...c }; else { cityMap[c.city].gmv += c.gmv; cityMap[c.city].count += c.count; } }
      for (const o of (e.topOps || [])) { if (!opMap[o.op]) opMap[o.op] = { ...o }; else { opMap[o.op].count += o.count; } }
      for (const w of (e.weekly || [])) { if (!weekMap[w.semana]) weekMap[w.semana] = { ...w }; else { weekMap[w.semana].gmv += w.gmv; weekMap[w.semana].servicios += w.servicios; weekMap[w.semana].completados += w.completados; weekMap[w.semana].cancelados += w.cancelados; } }
      for (const u of (e.topUsuarios || [])) { if (!userMap[u.usuario]) userMap[u.usuario] = { ...u }; else { userMap[u.usuario].total += u.total; userMap[u.usuario].completados += u.completados; userMap[u.usuario].gmv += u.gmv; } }
      for (const s of (e.topSedes || [])) { if (!sedeMap[s.sede]) sedeMap[s.sede] = { ...s }; else { sedeMap[s.sede].total += s.total; sedeMap[s.sede].completados += s.completados; sedeMap[s.sede].gmv += s.gmv; } }
    }
    m.tasa_completado = m.total > 0 ? m.completados / m.total : 0;
    m.tasa_cancelacion = m.total > 0 ? m.cancelados / m.total : 0;
    m.tasa_expirado = m.total > 0 ? m.expirados / m.total : 0;
    m.topCiudades = Object.values(cityMap).sort((a, b) => b.gmv - a.gmv);
    m.topOps = Object.values(opMap).sort((a, b) => b.count - a.count);
    m.weekly = Object.values(weekMap).sort((a, b) => a.semana - b.semana);
    m.topUsuarios = Object.values(userMap).sort((a, b) => b.total - a.total).slice(0, 30);
    m.topSedes = Object.values(sedeMap).sort((a, b) => b.total - a.total);
    return m;
  }, [dataMes, empresasSel]);

  const prevData = useMemo(() => {
    if (!empresasSel.length || !dataPrev?.empresas) return null;
    const selected = dataPrev.empresas.filter(e => empresasSel.includes(e.empresa));
    if (!selected.length) return null;
    if (selected.length === 1) return selected[0];
    const m = { total: 0, completados: 0, cancelados: 0, gmv: 0, paquetes: 0, tasa_completado: 0, tasa_cancelacion: 0, topUsuarios: [], topSedes: [] };
    for (const e of selected) { m.total += e.total; m.completados += e.completados; m.cancelados += e.cancelados; m.gmv += e.gmv; m.paquetes += e.paquetes; }
    m.tasa_completado = m.total > 0 ? m.completados / m.total : 0;
    m.tasa_cancelacion = m.total > 0 ? m.cancelados / m.total : 0;
    return m;
  }, [dataPrev, empresasSel]);

  const score    = useMemo(()=>empData?calcularScore(empData,prevData||null,umb):null, [empData,prevData,umb]);

  const semColor = score?.color==="rojo"?SEM_ROJO:score?.color==="amarillo"?SEM_AMARILLO:SEM_VERDE;

  // Generar insights automáticos
  const insights = useMemo(() => {
    if (!empData || !score) return { positivos: [], alertas: [] };
    const pos = [], alt = [];
    // Completado
    if (empData.tasa_completado >= 0.95) pos.push(`Tasa de completado excelente: ${fmtPct(empData.tasa_completado)} — servicio altamente confiable.`);
    else if (empData.tasa_completado >= 0.85) pos.push(`Tasa de completado sólida: ${fmtPct(empData.tasa_completado)}.`);
    else alt.push(`Tasa de completado baja: ${fmtPct(empData.tasa_completado)} — revisar causas de servicios no completados.`);
    // Cancelación
    if (empData.tasa_cancelacion <= 0.05) pos.push(`Cancelaciones mínimas: ${fmtPct(empData.tasa_cancelacion)} — cliente estable.`);
    else if (empData.tasa_cancelacion > 0.15) alt.push(`Cancelaciones altas: ${fmtPct(empData.tasa_cancelacion)} (${empData.cancelados} servicios). Investigar causas.`);
    else if (empData.tasa_cancelacion > 0.08) alt.push(`Cancelaciones moderadas: ${fmtPct(empData.tasa_cancelacion)}. Mantener monitoreo.`);
    // GMV vs anterior
    if (prevData && prevData.gmv > 0) {
      const varGmv = (empData.gmv - prevData.gmv) / prevData.gmv;
      if (varGmv > 0.1) pos.push(`GMV creció ${(varGmv * 100).toFixed(1)}%: ${fmtFull(prevData.gmv)} → ${fmtFull(empData.gmv)}.`);
      else if (varGmv < -0.15) alt.push(`GMV cayó ${Math.abs(varGmv * 100).toFixed(1)}%: ${fmtFull(prevData.gmv)} → ${fmtFull(empData.gmv)}. Analizar si es por volumen o precio.`);
      else if (varGmv < -0.05) alt.push(`GMV bajó ${Math.abs(varGmv * 100).toFixed(1)}% vs mes anterior.`);
    }
    // Servicios vs anterior
    if (prevData && prevData.total > 0) {
      const varSvc = (empData.total - prevData.total) / prevData.total;
      if (varSvc > 0.1) pos.push(`Servicios crecieron ${(varSvc * 100).toFixed(1)}%: ${prevData.total} → ${empData.total}.`);
      else if (varSvc < -0.15) alt.push(`Servicios cayeron ${Math.abs(varSvc * 100).toFixed(1)}%: ${prevData.total} → ${empData.total}.`);
    }
    // Diversificación de ciudades
    if (empData.topCiudades?.length >= 3) pos.push(`Opera en ${empData.topCiudades.length} ciudades — buena diversificación geográfica.`);
    else if (empData.topCiudades?.length === 1) alt.push(`Concentrado en una sola ciudad (${empData.ciudad}). Riesgo de dependencia geográfica.`);
    // Expirados
    if (empData.tasa_expirado > 0.1) alt.push(`Tasa de expirados alta: ${fmtPct(empData.tasa_expirado)} — puede indicar problemas de asignación.`);
    else if (empData.tasa_expirado <= 0.02) pos.push(`Expirados controlados: ${fmtPct(empData.tasa_expirado)}.`);
    // Volumen
    if (empData.total >= 500) pos.push(`Alto volumen: ${empData.total.toLocaleString()} servicios en el mes — cliente estratégico.`);
    else if (empData.total < 10) alt.push(`Solo ${empData.total} servicios en el mes — riesgo de inactividad.`);
    // Score
    if (score.score >= 80) pos.push(`Score de riesgo saludable: ${score.score}/100.`);
    else if (score.score < 50) alt.push(`Score de riesgo crítico: ${score.score}/100. Requiere plan de acción inmediato.`);
    // Pilotos
    if (empData.totalDrivers > 20) pos.push(`${empData.totalDrivers} pilotos activos asignados — buena cobertura.`);
    else if (empData.totalDrivers > 0 && empData.totalDrivers <= 3) alt.push(`Solo ${empData.totalDrivers} pilotos activos. Riesgo de dependencia operativa.`);
    // Paquetes
    if (empData.paquetes > 1000) pos.push(`${empData.paquetes.toLocaleString()} paquetes entregados — volumen sólido.`);
    return { positivos: pos.slice(0, 5), alertas: alt.slice(0, 5) };
  }, [empData, prevData, score]);

  if (!meses.length) return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800 text-sm">
      <b>Sin datos.</b> Ve a <b>⚙️ Configuración</b> y sube al menos un mes.
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Selección */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <h3 className="font-bold text-gray-700 text-sm mb-4 flex items-center gap-2">
          <span className="bg-purple-100 text-purple-700 rounded-lg p-1">📄</span>
          Seleccionar empresa
        </h3>
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Mes</label>
            <select value={mesKey} onChange={e=>setMesKey(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {[...meses].reverse().map(m=>(
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Buscar empresa</label>
            <input type="text" value={buscarEmp} onChange={e=>setBuscarEmp(e.target.value)} placeholder="Nombre..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          {empresasSel.length > 0 && (
            <button onClick={()=>setEmpresasSel([])} className="px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200">
              Limpiar ({empresasSel.length})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
          {empresasFiltradas.map(e => {
            const sel = empresasSel.includes(e);
            return (
              <button key={e} onClick={()=>toggleEmpresa(e)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${sel ? "bg-purple-600 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-purple-50"}`}>
                {e}
              </button>
            );
          })}
        </div>

        {mesPrevMeta && (
          <p className="text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg inline-block">
            📊 Se incluirá comparativo vs <b>{mesPrevMeta.label}</b>
          </p>
        )}
      </div>

      {empData && score && (
        <>

          {/* Score + Info empresa */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-6 flex-wrap" style={{borderLeft:`6px solid ${semColor}`}}>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Score de riesgo</p>
                <p className="text-4xl font-extrabold" style={{color:semColor}}>{score.score}</p>
                <p className="text-xs text-gray-400">sobre 100</p>
              </div>
              <div>
                <span className="inline-block px-4 py-1.5 rounded-full text-white font-bold text-sm" style={{background:semColor}}>{score.semaforo}</span>
              </div>
              <div className="flex-1 text-right text-xs text-gray-500">
                <p>Ejecutivo: <b className="text-gray-700">{empData.ejecutivo}</b></p>
                <p>Ciudad: <b className="text-gray-700">{empData.ciudad}</b></p>
                {empData.totalDrivers > 0 && <p>Pilotos activos: <b className="text-gray-700">{empData.totalDrivers}</b></p>}
              </div>
            </div>

            {/* Insights */}
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-green-700 mb-2">✅ Puntos positivos ({insights.positivos.length})</h4>
                  {insights.positivos.length > 0 ? (
                    <div className="space-y-1.5">
                      {insights.positivos.map((t, i) => (
                        <div key={i} className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-gray-700 flex items-start gap-2">
                          <span className="text-green-500 shrink-0">●</span> {t}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-400">Sin puntos positivos destacados.</p>}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-red-700 mb-2">⚠️ Alertas ({insights.alertas.length})</h4>
                  {insights.alertas.length > 0 ? (
                    <div className="space-y-1.5">
                      {insights.alertas.map((t, i) => (
                        <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-gray-700 flex items-start gap-2">
                          <span className="text-red-500 shrink-0">●</span> {t}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-400">Sin alertas para esta empresa.</p>}
                </div>
              </div>
            </div>

            {/* KPIs tabla comparativa */}
            <div className="px-6 py-5">
              <h4 className="font-bold text-gray-700 text-sm mb-3">📊 Indicadores clave del mes</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{background:PIBOX_PURPLE}} className="text-white">
                      <th className="px-4 py-2.5 text-left font-semibold rounded-tl-lg">Indicador</th>
                      <th className="px-4 py-2.5 text-center font-semibold">{dataMes?.label}</th>
                      <th className="px-4 py-2.5 text-center font-semibold">{mesPrevMeta?.label||"—"}</th>
                      <th className="px-4 py-2.5 text-center font-semibold rounded-tr-lg">Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label:"💰 GMV Total",
                        curr: fmtCOP(empData.gmv),
                        prev: prevData ? fmtCOP(prevData.gmv) : "—",
                        varN: prevData&&prevData.gmv>0 ? (empData.gmv-prevData.gmv)/prevData.gmv : null,
                        invert:false,
                      },
                      {
                        label:"📦 Servicios totales",
                        curr: empData.total.toLocaleString(),
                        prev: prevData ? prevData.total.toLocaleString() : "—",
                        varN: prevData&&prevData.total>0 ? (empData.total-prevData.total)/prevData.total : null,
                        invert:false,
                      },
                      {
                        label:"✅ Tasa completado",
                        curr: fmtPct(empData.tasa_completado),
                        prev: prevData ? fmtPct(prevData.tasa_completado) : "—",
                        varN: prevData ? empData.tasa_completado-prevData.tasa_completado : null,
                        invert:false,
                      },
                      {
                        label:"❌ Tasa cancelación",
                        curr: fmtPct(empData.tasa_cancelacion),
                        prev: prevData ? fmtPct(prevData.tasa_cancelacion) : "—",
                        varN: prevData ? empData.tasa_cancelacion-prevData.tasa_cancelacion : null,
                        invert:true,
                      },
                      {
                        label:"⏱️ Tasa expirados",
                        curr: fmtPct(empData.tasa_expirado),
                        prev: prevData ? fmtPct(prevData.tasa_expirado) : "—",
                        varN: null, invert:true,
                      },
                      {
                        label:"🏙️ Ciudad principal",
                        curr: empData.ciudad, prev:"—", varN:null,
                      },
                    ].map((r,i)=>(
                      <tr key={i} className={i%2===0?"bg-white":"bg-purple-50/30"}>
                        <td className="px-4 py-2.5 font-medium text-gray-700">{r.label}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-gray-800">{r.curr}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500">{r.prev}</td>
                        <td className="px-4 py-2.5 text-center">
                          {r.varN !== null ? (
                            <span style={{color: (r.varN>0)!==r.invert ? SEM_VERDE : SEM_ROJO}}
                                  className="font-bold">
                              {r.varN>=0?"▲":"▼"} {Math.abs(r.varN*100).toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Estado del booking */}
            {empData.total > 0 && (
              <div className="px-6 py-4 border-t border-gray-100">
                <h4 className="font-bold text-gray-700 text-sm mb-1">📋 Estado del Servicio</h4>
                {prevData && <p className="text-xs text-gray-400 mb-3">🟣 {dataMes?.label} · 🩷 {mesPrevMeta?.label}</p>}
                {(() => {
                  const estados = [
                    { estado: "Completed", total: empData.completados || 0 },
                    { estado: "Canceled", total: empData.cancelados || 0 },
                    { estado: "Expired", total: empData.expirados || 0 },
                  ].filter(e => e.total > 0 || (prevData && (e.estado === "Completed" ? prevData.completados : e.estado === "Canceled" ? prevData.cancelados : prevData.expirados) > 0));
                  const merged = estados.map(e => ({
                    ...e,
                    totalPrev: prevData ? (e.estado === "Completed" ? prevData.completados : e.estado === "Canceled" ? prevData.cancelados : prevData.expirados) || 0 : 0,
                  }));
                  const other = (empData.total || 0) - (empData.completados || 0) - (empData.cancelados || 0) - (empData.expirados || 0);
                  if (other > 0) merged.push({ estado: "Other", total: other, totalPrev: 0 });
                  return (
                    <ResponsiveContainer width="100%" height={Math.max(160, merged.length * 40)}>
                      <BarChart data={merged} layout="vertical" margin={{ left: 5, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                        <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => v.toLocaleString()} />
                        <YAxis type="category" dataKey="estado" tick={{ fontSize: 9 }} width={80} />
                        <Tooltip formatter={v => [v.toLocaleString() + " servicios"]} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                        <Bar dataKey="total" name={dataMes?.label || "Actual"} radius={[0, 4, 4, 0]}>
                          {merged.map((e, i) => (
                            <Cell key={i} fill={e.estado === "Completed" ? SEM_VERDE : e.estado === "Canceled" ? SEM_ROJO : e.estado === "Expired" ? SEM_AMARILLO : "#9CA3AF"} />
                          ))}
                        </Bar>
                        {prevData && <Bar dataKey="totalPrev" name={mesPrevMeta?.label} fill={PIBOX_PINK} fillOpacity={0.45} radius={[0, 4, 4, 0]} />}
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
                <div className="mt-2 space-y-1">
                  {[
                    { label: "Completed", value: empData.completados, prev: prevData?.completados, color: SEM_VERDE },
                    { label: "Canceled", value: empData.cancelados, prev: prevData?.cancelados, color: SEM_ROJO },
                    { label: "Expired", value: empData.expirados, prev: prevData?.expirados, color: SEM_AMARILLO },
                  ].map(d => {
                    const varPct = d.prev > 0 ? ((d.value - d.prev) / d.prev * 100) : 0;
                    return (
                      <div key={d.label} className="flex justify-between text-xs items-center">
                        <span style={{ color: d.color }}>{d.label}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700">{(d.value || 0).toLocaleString()}</span>
                          {d.prev > 0 && (
                            <span className={`text-xs font-bold ${varPct >= 0 ? (d.label === "Completed" ? "text-green-600" : "text-red-500") : (d.label === "Completed" ? "text-red-500" : "text-green-600")}`}>
                              {varPct >= 0 ? "▲" : "▼"} {Math.abs(varPct).toFixed(1)}%
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Gráficas semanales */}
            {empData.weekly?.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-100">
                <h4 className="font-bold text-gray-700 text-sm mb-4">📈 Evolución semanal</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold mb-2">GMV semanal</p>
                    <ResponsiveContainer width="100%" height={130}>
                      <BarChart data={empData.weekly}>
                        <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={40}/>
                        <YAxis tick={{fontSize:9}} tickFormatter={fmtM}/>

                        <Tooltip formatter={v=>fmtCOP(v)}/>
                        <Bar dataKey="gmv" name="GMV" fill={PIBOX_PURPLE} radius={[3,3,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold mb-2">Servicios semanales</p>
                    <ResponsiveContainer width="100%" height={130}>
                      <BarChart data={empData.weekly}>
                        <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={40}/>
                        <YAxis tick={{fontSize:9}}/>
                        <Tooltip/>
                        <Bar dataKey="servicios" name="Servicios" fill={PIBOX_PINK} radius={[3,3,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold mb-2">% Completado / Cancelación</p>
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={empData.weekly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                        <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={40}/>
                        <YAxis tick={{fontSize:9}} tickFormatter={v=>`${(v*100).toFixed(0)}%`}/>
                        <Tooltip formatter={v=>fmtPct(v)}/>
                        <Legend iconSize={7} wrapperStyle={{fontSize:9}}/>
                        <Line dataKey="tasa_completado"  name="Completado"  stroke={SEM_VERDE} strokeWidth={2} dot={{r:2}}/>
                        <Line dataKey="tasa_cancelacion" name="Cancelación" stroke={SEM_ROJO}  strokeWidth={2} dot={{r:2}} strokeDasharray="4 2"/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Cumplimiento por rango de distancia */}
            {(() => {
              const distMap = { "0-3 km": 0, "3-5 km": 0, "5-10 km": 0, "Mas de 10 km": 0 };
              const distTimes = {};
              // For merged empresas, aggregate from all selected
              const selEmps = empresasSel.length > 1
                ? (dataMes?.empresas || []).filter(e => empresasSel.includes(e.empresa))
                : empData ? [empData] : [];
              let totalRelaunch = 0;
              for (const e of selEmps) {
                totalRelaunch += e.relanzamientos || 0;
                if (!e.distancias) continue;
                for (const [rng, val] of Object.entries(e.distancias)) {
                  const k = rng === "Más de 10 km" || rng === "Mas de 10 km" ? "Mas de 10 km" : rng;
                  if (!(k in distMap)) continue;
                  if (typeof val === "number") { distMap[k] += val; continue; }
                  distMap[k] += val.total || 0;
                  if (!distTimes[k]) distTimes[k] = { completados: 0, relanzamientos: 0, tAsig: 0, tLleg: 0, tRuta: 0, tTotal: 0, n: 0 };
                  distTimes[k].completados += val.completados || 0;
                  distTimes[k].relanzamientos += val.relanzamientos || 0;
                  distTimes[k].tAsig += val.tAsignacion || 0;
                  distTimes[k].tLleg += val.tLlegada || 0;
                  distTimes[k].tRuta += val.tRuta || 0;
                  distTimes[k].tTotal += val.tTotal || 0;
                  distTimes[k].n += val.nTiempos || 0;
                }
              }
              const totalBookings = Object.values(distMap).reduce((s, v) => s + v, 0);
              const fmtTime = (mins) => { if (!mins) return "\u2014"; const h = Math.floor(mins/60); const m = Math.round(mins%60); return h > 0 ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`; };
              const distAgg = Object.entries(distMap).map(([rng, cnt]) => {
                const t = distTimes[rng] || {};
                const n = t.n || 1;
                return { rango: rng, bookings: cnt, pct: totalBookings > 0 ? cnt / totalBookings : 0, completados: t.completados || 0, relanzamientos: t.relanzamientos || 0, efectividad: cnt > 0 ? (t.completados || 0) / cnt : 0, avgAsig: fmtTime(t.tAsig / n), avgLleg: fmtTime(t.tLleg / n), avgRuta: fmtTime(t.tRuta / n), avgTotal: fmtTime(t.tTotal / n) };
              });
              const empWithRelaunch = selEmps.filter(e => (e.relanzamientos || 0) > 0).sort((a, b) => (b.relanzamientos || 0) - (a.relanzamientos || 0));

              return totalBookings > 0 ? (
                <>
                  <div className="px-6 py-5 border-t border-gray-100">
                    <h4 className="font-bold text-gray-700 text-sm mb-3">📏 Cumplimiento por rango de distancia</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" style={{borderCollapse:"collapse"}}>
                        <thead>
                          <tr style={{background:PIBOX_PURPLE}} className="text-white">
                            {["Rango","Bookings","Relanzamientos","Efectividad","T. Asignacion","T. Llegada","T. Ruta","T. Total","% Bookings"].map(h=>(
                              <th key={h} className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {distAgg.map((d,i)=>(
                            <tr key={i} className={i%2===0?"bg-white":"bg-purple-50/30"}>
                              <td className="px-3 py-2 font-semibold text-gray-700">{d.rango}</td>
                              <td className="px-3 py-2 text-center">{d.bookings.toLocaleString()}</td>
                              <td className="px-3 py-2 text-center">{d.relanzamientos.toLocaleString()}</td>
                              <td className="px-3 py-2 text-center font-semibold" style={{color: d.efectividad >= 0.9 ? SEM_VERDE : d.efectividad >= 0.75 ? SEM_AMARILLO : SEM_ROJO}}>{fmtPct(d.efectividad)}</td>
                              <td className="px-3 py-2 text-center text-gray-500">{d.avgAsig}</td>
                              <td className="px-3 py-2 text-center text-gray-500">{d.avgLleg}</td>
                              <td className="px-3 py-2 text-center text-gray-500">{d.avgRuta}</td>
                              <td className="px-3 py-2 text-center font-semibold text-gray-700">{d.avgTotal}</td>
                              <td className="px-3 py-2 text-center" style={{color:PIBOX_PURPLE}}>{fmtPct(d.pct)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-purple-300 bg-purple-50 font-bold">
                            <td className="px-3 py-2 text-gray-800">Total</td>
                            <td className="px-3 py-2 text-center">{distAgg.reduce((s,d)=>s+d.bookings,0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-center">{distAgg.reduce((s,d)=>s+d.relanzamientos,0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-center" colSpan={5}></td>
                            <td className="px-3 py-2 text-center">100.0%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Gráficas comparativas devoluciones + relanzamientos */}
                  {(() => {
                    const selEmpsAct = dataMes?.empresas?.filter(e => empresasSel.includes(e.empresa)) || [];
                    const selEmpsPrev = dataPrev?.empresas?.filter(e => empresasSel.includes(e.empresa)) || [];
                    const totalDevAct = selEmpsAct.reduce((s,e) => s + (e.devueltos||0), 0);
                    const totalRelAct = selEmpsAct.reduce((s,e) => s + (e.relanzamientos||0), 0);
                    const totalServAct = selEmpsAct.reduce((s,e) => s + e.total, 0);
                    const totalDevPrev = selEmpsPrev.reduce((s,e) => s + (e.devueltos||0), 0);
                    const totalRelPrev = selEmpsPrev.reduce((s,e) => s + (e.relanzamientos||0), 0);
                    const totalServPrev = selEmpsPrev.reduce((s,e) => s + e.total, 0);
                    const mesActLabel = dataMes?.label || "Actual";
                    const mesPrevLabel2 = mesPrevMeta?.label || "Anterior";
                    const barData = [
                      { name: "Devoluciones", [mesActLabel]: totalDevAct, [mesPrevLabel2]: totalDevPrev },
                      { name: "Relanzamientos", [mesActLabel]: totalRelAct, [mesPrevLabel2]: totalRelPrev },
                    ];
                    const pctData = [
                      { name: "% Devoluciones", [mesActLabel]: totalServAct > 0 ? +(totalDevAct/totalServAct*100).toFixed(2) : 0, [mesPrevLabel2]: totalServPrev > 0 ? +(totalDevPrev/totalServPrev*100).toFixed(2) : 0 },
                      { name: "% Relanzamientos", [mesActLabel]: totalServAct > 0 ? +(totalRelAct/totalServAct*100).toFixed(2) : 0, [mesPrevLabel2]: totalServPrev > 0 ? +(totalRelPrev/totalServPrev*100).toFixed(2) : 0 },
                    ];
                    if (totalDevAct === 0 && totalRelAct === 0 && totalDevPrev === 0 && totalRelPrev === 0) return null;
                    return (
                      <div className="px-6 py-5 border-t border-gray-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-bold text-gray-700 text-sm mb-3">📦 Devoluciones y Relanzamientos vs {mesPrevLabel2}</h4>
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                                <Bar dataKey={mesActLabel} fill={PIBOX_PURPLE} radius={[4,4,0,0]} />
                                <Bar dataKey={mesPrevLabel2} fill="#DDD6FE" radius={[4,4,0,0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-700 text-sm mb-3">📊 Participación sobre servicios</h4>
                            <ResponsiveContainer width="100%" height={180}>
                              <PieChart>
                                <Pie data={[
                                  { name: "Completados", value: Math.max(totalServAct - totalDevAct - totalRelAct, 0) || totalServAct },
                                  { name: "Devoluciones", value: totalDevAct },
                                  { name: "Relanzamientos", value: totalRelAct },
                                ].filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65}
                                  label={({name, percent}) => `${name.slice(0,6)} ${(percent*100).toFixed(1)}%`} labelLine={false}>
                                  <Cell fill={SEM_VERDE} /><Cell fill={SEM_ROJO} /><Cell fill={SEM_AMARILLO} />
                                </Pie>
                                <Tooltip formatter={v => v.toLocaleString()} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-3 mt-1 text-[10px] text-gray-500">
                              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{background:SEM_VERDE}}/>Servicios</span>
                              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{background:SEM_ROJO}}/>Dev {totalServAct>0?((totalDevAct/totalServAct)*100).toFixed(1):"0"}%</span>
                              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{background:SEM_AMARILLO}}/>Rel {totalServAct>0?((totalRelAct/totalServAct)*100).toFixed(1):"0"}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Gráficas por usuario y sede: relanzamientos + devoluciones */}
                  {empData && (empData.topUsuarios?.some(u => (u.relanzamientos||0) > 0 || (u.devueltos||0) > 0) || empData.topSedes?.some(s => (s.relanzamientos||0) > 0 || (s.devueltos||0) > 0)) && (
                    <div className="px-6 py-5 border-t border-gray-100">
                      <h4 className="font-bold text-gray-700 text-sm mb-4">📊 Relanzamientos y Devoluciones por Usuario y Sede</h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Relanzamientos por usuario */}
                        {(() => {
                          const data = (empData.topUsuarios || []).filter(u => (u.relanzamientos||0) > 0)
                            .map(u => ({ name: u.usuario.length > 18 ? u.usuario.slice(0,18)+"…" : u.usuario, Relanzamientos: u.relanzamientos, Servicios: u.total }))
                            .sort((a,b) => b.Relanzamientos - a.Relanzamientos).slice(0, 10);
                          if (!data.length) return null;
                          return (
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <p className="text-xs font-bold text-gray-600 mb-2">🔄 Relanzamientos por usuario (Top 10)</p>
                              <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
                                <BarChart data={data} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                                  <XAxis type="number" tick={{ fontSize: 9 }} />
                                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 8 }} />
                                  <Tooltip />
                                  <Legend iconSize={7} wrapperStyle={{ fontSize: 9 }} />
                                  <Bar dataKey="Relanzamientos" fill={PIBOX_PURPLE} radius={[0,4,4,0]} />
                                  <Bar dataKey="Servicios" fill="#DDD6FE" radius={[0,4,4,0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()}
                        {/* Devoluciones por usuario */}
                        {(() => {
                          const data = (empData.topUsuarios || []).filter(u => (u.devueltos||0) > 0)
                            .map(u => ({ name: u.usuario.length > 18 ? u.usuario.slice(0,18)+"…" : u.usuario, Devueltos: u.devueltos, Paquetes: u.total }))
                            .sort((a,b) => b.Devueltos - a.Devueltos).slice(0, 10);
                          if (!data.length) return null;
                          return (
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <p className="text-xs font-bold text-gray-600 mb-2">📦 Devoluciones por usuario (Top 10)</p>
                              <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
                                <BarChart data={data} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" stroke="#FEE2E2" />
                                  <XAxis type="number" tick={{ fontSize: 9 }} />
                                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 8 }} />
                                  <Tooltip />
                                  <Legend iconSize={7} wrapperStyle={{ fontSize: 9 }} />
                                  <Bar dataKey="Devueltos" fill={SEM_ROJO} radius={[0,4,4,0]} />
                                  <Bar dataKey="Paquetes" fill="#FCA5A5" radius={[0,4,4,0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()}
                        {/* Relanzamientos por sede */}
                        {(() => {
                          const data = (empData.topSedes || []).filter(s => (s.relanzamientos||0) > 0)
                            .map(s => ({ name: s.sede.length > 18 ? s.sede.slice(0,18)+"…" : s.sede, Relanzamientos: s.relanzamientos, Servicios: s.total }))
                            .sort((a,b) => b.Relanzamientos - a.Relanzamientos).slice(0, 10);
                          if (!data.length) return null;
                          return (
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <p className="text-xs font-bold text-gray-600 mb-2">🔄 Relanzamientos por sede (Top 10)</p>
                              <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
                                <BarChart data={data} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                                  <XAxis type="number" tick={{ fontSize: 9 }} />
                                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 8 }} />
                                  <Tooltip />
                                  <Legend iconSize={7} wrapperStyle={{ fontSize: 9 }} />
                                  <Bar dataKey="Relanzamientos" fill={PIBOX_PINK} radius={[0,4,4,0]} />
                                  <Bar dataKey="Servicios" fill="#F5D0FE" radius={[0,4,4,0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()}
                        {/* Devoluciones por sede */}
                        {(() => {
                          const data = (empData.topSedes || []).filter(s => (s.devueltos||0) > 0)
                            .map(s => ({ name: s.sede.length > 18 ? s.sede.slice(0,18)+"…" : s.sede, Devueltos: s.devueltos, Paquetes: s.total }))
                            .sort((a,b) => b.Devueltos - a.Devueltos).slice(0, 10);
                          if (!data.length) return null;
                          return (
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <p className="text-xs font-bold text-gray-600 mb-2">📦 Devoluciones por sede (Top 10)</p>
                              <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
                                <BarChart data={data} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" stroke="#FEE2E2" />
                                  <XAxis type="number" tick={{ fontSize: 9 }} />
                                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 8 }} />
                                  <Tooltip />
                                  <Legend iconSize={7} wrapperStyle={{ fontSize: 9 }} />
                                  <Bar dataKey="Devueltos" fill={SEM_AMARILLO} radius={[0,4,4,0]} />
                                  <Bar dataKey="Paquetes" fill="#FEF3C7" radius={[0,4,4,0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="px-6 py-5 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-gray-700 text-sm">🔄 Distribucion de relanzamientos</h4>
                      {empWithRelaunch.length > 0 && (
                        <button onClick={() => {
                          const csv = ["Empresa,Relanzamientos totales,Servicios,Promedio por servicio", ...empWithRelaunch.map(c => `"${c.empresa}",${c.relanzamientos||0},${c.total},${c.total > 0 ? ((c.relanzamientos||0)/c.total).toFixed(2) : "0"}`)].join("\n");
                          const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
                          const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "relanzamientos.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        }} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200">
                          📥 Descargar ({empWithRelaunch.length})
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-3">Nota: el conteo de relanzamientos es agregado por empresa; la distribucion individual por servicio no esta disponible en los datos almacenados.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" style={{borderCollapse:"collapse"}}>
                        <thead>
                          <tr style={{background:PIBOX_PURPLE}} className="text-white">
                            {["Empresa","Relanzamientos totales","Servicios","Promedio por servicio"].map(h=>(
                              <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {empWithRelaunch.length === 0 ? (
                            <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">Sin relanzamientos registrados.</td></tr>
                          ) : empWithRelaunch.slice(0, 15).map((c,i)=>(
                            <tr key={i} className={i%2===0?"bg-white":"bg-purple-50/30"}>
                              <td className="px-3 py-2 font-semibold text-gray-700">{c.empresa}</td>
                              <td className="px-3 py-2">{(c.relanzamientos||0).toLocaleString()}</td>
                              <td className="px-3 py-2 text-gray-500">{c.total}</td>
                              <td className="px-3 py-2" style={{color:PIBOX_PURPLE}}>{c.total > 0 ? ((c.relanzamientos||0)/c.total).toFixed(2) : "0"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {empWithRelaunch.length > 15 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">Mostrando 15 de {empWithRelaunch.length}. Descarga CSV para ver todos.</p>
                    )}
                  </div>

                  {/* Devoluciones por empresa */}
                  {(() => {
                    const devolData = selEmps.filter(e => (e.devueltos||0) > 0)
                      .map(e => ({ empresa: e.empresa, paquetes: e.paquetes||0, devueltos: e.devueltos||0, tasa: (e.paquetes||0) > 0 ? (e.devueltos||0)/(e.paquetes||0) : 0 }))
                      .sort((a,b) => b.devueltos - a.devueltos);
                    if (!devolData.length) return null;
                    const totPaq = devolData.reduce((s,d) => s+d.paquetes, 0);
                    const totDev = devolData.reduce((s,d) => s+d.devueltos, 0);
                    const totTasa = totPaq > 0 ? totDev/totPaq : 0;
                    return (
                      <div className="px-6 py-5 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-gray-700 text-sm">📦 Devoluciones por empresa</h4>
                          <button onClick={() => {
                            const csv = ["Empresa,Paquetes,Devueltos,Tasa Devolucion", ...devolData.map(d => `"${d.empresa}",${d.paquetes},${d.devueltos},${(d.tasa*100).toFixed(1)}%`)].join("\n");
                            const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
                            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "devoluciones.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                          }} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200">
                            📥 Descargar ({devolData.length})
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs" style={{borderCollapse:"collapse"}}>
                            <thead>
                              <tr style={{background:PIBOX_PURPLE}} className="text-white">
                                {["Empresa","Paquetes","Devueltos","Tasa devolucion (%)"].map(h=>(
                                  <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {devolData.slice(0, 15).map((d,i)=>(
                                <tr key={i} className={i%2===0?"bg-white":"bg-purple-50/30"}>
                                  <td className="px-3 py-2 font-semibold text-gray-700">{d.empresa}</td>
                                  <td className="px-3 py-2">{d.paquetes.toLocaleString()}</td>
                                  <td className="px-3 py-2">{d.devueltos.toLocaleString()}</td>
                                  <td className="px-3 py-2 font-semibold" style={{color: d.tasa > 0.10 ? SEM_ROJO : d.tasa > 0.05 ? SEM_AMARILLO : SEM_VERDE}}>{fmtPct(d.tasa)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-purple-300 bg-purple-50 font-bold">
                                <td className="px-3 py-2 text-gray-800">Total</td>
                                <td className="px-3 py-2">{totPaq.toLocaleString()}</td>
                                <td className="px-3 py-2">{totDev.toLocaleString()}</td>
                                <td className="px-3 py-2 font-semibold" style={{color: totTasa > 0.10 ? SEM_ROJO : totTasa > 0.05 ? SEM_AMARILLO : SEM_VERDE}}>{fmtPct(totTasa)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        {devolData.length > 15 && (
                          <p className="text-xs text-gray-400 mt-2 text-center">Mostrando 15 de {devolData.length}. Descarga CSV para ver todos.</p>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : null;
            })()}

            {/* Ciudad + Tipo op */}
            {(empData.topCiudades?.length>0 || empData.topOps?.length>0) && (
              <div className="px-6 py-4 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {empData.topCiudades?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-700 text-sm mb-3">🏙️ Top ciudades</h4>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{background:PIBOX_PURPLE}} className="text-white">
                            <th className="px-3 py-2 text-left">Ciudad</th>
                            <th className="px-3 py-2 text-right">GMV</th>
                            <th className="px-3 py-2 text-right">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {empData.topCiudades.slice(0,6).map((c,i)=>{
                            const tot = empData.topCiudades.reduce((s,x)=>s+x.gmv,0)||1;
                            return (
                              <tr key={i} className={i%2===0?"bg-white":"bg-purple-50/30"}>
                                <td className="px-3 py-1.5">{c.city}</td>
                                <td className="px-3 py-1.5 text-right font-semibold">{fmtFull(c.gmv)}</td>
                                <td className="px-3 py-1.5 text-right">{((c.gmv/tot)*100).toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {empData.topOps?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-700 text-sm mb-3">⚙️ Tipo de operación</h4>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{background:PIBOX_PURPLE}} className="text-white">
                            <th className="px-3 py-2 text-left">Tipo</th>
                            <th className="px-3 py-2 text-right">Servicios</th>
                            <th className="px-3 py-2 text-right">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {empData.topOps.map((o,i)=>{
                            const tot = empData.topOps.reduce((s,x)=>s+x.count,0)||1;
                            return (
                              <tr key={i} className={i%2===0?"bg-white":"bg-purple-50/30"}>
                                <td className="px-3 py-1.5">{o.op}</td>
                                <td className="px-3 py-1.5 text-right font-semibold">{o.count.toLocaleString()}</td>
                                <td className="px-3 py-1.5 text-right">{((o.count/tot)*100).toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Drivers activos por tipo de operación */}
            {empData.driversPorOp?.length > 0 && (
              <div className="px-6 py-5 border-t border-gray-100">
                <div className="flex flex-wrap items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-700 text-sm">🏍️ Drivers Activos por Tipo de Operación</h3>
                  <span className="text-xs font-bold text-white px-3 py-1 rounded-lg" style={{background:BRAND_GRADIENT}}>
                    {(empData.totalDrivers || 0).toLocaleString()} drivers únicos
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{background:PIBOX_PURPLE}} className="text-white">
                          <th className="px-3 py-2 text-left font-semibold">Tipo de Operación</th>
                          <th className="px-3 py-2 text-right font-semibold">Drivers</th>
                          <th className="px-3 py-2 text-right font-semibold">Servicios</th>
                          <th className="px-3 py-2 text-right font-semibold">Prom/Driver</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empData.driversPorOp.map((d, i) => {
                          const prevOp = prevData?.driversPorOp?.find(p => p.op === d.op);
                          const varD = prevOp?.driversActivos > 0 ? ((d.driversActivos - prevOp.driversActivos) / prevOp.driversActivos * 100) : null;
                          return (
                            <tr key={d.op} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-purple-50/30"}`}>
                              <td className="px-3 py-2 font-semibold text-gray-800">{d.op}</td>
                              <td className="px-3 py-2 text-right">
                                <span className="font-bold text-purple-700">{d.driversActivos}</span>
                                {varD !== null && (
                                  <span className={`ml-1 text-xs font-bold ${varD >= 0 ? "text-green-600" : "text-red-500"}`}>
                                    {varD >= 0 ? "▲" : "▼"}{Math.abs(varD).toFixed(0)}%
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-600">{d.servicios.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right">
                                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">{d.promServPorDriver}</span>
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-purple-300 bg-purple-50 font-bold">
                          <td className="px-3 py-2 text-purple-800">TOTAL</td>
                          <td className="px-3 py-2 text-right text-purple-800">{(empData.totalDrivers || 0)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{empData.driversPorOp.reduce((s, d) => s + d.servicios, 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">
                            <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                              {(empData.totalDrivers || 0) > 0 ? Math.round(empData.driversPorOp.reduce((s, d) => s + d.servicios, 0) / empData.totalDrivers) : 0}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <ResponsiveContainer width="100%" height={Math.max(160, empData.driversPorOp.length * 38)}>
                    <BarChart data={empData.driversPorOp} layout="vertical" margin={{left:5,right:10}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                      <XAxis type="number" tick={{fontSize:9}}/>
                      <YAxis type="category" dataKey="op" tick={{fontSize:9}} width={85}/>
                      <Tooltip formatter={(v,n) => [v.toLocaleString(), n]}/>
                      <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                      <Bar dataKey="driversActivos" name="Drivers" fill={PIBOX_PURPLE} radius={[0,4,4,0]}/>
                      <Bar dataKey="promServPorDriver" name="Prom/Driver" fill={PIBOX_PINK} radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400 text-center">
                Generado por <b>Tablero de Riesgo Comercial 360° · PIBOX</b> · {fmtDate()}
              </p>
            </div>
          </div>
        </>
      )}

      {!empresa && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-8 text-center text-purple-700">
          <p className="text-2xl mb-2">📄</p>
          <p className="text-sm font-medium">Selecciona un mes y una empresa para generar el informe.</p>
        </div>
      )}
    </div>
  );
}
