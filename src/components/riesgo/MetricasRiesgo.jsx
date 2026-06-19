import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import {
  loadMesData, mesesDisponibles, calcularScore, fmtM, fmtPct, fmtFull,
  PIBOX_PURPLE, PIBOX_PINK, SEM_ROJO, SEM_AMARILLO, SEM_VERDE,
  UMBRALES_DEFAULT,
} from "./utils";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const COLORS = [PIBOX_PURPLE, PIBOX_PINK, "#A855F7","#6366F1","#EC4899","#8B5CF6"];

function getUmbrales() {
  try { return {...UMBRALES_DEFAULT, ...JSON.parse(localStorage.getItem("pibox_riesgo_umbrales")||"{}")}; }
  catch { return UMBRALES_DEFAULT; }
}

// ── Tooltip custom ────────────────────────────────────────────────────────────
const TT = ({active,payload,label,fmt}) => {
  if (!active||!payload?.length) return null;
  return (
    <div className="bg-white border border-purple-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-purple-700 mb-1">{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color}}>{p.name}: {fmt?fmt(p.value):p.value?.toLocaleString()}</p>
      ))}
    </div>
  );
};

// ── KPI Card con delta ────────────────────────────────────────────────────────
function KpiCard({icon,label,value,borderColor,delta,deltaLabel,invertDelta}) {
  // delta: número decimal (ej 0.078 = +7.8%) o null
  const showDelta = delta !== null && delta !== undefined;
  const isPositive = invertDelta ? delta < 0 : delta > 0;
  const deltaColor = showDelta ? (isPositive ? SEM_VERDE : SEM_ROJO) : "#9CA3AF";
  const deltaArrow = showDelta ? (delta > 0 ? "▲" : "▼") : "";
  const deltaText  = showDelta
    ? `${deltaArrow} ${Math.abs(delta*100).toFixed(1)}% vs mes ant.`
    : deltaLabel || "Sin mes anterior";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-w-0"
         style={{borderLeft:`4px solid ${borderColor||PIBOX_PURPLE}`}}>
      <p className="text-xs text-gray-500 uppercase tracking-wide whitespace-nowrap">{icon} {label}</p>
      <p className="text-xl font-extrabold mt-1 truncate" style={{color:borderColor||PIBOX_PURPLE}} title={value}>{value}</p>
      <p className="text-xs font-semibold mt-1 whitespace-nowrap" style={{color:deltaColor}}>{deltaText}</p>
    </div>
  );
}

// ── Semáforo badge ────────────────────────────────────────────────────────────
function SemBadge({color,label}) {
  const c = color==="rojo"?SEM_ROJO:color==="amarillo"?SEM_AMARILLO:SEM_VERDE;
  return (
    <span className="inline-block px-3 py-0.5 rounded-full text-white text-xs font-bold"
          style={{background:c}}>{label}</span>
  );
}

