import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Legend,
  ReferenceLine, ComposedChart, Area,
} from "recharts";
import {
  loadMesData, loadMesDataAsync, mesesDisponibles, calcularScore, fmtM, fmtPct, fmtFull,
  PIBOX_PURPLE, PIBOX_PINK, SEM_ROJO, SEM_AMARILLO, SEM_VERDE,
  UMBRALES_DEFAULT,
} from "./utils";
import { empresaMatchesOpType, getOpMetrics, OP_TYPES } from "./RiesgoContext";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const COLORS = [PIBOX_PURPLE, PIBOX_PINK, "#A855F7","#6366F1","#EC4899","#8B5CF6"];


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

export default function MetricasRiesgo({ umbrales: umbralesProp }) {
  const meses       = mesesDisponibles();
  const umb         = { ...UMBRALES_DEFAULT, ...(umbralesProp || {}) };

  const [mesKey, setMesKey]             = useState(meses[meses.length-1]?.key || "");
  const [filterOpType, setFilterOpType] = useState("");
  const [filterKam, setFilterKam]       = useState("");
  const [historialGlobal, setHistorialGlobal] = useState([]);
  const [empresaSel, setEmpresaSel]     = useState(null);
  const [metaMap, setMetaMap]           = useState(() => {
    try { return JSON.parse(localStorage.getItem("riesgo_meta_map") || "{}"); } catch { return {}; }
  });
  const [festivosMap, setFestivosMap]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("riesgo_festivos_map") || "{}"); } catch { return {}; }
  });

  const metaMes    = Number(metaMap[mesKey] || 0);
  const setMetaMes = (val) => {
    const v = Number(String(val).replace(/[^0-9]/g, "")) || 0;
    setMetaMap(prev => {
      const next = { ...prev, [mesKey]: v };
      try { localStorage.setItem("riesgo_meta_map", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const festivosMes    = (festivosMap[mesKey] || []).map(Number);
  const setFestivosMes = (diasArr) => {
    setFestivosMap(prev => {
      const next = { ...prev, [mesKey]: diasArr };
      try { localStorage.setItem("riesgo_festivos_map", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  // Texto crudo del campo festivos — se parsea solo al perder el foco
  const [festivosRaw, setFestivosRaw] = useState(festivosMes.join(", "));
  useEffect(() => { setFestivosRaw(festivosMes.join(", ")); }, [mesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (meses.length > 0 && (!mesKey || !meses.find(m => m.key === mesKey)))
      setMesKey(meses[meses.length - 1].key);
  }, [meses.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const allMeses = mesesDisponibles();
      const result   = [];
      for (const m of allMeses) {
        const d = await loadMesDataAsync(m.key);
        if (!d?.empresas) continue;
        result.push({
          key:   m.key,
          label: m.label,
          gmv:   d.empresas.reduce((s, e) => s + e.gmv,   0),
          total: d.empresas.reduce((s, e) => s + e.total, 0),
        });
      }
      if (!cancelled) setHistorialGlobal(result.sort((a, b) => a.key < b.key ? -1 : 1));
    })();
    return () => { cancelled = true; };
  }, [mesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mes anterior automático
  const idxActual   = meses.findIndex(m=>m.key===mesKey);
  const mesPrevMeta = idxActual > 0 ? meses[idxActual-1] : null;

  const dataMes  = useMemo(()=> mesKey ? loadMesData(mesKey)   : null, [mesKey]);
  const dataPrev = useMemo(()=> mesPrevMeta ? loadMesData(mesPrevMeta.key) : null, [mesPrevMeta]);

  // Opciones de KAM únicas del mes activo
  const kamOptions = useMemo(() => {
    if (!dataMes) return [];
    const set = new Set(dataMes.empresas.map(e => e.ejecutivo || "Sin asignar"));
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
  }, [dataMes]);

  const empresasConScore = useMemo(()=>{
    if (!dataMes) return [];
    const ORDER = { rojo: 0, amarillo: 1, verde: 2 };
    return dataMes.empresas
      .filter(e => empresaMatchesOpType(e, filterOpType))
      .filter(e => !filterKam || (e.ejecutivo || "Sin asignar") === filterKam)
      .map(e => {
        const opData = getOpMetrics(e, filterOpType);
        const eBase  = opData ? { ...e, gmv: opData.gmv, total: opData.total, completados: opData.completados, cancelados: opData.cancelados, paquetes: opData.paquetes, relanzamientos: opData.relanzamientos ?? e.relanzamientos, devueltos: opData.devueltos ?? e.devueltos, canceladosPax: opData.canceladosPax ?? e.canceladosPax, expirados: opData.expirados ?? e.expirados } : e;
        const prev   = dataPrev?.empresas?.find(p=>p.empresa===e.empresa);
        const prevOp = prev ? getOpMetrics(prev, filterOpType) : null;
        const prevBase = prevOp ? { ...prev, gmv: prevOp.gmv, total: prevOp.total, completados: prevOp.completados } : prev;
        return { ...eBase, ...calcularScore(eBase, prevBase||null, umb) };
      }).sort((a,b) => {
        const riskDiff = ORDER[a.color] - ORDER[b.color];
        if (riskDiff !== 0) return riskDiff;
        return b.gmv - a.gmv;
      });
  }, [dataMes, dataPrev, umb, filterOpType, filterKam]);


  // Totales filtrados por tipo de operación — alimenta todos los charts cuando hay filtro activo
  const filteredTot = useMemo(() => {
    if (!filterOpType || !dataMes) return null;
    const rawTot  = dataMes.totales;
    const totComp = empresasConScore.reduce((s, e) => s + e.completados, 0);
    const totCanc = empresasConScore.reduce((s, e) => s + e.cancelados,  0);
    const totServ = empresasConScore.reduce((s, e) => s + e.total,       0);
    const totGmv  = empresasConScore.reduce((s, e) => s + e.gmv,         0);

    // Ciudad — desglose por tipo de op guardado en dataMes.ciudades[].ops
    const topCiudades = (dataMes.ciudades || [])
      .map(c => {
        const opEnt = (c.ops || []).find(o =>
          (o.op || "").toLowerCase().includes(filterOpType.toLowerCase())
        );
        return { city: c.city, gmv: opEnt?.gmv || 0, servicios: opEnt?.total || 0, paquetes: opEnt?.paquetes || 0 };
      })
      .filter(c => c.gmv > 0 || c.servicios > 0)
      .sort((a, b) => b.gmv - a.gmv);

    const porTipoOp = [{ name: filterOpType, total: totServ, gmv: totGmv }];
    const otroServ  = Math.max(0, totServ - totComp - totCanc);
    const porStatus = [
      { name: "Completed", total: totComp },
      { name: "Canceled",  total: totCanc },
      ...(otroServ > 0 ? [{ name: "Other", total: otroServ }] : []),
    ].filter(d => d.total > 0);

    // Drivers — solo el tipo de op seleccionado
    const opDrv = (rawTot?.driversPorTipoOp || []).find(d =>
      (d.op || "").toLowerCase().includes(filterOpType.toLowerCase())
    );
    const driversPorTipoOp   = opDrv ? [opDrv] : [];
    const totalDriversActivos = opDrv?.driversActivos || 0;

    // Weekly — suma de semanales por empresa filtrada (aproximación con todos sus ops)
    const wMap = {};
    for (const e of empresasConScore) {
      for (const w of (e.weekly || [])) {
        if (!wMap[w.semana]) wMap[w.semana] = {
          semana: w.semana, label: w.label,
          gmv: 0, servicios: 0, completados: 0, cancelados: 0, canceladosConductor: 0, expirados: 0,
        };
        const wm = wMap[w.semana];
        wm.gmv += w.gmv; wm.servicios += w.servicios;
        wm.completados         += w.completados;
        wm.cancelados          += w.cancelados          || 0;
        wm.canceladosConductor += w.canceladosConductor || 0;
        wm.expirados           += w.expirados           || 0;
      }
    }
    const weekly = Object.values(wMap).sort((a, b) => a.semana - b.semana).map(w => ({
      ...w,
      tasa_completado: (w.completados + w.canceladosConductor + w.expirados) > 0
        ? w.completados / (w.completados + w.canceladosConductor + w.expirados) : 0,
      tasa_cancelacion: w.servicios > 0 ? w.cancelados / w.servicios : 0,
    }));

    // Daily: buscar el op type en dailyByOp (match parcial para cubrir variaciones de nombre)
    const dailyByOp = dataMes?.totales?.dailyByOp || {};
    const dailyOpKey = Object.keys(dailyByOp).find(k =>
      k.toLowerCase().includes(filterOpType.toLowerCase()) ||
      filterOpType.toLowerCase().includes(k.toLowerCase())
    );
    const daily = dailyOpKey ? dailyByOp[dailyOpKey] : null;

    // Vehículo: buscar el op type en porVehiculoByOp
    const vhByOpMap = dataMes?.totales?.porVehiculoByOp || {};
    const vhOpKey = Object.keys(vhByOpMap).find(k =>
      k.toLowerCase().includes(filterOpType.toLowerCase()) ||
      filterOpType.toLowerCase().includes(k.toLowerCase())
    );
    const porVehiculo = vhOpKey ? vhByOpMap[vhOpKey] : [];

    return { topCiudades, porTipoOp, porStatus, porVehiculo, driversPorTipoOp, totalDriversActivos, weekly, ...(daily ? { daily } : {}) };
  }, [filterOpType, empresasConScore, dataMes]); // eslint-disable-line

  if (!meses.length) return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800 text-sm">
      <b>Sin datos.</b> Ve a <b>⚙️ Configuración</b> y sube al menos un mes.
    </div>
  );

  // ── Totales del mes ───────────────────────────────────────────────────────
  const tot       = dataMes?.totales;
  // activeTot: usa los datos filtrados por tipo de op cuando hay filtro activo
  const activeTot = (filterOpType && filteredTot) ? filteredTot : tot;
  const nRojo     = empresasConScore.filter(e=>e.color==="rojo").length;
  const nAmarillo = empresasConScore.filter(e=>e.color==="amarillo").length;
  const nVerde    = empresasConScore.filter(e=>e.color==="verde").length;
  const gmvTotal  = empresasConScore.reduce((s,e)=>s+e.gmv, 0);
  const tcGlobal  = empresasConScore.reduce((s,e)=>s+e.completados,0) /
                    Math.max(empresasConScore.reduce((s,e)=>s+e.total,0),1);

  // ── Totales mes anterior ─────────────────────────────────────────────────
  const empPrevAll    = (dataPrev?.empresas || [])
    .filter(e => empresaMatchesOpType(e, filterOpType))
    .filter(e => !filterKam || (e.ejecutivo || "Sin asignar") === filterKam);
  const _prevVal = (e, k) => { const op = getOpMetrics(e, filterOpType); return op ? (op[k]||0) : e[k]||0; };
  const gmvPrevTotal  = empPrevAll.reduce((s,e)=>s+_prevVal(e,"gmv"),0);
  const totPrevSvc    = empPrevAll.reduce((s,e)=>s+_prevVal(e,"total"),0);
  const compPrevSvc   = empPrevAll.reduce((s,e)=>s+_prevVal(e,"completados"),0);
  const tcPrev        = totPrevSvc > 0 ? compPrevSvc/totPrevSvc : null;
  const nEmpPrev      = empPrevAll.length;
  const nRojoPrev     = empPrevAll.filter(e=>calcularScore(e,null,umb).color==="rojo").length;

  // Servicios, paquetes, drivers actuales
  const totalServicios = empresasConScore.reduce((s,e)=>s+e.total, 0);
  const totalPaquetes  = empresasConScore.reduce((s,e)=>s+(e.paquetes||0), 0);
  const totalDrivers   = filterOpType
    ? (tot?.driversPorTipoOp?.find(d=>d.op?.toLowerCase().includes(filterOpType.toLowerCase()))?.driversActivos || 0)
    : (tot?.totalDriversActivos || 0);

  // Mes anterior
  const totalServPrev   = empPrevAll.reduce((s,e)=>s+_prevVal(e,"total"), 0);
  const totalPaqPrev    = empPrevAll.reduce((s,e)=>s+_prevVal(e,"paquetes"), 0);
  const totalDriversPrev = dataPrev?.totales?.totalDriversActivos || 0;

  const varGmv     = gmvPrevTotal  > 0 ? (gmvTotal - gmvPrevTotal)/gmvPrevTotal  : null;
  const varEmp     = nEmpPrev      > 0 ? (empresasConScore.length - nEmpPrev)/nEmpPrev : null;
  const varRojo    = nRojoPrev     > 0 ? (nRojo - nRojoPrev)/nRojoPrev            : null;
  const varTc      = tcPrev !== null   ? tcGlobal - tcPrev                         : null;
  const varServ    = totalServPrev > 0 ? (totalServicios - totalServPrev)/totalServPrev : null;
  const varPaq     = totalPaqPrev  > 0 ? (totalPaquetes - totalPaqPrev)/totalPaqPrev   : null;
  const varDrivers = totalDriversPrev > 0 ? (totalDrivers - totalDriversPrev)/totalDriversPrev : null;

  // ── On Time (SLA On Demand) ──────────────────────────────────────────────
  const onTimeTotal  = empresasConScore.reduce((s, e) => s + (e.onDemandCompletados || 0), 0);
  const onTimeOnTime = empresasConScore.reduce((s, e) => s + (e.onDemandOnTime || 0), 0);
  const onTimePctGlobal = onTimeTotal > 0 ? onTimeOnTime / onTimeTotal : null;
  const onTimePrevTotal  = empPrevAll.reduce((s, e) => s + (e.onDemandCompletados || 0), 0);
  const onTimePrevOnTime = empPrevAll.reduce((s, e) => s + (e.onDemandOnTime || 0), 0);
  const onTimePctPrev = onTimePrevTotal > 0 ? onTimePrevOnTime / onTimePrevTotal : null;
  const varOnTime = (onTimePctGlobal !== null && onTimePctPrev !== null) ? onTimePctGlobal - onTimePctPrev : null;

  // ── Efectividad Comercial y Operativa ────────────────────────────────────
  const getStatus = (porStatus, name) => (porStatus || []).find(d => d.name === name)?.total || 0;
  const ps = activeTot?.porStatus || [];
  // psPrev: cuando hay filtro usa las métricas op-específicas del mes anterior
  const psPrev = filterOpType
    ? (() => {
        const pC = empPrevAll.reduce((s, e) => s + _prevVal(e, "completados"), 0);
        const pK = empPrevAll.reduce((s, e) => s + _prevVal(e, "cancelados"),  0);
        return [{ name:"Completed",total:pC },{ name:"Canceled",total:pK }].filter(d=>d.total>0);
      })()
    : (dataPrev?.totales?.porStatus || []);

  let efectComercial, efectOperativa, varEfCom, varEfOp;
  if (filterOpType) {
    const fc = getStatus(ps, "Completed"), fk = getStatus(ps, "Canceled");
    efectComercial = totalServicios > 0 ? fc / totalServicios : null;
    efectOperativa = (fc + fk) > 0     ? fc / (fc + fk)      : null;
    const pc = getStatus(psPrev, "Completed"), pk = getStatus(psPrev, "Canceled");
    const efCP = totPrevSvc > 0    ? pc / totPrevSvc    : null;
    const efOP = (pc + pk) > 0    ? pc / (pc + pk)     : null;
    varEfCom = efectComercial !== null && efCP !== null ? efectComercial - efCP : null;
    varEfOp  = efectOperativa !== null && efOP !== null ? efectOperativa - efOP : null;
  } else {
    const sCompleted   = getStatus(ps, "Completed");
    const sCancelPax   = getStatus(ps, "Canceled by Passenger");
    const sCancelDrv   = getStatus(ps, "Canceled by Driver");
    const sCancelOps   = getStatus(ps, "Canceled by Ops");
    const sExpired     = getStatus(ps, "Expired");
    const denomComercial = sCompleted + sCancelPax + sCancelDrv + sCancelOps + sExpired;
    const denomOperativa = sCompleted + sCancelDrv + sExpired;
    efectComercial = denomComercial > 0 ? sCompleted / denomComercial : null;
    efectOperativa = denomOperativa > 0 ? sCompleted / denomOperativa : null;
    const sCompPrev    = getStatus(psPrev, "Completed");
    const sCancelPaxP  = getStatus(psPrev, "Canceled by Passenger");
    const sCancelDrvP  = getStatus(psPrev, "Canceled by Driver");
    const sCancelOpsP  = getStatus(psPrev, "Canceled by Ops");
    const sExpiredP    = getStatus(psPrev, "Expired");
    const denomComPrev = sCompPrev + sCancelPaxP + sCancelDrvP + sCancelOpsP + sExpiredP;
    const denomOpPrev  = sCompPrev + sCancelDrvP + sExpiredP;
    const efComPrev    = denomComPrev > 0 ? sCompPrev / denomComPrev : null;
    const efOpPrev     = denomOpPrev  > 0 ? sCompPrev / denomOpPrev  : null;
    varEfCom = efectComercial !== null && efComPrev !== null ? efectComercial - efComPrev : null;
    varEfOp  = efectOperativa !== null && efOpPrev  !== null ? efectOperativa - efOpPrev  : null;
  }

  return (
    <div className="space-y-6">
      {/* Selección de mes + filtro operation type */}
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
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">🔖 Operation Type</label>
            <select
              value={filterOpType}
              onChange={e => setFilterOpType(e.target.value)}
              className="border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-gray-700"
            >
              {OP_TYPES.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">👤 KAM</label>
            <select
              value={filterKam}
              onChange={e => { setFilterKam(e.target.value); setEmpresaSel(null); }}
              className="border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-gray-700"
            >
              <option value="">Todos los KAMs</option>
              {kamOptions.map(k => (
                <option key={k} value={k}>{k}</option>
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

      {/* KPIs globales — 4 arriba + 4 abajo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon="🏢" label="Empresas"       value={empresasConScore.length.toLocaleString()} borderColor={PIBOX_PURPLE} delta={varEmp}/>
        <KpiCard icon="💰" label="GMV Total"       value={fmtFull(gmvTotal)} borderColor={PIBOX_PURPLE} delta={varGmv}/>
        <KpiCard icon="📦" label="Servicios"       value={totalServicios.toLocaleString()} borderColor="#6366F1" delta={varServ}/>
        <KpiCard icon="📮" label="Paquetes"        value={totalPaquetes.toLocaleString()} borderColor="#0EA5E9" delta={varPaq}/>
        <KpiCard icon="🏍️" label="Drivers Activos" value={totalDrivers.toLocaleString()} borderColor="#F59E0B" delta={varDrivers}/>
        <KpiCard icon="⏱️" label="On Time OD"
          value={onTimePctGlobal !== null ? fmtPct(onTimePctGlobal) : "N/A"}
          borderColor="#0d9488"
          delta={varOnTime}
          deltaLabel={onTimeTotal === 0 ? "Sin datos On Demand" : undefined}/>
        <KpiCard
          icon="🎯"
          label="Efectividad Comercial"
          value={efectComercial !== null ? (efectComercial * 100).toFixed(1) + "%" : "—"}
          borderColor="#16a34a"
          delta={varEfCom}
          deltaLabel={mesPrevMeta ? "Sin variación" : "Sin mes anterior"}
        />
        <KpiCard
          icon="⚙️"
          label="Efectividad Operativa"
          value={efectOperativa !== null ? (efectOperativa * 100).toFixed(1) + "%" : "—"}
          borderColor="#0891b2"
          delta={varEfOp}
          deltaLabel={mesPrevMeta ? "Sin variación" : "Sin mes anterior"}
        />
      </div>

      {/* GMV Diario */}
      {(() => {
        // Usa daily filtrado por op type cuando está disponible (requiere re-cargar desde ClickHouse)
        const daily = activeTot?.daily || tot?.daily;
        if (!daily?.length) return (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-5 text-center text-xs text-gray-400">
            📆 La gráfica de GMV diario estará disponible al volver a subir los datos del mes desde <b>⚙️ Configuración</b>.
          </div>
        );

        // MA-7 y acumulado
        let acum = 0;
        const chartDaily = daily.map((d, i, arr) => {
          const ventana = arr.slice(Math.max(0, i - 6), i + 1);
          const ma7 = ventana.reduce((s, w) => s + w.gmv, 0) / ventana.length;
          acum += d.gmv;
          return { ...d, ma7, acum };
        });

        const maxGmvDia  = Math.max(...chartDaily.map(d => d.gmv));
        const avgGmvDia  = chartDaily.reduce((s, d) => s + d.gmv, 0) / chartDaily.length;
        const topDia     = chartDaily.reduce((m, d) => d.gmv > m.gmv ? d : m, chartDaily[0]);
        const minDia     = chartDaily.reduce((m, d) => d.gmv < m.gmv ? d : m, chartDaily[0]);
        const gmvAcumFinal = acum;

        // Tick X: mostrar solo cada ~5 días
        const tickCount = chartDaily.length;
        const step = tickCount <= 15 ? 1 : tickCount <= 25 ? 3 : 5;

        return (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="font-bold text-gray-700 text-sm">📆 GMV Diario{filterOpType && !activeTot?.daily && <span className="text-xs font-normal text-gray-400 ml-1">(todos los tipos — recarga ClickHouse para filtrar)</span>}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Barras: GMV del día · Línea: media móvil 7 días · {chartDaily.length} días con datos
                </p>
              </div>
              {/* Mini KPIs de la gráfica */}
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="bg-purple-50 rounded-xl px-3 py-1.5 border border-purple-100">
                  <span className="text-gray-500">Prom/día </span>
                  <span className="font-bold text-purple-700">{fmtFull(avgGmvDia)}</span>
                </div>
                <div className="bg-green-50 rounded-xl px-3 py-1.5 border border-green-100">
                  <span className="text-gray-500">Mejor día </span>
                  <span className="font-bold text-green-700">{topDia.label} · {fmtFull(topDia.gmv)}</span>
                </div>
                <div className="bg-red-50 rounded-xl px-3 py-1.5 border border-red-100">
                  <span className="text-gray-500">Menor día </span>
                  <span className="font-bold text-red-600">{minDia.label} · {fmtFull(minDia.gmv)}</span>
                </div>
                <div className="bg-blue-50 rounded-xl px-3 py-1.5 border border-blue-100">
                  <span className="text-gray-500">Acumulado </span>
                  <span className="font-bold text-blue-700">{fmtFull(gmvAcumFinal)}</span>
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartDaily} margin={{top:8,right:60,left:0,bottom:20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" vertical={false}/>
                <XAxis
                  dataKey="label"
                  tick={{fontSize:9}}
                  angle={-45}
                  textAnchor="end"
                  height={45}
                  interval={step - 1}
                />
                <YAxis
                  yAxisId="left"
                  tick={{fontSize:9}}
                  tickFormatter={fmtM}
                  width={55}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{fontSize:9}}
                  tickFormatter={fmtM}
                  width={55}
                />
                <Tooltip
                  content={({active, payload, label}) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-white border border-purple-100 rounded-xl shadow-lg px-3 py-2.5 text-xs space-y-1 min-w-[180px]">
                        <p className="font-bold text-purple-700 mb-1">📅 {d?.date}</p>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">GMV del día</span>
                          <span className="font-bold" style={{color:PIBOX_PURPLE}}>{fmtFull(d?.gmv)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">MA-7</span>
                          <span className="font-bold" style={{color:PIBOX_PINK}}>{fmtFull(d?.ma7)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">Acumulado</span>
                          <span className="font-bold text-blue-600">{fmtFull(d?.acum)}</span>
                        </div>
                        <div className="border-t border-gray-100 pt-1 mt-1 flex justify-between gap-4">
                          <span className="text-gray-500">Servicios</span>
                          <span className="font-semibold text-gray-700">{d?.servicios?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">Completados</span>
                          <span className="font-semibold text-green-600">{d?.completados?.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                {/* Área acumulado (eje derecho, fondo suave) */}
                <Area
                  yAxisId="right"
                  dataKey="acum"
                  name="Acumulado"
                  fill="#DBEAFE"
                  stroke="#93C5FD"
                  strokeWidth={1.5}
                  fillOpacity={0.4}
                  dot={false}
                  activeDot={false}
                />
                {/* Barras GMV diario */}
                <Bar
                  yAxisId="left"
                  dataKey="gmv"
                  name="GMV día"
                  fill={PIBOX_PURPLE}
                  fillOpacity={0.85}
                  radius={[3,3,0,0]}
                  maxBarSize={28}
                />
                {/* Línea MA-7 */}
                <Line
                  yAxisId="left"
                  dataKey="ma7"
                  name="MA-7"
                  stroke={PIBOX_PINK}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{r:4, strokeWidth:0}}
                  strokeDasharray="5 3"
                />
                {/* Línea de promedio */}
                <ReferenceLine
                  yAxisId="left"
                  y={avgGmvDia}
                  stroke="#9CA3AF"
                  strokeDasharray="3 2"
                  label={{value:"Prom.", position:"insideTopRight", fontSize:9, fill:"#9CA3AF"}}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Leyenda */}
            <div className="flex flex-wrap justify-center gap-4 mt-1 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{background:PIBOX_PURPLE, opacity:0.85}}/>
                GMV diario
              </span>
              <span className="flex items-center gap-1">
                <span className="w-6 border-t-2 inline-block" style={{borderColor:PIBOX_PINK, borderStyle:"dashed"}}/>
                Media móvil 7 días
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block bg-blue-200"/>
                GMV acumulado (eje der.)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-6 border-t inline-block border-gray-400" style={{borderStyle:"dashed"}}/>
                Promedio diario
              </span>
            </div>
          </div>
        );
      })()}

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
                const top = (activeTot?.topCiudades || []).slice(0, 10);
                const prevCiudades = filterOpType
                  ? (dataPrev?.ciudades || []).map(c => {
                      const opEnt = (c.ops||[]).find(o=>o.op.toLowerCase().includes(filterOpType.toLowerCase()));
                      return { city:c.city, gmv:opEnt?.gmv||0 };
                    })
                  : (dataPrev?.totales?.topCiudades || []);
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
                const top = [...(activeTot?.topCiudades || [])].sort((a,b) => b.servicios - a.servicios).slice(0, 10);
                const prevCiudades = filterOpType
                  ? (dataPrev?.ciudades || []).map(c => {
                      const opEnt = (c.ops||[]).find(o=>o.op.toLowerCase().includes(filterOpType.toLowerCase()));
                      return { city:c.city, servicios:opEnt?.total||0 };
                    })
                  : (dataPrev?.totales?.topCiudades || []);
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
                const top = [...(activeTot?.topCiudades || [])].sort((a,b) => b.paquetes - a.paquetes).slice(0, 10);
                const prevCiudades = filterOpType
                  ? (dataPrev?.ciudades || []).map(c => {
                      const opEnt = (c.ops||[]).find(o=>o.op.toLowerCase().includes(filterOpType.toLowerCase()));
                      return { city:c.city, paquetes:opEnt?.paquetes||0 };
                    })
                  : (dataPrev?.totales?.topCiudades || []);
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
        {/* Línea Operativa */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-3">📦 Línea Operativa</h3>
          {(activeTot?.porTipoOp?.length > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={activeTot.porTipoOp} dataKey="total" nameKey="name"
                  cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                  label={({name,percent})=>`${name.split(" ")[0]} ${(percent*100).toFixed(0)}%`}
                  labelLine={false}>
                  {activeTot.porTipoOp.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v,n)=>[v.toLocaleString()+" servicios",n]}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>}
          {activeTot?.porTipoOp?.length > 0 && (
            <div className="mt-2 space-y-1">
              {activeTot.porTipoOp.slice(0,8).map((d,i)=>(
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
          {(activeTot?.porStatus?.length > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={Math.max(220, (activeTot.porStatus.length || 1) * 45)}>
                <BarChart
                  data={(() => {
                    const allNames = new Set([...activeTot.porStatus.map(d=>d.name), ...psPrev.map(d=>d.name)]);
                    return [...allNames].map(name => ({
                      name,
                      total:     activeTot.porStatus.find(d=>d.name===name)?.total || 0,
                      totalPrev: psPrev.find(p=>p.name===name)?.total || 0,
                    })).sort((a,b) => b.total - a.total);
                  })()}
                  layout="vertical" margin={{left:5,right:10}}>
                  <XAxis type="number" tick={{fontSize:9}} tickFormatter={v=>v.toLocaleString()}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:9}} width={120}/>
                  <Tooltip formatter={(v)=>[v.toLocaleString()+" servicios"]}/>
                  <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                  <Bar dataKey="total" name={dataMes?.label||"Actual"} radius={[0,4,4,0]}>
                    {[...new Set([...activeTot.porStatus.map(d=>d.name), ...psPrev.map(d=>d.name)])].sort((a,b) => {
                      const at = activeTot.porStatus.find(d=>d.name===a)?.total||0;
                      const bt = activeTot.porStatus.find(d=>d.name===b)?.total||0;
                      return bt - at;
                    }).map((name,i)=>{
                      const c = name==="Completed"?SEM_VERDE:name.startsWith("Canceled")?SEM_ROJO:name==="Expired"?SEM_AMARILLO:COLORS[i%COLORS.length];
                      return <Cell key={i} fill={c}/>;
                    })}
                  </Bar>
                  {mesPrevMeta && <Bar dataKey="totalPrev" name={mesPrevMeta.label} fill={PIBOX_PINK} fillOpacity={0.45} radius={[0,4,4,0]}/>}
                </BarChart>
              </ResponsiveContainer>
              {/* Tabla comparativa debajo */}
              <div className="mt-3 space-y-1">
                {activeTot.porStatus.slice(0,6).map(d => {
                  const prev = psPrev.find(p => p.name === d.name);
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
          {(activeTot?.porVehiculo?.length > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={activeTot.porVehiculo} dataKey="total" nameKey="name"
                  cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                  label={({name,percent})=>`${name.split(" ")[0]} ${(percent*100).toFixed(0)}%`}
                  labelLine={false}>
                  {activeTot.porVehiculo.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v,n)=>[v.toLocaleString()+" servicios",n]}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 text-center py-8">Tipo de vehículo no disponible en los datos de ClickHouse</p>}
          {activeTot?.porVehiculo?.length > 0 && (
            <div className="mt-2 space-y-1">
              {activeTot.porVehiculo.slice(0,5).map((d,i)=>(
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
      {(activeTot?.driversPorTipoOp?.length > 0) && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 text-sm">🏍️ Drivers Activos por Tipo de Operación</h3>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold" style={{background:BRAND_GRADIENT,color:"#fff"}}>
              Total: {(activeTot?.totalDriversActivos || 0).toLocaleString()} drivers únicos
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
                  {(activeTot?.driversPorTipoOp || []).map((d, i) => (
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
                    <td className="px-3 py-2 text-right text-purple-800">{(activeTot?.totalDriversActivos||0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{(activeTot?.driversPorTipoOp||[]).reduce((s, d) => s + d.servicios, 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                        {(activeTot?.totalDriversActivos||0) > 0 ? Math.round((activeTot?.driversPorTipoOp||[]).reduce((s, d) => s + d.servicios, 0) / activeTot.totalDriversActivos) : 0}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Gráfico */}
            <ResponsiveContainer width="100%" height={Math.max(200, (activeTot?.driversPorTipoOp||[]).length * 40)}>
              <BarChart data={activeTot?.driversPorTipoOp||[]} layout="vertical" margin={{left:5,right:10}}>
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
          if (!e.distanciasOnDemand) continue;
          for (const [rng, val] of Object.entries(e.distanciasOnDemand)) {
            const k = rng === "Más de 10 km" || rng === "Mas de 10 km" ? "Mas de 10 km" : rng;
            if (!(k in distMap)) continue;
            if (typeof val === "number") { distMap[k] += val; continue; }
            distMap[k] += val.total || 0;
            if (!distTimes[k]) distTimes[k] = { completados: 0, relanzamientos: 0, tAsig: 0, tLleg: 0, tRuta: 0, tTotal: 0, n: 0, otTotal: 0, otOnTime: 0, otNoAplica: 0 };
            distTimes[k].completados += val.completados || 0;
            distTimes[k].relanzamientos += val.relanzamientos || 0;
            distTimes[k].tAsig += val.tAsignacion || 0;
            distTimes[k].tLleg += val.tLlegada || 0;
            distTimes[k].tRuta += val.tRuta || 0;
            distTimes[k].tTotal += val.tTotal || 0;
            distTimes[k].n += val.nTiempos || 0;
            distTimes[k].otTotal += val.otTotal || 0;
            distTimes[k].otOnTime += val.otOnTime || 0;
            distTimes[k].otNoAplica += val.otNoAplica || 0;
          }
        }
        const totalBookings = Object.values(distMap).reduce((s, v) => s + v, 0);
        const fmtTime = (mins) => { if (!mins) return "\u2014"; const h = Math.floor(mins/60); const m = Math.round(mins%60); return h > 0 ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`; };
        const distAgg = Object.entries(distMap).map(([rng, cnt]) => {
          const t = distTimes[rng] || {};
          const n = t.n || 1;
          return { rango: rng, bookings: cnt, pct: totalBookings > 0 ? cnt / totalBookings : 0, completados: t.completados || 0, relanzamientos: t.relanzamientos || 0, efectividad: cnt > 0 ? (t.completados || 0) / cnt : 0, avgAsig: fmtTime(t.tAsig / n), avgLleg: fmtTime(t.tLleg / n), avgRuta: fmtTime(t.tRuta / n), avgTotal: fmtTime(t.tTotal / n), otTotal: t.otTotal || 0, otOnTime: t.otOnTime || 0, otNoAplica: t.otNoAplica || 0, onTimePct: (t.otTotal || 0) > 0 ? (t.otOnTime || 0) / (t.otTotal || 0) : null };
        });
        const hasData = totalBookings > 0;
        const empWithRelaunch = empresasConScore.filter(e => (e.relanzamientos || 0) > 0).sort((a, b) => (b.relanzamientos || 0) - (a.relanzamientos || 0));

        return (
          <>
            {hasData && <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="font-bold text-gray-700 text-sm mb-4">📏 Cumplimiento por rango de distancia <span className="text-xs font-normal text-gray-400">(solo Op. On Demand)</span></h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:PIBOX_PURPLE}} className="text-white">
                      {["Rango","Bookings","Relanz.","Efectividad","T. Asig.","T. Llegada","T. Ruta","T. Total","On Time OD","Con SLA","Sin SLA","% Bookings"].map(h=>(
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
                        <td className="px-3 py-2 text-center font-semibold" style={{color: d.onTimePct != null ? (d.onTimePct >= 0.85 ? SEM_VERDE : d.onTimePct >= 0.70 ? SEM_AMARILLO : SEM_ROJO) : "#9ca3af"}}>{d.onTimePct != null ? fmtPct(d.onTimePct) : "—"}</td>
                        <td className="px-3 py-2 text-center text-gray-700">{d.otTotal > 0 ? d.otTotal : "—"}</td>
                        <td className="px-3 py-2 text-center text-gray-400">{d.otNoAplica > 0 ? d.otNoAplica : "—"}</td>
                        <td className="px-3 py-2 text-center" style={{color:PIBOX_PURPLE}}>{fmtPct(d.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-purple-300 bg-purple-50 font-bold">
                      <td className="px-3 py-2 text-gray-800">Total</td>
                      <td className="px-3 py-2 text-center">{distAgg.reduce((s,d)=>s+d.bookings,0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">{distAgg.reduce((s,d)=>s+d.relanzamientos,0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-center" colSpan={4}></td>
                      {(() => { const totOT = distAgg.reduce((s,d)=>s+d.otTotal,0); const totOTon = distAgg.reduce((s,d)=>s+d.otOnTime,0); const totNoApl = distAgg.reduce((s,d)=>s+d.otNoAplica,0); const pct = totOT > 0 ? totOTon/totOT : null; return (<><td className="px-3 py-2 text-center" style={{color: pct!=null?(pct>=0.85?SEM_VERDE:pct>=0.70?SEM_AMARILLO:SEM_ROJO):"#9ca3af"}}>{pct!=null?fmtPct(pct):"—"}</td><td className="px-3 py-2 text-center">{totOT > 0 ? totOT : "—"}</td><td className="px-3 py-2 text-center text-gray-500">{totNoApl > 0 ? totNoApl : "—"}</td></>); })()}
                      <td className="px-3 py-2 text-center">100.0%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>}

            {/* Gráficas comparativas: Devoluciones + Relanzamientos vs mes anterior */}
            {(() => {
              const totalDevAct = empresasConScore.reduce((s,e) => s + (e.devueltos||0), 0);
              const totalRelAct = empresasConScore.reduce((s,e) => s + (e.relanzamientos||0), 0);
              const totalServAct = empresasConScore.reduce((s,e) => s + e.total, 0);
              const prevEmps = dataPrev?.empresas || [];
              const totalDevPrev = prevEmps.reduce((s,e) => s + (e.devueltos||0), 0);
              const totalRelPrev = prevEmps.reduce((s,e) => s + (e.relanzamientos||0), 0);
              const totalServPrev = prevEmps.reduce((s,e) => s + e.total, 0);
              const mesActLabel = dataMes?.label || "Actual";
              const mesPrevLabel = mesPrevMeta?.label || "Anterior";

              const barData = [
                { name: "Devoluciones", [mesActLabel]: totalDevAct, [mesPrevLabel]: totalDevPrev },
                { name: "Relanzamientos", [mesActLabel]: totalRelAct, [mesPrevLabel]: totalRelPrev },
              ];
              const pctData = [
                { name: "% Devoluciones", [mesActLabel]: totalServAct > 0 ? +(totalDevAct/totalServAct*100).toFixed(2) : 0, [mesPrevLabel]: totalServPrev > 0 ? +(totalDevPrev/totalServPrev*100).toFixed(2) : 0 },
                { name: "% Relanzamientos", [mesActLabel]: totalServAct > 0 ? +(totalRelAct/totalServAct*100).toFixed(2) : 0, [mesPrevLabel]: totalServPrev > 0 ? +(totalRelPrev/totalServPrev*100).toFixed(2) : 0 },
              ];

              // Relanzamientos por ciudad
              const ciudadRelMap = {};
              for (const e of empresasConScore) {
                for (const c of (e.topCiudades || [])) {
                  if (!ciudadRelMap[c.city]) ciudadRelMap[c.city] = { actual: 0, prev: 0 };
                }
              }
              // Actual: sum relanzamientos by ciudad from empresas
              if (dataMes?.ciudades) {
                for (const c of dataMes.ciudades) {
                  if (!ciudadRelMap[c.city]) ciudadRelMap[c.city] = { actual: 0, prev: 0 };
                  // Aggregate from empresas that operate in this city
                  const empsInCity = empresasConScore.filter(e => (e.topCiudades||[]).some(tc => tc.city === c.city));
                  ciudadRelMap[c.city].actual = empsInCity.reduce((s,e) => s + (e.relanzamientos||0), 0);
                }
              }
              if (dataPrev?.ciudades) {
                for (const c of dataPrev.ciudades) {
                  if (!ciudadRelMap[c.city]) ciudadRelMap[c.city] = { actual: 0, prev: 0 };
                  const empsInCity = (dataPrev.empresas||[]).filter(e => (e.topCiudades||[]).some(tc => tc.city === c.city));
                  ciudadRelMap[c.city].prev = empsInCity.reduce((s,e) => s + (e.relanzamientos||0), 0);
                }
              }
              const ciudadRelData = Object.entries(ciudadRelMap)
                .filter(([,v]) => v.actual > 0 || v.prev > 0)
                .map(([city, v]) => ({ city, [mesActLabel]: v.actual, [mesPrevLabel]: v.prev }))
                .sort((a,b) => b[mesActLabel] - a[mesActLabel])
                .slice(0, 12);

              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Devoluciones + Relanzamientos vs anterior */}
                  <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                    <h3 className="font-bold text-gray-700 text-sm mb-3">📦 Devoluciones y Relanzamientos vs {mesPrevLabel}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey={mesActLabel} fill={PIBOX_PURPLE} radius={[4,4,0,0]} />
                        <Bar dataKey={mesPrevLabel} fill="#DDD6FE" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* % participación - tortas */}
                  <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                    <h3 className="font-bold text-gray-700 text-sm mb-3">📊 Participación sobre servicios — {mesActLabel}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={[
                          { name: "Completados", value: totalServAct - totalDevAct - totalRelAct > 0 ? totalServAct - totalDevAct - totalRelAct : totalServAct },
                          { name: "Devoluciones", value: totalDevAct },
                          { name: "Relanzamientos", value: totalRelAct },
                        ].filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75}
                          label={({name, percent}) => `${name.split(" ")[0]} ${(percent*100).toFixed(1)}%`} labelLine={false}>
                          <Cell fill={SEM_VERDE} />
                          <Cell fill={SEM_ROJO} />
                          <Cell fill={SEM_AMARILLO} />
                        </Pie>
                        <Tooltip formatter={v => v.toLocaleString()} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-1 text-[10px] text-gray-500">
                      <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{background:SEM_VERDE}}/>Completados</span>
                      <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{background:SEM_ROJO}}/>Devoluciones {totalServAct>0?((totalDevAct/totalServAct)*100).toFixed(1):"0"}%</span>
                      <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{background:SEM_AMARILLO}}/>Relanzamientos {totalServAct>0?((totalRelAct/totalServAct)*100).toFixed(1):"0"}%</span>
                    </div>
                  </div>

                  {/* Relanzamientos por ciudad */}
                  <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                    <h3 className="font-bold text-gray-700 text-sm mb-3">🏙️ Relanzamientos por ciudad</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={ciudadRelData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF" />
                        <XAxis type="number" tick={{ fontSize: 9 }} />
                        <YAxis dataKey="city" type="category" width={80} tick={{ fontSize: 9 }} />
                        <Tooltip />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey={mesActLabel} fill={PIBOX_PURPLE} radius={[0,4,4,0]} />
                        <Bar dataKey={mesPrevLabel} fill="#DDD6FE" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}

            {/* Evolución semanal */}
            {activeTot?.weekly?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-700 text-sm">📈 Evolución semanal{filterOpType && <span className="text-xs font-normal text-gray-400 ml-1">(aprox. empresas filtradas)</span>}</h3>
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
                      <BarChart data={(activeTot?.weekly||[]).map((w,i)=>({
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
                      <BarChart data={(activeTot?.weekly||[]).map((w,i)=>({
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
                    <p className="text-xs text-gray-500 mb-2 font-semibold">Ef. Operativa / Cancelación</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={(activeTot?.weekly||[]).map((w,i)=>({
                          ...w,
                          tc_prev:   dataPrev?.totales?.weekly?.[i]?.tasa_completado  ?? null,
                          canc_prev: dataPrev?.totales?.weekly?.[i]?.tasa_cancelacion ?? null,
                        }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                        <XAxis dataKey="label" tick={{fontSize:9}} angle={-30} textAnchor="end" height={45}/>
                        <YAxis tick={{fontSize:9}} tickFormatter={v=>`${(v*100).toFixed(0)}%`}/>
                        <Tooltip formatter={v=>fmtPct(v)}/>
                        <Legend iconSize={8} wrapperStyle={{fontSize:9}}/>
                        <Line dataKey="tasa_completado"  name="Ef. Operativa"           stroke={SEM_VERDE} strokeWidth={2} dot={{r:3}}/>
                        <Line dataKey="tasa_cancelacion" name="Cancelación"             stroke={SEM_ROJO}  strokeWidth={2} dot={{r:3}} strokeDasharray="5 3"/>
                        {mesPrevMeta && <Line dataKey="tc_prev"   name="Ef. Operativa (prev)" stroke={SEM_VERDE} strokeWidth={1.5} dot={{r:2}} strokeDasharray="3 3" strokeOpacity={0.5}/>}
                        {mesPrevMeta && <Line dataKey="canc_prev" name="Cancelación (prev)"   stroke={SEM_ROJO}  strokeWidth={1.5} dot={{r:2}} strokeDasharray="3 3" strokeOpacity={0.5}/>}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Relanzamientos por empresa + Devoluciones por empresa — side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-700 text-sm">🔄 Distribucion de relanzamientos</h3>
                {empWithRelaunch.length > 0 && (
                  <button onClick={() => {
                    const csv = ["Empresa,Tipo de Operacion,Relanzamientos totales,Servicios,Promedio por servicio", ...empWithRelaunch.map(c => `"${c.empresa}","${c.topOps?.[0]?.op||''}",${c.relanzamientos||0},${c.total},${c.total > 0 ? ((c.relanzamientos||0)/c.total).toFixed(2) : "0"}`)].join("\n");
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
              const devolData = empresasConScore.filter(e => (e.devueltos||0) > 0)
                .map(e => ({ empresa: e.empresa, paquetes: e.paquetes||0, devueltos: e.devueltos||0, tasa: (e.paquetes||0) > 0 ? (e.devueltos||0)/(e.paquetes||0) : null, topOps: e.topOps }))
                .sort((a,b) => b.devueltos - a.devueltos);
              if (!devolData.length) return null;
              const totPaq = devolData.reduce((s,d) => s+d.paquetes, 0);
              const totDev = devolData.reduce((s,d) => s+d.devueltos, 0);
              const totTasa = totPaq > 0 ? totDev/totPaq : 0;
              return (
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-700 text-sm">📦 Devoluciones por empresa</h3>
                    <button onClick={() => {
                      const csv = ["Empresa,Tipo de Operacion,Paquetes,Devueltos,Tasa Devolucion", ...devolData.map(d => `"${d.empresa}","${d.topOps?.[0]?.op||''}",${d.paquetes},${d.devueltos},${(d.tasa*100).toFixed(1)}%`)].join("\n");
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
                            <td className="px-3 py-2 font-semibold" style={{color: d.tasa === null ? "#9ca3af" : d.tasa > 0.10 ? SEM_ROJO : d.tasa > 0.05 ? SEM_AMARILLO : SEM_VERDE}}>{d.tasa === null ? <span title="Sin paquetes registrados — revisar datos fuente">s/d</span> : fmtPct(d.tasa)}</td>
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
            </div>


            {/* Cancelados por Pasajero y Expirados — side by side */}
            {(() => {
              const fmtMin = (m) => {
                if (m === null || m === undefined) return "—";
                const h = Math.floor(m / 60);
                const min = Math.round(m % 60);
                return h > 0 ? `${h}h ${min}m` : `${min}m`;
              };

              const cancelPaxData = empresasConScore
                .filter(e => (e.canceladosPax || 0) > 0)
                .map(e => ({
                  empresa: e.empresa,
                  cancelados: e.canceladosPax || 0,
                  total: e.total,
                  pct: e.total > 0 ? (e.canceladosPax || 0) / e.total : 0,
                  avgTiempo: e.avgTiempoCancelPax,
                  topOps: e.topOps,
                  bookings: e.cancelPaxBookings || [],
                }))
                .sort((a, b) => b.cancelados - a.cancelados);

              const expiradosData = empresasConScore
                .filter(e => (e.expirados || 0) > 0)
                .map(e => ({
                  empresa: e.empresa,
                  expirados: e.expirados || 0,
                  total: e.total,
                  pct: e.total > 0 ? (e.expirados || 0) / e.total : 0,
                  avgTiempo: e.avgTiempoExpirado,
                  topOps: e.topOps,
                }))
                .sort((a, b) => b.expirados - a.expirados);

              if (!cancelPaxData.length && !expiradosData.length) return null;

              const dlCSV = (data, filename, cols) => {
                const csv = [cols.headers.join(","), ...data.map(r => cols.row(r))].join("\n");
                const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
              };

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">

                  {/* Tabla: Cancelados por Pasajero */}
                  <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-gray-700 text-sm">🚶 Cancelados por Pasajero — Top empresas</h3>
                      {cancelPaxData.length > 0 && (
                        <button
                          onClick={() => dlCSV(cancelPaxData, "cancelados_pasajero.csv", {
                            headers: ["Empresa", "Tipo de Operacion", "Cancelados por Pasajero", "Total servicios", "% del total", "Tiempo promedio servicio", "Booking IDs cancelados"],
                            row: r => `"${r.empresa}","${r.topOps?.[0]?.op||''}",${r.cancelados},${r.total},${(r.pct * 100).toFixed(1)}%,${fmtMin(r.avgTiempo)},"${r.bookings.join(' | ')}"`,
                          })}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200"
                        >
                          📥 Descargar ({cancelPaxData.length})
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-3">Tiempo promedio del servicio al momento de la cancelación</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: SEM_ROJO }} className="text-white">
                            {["Empresa", "Cancelados", "% del total", "Tiempo prom."].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {cancelPaxData.length === 0 ? (
                            <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">Sin cancelaciones por pasajero.</td></tr>
                          ) : cancelPaxData.slice(0, 15).map((d, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-red-50/30"}>
                              <td className="px-3 py-2 font-semibold text-gray-700 max-w-[140px] truncate" title={d.empresa}>{d.empresa}</td>
                              <td className="px-3 py-2 font-bold" style={{ color: SEM_ROJO }}>{d.cancelados.toLocaleString()}</td>
                              <td className="px-3 py-2" style={{ color: d.pct > 0.15 ? SEM_ROJO : d.pct > 0.08 ? SEM_AMARILLO : "#374151" }}>{(d.pct * 100).toFixed(1)}%</td>
                              <td className="px-3 py-2 text-gray-600">{fmtMin(d.avgTiempo)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-red-200 bg-red-50 font-bold">
                            <td className="px-3 py-2 text-gray-800">Total</td>
                            <td className="px-3 py-2" style={{ color: SEM_ROJO }}>{cancelPaxData.reduce((s, d) => s + d.cancelados, 0).toLocaleString()}</td>
                            <td className="px-3 py-2">—</td>
                            <td className="px-3 py-2">—</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {cancelPaxData.length > 15 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">Mostrando 15 de {cancelPaxData.length}. Descarga CSV para ver todos.</p>
                    )}
                  </div>

                  {/* Tabla: Expirados */}
                  <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-gray-700 text-sm">⏰ Expirados — Top empresas</h3>
                      {expiradosData.length > 0 && (
                        <button
                          onClick={() => dlCSV(expiradosData, "expirados.csv", {
                            headers: ["Empresa", "Tipo de Operacion", "Expirados", "Total servicios", "% del total", "Tiempo promedio servicio"],
                            row: r => `"${r.empresa}","${r.topOps?.[0]?.op||''}",${r.expirados},${r.total},${(r.pct * 100).toFixed(1)}%,${fmtMin(r.avgTiempo)}`,
                          })}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200"
                        >
                          📥 Descargar ({expiradosData.length})
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-3">Tiempo promedio del servicio al momento de expirar</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: SEM_AMARILLO }} className="text-white">
                            {["Empresa", "Expirados", "% del total", "Tiempo prom."].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {expiradosData.length === 0 ? (
                            <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">Sin servicios expirados.</td></tr>
                          ) : expiradosData.slice(0, 15).map((d, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-yellow-50/30"}>
                              <td className="px-3 py-2 font-semibold text-gray-700 max-w-[140px] truncate" title={d.empresa}>{d.empresa}</td>
                              <td className="px-3 py-2 font-bold" style={{ color: SEM_AMARILLO }}>{d.expirados.toLocaleString()}</td>
                              <td className="px-3 py-2" style={{ color: d.pct > 0.10 ? SEM_ROJO : d.pct > 0.05 ? SEM_AMARILLO : "#374151" }}>{(d.pct * 100).toFixed(1)}%</td>
                              <td className="px-3 py-2 text-gray-600">{fmtMin(d.avgTiempo)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-yellow-300 bg-yellow-50 font-bold">
                            <td className="px-3 py-2 text-gray-800">Total</td>
                            <td className="px-3 py-2" style={{ color: SEM_AMARILLO }}>{expiradosData.reduce((s, d) => s + d.expirados, 0).toLocaleString()}</td>
                            <td className="px-3 py-2">—</td>
                            <td className="px-3 py-2">—</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {expiradosData.length > 15 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">Mostrando 15 de {expiradosData.length}. Descarga CSV para ver todos.</p>
                    )}
                  </div>

                </div>
              );
            })()}

            {/* Proyección de Cierre */}
            {(() => {
              const nowDate  = new Date();
              const nowKey   = `${nowDate.getFullYear()}-${String(nowDate.getMonth()+1).padStart(2,"0")}`;
              const esMesAct = mesKey === nowKey;

              const [yr, mo] = mesKey.split("-").map(Number);
              const totalDias = new Date(yr, mo, 0).getDate();

              let ultimoDia = 0;
              if (activeTot?.weekly?.length) {
                const lastLabel = activeTot.weekly[activeTot.weekly.length - 1]?.label || "";
                const mMatch = lastLabel.match(/[–\-](\d{1,2})\/\d{2}/);
                if (mMatch) ultimoDia = parseInt(mMatch[1], 10);
              }

              const diasConDatos = esMesAct
                ? (ultimoDia > 0 ? ultimoDia : nowDate.getDate())
                : totalDias;
              const pct = diasConDatos / totalDias;

              // ── Estacionalidad semanal ──────────────────────────────────────
              const dailyData   = (activeTot?.daily || []).filter(d => d.gmv > 0);
              const dowBuckets  = Array.from({length: 7}, () => []);
              dailyData.forEach(d => {
                const dow = new Date(d.date + "T12:00:00").getDay();
                dowBuckets[dow].push(d.gmv);
              });
              const globalAvgDay = dailyData.length > 0 ? gmvTotal / dailyData.length : 0;
              const dowAvg = dowBuckets.map(arr =>
                arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : globalAvgDay
              );
              const sIdx = globalAvgDay > 0 ? dowAvg.map(a => a / globalAvgDay) : Array(7).fill(1);
              const usandoEstacionalidad = dailyData.length >= 3;

              // ── Factor festivo: aprender del mes anterior ───────────────────
              let holidayFactor = 0.65;
              let holidayFactorSrc = "estimado (sin datos previos)";
              const prevDailyData  = (dataPrev?.totales?.daily || []).filter(d => d.gmv > 0);
              const prevFestivosArr = mesPrevMeta ? (festivosMap[mesPrevMeta.key] || []).map(Number) : [];
              if (prevFestivosArr.length > 0 && prevDailyData.length > 0) {
                const holGmv  = prevDailyData.filter(d => prevFestivosArr.includes(new Date(d.date + "T12:00:00").getDate())).map(d => d.gmv);
                const normGmv = prevDailyData.filter(d => !prevFestivosArr.includes(new Date(d.date + "T12:00:00").getDate())).map(d => d.gmv);
                if (holGmv.length > 0 && normGmv.length > 0) {
                  const avgHol  = holGmv.reduce((s, v) => s + v, 0) / holGmv.length;
                  const avgNorm = normGmv.reduce((s, v) => s + v, 0) / normGmv.length;
                  if (avgNorm > 0) {
                    holidayFactor = avgHol / avgNorm;
                    holidayFactorSrc = `aprendido de ${mesPrevMeta.label} (${prevFestivosArr.length} festivo${prevFestivosArr.length > 1 ? "s" : ""})`;
                  }
                }
              }

              // ── Peso por día: sIdx[DOW] × factor festivo ───────────────────
              const festActuales = festivosMes.filter(n => n > 0 && n <= totalDias);
              const dayWeight = (dayNum) => {
                const dow    = new Date(yr, mo - 1, dayNum).getDay();
                const isFest = festActuales.includes(dayNum);
                return sIdx[dow] * (isFest ? holidayFactor : 1);
              };

              let wElapsed = 0, wTotal = 0;
              for (let d = 1; d <= totalDias; d++) {
                const w = dayWeight(d);
                wTotal += w;
                if (d <= diasConDatos) wElapsed += w;
              }

              // Proyección ajustada (cae al lineal si no hay datos diarios)
              const gmvProy = wElapsed > 0 ? gmvTotal / wElapsed * wTotal
                : (pct > 0 ? gmvTotal / pct : gmvTotal);

              const histPrev = historialGlobal.filter(h => h.key < mesKey);

              let halfRange = 0.12;
              if (histPrev.length >= 2) {
                const vals = histPrev.map(h => h.gmv).filter(v => v > 0);
                if (vals.length >= 2) {
                  const avgGmvH = vals.reduce((s, v) => s + v, 0) / vals.length;
                  const maxGmv  = Math.max(...vals);
                  const minGmv  = Math.min(...vals);
                  if (avgGmvH > 0) halfRange = Math.min((maxGmv - minGmv) / (2 * avgGmvH), 0.35);
                }
              }

              const gmvOpt  = gmvProy * (1 + halfRange);
              const gmvCons = gmvProy * (1 - halfRange);
              const avgHist = histPrev.length
                ? histPrev.reduce((s, h) => s + h.gmv, 0) / histPrev.length
                : 0;
              const deltaVsAvg = avgHist > 0 ? (gmvProy - avgHist) / avgHist : null;

              const shortLabel = (l="") => l.replace(/^(\w{3})\w*\s(\d{4})$/, "$1. $2");

              const chartData = [
                ...histPrev.slice(-5).map(h => ({
                  label: shortLabel(h.label),
                  gmvHist: h.gmv,
                  gmvProy: null,
                })),
                {
                  label: shortLabel(dataMes?.label || mesKey),
                  gmvHist: null,
                  gmvProy,
                },
              ];

              const totalServProy = pct > 0 ? Math.round(totalServicios / pct) : totalServicios;
              const gmvPorDia     = diasConDatos > 0 ? gmvTotal / diasConDatos : 0;
              const gmvPorServ    = totalServicios > 0 ? gmvTotal / totalServicios : 0;

              return (
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                  {/* Meta mensual manual */}
                  {(() => {
                    const cumplAcum  = metaMes > 0 ? (gmvTotal / metaMes * 100) : null;
                    const cumplProy  = metaMes > 0 ? (gmvProy  / metaMes * 100) : null;
                    const cumplOpt   = metaMes > 0 ? (gmvOpt   / metaMes * 100) : null;
                    const cumplCons  = metaMes > 0 ? (gmvCons  / metaMes * 100) : null;
                    const semColor   = (p) => p === null ? "" : p >= 95 ? "#16a34a" : p >= 80 ? "#d97706" : "#dc2626";
                    const semBg      = (p) => p === null ? "" : p >= 95 ? "#dcfce7" : p >= 80 ? "#fef3c7" : "#fee2e2";

                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between mb-4">
                          <h3 className="font-bold text-gray-700 text-sm">📈 Proyección de Cierre</h3>
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Input meta */}
                            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5">
                              <span className="text-xs font-semibold text-purple-700">🎯 Meta:</span>
                              <span className="text-xs text-purple-400">$</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={metaMes > 0 ? metaMes.toLocaleString("es-CO") : ""}
                                placeholder="0"
                                onChange={e => setMetaMes(e.target.value.replace(/\./g, ""))}
                                className="w-32 text-xs font-bold text-purple-800 bg-transparent focus:outline-none text-right"
                              />
                            </div>
                            {/* Input festivos */}
                            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
                              <span className="text-xs font-semibold text-orange-700">🎉 Festivos (días):</span>
                              <input
                                type="text"
                                value={festivosRaw}
                                placeholder="ej: 7, 20"
                                onChange={e => setFestivosRaw(e.target.value)}
                                onBlur={e => {
                                  const dias = e.target.value.split(/[,\s]+/).map(s => parseInt(s)).filter(n => !isNaN(n) && n > 0);
                                  setFestivosMes(dias);
                                  setFestivosRaw(dias.join(", "));
                                }}
                                className="w-24 text-xs font-bold text-orange-800 bg-transparent focus:outline-none"
                              />
                            </div>
                            {esMesAct ? (
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-gray-500">Día {diasConDatos} de {totalDias}</div>
                                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full"
                                       style={{width:`${Math.min(pct*100,100).toFixed(1)}%`,background:BRAND_GRADIENT}}/>
                                </div>
                                <div className="text-xs font-bold text-purple-600">{(pct*100).toFixed(1)}%</div>
                              </div>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-bold text-white"
                                    style={{background:PIBOX_PURPLE}}>Mes completado</span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100"
                               style={{borderLeft:`3px solid ${PIBOX_PURPLE}`}}>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">GMV acumulado</p>
                            <p className="text-lg font-extrabold mt-1" style={{color:PIBOX_PURPLE}}>{fmtFull(gmvTotal)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{(pct*100).toFixed(1)}% del mes</p>
                            {cumplAcum !== null && (
                              <span className="mt-1.5 inline-block text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={{background:semBg(cumplAcum),color:semColor(cumplAcum)}}>
                                {cumplAcum.toFixed(1)}% meta
                              </span>
                            )}
                          </div>
                          <div className="rounded-xl p-3 border border-purple-200"
                               style={{background:BRAND_GRADIENT}}>
                            <p className="text-xs text-white/80 uppercase tracking-wide">Proyección al cierre</p>
                            <p className="text-lg font-extrabold mt-1 text-white">{fmtFull(gmvProy)}</p>
                            {deltaVsAvg !== null && (
                              <p className="text-xs font-semibold mt-0.5 text-white/80">
                                {deltaVsAvg >= 0 ? "▲" : "▼"} {Math.abs(deltaVsAvg*100).toFixed(1)}% vs prom. hist.
                              </p>
                            )}
                            {cumplProy !== null && (
                              <span className="mt-1.5 inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-white/25 text-white">
                                {cumplProy.toFixed(1)}% meta
                              </span>
                            )}
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100"
                               style={{borderLeft:`3px solid #16a34a`}}>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">↑ Optimista</p>
                            <p className="text-lg font-extrabold mt-1" style={{color:"#16a34a"}}>{fmtFull(gmvOpt)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">+{(halfRange*100).toFixed(0)}% rango</p>
                            {cumplOpt !== null && (
                              <span className="mt-1.5 inline-block text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={{background:semBg(cumplOpt),color:semColor(cumplOpt)}}>
                                {cumplOpt.toFixed(1)}% meta
                              </span>
                            )}
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100"
                               style={{borderLeft:`3px solid #d97706`}}>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">↓ Conservador</p>
                            <p className="text-lg font-extrabold mt-1" style={{color:"#d97706"}}>{fmtFull(gmvCons)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">-{(halfRange*100).toFixed(0)}% rango</p>
                            {cumplCons !== null && (
                              <span className="mt-1.5 inline-block text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={{background:semBg(cumplCons),color:semColor(cumplCons)}}>
                                {cumplCons.toFixed(1)}% meta
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{top:16,right:40,left:0,bottom:0}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                          <XAxis dataKey="label" tick={{fontSize:10}}/>
                          <YAxis tick={{fontSize:10}} tickFormatter={fmtM}/>
                          <Tooltip formatter={v=>fmtFull(v)}/>
                          <Bar dataKey="gmvHist" name="GMV histórico" fill="#DDD6FE" radius={[4,4,0,0]}/>
                          <Bar dataKey="gmvProy"  name="Proyección"    fill={PIBOX_PURPLE} radius={[4,4,0,0]}/>
                          {avgHist > 0 && (
                            <ReferenceLine y={avgHist} stroke="#9CA3AF" strokeDasharray="4 2"
                              label={{value:"Prom.",position:"right",fontSize:9,fill:"#9CA3AF"}}/>
                          )}
                          <ReferenceLine y={gmvOpt}  stroke="#16a34a" strokeDasharray="4 2"
                            label={{value:"Opt.",position:"right",fontSize:9,fill:"#16a34a"}}/>
                          <ReferenceLine y={gmvCons} stroke="#d97706" strokeDasharray="4 2"
                            label={{value:"Cons.",position:"right",fontSize:9,fill:"#d97706"}}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-xs text-gray-500">Promedio hist. mensual</p>
                        <p className="font-bold text-gray-800">{avgHist > 0 ? fmtFull(avgHist) : "—"}</p>
                        {deltaVsAvg !== null && (
                          <p className="text-xs font-semibold mt-0.5"
                             style={{color: deltaVsAvg >= 0 ? "#16a34a" : "#d97706"}}>
                            {deltaVsAvg >= 0 ? "▲" : "▼"} {Math.abs(deltaVsAvg*100).toFixed(1)}% proy. vs hist.
                          </p>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-xs text-gray-500">Servicios proyectados</p>
                        <p className="font-bold text-gray-800">{totalServProy.toLocaleString()}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-xs text-gray-500">GMV / día</p>
                        <p className="font-bold text-gray-800">{fmtFull(gmvPorDia)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-xs text-gray-500">GMV / servicio</p>
                        <p className="font-bold text-gray-800">{fmtFull(gmvPorServ)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-0.5">
                    <p className="text-[10px] text-gray-400">
                      {usandoEstacionalidad
                        ? `📊 Proyección con estacionalidad semanal (${dailyData.length} días con datos). Pesos por DOW calculados del mes actual.`
                        : `📊 Proyección lineal (sin datos diarios suficientes — carga desde ClickHouse para activar estacionalidad).`}
                      {" "}Rango ±{(halfRange*100).toFixed(0)}% de varianza de {histPrev.length} mes{histPrev.length !== 1 ? "es" : ""} anteriores.
                    </p>
                    {festActuales.length > 0 && (
                      <p className="text-[10px] text-orange-500">
                        🎉 {festActuales.length} festivo{festActuales.length > 1 ? "s" : ""} del mes ajustados (días {festActuales.join(", ")}).
                        Factor festivo: {(holidayFactor*100).toFixed(0)}% vs día normal — {holidayFactorSrc}.
                      </p>
                    )}
                    {prevFestivosArr.length > 0 && festActuales.length === 0 && (
                      <p className="text-[10px] text-gray-400">
                        💡 Factor festivo aprendido del mes anterior: {(holidayFactor*100).toFixed(0)}% vs día normal ({holidayFactorSrc}).
                        Ingresa los festivos de este mes para aplicarlo.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        );
      })()}

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
                <Line dataKey="tasa_completado"  name="Ef. Operativa" stroke={SEM_VERDE} strokeWidth={2} dot={{r:2}}/>
                <Line dataKey="tasa_cancelacion" name="Cancelación"  stroke={SEM_ROJO}  strokeWidth={2} dot={{r:2}} strokeDasharray="4 2"/>
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
