import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  loadMesData, loadMesDataAsync, mesesDisponibles, fmtM, fmtFull,
  PIBOX_PURPLE, PIBOX_PINK, SEM_ROJO, SEM_AMARILLO, SEM_VERDE,
} from "./utils";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";

const EJECUTIVO_COLORS = [
  "#7C22D4","#C026D3","#2563EB","#0891B2","#16A34A","#D97706","#DC2626","#7C3AED",
];

function deltaColor(pct) {
  if (pct === null) return "#9CA3AF";
  if (pct >= 0.05) return SEM_VERDE;
  if (pct >= -0.05) return "#6B7280";
  return SEM_ROJO;
}

function DeltaBadge({ pct }) {
  if (pct === null) return <span className="text-gray-400 text-xs">—</span>;
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "→";
  return (
    <span className="text-xs font-semibold" style={{ color: deltaColor(pct) }}>
      {arrow} {Math.abs(pct * 100).toFixed(1)}%
    </span>
  );
}

function sortRows(rows, field, dir) {
  return [...rows].sort((a, b) => {
    let va = a[field] ?? 0;
    let vb = b[field] ?? 0;
    if (typeof va === "string") return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return dir === "asc" ? va - vb : vb - va;
  });
}

// ── Contador numérico con ± botones ──────────────────────────────────────────
function FestivosInput({ label, sublabel, value, onChange, color = PIBOX_PURPLE }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      {sublabel && <p className="text-[10px] text-gray-400 leading-tight">{sublabel}</p>}
      <div className="flex items-center gap-1 mt-1">
        <button onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-sm font-bold flex items-center justify-center">
          −
        </button>
        <input
          type="number" min="0" max="15" value={value}
          onChange={e => onChange(Math.max(0, Math.min(15, parseInt(e.target.value) || 0)))}
          className="w-12 text-center border border-gray-200 rounded-lg py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-300"
          style={{ color }}
        />
        <button onClick={() => onChange(Math.min(15, value + 1))}
          className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-sm font-bold flex items-center justify-center">
          +
        </button>
      </div>
    </div>
  );
}

