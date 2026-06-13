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
  const printRef = useRef();

  const [mesKey, setMesKey]     = useState(meses[meses.length-1]?.key||"");
  const [empresa, setEmpresa]   = useState("");
  const [printing, setPrinting] = useState(false);

  const idxActual   = meses.findIndex(m=>m.key===mesKey);
  const mesPrevMeta = idxActual > 0 ? meses[idxActual-1] : null;

  const dataMes  = useMemo(()=>mesKey?loadMesData(mesKey):null,       [mesKey]);
  const dataPrev = useMemo(()=>mesPrevMeta?loadMesData(mesPrevMeta.key):null, [mesPrevMeta]);

  const empresas = useMemo(()=>dataMes?.empresas?.map(e=>e.empresa).sort()||[], [dataMes]);

  const empData  = useMemo(()=>dataMes?.empresas?.find(e=>e.empresa===empresa)||null, [dataMes, empresa]);
  const prevData = useMemo(()=>dataPrev?.empresas?.find(e=>e.empresa===empresa)||null, [dataPrev, empresa]);
  const score    = useMemo(()=>empData?calcularScore(empData,prevData||null,umb):null, [empData,prevData,umb]);

  const semColor = score?.color==="rojo"?SEM_ROJO:score?.color==="amarillo"?SEM_AMARILLO:SEM_VERDE;

  const handlePrint = async () => {
    if (!empData) return;
    setPrinting(true);
    await new Promise(r=>setTimeout(r,300));
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set({
        margin:      [10,12,10,12],
        filename:    `Informe_${empresa.replace(/[^a-zA-Z0-9]/g,"_")}_${mesKey}.pdf`,
        image:       {type:"jpeg",quality:0.97},
        html2canvas: {scale:2,useCORS:true,logging:false},
        jsPDF:       {unit:"mm",format:"a4",orientation:"portrait"},
        pagebreak:   {mode:["css","legacy"]},
      }).from(printRef.current).save();
    } catch(e) {
      alert("Error al generar PDF: "+e.message);
    }
    setPrinting(false);
  };

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
          Configurar informe
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Mes</label>
            <select value={mesKey} onChange={e=>{setMesKey(e.target.value);setEmpresa("");}}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {[...meses].reverse().map(m=>(
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Empresa</label>
            <select value={empresa} onChange={e=>setEmpresa(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              <option value="">— Selecciona una empresa —</option>
              {empresas.map(e=><option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        {mesPrevMeta && (
          <p className="text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg inline-block">
            📊 Se incluirá comparativo vs <b>{mesPrevMeta.label}</b>
          </p>
        )}
      </div>

      {empData && score && (
        <>
          {/* ── Tablas Usuario / Sede ── siempre visibles ─────────────────── */}
          <TablaUsuariosSedes empData={empData} prevData={prevData}
            mesLabel={dataMes?.label} prevLabel={mesPrevMeta?.label}/>

          {/* Botón de descarga */}
          <div className="flex gap-3">
            <button onClick={handlePrint} disabled={printing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{background:BRAND_GRADIENT}}>
              {printing
                ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Generando PDF...</>
                : "⬇️ Descargar PDF"}
            </button>
            <div className="flex items-center text-xs text-gray-500">
              El PDF incluye score, KPIs, comparativo, gráficas y distribución geográfica.
            </div>
          </div>

          {/* Vista previa / contenido del PDF */}
          <div ref={printRef} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden"
               id="informe-pdf-content">
            {/* Header */}
            <div className="p-6 text-white" style={{background:BRAND_GRADIENT}}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                    Informe de Riesgo Comercial 360° · PIBOX
                  </p>
                  <h2 className="text-xl font-extrabold">{empresa}</h2>
                  <p className="text-sm text-white/80 mt-1">
                    Período: <b>{dataMes?.label}</b>
                    {mesPrevMeta && ` · Comparado con: ${mesPrevMeta.label}`}
                  </p>
                </div>
                <div className="text-right text-sm text-white/70">
                  <p>Ejecutivo: <b className="text-white">{empData.ejecutivo}</b></p>
                  <p>Ciudad: <b className="text-white">{empData.ciudad}</b></p>
                  <p className="text-xs mt-1">Generado: {fmtDate()}</p>
                </div>
              </div>
            </div>

            {/* Score */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-6 flex-wrap"
                 style={{borderLeft:`6px solid ${semColor}`}}>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Score de riesgo</p>
                <p className="text-4xl font-extrabold" style={{color:semColor}}>{score.score}</p>
                <p className="text-xs text-gray-400">sobre 100</p>
              </div>
              <div>
                <span className="inline-block px-4 py-1.5 rounded-full text-white font-bold text-sm"
                      style={{background:semColor}}>
                  {score.semaforo}
                </span>
              </div>
              {score.factores.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2 flex-1">
                  <p className="text-xs font-bold text-red-700 mb-1">⚠️ Factores de alerta</p>
                  <p className="text-xs text-red-600">{score.factores.join(" · ")}</p>
                </div>
              )}
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

            {/* Servicios completados por usuario */}
            {empData.topUsuarios?.length > 0 && (
              <div className="px-6 py-5 border-t border-gray-100">
                <h4 className="font-bold text-gray-700 text-sm mb-3">👤 Servicios completados y costo por usuario</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{background:PIBOX_PURPLE}} className="text-white">
                        <th className="px-3 py-2.5 text-left">Usuario</th>
                        <th className="px-3 py-2.5 text-right">Completados</th>
                        <th className="px-3 py-2.5 text-right">Total servicios</th>
                        <th className="px-3 py-2.5 text-right">% Completado</th>
                        <th className="px-3 py-2.5 text-right">GMV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empData.topUsuarios.map((u,i)=>(
                        <tr key={i} className={i%2===0?"bg-white":"bg-purple-50/30"}>
                          <td className="px-3 py-2 font-medium text-gray-700 max-w-[180px] truncate">{u.usuario}</td>
                          <td className="px-3 py-2 text-right font-bold" style={{color:SEM_VERDE}}>{u.completados.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{u.total.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-semibold" style={{color:SEM_VERDE}}>
                            {u.total>0 ? fmtPct(u.completados/u.total) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold" style={{color:PIBOX_PURPLE}}>{fmtFull(u.gmv)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-purple-50 font-bold border-t border-purple-200">
                        <td className="px-3 py-2 text-gray-700">Total</td>
                        <td className="px-3 py-2 text-right" style={{color:SEM_VERDE}}>
                          {empData.topUsuarios.reduce((s,u)=>s+u.completados,0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {empData.topUsuarios.reduce((s,u)=>s+u.total,0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right" style={{color:SEM_VERDE}}>
                          {fmtPct(empData.completados / Math.max(empData.total,1))}
                        </td>
                        <td className="px-3 py-2 text-right" style={{color:PIBOX_PURPLE}}>
                          {fmtFull(empData.topUsuarios.reduce((s,u)=>s+u.gmv,0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Servicios completados por sede */}
            {empData.topSedes?.length > 0 && (
              <div className="px-6 py-5 border-t border-gray-100">
                <h4 className="font-bold text-gray-700 text-sm mb-3">🏢 Servicios completados y costo por sede</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{background:PIBOX_PURPLE}} className="text-white">
                        <th className="px-3 py-2.5 text-left">Sede</th>
                        <th className="px-3 py-2.5 text-right">Completados</th>
                        <th className="px-3 py-2.5 text-right">Total servicios</th>
                        <th className="px-3 py-2.5 text-right">% Completado</th>
                        <th className="px-3 py-2.5 text-right">GMV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empData.topSedes.map((s,i)=>(
                        <tr key={i} className={i%2===0?"bg-white":"bg-purple-50/30"}>
                          <td className="px-3 py-2 font-medium text-gray-700 max-w-[200px] truncate">{s.sede}</td>
                          <td className="px-3 py-2 text-right font-bold" style={{color:SEM_VERDE}}>{s.completados.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{s.total.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-semibold" style={{color:SEM_VERDE}}>
                            {s.total>0 ? fmtPct(s.completados/s.total) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold" style={{color:PIBOX_PURPLE}}>{fmtFull(s.gmv)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-purple-50 font-bold border-t border-purple-200">
                        <td className="px-3 py-2 text-gray-700">Total</td>
                        <td className="px-3 py-2 text-right" style={{color:SEM_VERDE}}>
                          {empData.topSedes.reduce((s,r)=>s+r.completados,0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {empData.topSedes.reduce((s,r)=>s+r.total,0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right" style={{color:SEM_VERDE}}>
                          {fmtPct(empData.completados / Math.max(empData.total,1))}
                        </td>
                        <td className="px-3 py-2 text-right" style={{color:PIBOX_PURPLE}}>
                          {fmtFull(empData.topSedes.reduce((s,r)=>s+r.gmv,0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
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
