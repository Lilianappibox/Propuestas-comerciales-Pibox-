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
  const [filtroSem, setFiltroSem]     = useState("Todos");
  const [filtroKam, setFiltroKam]     = useState("Todos");
  const [filtroFactor, setFiltroFactor] = useState("Todos");
  const [busca, setBusca]             = useState("");
  const [empresaSel, setEmpresaSel]   = useState(null);

  // Mes anterior automático
  const idxActual   = meses.findIndex(m=>m.key===mesKey);
  const mesPrevMeta = idxActual > 0 ? meses[idxActual-1] : null;

  const dataMes  = useMemo(()=> mesKey ? loadMesData(mesKey) : null, [mesKey]);
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

  // Lista dinámica de ejecutivos
  const kamsDisponibles = useMemo(()=>{
    const set = new Set(empresasConScore.map(e=>e.ejecutivo).filter(Boolean));
    return ["Todos", ...Array.from(set).sort()];
  }, [empresasConScore]);

  // Catálogo fijo de factores de riesgo posibles
  const FACTORES_CATALOGO = [
    { key:"Todos",                label:"⚠️ Todos los factores" },
    { key:"Completado bajo",      label:"📉 Completado bajo"       },
    { key:"Completado moderado",  label:"📊 Completado moderado"   },
    { key:"Cancelaciones altas",  label:"❌ Cancelaciones altas"   },
    { key:"Cancelaciones moderadas", label:"⚠️ Cancelaciones moderadas" },
    { key:"Expirados altos",      label:"⏱️ Expirados altos"       },
    { key:"Expirados moderados",  label:"⏱️ Expirados moderados"   },
    { key:"GMV cayó",             label:"💸 GMV cayó"              },
    { key:"GMV bajó",             label:"📉 GMV bajó"              },
    { key:"GMV = $0",             label:"🚫 GMV = $0"              },
    { key:"Sin alertas",          label:"✅ Sin alertas"           },
  ];

  const empresasFiltradas = useMemo(()=>{
    let r = empresasConScore;
    if (filtroSem !== "Todos") r = r.filter(e=>e.semaforo.includes(filtroSem.replace(/🔴|🟡|🟢/,"").trim()));
    if (filtroKam !== "Todos") r = r.filter(e=>e.ejecutivo === filtroKam);
    if (filtroFactor !== "Todos") {
      if (filtroFactor === "Sin alertas") {
        r = r.filter(e => e.factores.length === 0);
      } else {
        r = r.filter(e => e.factores.some(f => f.startsWith(filtroFactor)));
      }
    }
    if (busca) r = r.filter(e=>e.empresa.toLowerCase().includes(busca.toLowerCase()));
    return r;
  }, [empresasConScore, filtroSem, filtroKam, filtroFactor, busca]);

  if (!meses.length) return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800 text-sm">
      <b>Sin datos.</b> Ve a <b>⚙️ Configuración</b> y sube al menos un mes.
    </div>
  );

  // ── Totales del mes ───────────────────────────────────────────────────────
  const tot       = dataMes?.totales;
  const nRojo     = empresasFiltradas.filter(e=>e.color==="rojo").length;
  const nAmarillo = empresasFiltradas.filter(e=>e.color==="amarillo").length;
  const nVerde    = empresasFiltradas.filter(e=>e.color==="verde").length;
  const gmvTotal  = empresasFiltradas.reduce((s,e)=>s+e.gmv, 0);
  const tcGlobal  = empresasFiltradas.reduce((s,e)=>s+e.completados,0) /
                    Math.max(empresasFiltradas.reduce((s,e)=>s+e.total,0),1);

  // ── Totales mes anterior ─────────────────────────────────────────────────
  const empPrevAll    = dataPrev?.empresas || [];
  const gmvPrevTotal  = empPrevAll.reduce((s,e)=>s+e.gmv,0);
  const totPrevSvc    = empPrevAll.reduce((s,e)=>s+e.total,0);
  const compPrevSvc   = empPrevAll.reduce((s,e)=>s+e.completados,0);
  const tcPrev        = totPrevSvc > 0 ? compPrevSvc/totPrevSvc : null;
  const nEmpPrev      = empPrevAll.length;
  const nRojoPrev     = empPrevAll.filter(e=>calcularScore(e,null,umb).color==="rojo").length;

  // Servicios, paquetes, drivers actuales
  const totalServicios = empresasFiltradas.reduce((s,e)=>s+e.total, 0);
  const totalPaquetes  = empresasFiltradas.reduce((s,e)=>s+(e.paquetes||0), 0);
  const totalDrivers   = tot?.totalDriversActivos || 0;

  // Mes anterior
  const totalServPrev   = empPrevAll.reduce((s,e)=>s+e.total, 0);
  const totalPaqPrev    = empPrevAll.reduce((s,e)=>s+(e.paquetes||0), 0);
  const totalDriversPrev = dataPrev?.totales?.totalDriversActivos || 0;

  const varGmv     = gmvPrevTotal  > 0 ? (gmvTotal - gmvPrevTotal)/gmvPrevTotal  : null;
  const varEmp     = nEmpPrev      > 0 ? (empresasFiltradas.length - nEmpPrev)/nEmpPrev : null;
  const varRojo    = nRojoPrev     > 0 ? (nRojo - nRojoPrev)/nRojoPrev            : null;
  const varTc      = tcPrev !== null   ? tcGlobal - tcPrev                         : null;
  const varServ    = totalServPrev > 0 ? (totalServicios - totalServPrev)/totalServPrev : null;
  const varPaq     = totalPaqPrev  > 0 ? (totalPaquetes - totalPaqPrev)/totalPaqPrev   : null;
  const varDrivers = totalDriversPrev > 0 ? (totalDrivers - totalDriversPrev)/totalDriversPrev : null;

  const empSel = empresaSel ? empresasConScore.find(e=>e.empresa===empresaSel) : null;

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
        <KpiCard icon="🏢" label="Empresas"       value={empresasFiltradas.length.toLocaleString()} borderColor={PIBOX_PURPLE} delta={varEmp}/>
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

      {/* Filtros + tabla de riesgo */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        {/* Título + contador */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-700 text-sm">🗂️ Ranking de riesgo
            <span className="ml-2 text-xs font-normal text-gray-400">({empresasFiltradas.length} empresas)</span>
          </h3>
          {(filtroSem!=="Todos"||filtroKam!=="Todos"||filtroFactor!=="Todos"||busca) && (
            <button onClick={()=>{setFiltroSem("Todos");setFiltroKam("Todos");setFiltroFactor("Todos");setBusca("");setEmpresaSel(null);}}
              className="text-xs text-purple-600 hover:underline">✕ Limpiar filtros</button>
          )}
        </div>

        {/* Barra de filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
          {/* Semáforo */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">🚦 Semáforo</p>
            <div className="flex flex-wrap gap-1">
              {["Todos","🔴 Rojo","🟡 Amarillo","🟢 Verde"].map(s=>(
                <button key={s} onClick={()=>setFiltroSem(s)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition ${
                    filtroSem===s?"bg-purple-600 text-white border-purple-600"
                                :"border-gray-200 text-gray-600 hover:bg-purple-50"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Ejecutivo */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">👤 Ejecutivo</p>
            <select value={filtroKam} onChange={e=>{setFiltroKam(e.target.value);setEmpresaSel(null);}}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white text-gray-600">
              {kamsDisponibles.map(k=>(
                <option key={k} value={k}>{k==="Todos" ? "Todos los ejecutivos" : k}</option>
              ))}
            </select>
          </div>

          {/* Factor de riesgo */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">⚠️ Factor de riesgo</p>
            <select value={filtroFactor} onChange={e=>{setFiltroFactor(e.target.value);setEmpresaSel(null);}}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white text-gray-600">
              {FACTORES_CATALOGO.map(f=>(
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Buscar empresa */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">🔍 Buscar empresa</p>
            <input value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder="Nombre de empresa..."
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"/>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{background:PIBOX_PURPLE}} className="text-white">
                {["Empresa","Semáforo","Score","Servicios","Completado","Cancelación","Expirado","GMV","Ejecutivo","Factores"].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empresasFiltradas.slice(0,100).map((e,i)=>(
                <tr key={e.empresa}
                  className={`cursor-pointer transition-colors ${
                    empresaSel===e.empresa?"bg-purple-50":i%2===0?"bg-white":"bg-purple-50/30"
                  } hover:bg-purple-50`}
                  onClick={()=>setEmpresaSel(empresaSel===e.empresa?null:e.empresa)}>
                  <td className="px-3 py-2 font-semibold text-gray-800 max-w-[160px] truncate">{e.empresa}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <SemBadge color={e.color} label={e.semaforo}/>
                  </td>
                  <td className="px-3 py-2 font-bold" style={{color:e.semColor}}>{e.score}/100</td>
                  <td className="px-3 py-2">{e.total.toLocaleString()}</td>
                  <td className="px-3 py-2 font-semibold" style={{color:SEM_VERDE}}>{fmtPct(e.tasa_completado)}</td>
                  <td className="px-3 py-2 font-semibold" style={{color:SEM_ROJO}}>{fmtPct(e.tasa_cancelacion)}</td>
                  <td className="px-3 py-2">{fmtPct(e.tasa_expirado)}</td>
                  <td className="px-3 py-2 font-semibold text-gray-700">{fmtFull(e.gmv)}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{e.ejecutivo}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[200px]">
                    {e.factores.length > 0
                      ? <span className="text-red-600">{e.factores.join(" · ")}</span>
                      : <span className="text-green-600">Sin alertas</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {empresasFiltradas.length > 100 && (
            <p className="text-xs text-gray-400 mt-2 text-center">Mostrando 100 de {empresasFiltradas.length} empresas. Usa el filtro de búsqueda para encontrar una en específico.</p>
          )}
        </div>
      </div>

      {/* Drill-down empresa */}
      {empSel && (
        <DrillDown empresa={empSel} mesLabel={dataMes?.label} />
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
