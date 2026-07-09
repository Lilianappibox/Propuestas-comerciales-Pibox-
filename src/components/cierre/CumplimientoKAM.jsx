import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fmtMoney, fmtM, colorCumplimiento, PIBOX_PURPLE, PIBOX_PINK } from "./utils";
import { useMoneda } from "./MonedaContext";
import { TooltipMetaGMV } from "./TooltipCustom";

const KAM_GRADIENTS = [
  "linear-gradient(135deg,#5B17A8,#C026D3)",
  "linear-gradient(135deg,#1d4ed8,#6366f1)",
  "linear-gradient(135deg,#0d9488,#06b6d4)",
  "linear-gradient(135deg,#be185d,#f43f5e)",
  "linear-gradient(135deg,#92400e,#f59e0b)",
  "linear-gradient(135deg,#065f46,#10b981)",
];

function KAMCard({ k, data, selected, onClick, gradient, M, expanded }) {
  const color    = colorCumplimiento(k.cumplimiento);
  const pctNum   = k.cumplimiento;
  const circumference = 2 * Math.PI * (expanded ? 52 : 34);
  const progress = (pctNum / 100) * circumference;
  const r        = expanded ? 52 : 34;

  // Comparaciones normalizadas: toleran diferencias de capitalización y tildes
  const kamNorm = normK(k.nombre);
  const nuevos   = (data.clientesNuevos   || []).filter((c) => normK(c.kam) === kamNorm).length;
  const perdidos = (data.clientesPerdidos || []).filter((c) => normK(c.kam) === kamNorm).length;

  // Lookup tolerante a capitalización para kamDetalle
  const kdet = data.kamDetalle?.[k.nombre]
    ?? Object.entries(data.kamDetalle || {}).find(([key]) => normK(key) === kamNorm)?.[1];

  const activos = kdet?.clientesActivos
    ?? (data.top10Clientes || []).filter((c) => normK(c.kam) === kamNorm).length;
  const gmvActualKam   = kdet?.gmv    ?? k.gmv;
  // gmvAnt ya viene copiado en k.gmvAnt desde parseBasePlana; kdet.gmvAnt como respaldo
  const gmvAnteriorKam = k.gmvAnt ?? kdet?.gmvAnt ?? 0;
  const crecPct = gmvAnteriorKam > 0 ? ((gmvActualKam - gmvAnteriorKam) / gmvAnteriorKam) * 100 : 0;

  const metaProgress = Math.min((k.gmv / k.meta) * 100, 100);
  const svgSize = expanded ? 120 : 80;
  const cx = svgSize / 2;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${selected ? "ring-2 ring-offset-2 ring-purple-500 shadow-xl" : "shadow-md hover:shadow-xl hover:scale-[1.01]"}`}
    >
      {/* Header con gradiente */}
      <div style={{ background: gradient }} className={`px-6 ${expanded ? "py-5" : "py-4"}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className={`text-white font-extrabold leading-tight ${expanded ? "text-2xl" : "text-base"}`}>{k.nombre.split(" ")[0]}</p>
            <p className="text-white/60 text-sm">{k.nombre.split(" ").slice(1).join(" ")}</p>
          </div>
          <span className={`text-white font-black ${expanded ? "text-5xl" : "text-2xl"}`}>{pctNum.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${metaProgress}%`, background: color }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-white/50 text-xs">GMV</span>
          <span className="text-white/50 text-xs">{metaProgress.toFixed(0)}% de meta</span>
        </div>
      </div>

      {/* Cuerpo blanco */}
      <div className={`bg-white ${expanded ? "px-6 py-5" : "px-4 py-3"}`}>
        {expanded ? (
          /* ── Layout horizontal cuando está expandida ── */
          <div className="flex items-center gap-8">
            {/* Donut grande */}
            <div className="shrink-0">
              <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f3e8ff" strokeWidth={10} />
                <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={10}
                  strokeDasharray={`${progress} ${circumference}`} strokeLinecap="round"
                  transform={`rotate(-90 ${cx} ${cx})`} />
                <text x={cx} y={cx - 4} textAnchor="middle" fontSize={20} fontWeight="900" fill={color}>{pctNum.toFixed(0)}%</text>
                <text x={cx} y={cx + 14} textAnchor="middle" fontSize={10} fill="#9ca3af">cumpl.</text>
              </svg>
            </div>

            {/* Meta / GMV */}
            <div className="shrink-0">
              <p className="text-xs text-gray-500 mb-0.5">🎯 Meta</p>
              <p className="font-extrabold text-purple-700 text-2xl leading-tight">{M(k.meta)}</p>
              <p className="text-xs text-gray-500 mt-3 mb-0.5">📈 GMV acumulado</p>
              <p className="font-extrabold text-pink-600 text-2xl leading-tight">{M(k.gmv)}</p>
            </div>

            {/* Divisor */}
            <div className="w-px h-20 bg-gray-100 shrink-0" />

            {/* Stats 2x2 expandidas */}
            <div className="grid grid-cols-2 gap-3 flex-1">
              <div className={`rounded-xl p-3 ${crecPct >= 0 ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
                <p className="text-xs text-gray-600 font-medium">vs mes anterior</p>
                <p className={`font-bold text-lg mt-1 ${crecPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {crecPct >= 0 ? "▲" : "▼"} {Math.abs(crecPct).toFixed(1)}%
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs text-gray-600 font-medium">Clientes activos</p>
                <p className="font-bold text-lg text-blue-700 mt-1">{activos}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <p className="text-xs text-gray-600 font-medium">Clientes nuevos</p>
                <p className="font-bold text-lg text-emerald-600 mt-1">{nuevos}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-xs text-gray-600 font-medium">Clientes perdidos</p>
                <p className="font-bold text-lg text-red-500 mt-1">{perdidos}</p>
              </div>
            </div>
          </div>
        ) : (
          /* ── Layout compacto (modo grid múltiple) ── */
          <>
            <div className="flex items-center gap-3 mb-3">
              <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} className="shrink-0">
                <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f3e8ff" strokeWidth={8} />
                <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={8}
                  strokeDasharray={`${progress} ${circumference}`} strokeLinecap="round"
                  transform={`rotate(-90 ${cx} ${cx})`} />
                <text x={cx} y={cx - 4} textAnchor="middle" fontSize={14} fontWeight="900" fill={color}>{pctNum.toFixed(0)}%</text>
                <text x={cx} y={cx + 10} textAnchor="middle" fontSize={8} fill="#9ca3af">cumpl.</text>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-600">🎯 Meta</p>
                <p className="font-extrabold text-purple-700 text-sm leading-tight">{M(k.meta)}</p>
                <p className="text-[10px] text-gray-600 mt-1">📈 GMV</p>
                <p className="font-extrabold text-pink-600 text-sm leading-tight">{M(k.gmv)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className={`rounded-lg p-2 ${crecPct >= 0 ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
                <p className="text-[10px] text-gray-600">vs mes ant.</p>
                <p className={`font-bold text-xs ${crecPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>{crecPct >= 0 ? "▲" : "▼"} {Math.abs(crecPct).toFixed(1)}%</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
                <p className="text-[10px] text-gray-600">Activos</p>
                <p className="font-bold text-xs text-blue-700">{activos}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2">
                <p className="text-[10px] text-gray-600">Nuevos</p>
                <p className="font-bold text-xs text-emerald-600">{nuevos}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-lg p-2">
                <p className="text-[10px] text-gray-600">Perdidos</p>
                <p className="font-bold text-xs text-red-500">{perdidos}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const normK = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function CumplimientoKAM({ data, printing = false }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);

  const [selectedKAM, setSelectedKAM] = useState(null);
  const kamsFiltrados = selectedKAM ? data.kams.filter((k) => k.nombre === selectedKAM) : data.kams;

  const chartData = kamsFiltrados.map((k) => ({
    nombre: k.nombre.split(" ")[0],
    Meta: moneda === "USD" ? k.meta / trm : k.meta,
    GMV:  moneda === "USD" ? k.gmv  / trm : k.gmv,
    cumplimiento: k.cumplimiento,
  }));

  // Top 10 según selección activa
  const { top10Rows, top10Label, showKamCol } = (() => {
    if (!selectedKAM) {
      // Todos: top10Clientes global (ya viene ordenado por GMV)
      const rows = (data.top10Clientes || []).slice(0, 10);
      return { top10Rows: rows, top10Label: "Todos los KAMs", showKamCol: true };
    }
    // KAM específico: buscar en kamDetalle con lookup normalizado
    const kd = data.kamDetalle?.[selectedKAM]
      ?? Object.entries(data.kamDetalle || {}).find(([k]) => normK(k) === normK(selectedKAM))?.[1];
    const rows = (kd?.top10 || []).slice(0, 10);
    return { top10Rows: rows, top10Label: selectedKAM, showKamCol: false };
  })();

  return (
    <section className="bg-white rounded-2xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
        <h2 className="text-xl font-extrabold text-purple-800">Goal KAM Pibox</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedKAM(null)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${!selectedKAM ? "bg-purple-600 text-white border-purple-600 shadow" : "border-gray-200 text-gray-600 hover:bg-purple-50"}`}
          >
            Todos
          </button>
          {data.kams.map((k, i) => (
            <button
              key={k.nombre}
              onClick={() => setSelectedKAM(k.nombre === selectedKAM ? null : k.nombre)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${selectedKAM === k.nombre ? "text-white border-transparent shadow" : "border-gray-200 text-gray-600 hover:bg-purple-50"}`}
              style={selectedKAM === k.nombre ? { background: KAM_GRADIENTS[i % KAM_GRADIENTS.length] } : {}}
            >
              {k.nombre.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {/* KAM Cards */}
        <div className={`grid gap-4 mb-6 ${kamsFiltrados.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
          {kamsFiltrados.map((k) => {
            const gradIdx = data.kams.indexOf(k);
            return (
              <div key={k.nombre} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                <KAMCard
                  k={k}
                  data={data}
                  selected={selectedKAM === k.nombre}
                  onClick={() => setSelectedKAM(k.nombre === selectedKAM ? null : k.nombre)}
                  gradient={KAM_GRADIENTS[gradIdx % KAM_GRADIENTS.length]}
                  M={M}
                  expanded={kamsFiltrados.length === 1}
                />
              </div>
            );
          })}
        </div>

        {/* Gráfico comparativo — oculto en PDF */}
        {!printing && (
        <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Meta vs GMV por KAM</p>
        <div className="bg-gray-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={Math.max(kamsFiltrados.length * 40, 160)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tickFormatter={Mx} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={70} />
              <Tooltip content={(props) => <TooltipMetaGMV {...props} fmt={Mx} />} />
              <Legend />
              <Bar dataKey="Meta" fill={PIBOX_PURPLE} radius={[0, 4, 4, 0]} />
              <Bar dataKey="GMV"  fill={PIBOX_PINK}   radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        </div>
        )}{/* fin !printing chart */}

        {/* Top 10 — siempre visible, cambia según selección */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
            Top 10 cuentas por GMV — {top10Label}
          </p>
          {top10Rows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Carga la base plana para ver el top 10 de facturación
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Cliente</th>
                    {showKamCol && <th className="px-4 py-2 text-left">KAM</th>}
                    <th className="px-4 py-2 text-right">GMV Actual</th>
                    <th className="px-4 py-2 text-right">GMV Anterior</th>
                    <th className="px-4 py-2 text-right">Var.</th>
                    <th className="px-4 py-2 text-right">Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {top10Rows.map((c, i) => (
                    <tr key={`${c.cliente}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-2 text-gray-400 font-bold">{i + 1}</td>
                      <td className="px-4 py-2 font-medium text-gray-800">{c.cliente}</td>
                      {showKamCol && (
                        <td className="px-4 py-2 text-xs text-gray-500">{c.kam || "—"}</td>
                      )}
                      <td className="px-4 py-2 text-right font-semibold text-purple-700">{M(c.gmvActual)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">
                        {c.gmvAnterior > 0 ? M(c.gmvAnterior) : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold text-xs ${
                        c.gmvAnterior > 0
                          ? c.crecimiento >= 0 ? "text-emerald-600" : "text-red-500"
                          : "text-gray-400"
                      }`}>
                        {c.gmvAnterior > 0
                          ? `${c.crecimiento >= 0 ? "▲" : "▼"} ${Math.abs(c.crecimiento).toFixed(1)}%`
                          : "Nuevo"}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500 text-xs">
                        {c.participacion.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