export default function MetricasRiesgo() {
  const meses       = mesesDisponibles();
  const umb         = getUmbrales();

  const [mesKey, setMesKey]           = useState(meses[meses.length-1]?.key || "");

  // Mes anterior automático
  const idxActual   = meses.findIndex(m=>m.key===mesKey);
  const mesPrevMeta = idxActual > 0 ? meses[idxActual-1] : null;

  const dataMes  = useMemo(()=> mesKey ? loadMesData(mesKey)   : null, [mesKey]);
  const dataPrev = useMemo(()=> mesPrevMeta ? loadMesData(mesPrevMeta.key) : null, [mesPrevMeta]);

  const empresasConScore = useMemo(()=>{
    if (!dataMes) return [];
    const ORDER = { rojo: 0, amarillo: 1, verde: 2 };
    return dataMes.empresas.map(e => {
      const prev = dataPrev?.empresas?.find(p=>p.empresa===e.empresa);
      return { ...e, ...calcularScore(e, prev||null, umb) };
    }).sort((a,b) => {
      // 1º prioridad: nivel de riesgo (rojo → amarillo → verde)
      const riskDiff = ORDER[a.color] - ORDER[b.color];
      if (riskDiff !== 0) return riskDiff;
      // 2º prioridad: GMV más alto primero dentro del mismo nivel
      return b.gmv - a.gmv;
    });
  }, [dataMes, dataPrev, umb]);


  if (!meses.length) return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800 text-sm">
      <b>Sin datos.</b> Ve a <b>⚙️ Configuración</b> y sube al menos un mes.
    </div>
  );

  // ── Totales del mes ───────────────────────────────────────────────────────
  const tot       = dataMes?.totales;
  const nRojo     = empresasConScore.filter(e=>e.color==="rojo").length;
  const nAmarillo = empresasConScore.filter(e=>e.color==="amarillo").length;
  const nVerde    = empresasConScore.filter(e=>e.color==="verde").length;
  const gmvTotal  = empresasConScore.reduce((s,e)=>s+e.gmv, 0);
  const tcGlobal  = empresasConScore.reduce((s,e)=>s+e.completados,0) /
                    Math.max(empresasConScore.reduce((s,e)=>s+e.total,0),1);

  // ── Totales mes anterior ─────────────────────────────────────────────────
  const empPrevAll    = dataPrev?.empresas || [];
  const gmvPrevTotal  = empPrevAll.reduce((s,e)=>s+e.gmv,0);
  const totPrevSvc    = empPrevAll.reduce((s,e)=>s+e.total,0);
  const compPrevSvc   = empPrevAll.reduce((s,e)=>s+e.completados,0);
  const tcPrev        = totPrevSvc > 0 ? compPrevSvc/totPrevSvc : null;
  const nEmpPrev      = empPrevAll.length;
  const nRojoPrev     = empPrevAll.filter(e=>calcularScore(e,null,umb).color==="rojo").length;

  // Servicios, paquetes, drivers actuales
  const totalServicios = empresasConScore.reduce((s,e)=>s+e.total, 0);
  const totalPaquetes  = empresasConScore.reduce((s,e)=>s+(e.paquetes||0), 0);
  const totalDrivers   = tot?.totalDriversActivos || 0;

  // Mes anterior
  const totalServPrev   = empPrevAll.reduce((s,e)=>s+e.total, 0);
  const totalPaqPrev    = empPrevAll.reduce((s,e)=>s+(e.paquetes||0), 0);
  const totalDriversPrev = dataPrev?.totales?.totalDriversActivos || 0;

  const varGmv     = gmvPrevTotal  > 0 ? (gmvTotal - gmvPrevTotal)/gmvPrevTotal  : null;
  const varEmp     = nEmpPrev      > 0 ? (empresasConScore.length - nEmpPrev)/nEmpPrev : null;
  const varRojo    = nRojoPrev     > 0 ? (nRojo - nRojoPrev)/nRojoPrev            : null;
  const varTc      = tcPrev !== null   ? tcGlobal - tcPrev                         : null;
  const varServ    = totalServPrev > 0 ? (totalServicios - totalServPrev)/totalServPrev : null;
  const varPaq     = totalPaqPrev  > 0 ? (totalPaquetes - totalPaqPrev)/totalPaqPrev   : null;
  const varDrivers = totalDriversPrev > 0 ? (totalDrivers - totalDriversPrev)/totalDriversPrev : null;

  return (
    <div className="space-y-6">
      {/* Selección de mes */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">📅 Mes a analizar</label>
            <select value={mesKey} onChange={e=>{setMesKey(e.target.value);setEmpresaSel(null);}}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {[...meses].reverse().map(m=>(
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          {mesPrevMeta && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                 style={{background:BRAND_GRADIENT}}>
              📊 Comparando vs <b className="ml-1">{mesPrevMeta.label}</b>
              {varGmv !== null && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-white/20`}>
                  {varGmv>=0?"▲":"▼"} GMV {Math.abs(varGmv*100).toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPIs globales — fila 1: operacionales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard icon="🏢" label="Empresas"       value={empresasConScore.length.toLocaleString()} borderColor={PIBOX_PURPLE} delta={varEmp}/>
        <KpiCard icon="💰" label="GMV Total"       value={fmtFull(gmvTotal)} borderColor={PIBOX_PURPLE} delta={varGmv}/>
        <KpiCard icon="📦" label="Servicios"       value={totalServicios.toLocaleString()} borderColor="#6366F1" delta={varServ}/>
        <KpiCard icon="📮" label="Paquetes"        value={totalPaquetes.toLocaleString()} borderColor="#0EA5E9" delta={varPaq}/>
        <KpiCard icon="🏍️" label="Drivers Activos" value={totalDrivers.toLocaleString()} borderColor="#F59E0B" delta={varDrivers}/>
      </div>

      {/* KPIs riesgo + gráfica distribución alineados */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* 3 cards de riesgo */}
        <div className="space-y-3">
          <KpiCard icon="🔴" label="Riesgo crítico" value={nRojo}     borderColor={SEM_ROJO}     delta={varRojo}  invertDelta/>
          <KpiCard icon="🟡" label="Riesgo medio"   value={nAmarillo} borderColor={SEM_AMARILLO} delta={null} deltaLabel={mesPrevMeta ? `Prev: ${empPrevAll.filter(e=>calcularScore(e,null,umb).color==="amarillo").length}` : "Sin mes anterior"}/>
          <KpiCard icon="🟢" label="Saludables"     value={nVerde}    borderColor={SEM_VERDE}    delta={null} deltaLabel={mesPrevMeta ? `Prev: ${empPrevAll.filter(e=>calcularScore(e,null,umb).color==="verde").length}` : "Sin mes anterior"}/>
        </div>

        {/* Dona semáforo alineada */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-3">Distribución de riesgo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={[
                  {name:"🔴 Rojo",    value:nRojo,     fill:SEM_ROJO},
                  {name:"🟡 Amarillo",value:nAmarillo,  fill:SEM_AMARILLO},
                  {name:"🟢 Verde",   value:nVerde,     fill:SEM_VERDE},
                ]} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                dataKey="value" label={({name,percent})=>`${(percent*100).toFixed(0)}%`}
                labelLine={false}>
                {[SEM_ROJO,SEM_AMARILLO,SEM_VERDE].map((c,i)=><Cell key={i} fill={c}/>)}
              </Pie>
              <Tooltip formatter={(v,n)=>[v,n]}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:SEM_ROJO}}/> {nRojo}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:SEM_AMARILLO}}/> {nAmarillo}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:SEM_VERDE}}/> {nVerde}</span>
          </div>
        </div>

        {/* GMV por ciudad */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 lg:col-span-2 min-w-0">
          <h3 className="font-bold text-gray-700 text-sm mb-1">💰 GMV por ciudad (top 10)</h3>
          {mesPrevMeta && <p className="text-xs text-gray-400 mb-3">🟣 {dataMes?.label} · 🩷 {mesPrevMeta.label}</p>}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={(() => {
                const top = tot?.topCiudades?.slice(0,10) || [];
                const prevCiudades = dataPrev?.totales?.topCiudades || [];
                return top.map(c => ({
                  ...c,
                  gmvPrev: prevCiudades.find(p=>p.city===c.city)?.gmv || 0,
                }));
              })()}
              margin={{top:0,right:0,left:0,bottom:30}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
              <XAxis dataKey="city" tick={{fontSize:10}} angle={-35} textAnchor="end" interval={0}/>
              <YAxis tick={{fontSize:10}} tickFormatter={v=>fmtM(v)}/>
              <Tooltip formatter={v=>fmtFull(v)}/>
              <Legend iconSize={8} wrapperStyle={{fontSize:10,paddingTop:8}}/>
              <Bar dataKey="gmv"     name={dataMes?.label||"Actual"}        fill={PIBOX_PURPLE} radius={[4,4,0,0]}/>
              {mesPrevMeta && <Bar dataKey="gmvPrev" name={mesPrevMeta.label} fill={PIBOX_PINK}   radius={[4,4,0,0]} fillOpacity={0.6}/>}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Servicios y Paquetes por ciudad (top 10) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Servicios por ciudad */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-1">📦 Servicios por ciudad (top 10)</h3>
          {mesPrevMeta && <p className="text-xs text-gray-400 mb-3">🟣 {dataMes?.label} · 🩷 {mesPrevMeta.label}</p>}
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={(() => {
                const top = [...(tot?.topCiudades || [])].sort((a,b) => b.servicios - a.servicios).slice(0,10);
                const prevCiudades = dataPrev?.totales?.topCiudades || [];
                return top.map(c => ({
                  ...c,
                  serviciosPrev: prevCiudades.find(p=>p.city===c.city)?.servicios || 0,
                }));
              })()}
              margin={{top:0,right:0,left:0,bottom:30}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
              <XAxis dataKey="city" tick={{fontSize:9}} angle={-35} textAnchor="end" interval={0}/>
              <YAxis tick={{fontSize:9}}/>
              <Tooltip formatter={v=>[v.toLocaleString()]}/>
              <Legend iconSize={8} wrapperStyle={{fontSize:9,paddingTop:8}}/>
              <Bar dataKey="servicios" name={dataMes?.label||"Actual"} fill={PIBOX_PURPLE} radius={[4,4,0,0]}/>
              {mesPrevMeta && <Bar dataKey="serviciosPrev" name={mesPrevMeta.label} fill={PIBOX_PINK} radius={[4,4,0,0]} fillOpacity={0.6}/>}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Paquetes por ciudad */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-1">📮 Paquetes por ciudad (top 10)</h3>
          {mesPrevMeta && <p className="text-xs text-gray-400 mb-3">🟣 {dataMes?.label} · 🩷 {mesPrevMeta.label}</p>}
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={(() => {
                const top = [...(tot?.topCiudades || [])].sort((a,b) => b.paquetes - a.paquetes).slice(0,10);
                const prevCiudades = dataPrev?.totales?.topCiudades || [];
                return top.map(c => ({
                  ...c,
                  paquetesPrev: prevCiudades.find(p=>p.city===c.city)?.paquetes || 0,
                }));
              })()}
              margin={{top:0,right:0,left:0,bottom:30}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
              <XAxis dataKey="city" tick={{fontSize:9}} angle={-35} textAnchor="end" interval={0}/>
              <YAxis tick={{fontSize:9}}/>
              <Tooltip formatter={v=>[v.toLocaleString()]}/>
              <Legend iconSize={8} wrapperStyle={{fontSize:9,paddingTop:8}}/>
              <Bar dataKey="paquetes" name={dataMes?.label||"Actual"} fill="#6366F1" radius={[4,4,0,0]}/>
              {mesPrevMeta && <Bar dataKey="paquetesPrev" name={mesPrevMeta.label} fill={PIBOX_PINK} radius={[4,4,0,0]} fillOpacity={0.6}/>}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tipo de Operación, Estado del Servicio, Tipo de Vehículo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tipo de Operación */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-3">🔧 Tipo de Operación</h3>
          {(tot?.porTipoOp?.length > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={tot.porTipoOp} dataKey="total" nameKey="name"
                  cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                  label={({name,percent})=>`${name.split(" ")[0]} ${(percent*100).toFixed(0)}%`}
                  labelLine={false}>
                  {tot.porTipoOp.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v,n)=>[v.toLocaleString()+" servicios",n]}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>}
          {tot?.porTipoOp?.length > 0 && (
            <div className="mt-2 space-y-1">
              {tot.porTipoOp.slice(0,5).map((d,i)=>(
                <div key={d.name} className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:COLORS[i%COLORS.length]}}/>
                    <span className="text-gray-600 truncate max-w-[120px]">{d.name}</span>
                  </span>
                  <span className="font-semibold text-gray-700">{d.total.toLocaleString()} <span className="text-gray-400 font-normal">({fmtM(d.gmv)})</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estado del Servicio — comparativo vs mes anterior */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-1">📋 Estado del Servicio</h3>
          {mesPrevMeta && <p className="text-xs text-gray-400 mb-3">🟣 {dataMes?.label} · 🩷 {mesPrevMeta.label}</p>}
          {(tot?.porStatus?.length > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={(() => {
                    const prevStatus = dataPrev?.totales?.porStatus || [];
                    return tot.porStatus.slice(0,8).map(d => ({
                      ...d,
                      totalPrev: prevStatus.find(p => p.name === d.name)?.total || 0,
                    }));
                  })()}
                  layout="vertical" margin={{left:5,right:5}}>
                  <XAxis type="number" tick={{fontSize:9}} tickFormatter={v=>v.toLocaleString()}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:9}} width={80}/>
                  <Tooltip formatter={(v)=>[v.toLocaleString()+" servicios"]}/>
                  <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                  <Bar dataKey="total" name={dataMes?.label||"Actual"} radius={[0,4,4,0]}>
                    {tot.porStatus.slice(0,8).map((d,i)=>{
                      const c = d.name==="Completed"?SEM_VERDE:d.name.startsWith("Canceled")?SEM_ROJO:d.name==="Expired"?SEM_AMARILLO:COLORS[i%COLORS.length];
                      return <Cell key={i} fill={c}/>;
                    })}
                  </Bar>
                  {mesPrevMeta && <Bar dataKey="totalPrev" name={mesPrevMeta.label} fill={PIBOX_PINK} fillOpacity={0.45} radius={[0,4,4,0]}/>}
                </BarChart>
              </ResponsiveContainer>
              {/* Tabla comparativa debajo */}
              <div className="mt-3 space-y-1">
                {tot.porStatus.slice(0,6).map(d => {
                  const prev = (dataPrev?.totales?.porStatus || []).find(p => p.name === d.name);
                  const prevTotal = prev?.total || 0;
                  const varPct = prevTotal > 0 ? ((d.total - prevTotal) / prevTotal * 100) : 0;
                  const c = d.name==="Completed"?SEM_VERDE:d.name.startsWith("Canceled")?SEM_ROJO:d.name==="Expired"?SEM_AMARILLO:"#6b7280";
                  return (
                    <div key={d.name} className="flex justify-between text-xs items-center">
                      <span className="text-gray-600 truncate max-w-[100px]" style={{color:c}}>{d.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">{d.total.toLocaleString()}</span>
                        {prevTotal > 0 && (
                          <span className={`text-xs font-bold ${varPct >= 0 ? (d.name==="Completed"?"text-green-600":"text-red-500") : (d.name==="Completed"?"text-red-500":"text-green-600")}`}>
                            {varPct >= 0 ? "▲" : "▼"} {Math.abs(varPct).toFixed(1)}%
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>}
        </div>

        {/* Tipo de Vehículo */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-3">🚗 Tipo de Vehículo</h3>
          {(tot?.porVehiculo?.length > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={tot.porVehiculo} dataKey="total" nameKey="name"
                  cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                  label={({name,percent})=>`${name.split(" ")[0]} ${(percent*100).toFixed(0)}%`}
                  labelLine={false}>
                  {tot.porVehiculo.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v,n)=>[v.toLocaleString()+" servicios",n]}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>}
          {tot?.porVehiculo?.length > 0 && (
            <div className="mt-2 space-y-1">
              {tot.porVehiculo.slice(0,5).map((d,i)=>(
                <div key={d.name} className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:COLORS[i%COLORS.length]}}/>
                    <span className="text-gray-600 truncate max-w-[120px]">{d.name}</span>
                  </span>
                  <span className="font-semibold text-gray-700">{d.total.toLocaleString()} <span className="text-gray-400 font-normal">({fmtM(d.gmv)})</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drivers activos por tipo de operación */}
      {tot?.driversPorTipoOp?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 text-sm">🏍️ Drivers Activos por Tipo de Operación</h3>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold" style={{background:BRAND_GRADIENT,color:"#fff"}}>
              Total: {tot.totalDriversActivos.toLocaleString()} drivers únicos
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{background:PIBOX_PURPLE}} className="text-white">
                    <th className="px-3 py-2.5 text-left font-semibold">Tipo de Operación</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Drivers Activos</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Servicios</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Prom. Serv/Driver</th>
                  </tr>
                </thead>
                <tbody>
                  {tot.driversPorTipoOp.map((d, i) => (
                    <tr key={d.op} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-purple-50/30"} hover:bg-purple-50`}>
                      <td className="px-3 py-2 font-semibold text-gray-800">{d.op}</td>
                      <td className="px-3 py-2 text-right font-bold text-purple-700">{d.driversActivos.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{d.servicios.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">{d.promServPorDriver}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-purple-300 bg-purple-50 font-bold">
                    <td className="px-3 py-2 text-purple-800">TOTAL</td>
                    <td className="px-3 py-2 text-right text-purple-800">{tot.totalDriversActivos.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{tot.driversPorTipoOp.reduce((s, d) => s + d.servicios, 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                        {tot.totalDriversActivos > 0 ? Math.round(tot.driversPorTipoOp.reduce((s, d) => s + d.servicios, 0) / tot.totalDriversActivos) : 0}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Gráfico */}
            <ResponsiveContainer width="100%" height={Math.max(200, tot.driversPorTipoOp.length * 40)}>
              <BarChart data={tot.driversPorTipoOp} layout="vertical" margin={{left:5,right:10}}>
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

      {/* Cumplimiento por rango de distancia (agregado global) */}
      {(() => {
        const distMap = { "0-3 km": 0, "3-5 km": 0, "5-10 km": 0, "Mas de 10 km": 0 };
        const distTimes = {};
        let totalRelaunch = 0;
        for (const e of empresasConScore) {
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
        const hasData = totalBookings > 0;
        const empWithRelaunch = empresasConScore.filter(e => (e.relanzamientos || 0) > 0).sort((a, b) => (b.relanzamientos || 0) - (a.relanzamientos || 0));

        return hasData ? (
          <>
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="font-bold text-gray-700 text-sm mb-4">📏 Cumplimiento por rango de distancia</h3>
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

            {/* Relanzamientos por empresa */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="font-bold text-gray-700 text-sm mb-1">🔄 Distribucion de relanzamientos</h3>
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
                    ) : empWithRelaunch.map((c,i)=>(
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
            </div>
          </>
        ) : null;
      })()}

      {/* Evolución semanal */}
      {tot?.weekly?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 text-sm">📈 Evolución semanal</h3>
            {mesPrevMeta && (
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:PIBOX_PURPLE}}></span>{dataMes?.label}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:PIBOX_PINK,opacity:0.6}}></span>{mesPrevMeta.label}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-2 font-semibold">GMV por semana</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={tot.weekly.map((w,i)=>({
                    ...w,
                    gmvPrev: dataPrev?.totales?.weekly?.[i]?.gmv ?? null,
                  }))} margin={{right:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                  <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={45}/>
                  <YAxis tick={{fontSize:9}} tickFormatter={fmtM}/>
                  <Tooltip formatter={v=>fmtFull(v)}/>
                  <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                  <Bar dataKey="gmv"     name={dataMes?.label||"Actual"}        fill={PIBOX_PURPLE} radius={[3,3,0,0]}/>
                  {mesPrevMeta && <Bar dataKey="gmvPrev" name={mesPrevMeta.label} fill={PIBOX_PINK}   radius={[3,3,0,0]} fillOpacity={0.55}/>}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2 font-semibold">Servicios por semana</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={tot.weekly.map((w,i)=>({
                    ...w,
                    serviciosPrev: dataPrev?.totales?.weekly?.[i]?.servicios ?? null,
                  }))} margin={{right:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                  <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={45}/>
                  <YAxis tick={{fontSize:9}}/>
                  <Tooltip/>
                  <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                  <Bar dataKey="servicios"     name={dataMes?.label||"Actual"}        fill={PIBOX_PURPLE} radius={[3,3,0,0]}/>
                  {mesPrevMeta && <Bar dataKey="serviciosPrev" name={mesPrevMeta.label} fill={PIBOX_PINK}   radius={[3,3,0,0]} fillOpacity={0.55}/>}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2 font-semibold">% Completado / Cancelación</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={tot.weekly.map((w,i)=>({
                    ...w,
                    tc_prev:   dataPrev?.totales?.weekly?.[i]?.tasa_completado  ?? null,
                    canc_prev: dataPrev?.totales?.weekly?.[i]?.tasa_cancelacion ?? null,
                  }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                  <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={45}/>
                  <YAxis tick={{fontSize:9}} tickFormatter={v=>`${(v*100).toFixed(0)}%`}/>
                  <Tooltip formatter={v=>fmtPct(v)}/>
                  <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                  <Line dataKey="tasa_completado"  name="Completado"           stroke={SEM_VERDE} strokeWidth={2} dot={{r:3}}/>
                  <Line dataKey="tasa_cancelacion" name="Cancelación"          stroke={SEM_ROJO}  strokeWidth={2} dot={{r:3}} strokeDasharray="5 3"/>
                  {mesPrevMeta && <Line dataKey="tc_prev"   name="Completado (prev)"   stroke={SEM_VERDE} strokeWidth={1.5} dot={{r:2}} strokeDasharray="3 3" strokeOpacity={0.5}/>}
                  {mesPrevMeta && <Line dataKey="canc_prev" name="Cancelación (prev)"  stroke={SEM_ROJO}  strokeWidth={1.5} dot={{r:2}} strokeDasharray="3 3" strokeOpacity={0.5}/>}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Drill-down ────────────────────────────────────────────────────────────────
function DrillDown({ empresa, mesLabel }) {
  const c = empresa.color==="rojo"?SEM_ROJO:empresa.color==="amarillo"?SEM_AMARILLO:SEM_VERDE;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6"
         style={{borderLeft:`5px solid ${c}`}}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-extrabold text-gray-800">{empresa.empresa}</h3>
          <p className="text-sm text-gray-500">
            {empresa.semaforo} · Score <b style={{color:c}}>{empresa.score}/100</b>
            {" · "}{empresa.ejecutivo} · {empresa.ciudad}
          </p>
          {empresa.factores.length > 0 && (
            <div className="mt-2 bg-red-50 text-red-700 text-xs px-3 py-1.5 rounded-lg inline-block">
              ⚠️ {empresa.factores.join(" · ")}
            </div>
          )}
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          {icon:"📦",label:"Servicios",  val:empresa.total.toLocaleString(), col:PIBOX_PURPLE},
          {icon:"✅",label:"Completado", val:fmtPct(empresa.tasa_completado),  col:SEM_VERDE},
          {icon:"❌",label:"Cancelación",val:fmtPct(empresa.tasa_cancelacion), col:SEM_ROJO},
          {icon:"⏱️",label:"Expirados",  val:fmtPct(empresa.tasa_expirado),    col:SEM_AMARILLO},
          {icon:"💰",label:"GMV",         val:fmtFull(empresa.gmv),            col:PIBOX_PURPLE},
        ].map(k=>(
          <div key={k.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100"
               style={{borderLeft:`3px solid ${k.col}`}}>
            <p className="text-xs text-gray-500">{k.icon} {k.label}</p>
            <p className="font-bold text-base mt-0.5" style={{color:k.col}}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Gráficas */}
      {empresa.weekly?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-2">GMV semanal</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={empresa.weekly}>
                <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={45}/>
                <YAxis tick={{fontSize:9}} tickFormatter={fmtM}/>
                <Tooltip content={<TT fmt={fmtFull}/>}/>
                <Bar dataKey="gmv" name="GMV" fill={PIBOX_PURPLE} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-2">Servicios semanales</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={empresa.weekly}>
                <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={45}/>
                <YAxis tick={{fontSize:9}}/>
                <Tooltip content={<TT/>}/>
                <Bar dataKey="servicios" name="Servicios" fill={PIBOX_PINK} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-2">% Completado / Cancelación</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={empresa.weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={45}/>
                <YAxis tick={{fontSize:9}} tickFormatter={v=>`${(v*100).toFixed(0)}%`}/>
                <Tooltip formatter={v=>fmtPct(v)}/>
                <Legend iconSize={7} wrapperStyle={{fontSize:9}}/>
                <Line dataKey="tasa_completado"  name="Completado"  stroke={SEM_VERDE} strokeWidth={2} dot={{r:2}}/>
                <Line dataKey="tasa_cancelacion" name="Cancelación" stroke={SEM_ROJO}  strokeWidth={2} dot={{r:2}} strokeDasharray="4 2"/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ciudad y tipo op */}
      {empresa.topCiudades?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-2">GMV por ciudad</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={empresa.topCiudades.slice(0,6)} layout="vertical" margin={{left:60,right:0,top:0,bottom:0}}>
                <XAxis type="number" tick={{fontSize:9}} tickFormatter={fmtM}/>
                <YAxis type="category" dataKey="city" tick={{fontSize:9}} width={56}/>
                <Tooltip content={<TT fmt={fmtFull}/>}/>
                <Bar dataKey="gmv" name="GMV" fill={PIBOX_PURPLE} radius={[0,3,3,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-2">Tipo de operación</p>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={empresa.topOps} dataKey="count" nameKey="op"
                  cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                  label={({op,percent})=>`${op.split(" ")[0]} ${(percent*100).toFixed(0)}%`}
                  labelLine={false}>
                  {empresa.topOps.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v,n)=>[v,n]}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
