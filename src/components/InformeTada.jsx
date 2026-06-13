import { useState, useMemo } from "react";
import XLSX from "../utils/xlsxHelper";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const PIBOX_PURPLE = "#7C22D4";
const PIBOX_PINK   = "#C026D3";
const SEM_VERDE    = "#16A34A";
const SEM_ROJO     = "#DC2626";
const SEM_AMARILLO = "#D97706";
const PIE_COLORS   = [SEM_VERDE, SEM_ROJO];
const BAR_COLORS   = [PIBOX_PURPLE, PIBOX_PINK, "#A855F7", "#6366F1", "#EC4899", "#8B5CF6", "#F59E0B", "#10B981"];
const STORAGE_KEY  = "pibox_tada_data";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveStored(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* noop */ }
}

function pct(n, d) { return d ? ((n / d) * 100).toFixed(1) : "0.0"; }

function processExcel(wb) {
  const sheet = wb.Sheets["DATA"];
  if (!sheet) throw new Error('No se encontró la hoja "DATA" en el archivo.');
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rows.length) throw new Error("La hoja DATA está vacía.");
  return processRows(rows);
}

function processRows(rows) {
  const totalTurnos = rows.length;
  let colocacionesSI = 0;
  let colocacionesNO = 0;
  let puntualidadSI  = 0;
  const estadoMap    = {};
  const ciudadMap    = {};
  const puntoMap     = {};
  const semanaMap    = {};
  const diaMap       = {};
  const mesMap       = {};
  const pilotos      = new Set();

  for (const r of rows) {
    const coloc = String(r["COLOCACION"] || r["COLOCACIÓN"] || "").trim().toUpperCase();
    const punt  = String(r["PUNTUALIDAD"] || "").trim().toUpperCase();
    const estado = String(r["ESTADO"] || "").trim();
    const ciudad = String(r["CIUDAD"] || "").trim();
    const punto  = String(r["PUNTO"] || "").trim();
    const semana = String(r["SEMANA"] || "").trim();
    const dia    = String(r["DÍA"] || r["DIA"] || "").trim();
    const mes    = String(r["MES"] || "").trim();
    const piloto = String(r["ID PILOTO"] || "").trim();

    const isSI  = coloc === "SI";
    const isNO  = coloc === "NO";
    const isPunt = punt === "SI CUMPLE";

    if (isSI) colocacionesSI++;
    if (isNO) colocacionesNO++;
    if (isPunt) puntualidadSI++;
    if (piloto) pilotos.add(piloto);

    // Estado
    if (estado) estadoMap[estado] = (estadoMap[estado] || 0) + 1;

    // Ciudad
    if (ciudad) {
      if (!ciudadMap[ciudad]) ciudadMap[ciudad] = { turnos: 0, si: 0, no: 0, punt: 0 };
      ciudadMap[ciudad].turnos++;
      if (isSI) ciudadMap[ciudad].si++;
      if (isNO) ciudadMap[ciudad].no++;
      if (isPunt) ciudadMap[ciudad].punt++;
    }

    // Punto
    if (punto) {
      if (!puntoMap[punto]) puntoMap[punto] = { ciudad, turnos: 0, si: 0, no: 0, punt: 0 };
      puntoMap[punto].turnos++;
      if (isSI) puntoMap[punto].si++;
      if (isNO) puntoMap[punto].no++;
      if (isPunt) puntoMap[punto].punt++;
    }

    // Semana
    if (semana) {
      if (!semanaMap[semana]) semanaMap[semana] = { turnos: 0, si: 0, punt: 0 };
      semanaMap[semana].turnos++;
      if (isSI) semanaMap[semana].si++;
      if (isPunt) semanaMap[semana].punt++;
    }

    // Día
    if (dia) diaMap[dia] = (diaMap[dia] || 0) + 1;

    // Mes
    if (mes) {
      if (!mesMap[mes]) mesMap[mes] = { turnos: 0, si: 0, punt: 0 };
      mesMap[mes].turnos++;
      if (isSI) mesMap[mes].si++;
      if (isPunt) mesMap[mes].punt++;
    }
  }

  const cancelaciones = (estadoMap["Cancelado"] || 0) + (estadoMap["CANCELADO"] || 0);

  return {
    totalTurnos,
    colocacionesSI,
    colocacionesNO,
    puntualidadSI,
    cancelaciones,
    pilotosActivos: pilotos.size,
    estadoMap,
    ciudadMap,
    puntoMap,
    semanaMap,
    diaMap,
    mesMap,
  };
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-purple-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-purple-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

/* ── KPI Card ────────────────────────────────────────────────────────────── */

function KpiCard({ icon, label, value, sub, borderColor }) {
  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-w-0"
      style={{ borderLeft: `4px solid ${borderColor || PIBOX_PURPLE}` }}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide whitespace-nowrap">
        {icon} {label}
      </p>
      <p
        className="text-xl font-extrabold mt-1 truncate"
        style={{ color: borderColor || PIBOX_PURPLE }}
        title={value}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

/* ── Coloc color helper ──────────────────────────────────────────────────── */

function colocColor(pctVal) {
  const n = parseFloat(pctVal);
  if (n >= 90) return SEM_VERDE;
  if (n >= 70) return SEM_AMARILLO;
  return SEM_ROJO;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                          */
/* ══════════════════════════════════════════════════════════════════════════ */

export default function InformeTada({ isAdmin }) {
  const [stored, setStored]       = useState(loadStored);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [fileName, setFileName]   = useState(stored?.fileName || null);
  const [uploadDate, setUploadDate] = useState(stored?.uploadDate || null);

  /* ── derived data ─────────────────────────────────────────────────────── */

  const data = stored?.data || null;

  const estadoData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.estadoMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const ciudadColocData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.ciudadMap)
      .map(([name, v]) => ({ name, SI: v.si, NO: v.no }))
      .sort((a, b) => (b.SI + b.NO) - (a.SI + a.NO));
  }, [data]);

  const ciudadPuntData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.ciudadMap)
      .map(([name, v]) => ({
        name,
        "Puntualidad %": v.turnos ? parseFloat(((v.punt / v.turnos) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b["Puntualidad %"] - a["Puntualidad %"]);
  }, [data]);

  const semanaData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.semanaMap)
      .sort(([a], [b]) => {
        const na = parseFloat(a), nb = parseFloat(b);
        return (isNaN(na) || isNaN(nb)) ? a.localeCompare(b) : na - nb;
      })
      .map(([name, v]) => ({
        name: `S${name}`,
        Turnos: v.turnos,
        Colocaciones: v.si,
        "Puntualidad %": v.turnos ? parseFloat(((v.punt / v.turnos) * 100).toFixed(1)) : 0,
      }));
  }, [data]);

  const diaData = useMemo(() => {
    if (!data) return [];
    const order = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    return Object.entries(data.diaMap)
      .sort(([a], [b]) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([name, value]) => ({ name, Turnos: value }));
  }, [data]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "SI", value: data.colocacionesSI },
      { name: "NO", value: data.colocacionesNO },
    ];
  }, [data]);

  const topPuntos = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.puntoMap)
      .map(([punto, v]) => ({
        punto,
        ciudad: v.ciudad,
        turnos: v.turnos,
        colocaciones: v.si,
        pctColoc: pct(v.si, v.turnos),
        pctPunt: pct(v.punt, v.turnos),
      }))
      .sort((a, b) => b.turnos - a.turnos)
      .slice(0, 20);
  }, [data]);

  /* ── upload handler ───────────────────────────────────────────────────── */

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: "array" });
      const processed = processExcel(wb);
      const payload = {
        data: processed,
        fileName: file.name,
        uploadDate: new Date().toISOString(),
      };
      saveStored(payload);
      setStored(payload);
      setFileName(file.name);
      setUploadDate(payload.uploadDate);
    } catch (err) {
      setError(err.message || "Error al procesar el archivo.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  /* ── render ───────────────────────────────────────────────────────────── */

  const chartCard = (title, children) => (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col">
      <h3 className="text-sm font-bold text-gray-700 mb-3">{title}</h3>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-purple-100 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-base font-bold"
              style={{ background: BRAND_GRADIENT }}
            >
              🍺
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">
                Informe Operacional TaDa (Bavaria)
              </p>
              <p className="text-xs text-gray-500">
                Análisis de turnos, colocación y puntualidad de pilotos
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ── Admin Upload ────────────────────────────────────────────── */}
        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-md border border-purple-100 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <label
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow hover:shadow-lg transition"
                style={{ background: BRAND_GRADIENT }}
              >
                📥 Subir Reporte TaDa (.xlsx)
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={loading}
                />
              </label>

              {loading && (
                <span className="text-sm text-purple-600 font-semibold animate-pulse">
                  Procesando archivo...
                </span>
              )}

              {fileName && !loading && (
                <span className="text-xs text-gray-500">
                  Archivo: <strong>{fileName}</strong>
                  {uploadDate && (
                    <> &middot; {new Date(uploadDate).toLocaleDateString("es-CO", {
                      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}</>
                  )}
                </span>
              )}
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600 font-semibold">
                Error: {error}
              </p>
            )}
          </div>
        )}

        {/* ── No data placeholder ─────────────────────────────────────── */}
        {!data && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">📊</p>
            <p className="text-lg font-semibold">No hay datos cargados</p>
            <p className="text-sm mt-1">
              {isAdmin
                ? "Sube un archivo Excel con la hoja DATA para comenzar."
                : "Un administrador debe subir el reporte para visualizar el dashboard."}
            </p>
          </div>
        )}

        {/* ── Dashboard ───────────────────────────────────────────────── */}
        {data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard
                icon="📋"
                label="Total Turnos"
                value={data.totalTurnos.toLocaleString()}
                borderColor={PIBOX_PURPLE}
              />
              <KpiCard
                icon="✅"
                label="Colocaciones"
                value={data.colocacionesSI.toLocaleString()}
                sub={`${pct(data.colocacionesSI, data.totalTurnos)}%`}
                borderColor={SEM_VERDE}
              />
              <KpiCard
                icon="❌"
                label="No Colocaciones"
                value={data.colocacionesNO.toLocaleString()}
                sub={`${pct(data.colocacionesNO, data.totalTurnos)}%`}
                borderColor={SEM_ROJO}
              />
              <KpiCard
                icon="🚫"
                label="Cancelaciones"
                value={data.cancelaciones.toLocaleString()}
                sub={`${pct(data.cancelaciones, data.totalTurnos)}%`}
                borderColor={SEM_AMARILLO}
              />
              <KpiCard
                icon="⏱️"
                label="Puntualidad"
                value={`${pct(data.puntualidadSI, data.totalTurnos)}%`}
                borderColor="#6366F1"
              />
              <KpiCard
                icon="🧑‍✈️"
                label="Pilotos Activos"
                value={data.pilotosActivos.toLocaleString()}
                borderColor={PIBOX_PINK}
              />
            </div>

            {/* Row 1: Pie + Estado Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {chartCard("Colocación: SI vs NO", (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip content={<TT />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ))}

              {chartCard("Estado del Turno", (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={estadoData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="value" name="Turnos" radius={[0, 6, 6, 0]}>
                      {estadoData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ))}
            </div>

            {/* Row 2: Ciudad Colocación + Ciudad Puntualidad */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {chartCard("Colocación por Ciudad", (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ciudadColocData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<TT />} />
                    <Legend />
                    <Bar dataKey="SI" stackId="a" fill={SEM_VERDE} name="SI" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="NO" stackId="a" fill={SEM_ROJO} name="NO" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ))}

              {chartCard("Puntualidad por Ciudad", (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ciudadPuntData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="Puntualidad %" fill="#6366F1" name="Puntualidad %" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ))}
            </div>

            {/* Row 3: Evolución Semanal + Día de la semana */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {chartCard("Evolución Semanal", (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={semanaData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip content={<TT />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="Turnos" fill={PIBOX_PURPLE} name="Turnos" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="Colocaciones" fill={SEM_VERDE} name="Colocaciones" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="Puntualidad %" fill="#6366F1" name="Puntualidad %" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ))}

              {chartCard("Distribución por Día de la Semana", (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={diaData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="Turnos" fill={PIBOX_PINK} name="Turnos" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ))}
            </div>

            {/* Row 4: Top 20 Puntos table */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                Top 20 Puntos (Tiendas) por Turnos
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-semibold">#</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-semibold">Punto</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-semibold">Ciudad</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-semibold">Turnos</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-semibold">Colocaciones</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-semibold">% Colocación</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-semibold">Puntualidad %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPuntos.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-purple-50/30 transition">
                        <td className="py-2 px-3 text-gray-400 font-mono">{i + 1}</td>
                        <td className="py-2 px-3 font-semibold text-gray-800 max-w-[220px] truncate" title={p.punto}>
                          {p.punto}
                        </td>
                        <td className="py-2 px-3 text-gray-600">{p.ciudad}</td>
                        <td className="py-2 px-3 text-right font-bold text-gray-700">{p.turnos}</td>
                        <td className="py-2 px-3 text-right text-gray-700">{p.colocaciones}</td>
                        <td className="py-2 px-3 text-right font-bold" style={{ color: colocColor(p.pctColoc) }}>
                          {p.pctColoc}%
                        </td>
                        <td className="py-2 px-3 text-right font-bold" style={{ color: colocColor(p.pctPunt) }}>
                          {p.pctPunt}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: SEM_VERDE }} /> {">"}90%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: SEM_AMARILLO }} /> 70-90%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: SEM_ROJO }} /> {"<"}70%
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
