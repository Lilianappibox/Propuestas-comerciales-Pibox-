import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fmtMoney, fmtM, colorCumplimiento, PIBOX_PURPLE, PIBOX_PINK } from "./utils";
import { useMoneda } from "./MonedaContext";

export default function CumplimientoEquipo({ data }) {
  const { moneda, trm } = useMoneda();
  const M = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);

  const { cumplimientoEquipo: c } = data;
  const pct = ((c.gmv / c.meta) * 100).toFixed(1);

  const chartData = [
    { periodo: data.periodo, Meta: moneda === "USD" ? c.meta / trm : c.meta, GMV: moneda === "USD" ? c.gmv / trm : c.gmv },
    { periodo: "Mes Pasado", Meta: moneda === "USD" ? c.mesPasadoMeta / trm : c.mesPasadoMeta, GMV: moneda === "USD" ? c.mesPasadoGmv / trm : c.mesPasadoGmv },
    { periodo: "Año Pasado", Meta: moneda === "USD" ? c.anioPasadoMeta / trm : c.anioPasadoMeta, GMV: moneda === "USD" ? c.anioPasadoGmv / trm : c.anioPasadoGmv },
  ];

  const vsMes  = c.gmv - c.mesPasadoGmv;
  const vsAnio = c.gmv - c.anioPasadoGmv;

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex flex-wrap gap-6 items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-purple-800">Cumplimiento Team Pibox</h2>
          <p className="text-sm text-gray-500">{data.mes}</p>
        </div>

        <div className="flex flex-wrap gap-5 items-center">
          {/* Gauge */}
          <div className="flex flex-col items-center">
            <svg width={110} height={110} viewBox="0 0 110 110">
              <circle cx={55} cy={55} r={48} fill="none" stroke="#e9d5ff" strokeWidth={10} />
              <circle
                cx={55} cy={55} r={48} fill="none"
                stroke={colorCumplimiento(Number(pct))}
                strokeWidth={10}
                strokeDasharray={`${(Number(pct) / 100) * 301.6} 301.6`}
                strokeLinecap="round"
                transform="rotate(-90 55 55)"
              />
              <text x={55} y={52} textAnchor="middle" fontSize={20} fontWeight="bold" fill={colorCumplimiento(Number(pct))}>{pct}%</text>
              <text x={55} y={68} textAnchor="middle" fontSize={10} fill="#6b7280">Cumplimiento</text>
            </svg>
          </div>

          {/* KPIs con cifras completas */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-purple-50 rounded-xl p-3 min-w-[160px]">
              <p className="text-gray-500 text-xs">Meta</p>
              <p className="font-bold text-purple-700 text-base">{M(c.meta)}</p>
            </div>
            <div className="bg-pink-50 rounded-xl p-3 min-w-[160px]">
              <p className="text-gray-500 text-xs">Cumplimiento GMV</p>
              <p className="font-bold text-pink-600 text-base">{M(c.gmv)}</p>
            </div>
            <div className={`rounded-xl p-3 ${vsMes >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              <p className="text-gray-500 text-xs">Vs Mes Pasado</p>
              <p className={`font-bold text-sm ${vsMes >= 0 ? "text-green-600" : "text-red-500"}`}>
                {M(vsMes)}
              </p>
              <p className={`text-xs ${vsMes >= 0 ? "text-green-500" : "text-red-400"}`}>
                {((vsMes / c.mesPasadoGmv) * 100).toFixed(2)}%
              </p>
            </div>
            <div className={`rounded-xl p-3 ${vsAnio >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              <p className="text-gray-500 text-xs">Vs Año Pasado</p>
              <p className={`font-bold text-sm ${vsAnio >= 0 ? "text-green-600" : "text-red-500"}`}>
                {M(vsAnio)}
              </p>
              <p className={`text-xs ${vsAnio >= 0 ? "text-green-500" : "text-red-400"}`}>
                {((vsAnio / c.anioPasadoGmv) * 100).toFixed(2)}%
              </p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-gray-500 text-xs">Utilidad Bruta</p>
                <span className="text-xs font-bold bg-purple-200 text-purple-800 rounded-full px-2 py-0.5">
                  {((c.utilidadBruta / c.gmv) * 100).toFixed(1)}% sobre GMV
                </span>
              </div>
              <p className="font-bold text-purple-700 text-base">{M(c.utilidadBruta)}</p>
              <div className="mt-1.5 h-1.5 bg-purple-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full"
                  style={{ width: `${Math.min((c.utilidadBruta / c.gmv) * 100 * 4, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" tickFormatter={Mx} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="periodo" tick={{ fontSize: 12 }} width={80} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const meta  = payload.find((p) => p.dataKey === "Meta")?.value ?? 0;
              const gmv   = payload.find((p) => p.dataKey === "GMV")?.value  ?? 0;
              const cumpl = meta > 0 ? ((gmv / meta) * 100).toFixed(1) : null;
              const color = cumpl ? (Number(cumpl) >= 95 ? "#22c55e" : Number(cumpl) >= 80 ? "#f59e0b" : "#ef4444") : "#6b7280";
              const labelV = (v) => moneda === "USD"
                ? `$${Math.round(v).toLocaleString("en-US")} USD`
                : `$${Math.round(v).toLocaleString("es-CO")} COP`;
              return (
                <div style={{ background: "#fff", border: "1px solid #e9d5ff", borderRadius: 12, padding: "10px 14px", minWidth: 220, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                  <p style={{ fontWeight: 700, color: "#374151", marginBottom: 8 }}>{label}</p>
                  {payload.map((p) => (
                    <p key={p.dataKey} style={{ color: p.fill, marginBottom: 4, fontSize: 13 }}>
                      {p.dataKey} : <strong>{labelV(p.value)}</strong>
                    </p>
                  ))}
                  {cumpl && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f3e8ff" }}>
                      <p style={{ color, fontWeight: 700, fontSize: 14 }}>
                        Cumplimiento: {cumpl}%
                      </p>
                      <div style={{ marginTop: 4, height: 6, background: "#f3e8ff", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(Number(cumpl), 100)}%`, background: color, borderRadius: 99 }} />
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
    </section>
  );
}
