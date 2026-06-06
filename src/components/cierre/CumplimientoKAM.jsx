import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fmtMoney, fmtM, colorCumplimiento, PIBOX_PURPLE, PIBOX_PINK } from "./utils";
import { useMoneda } from "./MonedaContext";
import { TooltipMetaGMV } from "./TooltipCustom";

export default function CumplimientoKAM({ data }) {
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

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-purple-800">Goal KAM Pibox</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedKAM(null)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${!selectedKAM ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600 hover:bg-purple-50"}`}
          >
            Todos
          </button>
          {data.kams.map((k) => (
            <button
              key={k.nombre}
              onClick={() => setSelectedKAM(k.nombre === selectedKAM ? null : k.nombre)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${selectedKAM === k.nombre ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600 hover:bg-purple-50"}`}
            >
              {k.nombre.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {kamsFiltrados.map((k) => (
          <div
            key={k.nombre}
            className="rounded-xl border border-purple-100 p-3 text-center cursor-pointer hover:shadow-md transition"
            onClick={() => setSelectedKAM(k.nombre === selectedKAM ? null : k.nombre)}
          >
            <p className="text-xs font-semibold text-purple-700 mb-1 truncate">{k.nombre.split(" ")[0]}</p>
            <svg width={64} height={64} viewBox="0 0 64 64" className="mx-auto">
              <circle cx={32} cy={32} r={26} fill="none" stroke="#e9d5ff" strokeWidth={7} />
              <circle
                cx={32} cy={32} r={26} fill="none"
                stroke={colorCumplimiento(k.cumplimiento)}
                strokeWidth={7}
                strokeDasharray={`${(k.cumplimiento / 100) * 163.4} 163.4`}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text x={32} y={36} textAnchor="middle" fontSize={13} fontWeight="bold" fill={colorCumplimiento(k.cumplimiento)}>
                {k.cumplimiento.toFixed(0)}%
              </text>
            </svg>
            <p className="text-[10px] text-gray-500 mt-1 leading-tight">Meta:<br /><span className="font-semibold text-purple-700">{M(k.meta)}</span></p>
            <p className="text-[10px] font-semibold text-pink-600 mt-1">GMV:<br />{M(k.gmv)}</p>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
          <XAxis type="number" tickFormatter={Mx} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={70} />
          <Tooltip content={(props) => <TooltipMetaGMV {...props} fmt={Mx} />} />
          <Legend />
          <Bar dataKey="Meta" fill={PIBOX_PURPLE} radius={[0, 4, 4, 0]} />
          <Bar dataKey="GMV"  fill={PIBOX_PINK}   radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
