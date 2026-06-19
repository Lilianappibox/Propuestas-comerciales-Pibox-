import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import {
  loadMesData, mesesDisponibles, fmtM, fmtFull, fmtPct,
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

// Mapeo departamento → ciudades de Colombia
const DEPARTAMENTOS = {
  "Antioquia": ["Medellin","Medellín","Envigado","Itagüi","Itagui","Bello","Sabaneta","Rionegro","La Estrella","Caldas","Copacabana","Barbosa","Girardota"],
  "Cundinamarca": ["Bogota","Bogotá","Soacha","Chia","Chía","Cajica","Cajicá","Funza","Mosquera","Madrid","Zipaquira","Zipaquirá","Cota","Facatativá","Facatativa","Toncancipa","Tenjo"],
  "Valle del Cauca": ["Cali","Palmira","Yumbo","Buga","Tulua","Tuluá"],
  "Atlántico": ["Barranquilla","Soledad"],
  "Santander": ["Bucaramanga","Floridablanca","Giron","Girón","Piedecuesta","San Gil"],
  "Bolívar": ["Cartagena"],
  "Norte de Santander": ["Cucuta","Cúcuta","Villa del Rosario","Los Patios"],
  "Magdalena": ["Santa Marta"],
  "Risaralda": ["Pereira"],
  "Quindío": ["Armenia"],
  "Caldas": ["Manizales"],
  "Meta": ["Villavicencio"],
  "Córdoba": ["Monteria","Montería"],
  "Sucre": ["Sincelejo"],
  "Cauca": ["Popayan","Popayán"],
  "Huila": ["Neiva"],
  "Nariño": ["Pasto"],
  "Tolima": ["Ibague","Ibagué"],
  "Cesar": ["Valledupar"],
  "La Guajira": ["Rioacha","Riohacha"],
};

export default function AnalisisCiudad() {
  const meses = mesesDisponibles();
  const [mesKey, setMesKey] = useState(meses[meses.length-1]?.key || "");
  const [ciudadesSeleccionadas, setCiudadesSeleccionadas] = useState([]);
  const [deptoSel, setDeptoSel] = useState("");
  const [clienteBuscar, setClienteBuscar] = useState("");
  const [clienteEjecutivo, setClienteEjecutivo] = useState("");
  const [clienteOrden, setClienteOrden] = useState("gmv");

  const idxActual   = meses.findIndex(m=>m.key===mesKey);
  const mesPrevMeta = idxActual > 0 ? meses[idxActual-1] : null;

  const dataMes  = useMemo(()=> mesKey ? loadMesData(mesKey)   : null, [mesKey]);
  const dataPrev = useMemo(()=> mesPrevMeta ? loadMesData(mesPrevMeta.key) : null, [mesPrevMeta]);

  const tieneCiudades = !!(dataMes?.ciudades?.length > 0);
  const ciudadesDisp = useMemo(()=>{
    if (dataMes?.ciudades?.length > 0)
      return dataMes.ciudades.map(c=>c.city).sort();
    return (dataMes?.totales?.topCiudades||[]).map(c=>c.city).sort();
  }, [dataMes]);

  // Departamentos disponibles según ciudades del mes
  const deptosDisp = useMemo(() => {
    const result = [];
    for (const [depto, ciudades] of Object.entries(DEPARTAMENTOS)) {
      const match = ciudades.filter(c => ciudadesDisp.includes(c));
      if (match.length > 0) result.push({ depto, ciudades: match });
    }
    return result.sort((a, b) => a.depto.localeCompare(b.depto));
  }, [ciudadesDisp]);

  const handleDeptoChange = (depto) => {
    setDeptoSel(depto);
    if (!depto) return;
    const deptoCiudades = DEPARTAMENTOS[depto] || [];
    const matching = ciudadesDisp.filter(c => deptoCiudades.includes(c));
    setCiudadesSeleccionadas(matching);
  };

  const toggleCiudad = (c) => {
    setCiudadesSeleccionadas(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    setDeptoSel("");
  };

  // Para compatibilidad: usar la primera ciudad seleccionada como "ciudad" principal
  const ciudad = ciudadesSeleccionadas[0] || "";

  // Agregar datos de todas las ciudades seleccionadas
  const cityData = useMemo(() => {
    if (!ciudadesSeleccionadas.length || !dataMes?.ciudades) return null;
    const selected = dataMes.ciudades.filter(c => ciudadesSeleccionadas.includes(c.city));
    if (!selected.length) return null;
    if (selected.length === 1) return selected[0];
    // Merge múltiples ciudades
    const merged = { city: ciudadesSeleccionadas.join(", "), total: 0, gmv: 0, paquetes: 0, completados: 0, cancelados: 0, expirados: 0, localidades: [], ops: [], estados: [], weekly: [], driversPorOp: [], totalDrivers: 0 };
    const locMap = {}, opMap = {}, stMap = {}, weekMap = {}, drvMap = {};
    for (const c of selected) {
      merged.total += c.total; merged.gmv += c.gmv; merged.paquetes += c.paquetes;
      merged.completados += c.completados; merged.cancelados += c.cancelados; merged.expirados += c.expirados;
      merged.totalDrivers += c.totalDrivers || 0;
      for (const l of (c.localidades || [])) { if (!locMap[l.loc]) locMap[l.loc] = { ...l }; else { locMap[l.loc].total += l.total; locMap[l.loc].paquetes += l.paquetes; locMap[l.loc].gmv += l.gmv; locMap[l.loc].completados += l.completados; locMap[l.loc].cancelados += l.cancelados; } }
      for (const o of (c.ops || [])) { if (!opMap[o.op]) opMap[o.op] = { ...o }; else { opMap[o.op].total += o.total; opMap[o.op].paquetes += (o.paquetes||0); opMap[o.op].gmv += o.gmv; } }
      for (const s of (c.estados || [])) { if (!stMap[s.estado]) stMap[s.estado] = { ...s }; else { stMap[s.estado].total += s.total; stMap[s.estado].paquetes += (s.paquetes||0); } }
      for (const w of (c.weekly || [])) { if (!weekMap[w.semana]) weekMap[w.semana] = { ...w }; else { weekMap[w.semana].gmv += w.gmv; weekMap[w.semana].servicios += w.servicios; weekMap[w.semana].paquetes += (w.paquetes||0); weekMap[w.semana].completados += w.completados; weekMap[w.semana].cancelados += w.cancelados; } }
      for (const d of (c.driversPorOp || [])) { if (!drvMap[d.op]) drvMap[d.op] = { ...d }; else { drvMap[d.op].driversActivos += d.driversActivos; drvMap[d.op].servicios += d.servicios; } }
    }
    merged.tasa_completado = merged.total > 0 ? merged.completados / merged.total : 0;
    merged.tasa_cancelacion = merged.total > 0 ? merged.cancelados / merged.total : 0;
    merged.localidades = Object.values(locMap).sort((a, b) => b.paquetes - a.paquetes).slice(0, 20);
    merged.ops = Object.values(opMap).sort((a, b) => b.total - a.total);
    merged.estados = Object.values(stMap).sort((a, b) => b.total - a.total);
    merged.weekly = Object.values(weekMap).sort((a, b) => a.semana - b.semana);
    merged.driversPorOp = Object.values(drvMap).map(d => ({ ...d, promServPorDriver: d.driversActivos > 0 ? Math.round(d.servicios / d.driversActivos) : 0 })).sort((a, b) => b.driversActivos - a.driversActivos);
    return merged;
  }, [dataMes, ciudadesSeleccionadas]);

  const cityPrev = useMemo(() => {
    if (!ciudadesSeleccionadas.length || !dataPrev?.ciudades) return null;
    const selected = dataPrev.ciudades.filter(c => ciudadesSeleccionadas.includes(c.city));
    if (!selected.length) return null;
    if (selected.length === 1) return selected[0];
    const m = { total: 0, gmv: 0, paquetes: 0, completados: 0, tasa_completado: 0 };
    for (const c of selected) { m.total += c.total; m.gmv += c.gmv; m.paquetes += c.paquetes; m.completados += c.completados; }
    m.tasa_completado = m.total > 0 ? m.completados / m.total : 0;
    return m;
  }, [dataPrev, ciudadesSeleccionadas]);

  // Clientes activos en ciudades seleccionadas
  const clientesCiudad = useMemo(() => {
    if (!ciudadesSeleccionadas.length || !dataMes?.empresas) return [];
    const result = [];
    for (const emp of dataMes.empresas) {
      const ciudadesEmp = emp.topCiudades || [];
      const match = ciudadesEmp.filter(c => ciudadesSeleccionadas.includes(c.city));
      if (match.length > 0) {
        const gmv = match.reduce((s, c) => s + c.gmv, 0);
        const servicios = match.reduce((s, c) => s + c.count, 0);
        result.push({ empresa: emp.empresa, servicios, gmv, paquetes: emp.paquetes, ciudades: match.map(c => c.city).join(", "), ejecutivo: emp.ejecutivo || "" });
      }
    }
    return result.sort((a, b) => b.gmv - a.gmv);
  }, [dataMes, ciudadesSeleccionadas]);

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
      {/* Filtros: Departamento/Ciudad primero, Mes después */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Departamento */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">📍 Departamento</label>
            <select value={deptoSel} onChange={e => handleDeptoChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              <option value="">— Todos —</option>
              {deptosDisp.map(d => <option key={d.depto} value={d.depto}>{d.depto} ({d.ciudades.length})</option>)}
            </select>
          </div>
          {/* Mes */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">📅 Mes</label>
            <select value={mesKey} onChange={e => setMesKey(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {[...meses].reverse().map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          {ciudadesSeleccionadas.length > 0 && (
            <button onClick={() => { setCiudadesSeleccionadas([]); setDeptoSel(""); }}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition">
              Limpiar selección
            </button>
          )}
          {mesPrevMeta && ciudadesSeleccionadas.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: BRAND_GRADIENT }}>
              📊 Comparando vs <b className="ml-1">{mesPrevMeta.label}</b>
            </div>
          )}
        </div>
        {/* Ciudades como chips multi-selección */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-2 block">🏙️ Ciudades {ciudadesSeleccionadas.length > 0 && `(${ciudadesSeleccionadas.length} seleccionadas)`}</label>
          <div className="flex flex-wrap gap-1.5">
            {ciudadesDisp.map(c => {
              const sel = ciudadesSeleccionadas.includes(c);
              return (
                <button key={c} onClick={() => toggleCiudad(c)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${sel ? "bg-purple-600 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-purple-50"}`}>
                  {c}
                </button>
              );
            })}
          </div>
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

      {!ciudadesSeleccionadas.length && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-10 text-center text-purple-600">
          <p className="text-3xl mb-3">🏙️</p>
          <p className="font-semibold">Selecciona una o más ciudades para ver el análisis detallado</p>
          <p className="text-sm text-purple-400 mt-1">Puedes filtrar por departamento o seleccionar ciudades individualmente</p>
        </div>
      )}

      {ciudadesSeleccionadas.length > 0 && cityData && (
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

          {/* Cumplimiento por rango de distancia (agregado de ciudades) */}
          {(() => {
            const distMap = { "0-3 km": 0, "3-5 km": 0, "5-10 km": 0, "Mas de 10 km": 0 };
            const distTimes = {};
            let totalRelaunch = 0;
            const matchingEmpresas = (dataMes?.empresas || []).filter(emp => {
              const ciudadesEmp = emp.topCiudades || [];
              return ciudadesEmp.some(c => ciudadesSeleccionadas.includes(c.city));
            });
            for (const e of matchingEmpresas) {
              totalRelaunch += e.relanzamientos || 0;
              if (!e.distancias) continue;
              for (const [rng, val] of Object.entries(e.distancias)) {
                const k = rng === "Mas de 10 km" || rng === "Más de 10 km" ? "Mas de 10 km" : rng;
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
            const empWithRelaunch = matchingEmpresas.filter(e => (e.relanzamientos || 0) > 0).sort((a, b) => (b.relanzamientos || 0) - (a.relanzamientos || 0));

            return totalBookings > 0 ? (
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

                {/* Devoluciones por empresa */}
                {(() => {
                  const devolData = matchingEmpresas.filter(e => (e.devueltos||0) > 0)
                    .map(e => ({ empresa: e.empresa, paquetes: e.paquetes||0, devueltos: e.devueltos||0, tasa: (e.paquetes||0) > 0 ? (e.devueltos||0)/(e.paquetes||0) : 0 }))
                    .sort((a,b) => b.devueltos - a.devueltos);
                  if (!devolData.length) return null;
                  const totPaq = devolData.reduce((s,d) => s+d.paquetes, 0);
                  const totDev = devolData.reduce((s,d) => s+d.devueltos, 0);
                  const totTasa = totPaq > 0 ? totDev/totPaq : 0;
                  return (
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                      <h3 className="font-bold text-gray-700 text-sm mb-4">📦 Devoluciones por empresa</h3>
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
                            {devolData.map((d,i)=>(
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
                    </div>
                  );
                })()}
              </>
            ) : null;
          })()}

          {/* Clientes activos en las ciudades */}
          {clientesCiudad.length > 0 && (() => {
            const ejecutivos = [...new Set(clientesCiudad.map(c => c.ejecutivo).filter(Boolean))].sort();
            const filtered = clientesCiudad
              .filter(c => !clienteBuscar || c.empresa.toLowerCase().includes(clienteBuscar.toLowerCase()))
              .filter(c => !clienteEjecutivo || c.ejecutivo === clienteEjecutivo)
              .sort((a, b) => clienteOrden === "gmv" ? b.gmv - a.gmv : clienteOrden === "paquetes" ? b.paquetes - a.paquetes : clienteOrden === "servicios" ? b.servicios - a.servicios : a.empresa.localeCompare(b.empresa));
            return (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Clientes activos ({clientesCiudad.length})</h3>
              {/* Filtros */}
              <div className="flex flex-wrap gap-3 items-end mb-4">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Buscar empresa</label>
                  <input type="text" value={clienteBuscar} onChange={e => setClienteBuscar(e.target.value)} placeholder="Nombre..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Ejecutivo</label>
                  <select value={clienteEjecutivo} onChange={e => setClienteEjecutivo(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400">
                    <option value="">Todos</option>
                    {ejecutivos.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Ordenar por</label>
                  <select value={clienteOrden} onChange={e => setClienteOrden(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400">
                    <option value="gmv">Mayor GMV</option>
                    <option value="paquetes">Mayor Paquetes</option>
                    <option value="servicios">Mayor Servicios</option>
                    <option value="nombre">Nombre A-Z</option>
                  </select>
                </div>
                {(clienteBuscar || clienteEjecutivo) && (
                  <button onClick={() => { setClienteBuscar(""); setClienteEjecutivo(""); }}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200">
                    Limpiar
                  </button>
                )}
                <span className="text-[10px] text-gray-400">{filtered.length} de {clientesCiudad.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-purple-700 text-white">
                      {["#", "Empresa", "Servicios", "Paquetes", "GMV", "Ciudades", "Ejecutivo"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => (
                      <tr key={c.empresa} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-purple-50/30"} hover:bg-purple-50`}>
                        <td className="px-3 py-2 text-gray-400 font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800 max-w-[200px] truncate" title={c.empresa}>{c.empresa}</td>
                        <td className="px-3 py-2 text-center">{c.servicios.toLocaleString()}</td>
                        <td className="px-3 py-2 text-center font-bold text-purple-600">{c.paquetes.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">{fmtFull(c.gmv)}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate" title={c.ciudades}>{c.ciudades}</td>
                        <td className="px-3 py-2 text-gray-500">{c.ejecutivo}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-purple-200 bg-purple-50 font-bold">
                      <td className="px-3 py-2" colSpan={2}>Total ({filtered.length})</td>
                      <td className="px-3 py-2 text-center">{filtered.reduce((s, c) => s + c.servicios, 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-center text-purple-700">{filtered.reduce((s, c) => s + c.paquetes, 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-green-700">{fmtFull(filtered.reduce((s, c) => s + c.gmv, 0))}</td>
                      <td className="px-3 py-2" colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
