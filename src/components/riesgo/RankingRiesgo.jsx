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

// -- Tooltip custom --
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

// -- Semaforo badge --
function SemBadge({color,label}) {
  const c = color==="rojo"?SEM_ROJO:color==="amarillo"?SEM_AMARILLO:SEM_VERDE;
  return (
    <span className="inline-block px-3 py-0.5 rounded-full text-white text-xs font-bold"
          style={{background:c}}>{label}</span>
  );
}

// -- Drill-down --
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

      {/* Graficas */}
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

export default function RankingRiesgo() {
  const meses = mesesDisponibles();
  const umb   = getUmbrales();

  const [mesKey, setMesKey]             = useState(meses[meses.length-1]?.key || "");
  const [filtroSem, setFiltroSem]       = useState("Todos");
  const [filtroKam, setFiltroKam]       = useState("Todos");
  const [filtroFactor, setFiltroFactor] = useState("Todos");
  const [busca, setBusca]               = useState("");
  const [empresaSel, setEmpresaSel]     = useState(null);

  // Mes anterior automatico
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
      const riskDiff = ORDER[a.color] - ORDER[b.color];
      if (riskDiff !== 0) return riskDiff;
      return b.gmv - a.gmv;
    });
  }, [dataMes, dataPrev, umb]);

  // Lista dinamica de ejecutivos
  const kamsDisponibles = useMemo(()=>{
    const set = new Set(empresasConScore.map(e=>e.ejecutivo).filter(Boolean));
    return ["Todos", ...Array.from(set).sort()];
  }, [empresasConScore]);

  // Catalogo fijo de factores de riesgo posibles
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

  const empSel = empresaSel ? empresasConScore.find(e=>e.empresa===empresaSel) : null;

  return (
    <div className="space-y-6">
      {/* Seleccion de mes */}
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
            </div>
          )}
        </div>
      </div>

      {/* Filtros + tabla de riesgo */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        {/* Titulo + contador */}
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
          {/* Semaforo */}
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