export default function ProyeccionCliente() {
  const meses = mesesDisponibles();
  const [mesKey, setMesKey]       = useState(meses[meses.length - 1]?.key || "");
  useEffect(() => {
    if (meses.length > 0 && (!mesKey || !meses.find(m => m.key === mesKey)))
      setMesKey(meses[meses.length - 1].key);
  }, [meses.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [histPorEmpresa, setHistPorEmpresa] = useState({});
  const [cargandoHist, setCargandoHist]     = useState(false);
  const [busqueda, setBusqueda]             = useState("");
  const [ejecutivoFiltro, setEjecutivoFiltro] = useState("Todos");
  const [sortField, setSortField] = useState("gmv");
  const [sortDir, setSortDir]     = useState("desc");
  const [expandedEjec, setExpandedEjec] = useState({});
  const [vista, setVista] = useState("tabla");

  // ── Festivos ─────────────────────────────────────────────────────────────────
  const [festivosMesActual, setFestivosMesActual] = useState(0);
  const [festivosSigMes, setFestivosSigMes]       = useState(0);

  // Persist + reload festivos al cambiar de mes
  useEffect(() => {
    try {
      setFestivosMesActual(parseInt(localStorage.getItem(`pibox_festivos_${mesKey}`) || "0"));
      const [y, m] = mesKey.split("-").map(Number);
      const nextKey = `${y + (m === 12 ? 1 : 0)}-${String(m === 12 ? 1 : m + 1).padStart(2,"0")}`;
      setFestivosSigMes(parseInt(localStorage.getItem(`pibox_festivos_${nextKey}`) || "0"));
    } catch {}
  }, [mesKey]);

  const handleFestivosMes = (v) => {
    setFestivosMesActual(v);
    try { localStorage.setItem(`pibox_festivos_${mesKey}`, String(v)); } catch {}
  };
  const handleFestivosSig = (v) => {
    setFestivosSigMes(v);
    try {
      const [y, m] = mesKey.split("-").map(Number);
      const nextKey = `${y + (m === 12 ? 1 : 0)}-${String(m === 12 ? 1 : m + 1).padStart(2,"0")}`;
      localStorage.setItem(`pibox_festivos_${nextKey}`, String(v));
    } catch {}
  };

  const dataMes = useMemo(() => (mesKey ? loadMesData(mesKey) : null), [mesKey]);

  useEffect(() => {
    let cancelled = false;
    setCargandoHist(true);
    (async () => {
      const allMeses = mesesDisponibles();
      const hist = {};
      for (const m of allMeses) {
        if (m.key >= mesKey) continue;
        const d = await loadMesDataAsync(m.key);
        if (!d?.empresas) continue;
        for (const e of d.empresas) {
          if (!hist[e.empresa]) hist[e.empresa] = [];
          hist[e.empresa].push({ key: m.key, label: m.label, gmv: e.gmv, total: e.total, completados: e.completados || 0 });
        }
      }
      if (!cancelled) { setHistPorEmpresa(hist); setCargandoHist(false); }
    })();
    return () => { cancelled = true; };
  }, [mesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calendario del mes actual ─────────────────────────────────────────────────
  const nowDate  = new Date();
  const nowKey   = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;
  const esMesAct = mesKey === nowKey;
  const tot      = dataMes?.totales;
  const [yr, mo] = mesKey.split("-").map(Number);
  const totalDias = new Date(yr, mo, 0).getDate();

  let ultimoDia = 0;
  if (tot?.weekly?.length) {
    const lastLabel = tot.weekly[tot.weekly.length - 1]?.label || "";
    const mMatch = lastLabel.match(/[–\-](\d{1,2})\/\d{2}/);
    if (mMatch) ultimoDia = parseInt(mMatch[1], 10);
  }
  const diasConDatos = esMesAct ? (ultimoDia > 0 ? ultimoDia : nowDate.getDate()) : totalDias;
  const pct = diasConDatos / totalDias;

  // ── Festivos: cálculo de días laborables ─────────────────────────────────────
  const diasLaborablesTotal = Math.max(totalDias - (esMesAct ? festivosMesActual : 0), 1);
  const festivosPasados = (esMesAct && festivosMesActual > 0)
    ? Math.round(festivosMesActual * diasConDatos / totalDias)
    : 0;
  const diasTrabajados = Math.max(diasConDatos - festivosPasados, 1);
  // pct ajustado: días trabajados / días laborables totales del mes
  const pctAdj = diasLaborablesTotal > 0 ? diasTrabajados / diasLaborablesTotal : pct;

  // ── Siguiente mes ─────────────────────────────────────────────────────────────
  const nextMesDate    = new Date(yr, mo, 1);
  const nextMesLabel   = nextMesDate.toLocaleString("es", { month: "long", year: "numeric" });
  const [yrN, moN]     = [nextMesDate.getFullYear(), nextMesDate.getMonth() + 1];
  const totalDiasNext  = new Date(yrN, moN, 0).getDate();
  const diasLaborablesNext = Math.max(totalDiasNext - festivosSigMes, 1);

  // ── Construir filas con proyecciones ajustadas por festivos ──────────────────
  const rows = useMemo(() => {
    if (!dataMes?.empresas) return [];
    return dataMes.empresas.map(e => {
      const gmvAct = e.gmv || 0;

      // Proyección cierre: tasa diaria ajustada × días laborables totales del mes
      const gmvProy = pctAdj > 0 ? gmvAct / pctAdj : gmvAct;

      // Proyección siguiente mes: promedio últimos 3 meses por empresa,
      // ajustado por días laborables del siguiente mes
      const hist = histPorEmpresa[e.empresa] || [];
      const rec  = hist.slice(-3);
      let proyNext;
      if (rec.length > 0) {
        if (festivosSigMes > 0) {
          // Promedio histórico diario × días laborables del siguiente mes
          const avgHistCalDays = rec.reduce((s, h) => {
            const [hy, hm] = h.key.split("-").map(Number);
            return s + new Date(hy, hm, 0).getDate();
          }, 0) / rec.length;
          const avgPerDay = rec.reduce((s, h) => s + h.gmv, 0) / rec.length / Math.max(avgHistCalDays, 1);
          proyNext = avgPerDay * diasLaborablesNext;
        } else {
          proyNext = rec.reduce((s, h) => s + h.gmv, 0) / rec.length;
        }
      } else {
        proyNext = gmvProy;
      }

      const deltaCierre = gmvAct   > 0 ? (gmvProy  - gmvAct)  / gmvAct  : null;
      const deltaNext   = gmvProy  > 0 ? (proyNext  - gmvProy) / gmvProy : null;

      return {
        empresa:     e.empresa,
        ejecutivo:   e.ejecutivo || "Sin asignar",
        completados: e.completados || 0,
        total:       e.total || 0,
        gmv:         gmvAct,
        gmvProy,
        proyNext,
        deltaCierre,
        deltaNext,
        histCount:   hist.length,
      };
    });
  }, [dataMes, histPorEmpresa, pctAdj, festivosSigMes, diasLaborablesNext]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ejecutivos únicos ─────────────────────────────────────────────────────────
  const ejecutivos = useMemo(() => ["Todos", ...[...new Set(rows.map(r => r.ejecutivo))].sort()], [rows]);

  // ── Filtrar ───────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(r => {
      const okBusq = !busqueda || r.empresa.toLowerCase().includes(busqueda.toLowerCase());
      const okEjec = ejecutivoFiltro === "Todos" || r.ejecutivo === ejecutivoFiltro;
      return okBusq && okEjec;
    });
  }, [rows, busqueda, ejecutivoFiltro]);

  // ── Agrupar por ejecutivo, ordenar dentro ─────────────────────────────────────
  const grupos = useMemo(() => {
    const map = {};
    for (const r of filtered) {
      if (!map[r.ejecutivo]) map[r.ejecutivo] = [];
      map[r.ejecutivo].push(r);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ejec, items], idx) => ({
        ejec,
        color:      EJECUTIVO_COLORS[idx % EJECUTIVO_COLORS.length],
        items:      sortRows(items, sortField, sortDir),
        totalGmv:   items.reduce((s, r) => s + r.gmv,         0),
        totalProy:  items.reduce((s, r) => s + r.gmvProy,     0),
        totalNext:  items.reduce((s, r) => s + r.proyNext,    0),
        totalCompl: items.reduce((s, r) => s + r.completados, 0),
      }));
  }, [filtered, sortField, sortDir]);

  const totalGmvGlobal   = grupos.reduce((s, g) => s + g.totalGmv,   0);
  const totalProyGlobal  = grupos.reduce((s, g) => s + g.totalProy,  0);
  const totalNextGlobal  = grupos.reduce((s, g) => s + g.totalNext,  0);
  const totalComplGlobal = grupos.reduce((s, g) => s + g.totalCompl, 0);

  // ── Resumen KAM (sobre todos los rows, sin filtro de búsqueda) ────────────────
  const gruposKAM = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!map[r.ejecutivo]) map[r.ejecutivo] = [];
      map[r.ejecutivo].push(r);
    }
    const gmvTotalAll = rows.reduce((s, r) => s + r.gmv, 0);
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ejec, items], idx) => {
        const tGmv   = items.reduce((s, r) => s + r.gmv,         0);
        const tProy  = items.reduce((s, r) => s + r.gmvProy,     0);
        const tNext  = items.reduce((s, r) => s + r.proyNext,    0);
        const tCompl = items.reduce((s, r) => s + r.completados, 0);
        const tTotal = items.reduce((s, r) => s + r.total,       0);
        return {
          ejec,
          color:      EJECUTIVO_COLORS[idx % EJECUTIVO_COLORS.length],
          nClientes:  items.length,
          totalGmv:   tGmv,
          totalProy:  tProy,
          totalNext:  tNext,
          totalCompl: tCompl,
          totalSvc:   tTotal,
          pctTotal:   gmvTotalAll > 0 ? tGmv / gmvTotalAll : 0,
          deltaProy:  tGmv  > 0 ? (tProy - tGmv)  / tGmv  : null,
          deltaNext:  tProy > 0 ? (tNext - tProy)  / tProy : null,
          tcGlobal:   tTotal > 0 ? tCompl / tTotal : null,
          items,
        };
      });
  }, [rows]);

  // ── Datos para gráfico ────────────────────────────────────────────────────────
  const chartData = grupos.map(g => ({
    name: g.ejec.split(" ")[0],
    fullName: g.ejec,
    GMV:        Math.round(g.totalGmv),
    Proyección: Math.round(g.totalProy),
    "Sig. mes": Math.round(g.totalNext),
  }));

  // ── Toggle sort ───────────────────────────────────────────────────────────────
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  };
  const SortArrow = ({ field }) => (
    <span className="ml-0.5 opacity-60">
      {sortField === field ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
    </span>
  );

  // ── Export CSV ────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const cols = ["Ejecutivo","Cliente","Completados","GMV Actual","Proy. Cierre","Proy. Sig. Mes"];
    const body = grupos.flatMap(g =>
      g.items.map(r => [
        `"${g.ejec}"`,
        `"${r.empresa}"`,
        r.completados,
        r.gmv.toFixed(0),
        r.gmvProy.toFixed(0),
        r.proyNext.toFixed(0),
      ].join(","))
    );
    const csv = [cols.join(","), ...body].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `proyeccion-clientes-${mesKey}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ── Insight por KAM ──────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    if (!gruposKAM.length) return [];
    const gmvTotalAll = gruposKAM.reduce((s, g) => s + g.totalGmv, 0);
    return gruposKAM.map(g => {
      const lines = [];

      // Tendencia cierre
      if (g.deltaProy !== null) {
        if (g.deltaProy >= 0.15)
          lines.push({ tipo: "positivo", txt: `Con ${g.nClientes} clientes activos y ${(pctAdj*100).toFixed(0)}% del mes operado, la proyección de cierre supera el GMV acumulado en ${(g.deltaProy*100).toFixed(1)}%. La cartera mantiene un ritmo sostenido que valida la extrapolación.` });
        else if (g.deltaProy >= 0)
          lines.push({ tipo: "neutro", txt: `La proyección de cierre es ${(g.deltaProy*100).toFixed(1)}% superior al GMV actual. El ritmo es estable; pequeñas variaciones al final del mes podrían ajustar este resultado.` });
        else
          lines.push({ tipo: "alerta", txt: `La proyección de cierre es ${Math.abs(g.deltaProy*100).toFixed(1)}% inferior al GMV acumulado, lo que puede indicar una desaceleración reciente o concentración de operaciones en la primera parte del mes.` });
      }

      // Tendencia mes siguiente
      if (g.deltaNext !== null) {
        if (g.deltaNext <= -0.10)
          lines.push({ tipo: "alerta", txt: `La proyección de ${nextMesLabel} muestra una caída estimada del ${Math.abs(g.deltaNext*100).toFixed(1)}% vs el cierre proyectado. ${festivosSigMes > 0 ? `El ajuste por los ${festivosSigMes} festivo${festivosSigMes!==1?"s":""} de ${nextMesLabel} es el principal factor de esta reducción.` : "Revisar si hay clientes en pausa o cambios de operación previstos."}` });
        else if (g.deltaNext >= 0.10)
          lines.push({ tipo: "positivo", txt: `Se proyecta un crecimiento del ${(g.deltaNext*100).toFixed(1)}% para ${nextMesLabel}. ${festivosSigMes > 0 ? `Pese a los ${festivosSigMes} festivo${festivosSigMes!==1?"s":""} del mes, el promedio histórico respalda esta expectativa.` : "El comportamiento histórico de la cartera sustenta este crecimiento."}` });
        else
          lines.push({ tipo: "neutro", txt: `La proyección de ${nextMesLabel} es similar al cierre esperado (${g.deltaNext>=0?"+":" "}${(g.deltaNext*100).toFixed(1)}%). La cartera muestra comportamiento estable entre meses.` });
      }

      // Concentración de portafolio
      if (g.items.length > 0) {
        const sorted = [...g.items].sort((a,b) => b.gmvProy - a.gmvProy);
        const top1Pct = g.totalProy > 0 ? sorted[0].gmvProy / g.totalProy : 0;
        const top3Pct = g.totalProy > 0 ? sorted.slice(0,3).reduce((s,r) => s+r.gmvProy,0) / g.totalProy : 0;
        if (top1Pct > 0.50)
          lines.push({ tipo: "alerta", txt: `Alta concentración de riesgo: el cliente "${sorted[0].empresa}" representa el ${(top1Pct*100).toFixed(0)}% del GMV proyectado de esta cartera. Una variación en ese cliente impactará significativamente el resultado.` });
        else if (top3Pct > 0.75 && g.items.length > 3)
          lines.push({ tipo: "alerta", txt: `Los 3 clientes principales concentran el ${(top3Pct*100).toFixed(0)}% del GMV proyectado. Diversificar la cartera reduciría la exposición a cambios operativos individuales.` });
        else if (g.items.length >= 5)
          lines.push({ tipo: "positivo", txt: `La cartera está bien distribuida entre ${g.items.length} clientes; ningún cliente concentra más del ${(top1Pct*100).toFixed(0)}% del GMV proyectado, lo que reduce el riesgo de volatilidad.` });
      }

      // Clientes sin historial
      const nuevos = g.items.filter(r => r.histCount === 0);
      if (nuevos.length > 0)
        lines.push({ tipo: "neutro", txt: `${nuevos.length} cliente${nuevos.length!==1?"s":""} sin historial previo (${nuevos.map(r=>r.empresa).join(", ")}). Sus proyecciones son estimadas a partir del ritmo actual y deben tomarse con mayor precaución.` });

      // Impacto festivos en proyección cierre
      if (esMesAct && festivosMesActual > 0) {
        const gmvProySinAdj = g.totalGmv / pct;
        const impacto = g.totalProy - gmvProySinAdj;
        if (Math.abs(impacto) > g.totalGmv * 0.02)
          lines.push({ tipo: "info", txt: `El ajuste por los ${festivosMesActual} festivo${festivosMesActual!==1?"s":""} de este mes modifica la proyección de cierre en ${impacto >= 0 ? "+" : ""}${fmtFull(impacto)} respecto a la extrapolación sin ajuste. Esto refleja que los días hábiles son ${diasLaborablesTotal} de ${totalDias}.` });
      }

      // Participación en el total
      if (g.pctTotal > 0)
        lines.push({ tipo: "info", txt: `Esta cartera representa el ${(g.pctTotal*100).toFixed(1)}% del GMV acumulado de la plataforma, con una proyección de cierre de ${fmtFull(g.totalProy)}.` });

      return { ejec: g.ejec, color: g.color, lines };
    });
  }, [gruposKAM, pctAdj, pct, esMesAct, festivosMesActual, festivosSigMes, diasLaborablesTotal, nextMesLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  const iconoTipo = { positivo: "✅", alerta: "⚠️", neutro: "💡", info: "ℹ️" };
  const bgTipo   = { positivo: "bg-green-50 border-green-200 text-green-800", alerta: "bg-red-50 border-red-200 text-red-800", neutro: "bg-blue-50 border-blue-200 text-blue-800", info: "bg-gray-50 border-gray-200 text-gray-700" };

  if (!meses.length) return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800 text-sm">
      <b>Sin datos.</b> Ve a <b>⚙️ Configuración</b> y sube al menos un mes.
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── FESTIVOS — input al inicio ─────────────────────────────────────────── */}
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-800 text-sm mb-0.5">
              🗓️ ¿Cuántos festivos tienen los meses a proyectar?
            </p>
            <p className="text-xs text-amber-700 leading-snug">
              Los días festivos reducen el volumen operativo y afectan la proyección. Indícame cuántos festivos
              tiene <b>el mes actual</b> y <b>{nextMesLabel}</b> para que los cálculos sean más precisos.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 shrink-0">
            <FestivosInput
              label={`Festivos — ${dataMes?.label || mesKey}`}
              sublabel={esMesAct ? `${totalDias} días · ${diasLaborablesTotal} laborables con ajuste` : "Mes completo"}
              value={festivosMesActual}
              onChange={handleFestivosMes}
              color="#B45309"
            />
            <FestivosInput
              label={`Festivos — ${nextMesLabel}`}
              sublabel={`${totalDiasNext} días · ${diasLaborablesNext} laborables con ajuste`}
              value={festivosSigMes}
              onChange={handleFestivosSig}
              color="#B45309"
            />
          </div>
        </div>
        {(festivosMesActual > 0 || festivosSigMes > 0) && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {festivosMesActual > 0 && esMesAct && (
              <span className="bg-amber-100 border border-amber-300 px-3 py-1 rounded-full text-amber-800 font-semibold">
                ✂️ {festivosMesActual} festivo{festivosMesActual!==1?"s":""} est. · ~{festivosPasados} ya transcurrido{festivosPasados!==1?"s":""} · {diasTrabajados} días trabajados
              </span>
            )}
            {festivosSigMes > 0 && (
              <span className="bg-amber-100 border border-amber-300 px-3 py-1 rounded-full text-amber-800 font-semibold">
                🔮 {nextMesLabel}: {diasLaborablesNext} días laborables de {totalDiasNext}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Controles ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">📅 Mes base</label>
            <select value={mesKey} onChange={e => setMesKey(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {[...meses].reverse().map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">👤 Ejecutivo</label>
            <select value={ejecutivoFiltro} onChange={e => setEjecutivoFiltro(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {ejecutivos.map(ej => <option key={ej} value={ej}>{ej}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">🔍 Buscar cliente</label>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Nombre empresa..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-48"/>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setVista("tabla")}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${vista==="tabla" ? "text-white shadow" : "text-gray-600 hover:bg-purple-50"}`}
              style={vista==="tabla" ? {background:BRAND_GRADIENT} : {}}>
              📋 Tabla
            </button>
            <button onClick={() => setVista("grafico")}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${vista==="grafico" ? "text-white shadow" : "text-gray-600 hover:bg-purple-50"}`}
              style={vista==="grafico" ? {background:BRAND_GRADIENT} : {}}>
              📊 Gráfico
            </button>
            <button onClick={exportCSV}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200">
              📥 CSV
            </button>
          </div>
        </div>

        {/* Barra de progreso del mes */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
               style={{background:BRAND_GRADIENT}}>
            {esMesAct ? `📅 Día ${diasConDatos} de ${totalDias}` : "✅ Mes completado"}
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs ml-1">
              {(pct*100).toFixed(1)}%
              {festivosMesActual > 0 && esMesAct && (
                <span className="ml-1 opacity-80">→ {(pctAdj*100).toFixed(1)}% lab.</span>
              )}
            </span>
          </div>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
                 style={{width:`${Math.min(pctAdj*100,100).toFixed(1)}%`, background:BRAND_GRADIENT}}/>
          </div>
          {cargandoHist && <span className="text-xs text-purple-500 animate-pulse">⏳ Cargando historial...</span>}
        </div>
      </div>

      {/* ── KPIs globales ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Clientes",          value: filtered.length.toLocaleString(),  color: PIBOX_PURPLE, icon:"🏢" },
          { label:"GMV acumulado",     value: fmtFull(totalGmvGlobal),           color: PIBOX_PURPLE, icon:"💰" },
          { label:"Proy. mes actual",  value: fmtFull(totalProyGlobal),          color: PIBOX_PINK,   icon:"📈" },
          { label:`Proy. ${nextMesLabel}`, value: fmtFull(totalNextGlobal),      color: "#2563EB",    icon:"🔮" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
               style={{borderLeft:`4px solid ${k.color}`}}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{k.icon} {k.label}</p>
            <p className="text-xl font-extrabold mt-1" style={{color:k.color}}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Resumen por KAM ───────────────────────────────────────────────────── */}
      {gruposKAM.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-4">👤 Resumen por KAM</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {gruposKAM.map(g => (
              <div key={g.ejec} className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="px-4 py-3 text-white" style={{background:g.color}}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm truncate" title={g.ejec}>{g.ejec}</p>
                    <span className="bg-white/25 px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ml-2">
                      {g.nClientes} clientes
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-white/80 text-xs">
                    <span>📦 {g.totalSvc.toLocaleString()} servicios</span>
                    {g.tcGlobal !== null && (
                      <span>✅ {(g.tcGlobal * 100).toFixed(1)}% completado</span>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">💰 GMV acumulado</span>
                    <div className="text-right">
                      <span className="font-bold text-gray-800 text-sm">{fmtFull(g.totalGmv)}</span>
                      <span className="text-[10px] text-gray-400 ml-1.5">{(g.pctTotal*100).toFixed(1)}% del total</span>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${Math.min(g.pctTotal*100,100).toFixed(1)}%`, background:g.color}}/>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">📈 Proy. cierre</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 text-sm">{fmtFull(g.totalProy)}</span>
                      <DeltaBadge pct={g.deltaProy}/>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">🔮 Proy. {nextMesLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 text-sm">{fmtFull(g.totalNext)}</span>
                      <DeltaBadge pct={g.deltaNext}/>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-gray-200">
                    <p className="text-[9px] text-gray-400 mb-1.5 uppercase tracking-wide">GMV · Proy. cierre · Proy. sig. mes</p>
                    <div className="flex items-end gap-1 h-8">
                      {[
                        { v: g.totalGmv,  label: "Act.", bg: "#DDD6FE" },
                        { v: g.totalProy, label: "Cie.", bg: g.color   },
                        { v: g.totalNext, label: "Sig.", bg: PIBOX_PINK },
                      ].map(({ v, label, bg }) => {
                        const maxV = Math.max(g.totalGmv, g.totalProy, g.totalNext) || 1;
                        const ht   = Math.max(Math.round((v / maxV) * 32), 4);
                        return (
                          <div key={label} className="flex-1 flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-gray-400">{fmtM(v)}</span>
                            <div className="w-full rounded-t-sm" style={{height:`${ht}px`, background:bg}}/>
                            <span className="text-[9px] text-gray-400">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VISTA TABLA ───────────────────────────────────────────────────────── */}
      {vista === "tabla" && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:BRAND_GRADIENT}} className="text-white text-xs">
                  <th className="px-4 py-3 text-left font-semibold w-40">Ejecutivo / Cliente</th>
                  <th className="px-4 py-3 text-right font-semibold cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleSort("completados")}>
                    ✅ Svc. Completados <SortArrow field="completados"/>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold cursor-pointer select-none"
                      onClick={() => toggleSort("gmv")}>
                    💰 GMV actual <SortArrow field="gmv"/>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleSort("gmvProy")}>
                    📈 Proy. cierre <SortArrow field="gmvProy"/>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleSort("proyNext")}>
                    🔮 Proy. {nextMesLabel} <SortArrow field="proyNext"/>
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {grupos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                      Sin datos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : grupos.map((g, gi) => {
                  const isOpen = expandedEjec[g.ejec] !== false;
                  const deltaProyCierre = g.totalGmv  > 0 ? (g.totalProy - g.totalGmv)  / g.totalGmv  : null;
                  const deltaNext       = g.totalProy > 0 ? (g.totalNext - g.totalProy)  / g.totalProy : null;
                  return [
                    <tr key={`ejec-${g.ejec}`}
                        className="cursor-pointer select-none"
                        style={{background:`${g.color}18`}}
                        onClick={() => setExpandedEjec(prev => ({...prev, [g.ejec]: !isOpen}))}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{color:g.color}}>
                            {isOpen ? "▾" : "▸"} {g.ejec}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                                style={{background:g.color}}>
                            {g.items.length} clientes
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-700 text-xs">{g.totalCompl.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-xs" style={{color:g.color}}>{fmtFull(g.totalGmv)}</td>
                      <td className="px-4 py-2.5 text-right text-xs">
                        <div className="font-bold text-gray-800">{fmtFull(g.totalProy)}</div>
                        <DeltaBadge pct={deltaProyCierre}/>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs">
                        <div className="font-bold text-gray-800">{fmtFull(g.totalNext)}</div>
                        <DeltaBadge pct={deltaNext}/>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-end gap-0.5 h-5 justify-center">
                          {[g.totalGmv, g.totalProy, g.totalNext].map((v, i) => {
                            const maxV = Math.max(g.totalGmv, g.totalProy, g.totalNext);
                            const h = maxV > 0 ? Math.round((v / maxV) * 20) : 4;
                            return <div key={i} className="w-2 rounded-sm" style={{height:`${h}px`, background: i===0?"#DDD6FE":i===1?g.color:PIBOX_PINK}}/>;
                          })}
                        </div>
                      </td>
                    </tr>,
                    ...(isOpen ? g.items.map((r, ri) => (
                      <tr key={`${g.ejec}-${r.empresa}`}
                          className={`border-t border-gray-50 ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-purple-50/30`}>
                        <td className="px-4 py-2.5 pl-10">
                          <div className="font-semibold text-gray-800 text-xs truncate max-w-[180px]" title={r.empresa}>{r.empresa}</div>
                          {r.histCount === 0 && <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">nuevo</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-600">{r.completados.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold" style={{color:PIBOX_PURPLE}}>{fmtFull(r.gmv)}</td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          <div className="font-semibold text-gray-800">{fmtFull(r.gmvProy)}</div>
                          <DeltaBadge pct={r.deltaCierre}/>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          <div className="font-semibold text-gray-800">{fmtFull(r.proyNext)}</div>
                          {r.histCount > 0 ? <DeltaBadge pct={r.deltaNext}/> : <span className="text-[9px] text-gray-400">estimado</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-end gap-0.5 h-4 justify-center">
                            {[r.gmv, r.gmvProy, r.proyNext].map((v, i) => {
                              const maxV = Math.max(r.gmv, r.gmvProy, r.proyNext) || 1;
                              const ht = Math.max(Math.round((v / maxV) * 16), 2);
                              return <div key={i} className="w-2 rounded-sm" style={{height:`${ht}px`, background: i===0?"#DDD6FE":i===1?g.color:PIBOX_PINK}}/>;
                            })}
                          </div>
                        </td>
                      </tr>
                    )) : []),
                    gi < grupos.length - 1 && isOpen ? (
                      <tr key={`sep-${g.ejec}`}><td colSpan={6} className="py-0 bg-gray-100 h-px"/></tr>
                    ) : null,
                  ];
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-purple-300 text-xs font-bold" style={{background:BRAND_GRADIENT}}>
                  <td className="px-4 py-3 text-white">Total — {filtered.length} clientes</td>
                  <td className="px-4 py-3 text-right text-white">{totalComplGlobal.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-white">{fmtFull(totalGmvGlobal)}</td>
                  <td className="px-4 py-3 text-right text-white">
                    <div>{fmtFull(totalProyGlobal)}</div>
                    <DeltaBadge pct={totalGmvGlobal > 0 ? (totalProyGlobal - totalGmvGlobal) / totalGmvGlobal : null}/>
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    <div>{fmtFull(totalNextGlobal)}</div>
                    <DeltaBadge pct={totalProyGlobal > 0 ? (totalNextGlobal - totalProyGlobal) / totalProyGlobal : null}/>
                  </td>
                  <td className="px-4 py-3"/>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── VISTA GRÁFICO ─────────────────────────────────────────────────────── */}
      {vista === "grafico" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="font-bold text-gray-700 text-sm mb-4">💰 GMV por ejecutivo — actual vs proyecciones</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{top:4,right:8,left:0,bottom:30}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                <XAxis dataKey="name" tick={{fontSize:10}} angle={-30} textAnchor="end" height={50}/>
                <YAxis tick={{fontSize:10}} tickFormatter={fmtM}/>
                <Tooltip content={({active,payload,label}) => {
                  if (!active||!payload?.length) return null;
                  const d = chartData.find(c=>c.name===label);
                  return (
                    <div className="bg-white border border-purple-100 rounded-xl shadow-lg px-3 py-2 text-xs">
                      <p className="font-bold text-purple-700 mb-1">{d?.fullName || label}</p>
                      {payload.map((p,i)=><p key={i} style={{color:p.fill}}>{p.name}: {fmtFull(p.value)}</p>)}
                    </div>
                  );
                }}/>
                <Bar dataKey="GMV" name="GMV actual" fill="#DDD6FE" radius={[4,4,0,0]}/>
                <Bar dataKey="Proyección" name="Proy. cierre" fill={PIBOX_PURPLE} radius={[4,4,0,0]}/>
                <Bar dataKey="Sig. mes" name={`Proy. ${nextMesLabel}`} fill={PIBOX_PINK} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-1 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:"#DDD6FE"}}/>GMV actual</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:PIBOX_PURPLE}}/>Proy. cierre</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:PIBOX_PINK}}/>Proy. {nextMesLabel}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h3 className="font-bold text-gray-700 text-sm mb-4">🏆 Top 10 clientes por proyección de cierre</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={[...filtered].sort((a,b)=>b.gmvProy-a.gmvProy).slice(0,10).map(r=>({
                  name: r.empresa.length > 18 ? r.empresa.slice(0,16)+"…" : r.empresa,
                  fullName: r.empresa, ejecutivo: r.ejecutivo,
                  GMV: Math.round(r.gmv), Proyección: Math.round(r.gmvProy), "Sig. mes": Math.round(r.proyNext),
                }))}
                layout="vertical" margin={{left:10,right:50,top:4,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3E8FF"/>
                <XAxis type="number" tick={{fontSize:9}} tickFormatter={fmtM}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:9}} width={130}/>
                <Tooltip content={({active,payload}) => {
                  if (!active||!payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-purple-100 rounded-xl shadow-lg px-3 py-2 text-xs">
                      <p className="font-bold text-purple-700 mb-1">{d?.fullName}</p>
                      <p className="text-gray-400 mb-1">{d?.ejecutivo}</p>
                      {payload.map((p,i)=><p key={i} style={{color:p.fill}}>{p.name}: {fmtFull(p.value)}</p>)}
                    </div>
                  );
                }}/>
                <Bar dataKey="GMV" name="GMV actual" fill="#DDD6FE" radius={[0,4,4,0]}/>
                <Bar dataKey="Proyección" name="Proy. cierre" fill={PIBOX_PURPLE} radius={[0,4,4,0]}/>
                <Bar dataKey="Sig. mes" name={`Proy. ${nextMesLabel}`} fill={PIBOX_PINK} radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── INSIGHT POR KAM ───────────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-1">🧠 Insight de proyecciones por KAM</h3>
          <p className="text-xs text-gray-400 mb-4">
            Análisis automático basado en el comportamiento histórico, la distribución de la cartera y el ajuste por festivos.
          </p>
          <div className="space-y-5">
            {insights.map(ins => (
              <div key={ins.ejec}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{background:ins.color}}/>
                  <h4 className="font-bold text-sm text-gray-800">{ins.ejec}</h4>
                </div>
                <div className="pl-5 space-y-2">
                  {ins.lines.map((l, i) => (
                    <div key={i} className={`flex gap-2 items-start text-xs px-3 py-2 rounded-lg border ${bgTipo[l.tipo]}`}>
                      <span className="shrink-0 mt-0.5">{iconoTipo[l.tipo]}</span>
                      <span className="leading-relaxed">{l.txt}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Nota metodológica ─────────────────────────────────────────────────── */}
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-[10px] text-purple-700 leading-relaxed">
        <b>Metodología:</b> Proy. cierre = GMV acumulado ÷ % días laborables transcurridos
        ({diasTrabajados} días trabajados de {diasLaborablesTotal} laborables · {(pctAdj*100).toFixed(1)}%).
        {festivosMesActual > 0 && esMesAct && ` Ajuste por ${festivosMesActual} festivo${festivosMesActual!==1?"s":""} del mes (≈${festivosPasados} transcurrido${festivosPasados!==1?"s":""}).`}
        {" "}Proy. siguiente mes = promedio diario histórico (últimos 3 meses) × {diasLaborablesNext} días laborables de {nextMesLabel}.
        {festivosSigMes > 0 && ` Ajuste por ${festivosSigMes} festivo${festivosSigMes!==1?"s":""} en ${nextMesLabel}.`}
        {" "}Las flechas ▲▼ indican variación respecto al valor anterior.
      </div>

    </div>
  );
}
