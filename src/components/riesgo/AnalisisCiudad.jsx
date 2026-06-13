import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import {
  loadMesData, reprocesarSiNecesario, mesesDisponibles, fmtM, fmtFull, fmtPct,
  PIBOX_PURPLE, PIBOX_PINK, SEM_ROJO, SEM_AMARILLO, SEM_VERDE,
} from "./utils";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const COLORS = [PIBOX_PURPLE, PIBOX_PINK, "#A855F7","#6366F1","#EC4899","#8B5CF6","#F59E0B","#10B981"];

const STATUS_COLORS = {
  "Completed":            SEM_VERDE,
  "Canceled by Passenger":SEM_ROJO,
  "Canceled by Driver":   "#EF4444",
  "Canceled by Ops":      "#F87171",
  "Expired":              SEM_AMARILLO,
  "Other":                "#9CA3AF",
};

const TT = ({active,payload,label,fmt}) => {
  if (!active||!payload?.length) return null;
  return (
    <div className="bg-white border border-purple-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-purple-700 mb-1">{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color||PIBOX_PURPLE}}>
          {p.name}: <b>{fmt ? fmt(p.value) : p.value?.toLocaleString()}</b>
        </p>
      ))}
    </div>
  );
};

function KpiCard({icon,label,value,sub,borderColor,delta}) {
  const showDelta = delta !== null && delta !== undefined;
  const isPos = delta > 0;
  const deltaColor = showDelta ? (isPos ? SEM_VERDE : SEM_ROJO) : "#9CA3AF";
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
         style={{borderLeft:`4px solid ${borderColor||PIBOX_PURPLE}`}}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{icon} {label}</p>
      <p className="text-xl font-extrabold mt-1" style={{color:borderColor||PIBOX_PURPLE}}>{value}</p>
      {showDelta && (
        <p className="text-xs font-semibold mt-0.5" style={{color:deltaColor}}>
          {isPos?"▲":"▼"} {Math.abs(delta*100).toFixed(1)}% vs mes ant.
        </p>
      )}
      {!showDelta && sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AnalisisCiudad() {
  const meses = mesesDisponibles();
  const [mesKey, setMesKey] = useState(meses[meses.length-1]?.key || "");
  const [ciudad, setCiudad] = useState("");

  const idxActual   = meses.findIndex(m=>m.key===mesKey);
  const mesPrevMeta = idxActual > 0 ? meses[idxActual-1] : null;

  const dataMes  = useMemo(()=> mesKey ? (reprocesarSiNecesario(mesKey) || loadMesData(mesKey)) : null, [mesKey]);
  const dataPrev = useMemo(()=> mesPrevMeta ? (reprocesarSiNecesario(mesPrevMeta.key) || loadMesData(mesPrevMeta.key)) : null, [mesPrevMeta]);

  // Si ciudades no existe aún (datos viejos), derivar lista de topCiudades
  const tieneCiudades = !!(dataMes?.ciudades?.length > 0);
  const ciudadesDisp = useMemo(()=>{
    if (dataMes?.ciudades?.length > 0)
      return dataMes.ciudades.map(c=>c.city).sort();
    // Fallback: lista de topCiudades para que aparezcan en el selector
    return (dataMes?.totales?.topCiudades||[]).map(c=>c.city).sort();
  }, [dataMes]);

  const cityData  = useMemo(()=>
    dataMes?.ciudades?.find(c=>c.city===ciudad)||null, [dataMes,ciudad]);
  const cityPrev  = useMemo(()=>
    dataPrev?.ciudades?.find(c=>c.city===ciudad)||null, [dataPrev,ciudad]);

  // Deltas
  const varPaq  = cityPrev?.paquetes  > 0 ? (cityData?.paquetes  - cityPrev.paquetes)  / cityPrev.paquetes  : null;
  const varSvc  = cityPrev?.total     > 0 ? (cityData?.total      - cityPrev.total)      / cityPrev.total      : null;
  const varGmv  = cityPrev?.gmv       > 0 ? (cityData?.gmv        - cityPrev.gmv)        / cityPrev.gmv        : null;
  const varTc   = cityPrev            ? (cityData?.tasa_completado||0) - (cityPrev.tasa_completado||0) : null;

  if (!meses.length) return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800 text-sm">
      <b>Sin datos.</b> Ve a <b>⚙️ Configuración</b> y sube al menos un mes.
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Selección de mes y ciudad */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">📅 Mes</label>
            <select value={mesKey} onChange={e=>{setMesKey(e.target.value);setCiudad("");}}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {[...meses].reverse().map(m=>(
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">🏙️ Ciudad</label>
            <select value={ciudad} onChange={e=>setCiudad(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              <option value="">— Selecciona una ciudad —</option>
              {ciudadesDisp.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {mesPrevMeta && ciudad && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                 style={{background:BRAND_GRADIENT}}>
              📊 Comparando vs <b className="ml-1">{mesPrevMeta.label}</b>
            </div>
          )}
        </div>
      </div>

      {/* Aviso si el mes fue subido antes del fix */}
      {!tieneCiudades && dataMes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-800 text-sm flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <b>Este mes fue procesado con una versión anterior.</b>
            <p className="mt-1">Ve a <b>⚙️ Configuración</b>, elimina <b>{dataMes.label}</b> y vuelve a subir el archivo Excel para activar el análisis por ciudad completo.</p>
          </div>
        </div>
      )}

      {!ciudad && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-10 text-center text-purple-600">
          <p className="text-3xl mb-3">🏙️</p>
          <p className="font-semibold">Selecciona una ciudad para ver el análisis detallado</p>
          <p className="text-sm text-purple-400 mt-1">Paquetes por localidad · Tipo de operación · Estado del booking</p>
        </div>
      )}

      {ciudad && cityData && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon="📦" label="Paquetes"    value={cityData.paquetes.toLocaleString()}   borderColor={PIBOX_PURPLE} delta={varPaq}/>
            <KpiCard icon="🚗" label="Servicios"   value={cityData.total.toLocaleString()}      borderColor={PIBOX_PINK}   delta={varSvc}/>
            <KpiCard icon="💰" label="GMV"         value={fmtFull(cityData.gmv)}               borderColor={PIBOX_PURPLE} delta={varGmv}/>
            <KpiCard icon="✅" label="Completado"  value={fmtPct(cityData.tasa_completado)}     borderColor={SEM_VERDE}
              delta={varTc}/>
          </div>

          {/* Comparativo KPIs vs mes anterior */}
          {cityPrev && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="font-bold text-gray-700 text-sm mb-3">
                📊 Comparativo {dataMes?.label} vs {mesPrevMeta?.label}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{background:PIBOX_PURPLE}} className="text-white">
                      {["Indicador", dataMes?.label, mesPrevMeta?.label, "Variación"].map(h=>(
                        <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {label:"📦 Paquetes",    curr:cityData.paquetes.toLocaleString(),       prev:cityPrev.paquetes.toLocaleString(),       delta:varPaq,  inv:false},
                      {label:"🚗 Servicios",   curr:cityData.total.toLocaleString(),           prev:cityPrev.total.toLocaleString(),           delta:varSvc,  inv:false},
                      {label:"💰 GMV",         curr:fmtFull(cityData.gmv),                    prev:fmtFull(cityPrev.gmv),                    delta:varGmv,  inv:false},
                      {label:"✅ Completado",  curr:fmtPct(cityData.tasa_completado),          prev:fmtPct(cityPrev.tasa_completado),          delta:varTc,   inv:false},
                      {label:"❌ Cancelación", curr:fmtPct(cityData.tasa_cancelacion),         prev:fmtPct(cityPrev.tasa_cancelacion),         delta:(cityPrev?cityData.tasa_cancelacion-cityPrev.tasa_cancelacion:null), inv:true},
                    ].map((r,i)=>{
                      const isPos = r.inv ? r.delta < 0 : r.delta > 0;
                      const dc = r.delta!==null ? (isPos?SEM_VERDE:SEM_ROJO) : "#9CA3AF";
                      return (
                        <tr key={i} className={i%2===0?"bg-white":"bg-purple-50/30"}>
                          <td className="px-4 py-2.5 font-medium text-gray-700">{r.label}</td>
                          <td className="px-4 py-2.5 font-bold text-gray-800">{r.curr}</td>
                          <td className="px-4 py-2.5 text-gray-500">{r.prev}</td>
                          <td className="px-4 py-2.5 font-bold" style={{color:dc}}>
                            {r.delta!==null ? `${r.delta>0?"▲":"▼"} ${Math.abs(r.delta*100).toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Paquetes por localidad */}
          {cityData.localidades?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="font-bold text-gray-700 text-sm mb-4">
                📍 Paquetes por localidad / sede
                {cityPrev && <span className="ml-2 text-xs font-normal text-gray-400">🟣 {dataMes?.label} · 🩷 {mesPrevMeta?.label}</span>}
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Gráfica */}
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={cityData.localidades.slice(0,12).map(l=>({
                      ...l,
                      paqPrev: cityPrev?.localidades?.find(p=>p.loc===l.loc)?.paquetes || 0,
                    }))}
                    layout="vertical" margin={{left:10,right:10,top:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" horizontal={false}/>
                    <XAxis type="number" tick={{fontSize:9}} tickFormatter={v=>v.toLocaleString()}/>
                    <YAxis type="category" dataKey="loc" tick={{fontSize:9}} width={120}/>
                    <Tooltip content={<TT/>}/>
                    <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                    <Bar dataKey="paquetes" name={dataMes?.label||"Actual"} fill={PIBOX_PURPLE} radius={[0,3,3,0]}/>
                    {cityPrev && <Bar dataKey="paqPrev" name={mesPrevMeta?.label} fill={PIBOX_PINK} radius={[0,3,3,0]} fillOpacity={0.6}/>}
                  </BarChart>
                </ResponsiveContainer>
                {/* Tabla */}
                <div className="overflow-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr style={{background:PIBOX_PURPLE}} className="text-white">
                        <th className="px-3 py-2 text-left">Localidad</th>
                        <th className="px-3 py-2 text-right">Paquetes</th>
                        <th className="px-3 py-2 text-right">Servicios</th>
                        <th className="px-3 py-2 text-right">Completado</th>
                        <th className="px-3 py-2 text-right">Cancelado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cityData.localidades.map((l,i)=>(
                        <tr key={i} className={i%2===0?"bg-white":"bg-purple-50/30"}>
                          <td className="px-3 py-1.5 max-w-[160px] truncate font-medium text-gray-700">{l.loc}</td>
                          <td className="px-3 py-1.5 text-right font-bold text-purple-700">{l.paquetes.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right">{l.total.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right font-semibold" style={{color:SEM_VERDE}}>{fmtPct(l.tasa_completado)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold" style={{color:SEM_ROJO}}>{fmtPct(l.tasa_cancelacion)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tipo de operación + Estado del booking */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Tipo de operación */}
            {cityData.ops?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                <h3 className="font-bold text-gray-700 text-sm mb-4">
                  ⚙️ Por tipo de operación
                  {cityPrev && <span className="ml-2 text-xs font-normal text-gray-400">🟣 vs 🩷 mes anterior</span>}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={cityData.ops.map(o=>({
                      ...o,
                      totalPrev: cityPrev?.ops?.find(p=>p.op===o.op)?.total || 0,
                      paqPrev:   cityPrev?.ops?.find(p=>p.op===o.op)?.paquetes || 0,
                    }))}
                    margin={{top:0,right:8,left:0,bottom:40}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                    <XAxis dataKey="op" tick={{fontSize:9}} angle={-30} textAnchor="end" height={50}/>
                    <YAxis tick={{fontSize:9}}/>
                    <Tooltip content={<TT/>}/>
                    <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                    <Bar dataKey="paquetes" name={`Paquetes ${dataMes?.label||""}`} fill={PIBOX_PURPLE} radius={[3,3,0,0]}/>
                    {cityPrev && <Bar dataKey="paqPrev" name={`Paquetes ${mesPrevMeta?.label||""}`} fill={PIBOX_PINK} radius={[3,3,0,0]} fillOpacity={0.6}/>}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Estado del booking */}
            {cityData.estados?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                <h3 className="font-bold text-gray-700 text-sm mb-4">
                  📋 Por estado del booking
                  {cityPrev && <span className="ml-2 text-xs font-normal text-gray-400">🟣 vs 🩷 mes anterior</span>}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={cityData.estados.map(e=>({
                      ...e,
                      totalPrev: cityPrev?.estados?.find(p=>p.estado===e.estado)?.total || 0,
                    }))}
                    margin={{top:0,right:8,left:0,bottom:40}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                    <XAxis dataKey="estado" tick={{fontSize:9}} angle={-30} textAnchor="end" height={50}/>
                    <YAxis tick={{fontSize:9}}/>
                    <Tooltip content={<TT/>}/>
                    <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                    <Bar dataKey="total" name={dataMes?.label||"Actual"} radius={[3,3,0,0]}>
                      {cityData.estados.map((e,i)=>(
                        <Cell key={i} fill={STATUS_COLORS[e.estado]||COLORS[i%COLORS.length]}/>
                      ))}
                    </Bar>
                    {cityPrev && <Bar dataKey="totalPrev" name={mesPrevMeta?.label} fill={PIBOX_PINK} radius={[3,3,0,0]} fillOpacity={0.55}/>}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Evolución semanal de la ciudad */}
          {cityData.weekly?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-700 text-sm">📈 Evolución semanal en {ciudad}</h3>
                {mesPrevMeta && (
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:PIBOX_PURPLE}}></span>{dataMes?.label}</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block opacity-60" style={{background:PIBOX_PINK}}></span>{mesPrevMeta.label}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-2">Paquetes por semana</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={cityData.weekly.map((w,i)=>({
                        ...w, paqPrev: cityPrev?.weekly?.[i]?.paquetes ?? null,
                      }))}>
                      <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={42}/>
                      <YAxis tick={{fontSize:9}}/>
                      <Tooltip/>
                      <Legend iconSize={7} wrapperStyle={{fontSize:9}}/>
                      <Bar dataKey="paquetes" name={dataMes?.label||"Actual"} fill={PIBOX_PURPLE} radius={[3,3,0,0]}/>
                      {cityPrev && <Bar dataKey="paqPrev" name={mesPrevMeta?.label} fill={PIBOX_PINK} radius={[3,3,0,0]} fillOpacity={0.6}/>}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-2">Servicios por semana</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={cityData.weekly.map((w,i)=>({
                        ...w, svcPrev: cityPrev?.weekly?.[i]?.servicios ?? null,
                      }))}>
                      <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={42}/>
                      <YAxis tick={{fontSize:9}}/>
                      <Tooltip/>
                      <Legend iconSize={7} wrapperStyle={{fontSize:9}}/>
                      <Bar dataKey="servicios" name={dataMes?.label||"Actual"} fill={PIBOX_PURPLE} radius={[3,3,0,0]}/>
                      {cityPrev && <Bar dataKey="svcPrev" name={mesPrevMeta?.label} fill={PIBOX_PINK} radius={[3,3,0,0]} fillOpacity={0.6}/>}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-2">% Completado / Cancelación</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={cityData.weekly.map((w,i)=>({
                        ...w,
                        tc_prev:   cityPrev?.weekly?.[i]?.tasa_completado  ?? null,
                        canc_prev: cityPrev?.weekly?.[i]?.tasa_cancelacion ?? null,
                      }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                      <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={42}/>
                      <YAxis tick={{fontSize:9}} tickFormatter={v=>`${(v*100).toFixed(0)}%`}/>
                      <Tooltip formatter={v=>fmtPct(v)}/>
                      <Legend iconSize={7} wrapperStyle={{fontSize:9}}/>
                      <Line dataKey="tasa_completado"  name="Completado"           stroke={SEM_VERDE} strokeWidth={2} dot={{r:3}}/>
                      <Line dataKey="tasa_cancelacion" name="Cancelación"          stroke={SEM_ROJO}  strokeWidth={2} dot={{r:3}} strokeDasharray="5 3"/>
                      {cityPrev && <Line dataKey="tc_prev"   name="Completado (prev)"  stroke={SEM_VERDE} strokeWidth={1.5} dot={{r:2}} strokeDasharray="3 3" strokeOpacity={0.5}/>}
                      {cityPrev && <Line dataKey="canc_prev" name="Cancelación (prev)" stroke={SEM_ROJO}  strokeWidth={1.5} dot={{r:2}} strokeDasharray="3 3" strokeOpacity={0.5}/>}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Drivers activos por tipo de operación */}
          {cityData.driversPorOp?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <div className="flex flex-wrap items-center justify-between mb-4">
                <h3 className="font-bold text-gray-700 text-sm">🏍️ Drivers Activos por Tipo de Operación — {ciudad}</h3>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold text-white" style={{background:BRAND_GRADIENT}}>
                  Total: {(cityData.totalDrivers || 0).toLocaleString()} drivers
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{background:PIBOX_PURPLE}} className="text-white">
                        <th className="px-3 py-2.5 text-left font-semibold">Tipo de Operación</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Drivers</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Servicios</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Prom/Driver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cityData.driversPorOp.map((d, i) => {
                        const prevOp = cityPrev?.driversPorOp?.find(p => p.op === d.op);
                        const varD = prevOp?.driversActivos > 0 ? ((d.driversActivos - prevOp.driversActivos) / prevOp.driversActivos * 100) : null;
                        return (
                          <tr key={d.op} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-purple-50/30"} hover:bg-purple-50`}>
                            <td className="px-3 py-2 font-semibold text-gray-800">{d.op}</td>
                            <td className="px-3 py-2 text-right">
                              <span className="font-bold text-purple-700">{d.driversActivos.toLocaleString()}</span>
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
                        <td className="px-3 py-2 text-right text-purple-800">{(cityData.totalDrivers || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{cityData.driversPorOp.reduce((s, d) => s + d.servicios, 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                            {(cityData.totalDrivers || 0) > 0 ? Math.round(cityData.driversPorOp.reduce((s, d) => s + d.servicios, 0) / cityData.totalDrivers) : 0}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <ResponsiveContainer width="100%" height={Math.max(180, cityData.driversPorOp.length * 40)}>
                  <BarChart data={cityData.driversPorOp} layout="vertical" margin={{left:5,right:10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                    <XAxis type="number" tick={{fontSize:9}}/>
                    <YAxis type="category" dataKey="op" tick={{fontSize:9}} width={90}/>
                    <Tooltip formatter={(v,n) => [v.toLocaleString(), n]}/>
                    <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                    <Bar dataKey="driversActivos" name="Drivers Activos" fill={PIBOX_PURPLE} radius={[0,4,4,0]}/>
                    <Bar dataKey="promServPorDriver" name="Prom. Serv/Driver" fill={PIBOX_PINK} radius={[0,4,4,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
