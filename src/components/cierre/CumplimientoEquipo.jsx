import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fmtMoney, fmtM, colorCumplimiento, PIBOX_PURPLE, PIBOX_PINK } from "./utils";
import { useMoneda } from "./MonedaContext";

const BRAND = "linear-gradient(135deg, #5B17A8 0%, #7C22D4 50%, #C026D3 100%)";

export default function CumplimientoEquipo({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);

  const { cumplimientoEquipo: c } = data;
  const pct     = ((c.gmv / c.meta) * 100).toFixed(1);
  const pctNum  = Number(pct);
  const color   = colorCumplimiento(pctNum);
  const vsMes   = c.gmv - c.mesPasadoGmv;
  const vsAnio  = c.gmv - c.anioPasadoGmv;
  const vsMesPct  = c.mesPasadoGmv  > 0 ? ((vsMes  / c.mesPasadoGmv)  * 100).toFixed(2) : "0";
  const vsAnioPct = c.anioPasadoGmv > 0 ? ((vsAnio / c.anioPasadoGmv) * 100).toFixed(2) : "0";
  const utilPct     = c.gmv > 0 ? ((c.utilidadBruta / c.gmv) * 100).toFixed(1) : "0";
  const utilNetaPct = c.gmv > 0 ? ((( c.utilidadNeta || 0) / c.gmv) * 100).toFixed(1) : "0";

  const circumference = 2 * Math.PI * 48;
  const progress      = (pctNum / 100) * circumference;

  const chartData = [
    { periodo: data.periodo,   Meta: moneda === "USD" ? c.meta / trm : c.meta,           GMV: moneda === "USD" ? c.gmv / trm : c.gmv },
    { periodo: "Mes Pasado",   Meta: moneda === "USD" ? c.mesPasadoMeta / trm : c.mesPasadoMeta, GMV: moneda === "USD" ? c.mesPasadoGmv / trm : c.mesPasadoGmv },
    { periodo: "Año Pasado",   Meta: moneda === "USD" ? c.anioPasadoMeta / trm : c.anioPasadoMeta, GMV: moneda === "USD" ? c.anioPasadoGmv / trm : c.anioPasadoGmv },
  ];

  return (
    <section className="rounded-2xl overflow-hidden shadow-lg">

      {/* ── Banner de cabecera ── */}
      <div style={{ background: BRAND }} className="px-6 pt-5 pb-6">
        <div className="flex flex-wrap gap-6 items-center justify-between">

          {/* Título */}
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">Cumplimiento Team Pibox</h2>
            <p className="text-white/70 text-sm mt-0.5">{data.mes}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-3xl font-black text-white">{pct}%</span>
              <span className="text-white/70 text-sm">de la meta mensual</span>
            </div>
            <div className="mt-2 h-2.5 bg-white/20 rounded-full w-56 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(pctNum, 100)}%`, background: color }}
              />
            </div>
          </div>

          {/* Gauge donut */}
          <div className="flex flex-col items-center">
            <svg width={130} height={130} viewBox="0 0 110 110">
              <circle cx={55} cy={55} r={48} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={10} />
              <circle
                cx={55} cy={55} r={48} fill="none"
                stroke={color}
                strokeWidth={10}
                strokeDasharray={`${progress} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 55 55)"
              />
              <text x={55} y={50} textAnchor="middle" fontSize={22} fontWeight="900" fill="white">{pct}%</text>
              <text x={55} y={67} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.7)">Cumplimiento</text>
            </svg>
          </div>

          {/* KPIs en el banner */}
          <div className="flex flex-col gap-3 min-w-[200px]">
            <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-2.5 border border-white/20">
              <p className="text-white/60 text-xs font-medium">🎯 Meta mensual</p>
              <p className="text-white font-extrabold text-lg leading-tight">{M(c.meta)}</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-2.5 border border-white/20">
              <p className="text-white/60 text-xs font-medium">📈 GMV acumulado</p>
              <p className="text-white font-extrabold text-lg leading-tight">{M(c.gmv)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cuerpo blanco con métricas ── */}
      <div className="bg-white px-6 py-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">

          {/* Vs Mes Pasado */}
          <div className={`rounded-xl p-4 border ${vsMes >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs text-gray-500 font-medium">Vs Mes Pasado</p>
              <span className="text-lg">{vsMes >= 0 ? "📈" : "📉"}</span>
            </div>
            <p className={`font-extrabold text-base ${vsMes >= 0 ? "text-emerald-700" : "text-red-600"}`}>{M(vsMes)}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${vsMes >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
              {vsMes >= 0 ? "+" : ""}{vsMesPct}%
            </span>
          </div>

          {/* Vs Año Pasado */}
          <div className={`rounded-xl p-4 border ${vsAnio >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs text-gray-500 font-medium">Vs Año Pasado</p>
              <span className="text-lg">{vsAnio >= 0 ? "🚀" : "⚠️"}</span>
            </div>
            <p className={`font-extrabold text-base ${vsAnio >= 0 ? "text-emerald-700" : "text-red-600"}`}>{M(vsAnio)}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${vsAnio >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
              {vsAnio >= 0 ? "+" : ""}{vsAnioPct}%
            </span>
          </div>

          {/* Utilidad Bruta */}
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs text-gray-500 font-medium">Utilidad Bruta</p>
              <span className="text-xs font-bold bg-purple-600 text-white rounded-full px-2.5 py-0.5">
                {utilPct}% sobre GMV
              </span>
            </div>
            <p className="font-extrabold text-purple-700 text-xl">{M(c.utilidadBruta)}</p>
            <div className="mt-2 h-2 bg-purple-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(Number(utilPct) * 4, 100)}%`, background: BRAND }}
              />
            </div>
          </div>

          {/* Utilidad Neta */}
          <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs text-gray-500 font-medium">Utilidad Neta</p>
              <span className="text-xs font-bold bg-teal-600 text-white rounded-full px-2.5 py-0.5">
                {utilNetaPct}% sobre GMV
              </span>
            </div>
            <p className="font-extrabold text-teal-700 text-xl">{M(c.utilidadNeta || 0)}</p>
            <div className="mt-2 h-2 bg-teal-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500"
                style={{ width: `${Math.min(Number(utilNetaPct) * 4, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Gráfico — oculto en PDF */}
        <div className="cierre-print-hide">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Comparativo histórico</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" tickFormatter={Mx} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="periodo" tick={{ fontSize: 12 }} width={80} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const meta  = payload.find((p) => p.dataKey === "Meta")?.value ?? 0;
                const gmv   = payload.find((p) => p.dataKey === "GMV")?.value  ?? 0;
                const cumpl = meta > 0 ? ((gmv / meta) * 100).toFixed(1) : null;
                const clr   = cumpl ? colorCumplimiento(Number(cumpl)) : "#6b7280";
                const lbl   = (v) => moneda === "USD" ? `$${Math.round(v).toLocaleString("en-US")} USD` : `$${Math.round(v).toLocaleString("es-CO")} COP`;
                return (
                  <div style={{ background: "#fff", border: "1px solid #e9d5ff", borderRadius: 12, padding: "10px 14px", minWidth: 220, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                    <p style={{ fontWeight: 700, color: "#374151", marginBottom: 8 }}>{label}</p>
                    {payload.map((p) => <p key={p.dataKey} style={{ color: p.fill, marginBottom: 4, fontSize: 13 }}>{p.dataKey}: <strong>{lbl(p.value)}</strong></p>)}
                    {cumpl && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f3e8ff" }}>
                        <p style={{ color: clr, fontWeight: 700, fontSize: 14 }}>Cumplimiento: {cumpl}%</p>
                        <div style={{ marginTop: 4, height: 6, background: "#f3e8ff", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(Number(cumpl), 100)}%`, background: clr, borderRadius: 99 }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Legend />
            <Bar dataKey="Meta" fill={PIBOX_PURPLE} radius={[0, 6, 6, 0]} />
            <Bar dataKey="GMV"  fill={PIBOX_PINK}   radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>{/* fin cierre-print-hide */}
      </div>
    </section>
  );
}
