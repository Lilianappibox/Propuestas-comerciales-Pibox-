import { useState } from "react";
import { fmtMoney, fmtM } from "./utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMoneda } from "./MonedaContext";
import { TooltipSimple } from "./TooltipCustom";

const BRAND_GREEN = "linear-gradient(135deg,#047857 0%,#10b981 50%,#34d399 100%)";
const COLORES = ["#7C22D4", "#E040FB", "#7C3AED", "#06b6d4", "#f59e0b", "#10b981", "#ef4444"];

export default function ClientesNuevos({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  const [filtroKAM, setFiltroKAM] = useState(null);

  const porKAM = data.kams.map((k, i) => {
    const clientes = data.clientesNuevos.filter((c) => c.kam === k.nombre);
    return {
      kam: k.nombre.split(" ")[0],
      fullNombre: k.nombre,
      cantidad: clientes.length,
      gmv: clientes.reduce((a, c) => a + c.gmv, 0),
      gmvConv: clientes.reduce((a, c) => a + conv(c.gmv), 0),
      clientes,
      color: COLORES[i % COLORES.length],
    };
  }).filter((k) => k.cantidad > 0);

  const totalGmv      = data.clientesNuevos.reduce((a, c) => a + c.gmv, 0);
  const totalCantidad = data.clientesNuevos.length;
  const top3 = [...data.clientesNuevos].sort((a, b) => b.gmv - a.gmv).slice(0, 3);
  const maxGMV = Math.max(...porKAM.map((x) => x.gmv), 1);

  const kamsDisponibles = [...new Set(data.clientesNuevos.map((c) => c.kam))];
  const clientesFiltrados = filtroKAM
    ? data.clientesNuevos.filter((c) => c.kam === filtroKAM)
    : data.clientesNuevos;

  return (
    <section className="rounded-2xl overflow-hidden shadow-lg">

      {/* Banner */}
      <div style={{ background: BRAND_GREEN }} className="px-6 py-5">
        <h2 className="text-xl font-extrabold text-white tracking-tight mb-4">🌱 Clientes Nuevos</h2>
        <div className="flex flex-wrap gap-4">
          <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 border border-white/20 min-w-[140px]">
            <p className="text-white/60 text-xs font-medium">Total nuevos</p>
            <p className="text-white font-extrabold text-2xl leading-tight">{totalCantidad}</p>
            <p className="text-white/50 text-xs">clientes</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 border border-white/20 min-w-[180px]">
            <p className="text-white/60 text-xs font-medium">💰 GMV primer servicio</p>
            <p className="text-white font-extrabold text-xl leading-tight">{M(totalGmv)}</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 border border-white/20 min-w-[140px]">
            <p className="text-white/60 text-xs font-medium">📊 KAMs con nuevos</p>
            <p className="text-white font-extrabold text-2xl leading-tight">{porKAM.length}</p>
          </div>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="bg-white p-5">

        {/* Top 3 */}
        {top3.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {top3.map((c, i) => (
              <div key={c.cliente}
                className={`rounded-xl p-3 text-center border-2 ${i === 0 ? "bg-yellow-50 border-yellow-300" : i === 1 ? "bg-gray-50 border-gray-300" : "bg-orange-50 border-orange-300"}`}>
                <span className="text-2xl">{["🥇", "🥈", "🥉"][i]}</span>
                <p className="text-xs font-bold mt-1 text-gray-700 truncate">{c.cliente}</p>
                <p className="text-sm font-extrabold text-purple-700 mt-0.5">{M(c.gmv)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{c.kam.split(" ")[0]}</p>
              </div>
            ))}
          </div>
        )}

        {/* Gráficos */}
        <div className="grid md:grid-cols-2 gap-5 mb-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Clientes nuevos por KAM</p>
            <div className="bg-gray-50 rounded-xl p-3">
              <ResponsiveContainer width="100%" height={Math.max(140, porKAM.length * 40)}>
                <BarChart data={porKAM} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="kam" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip content={(props) => <TooltipSimple {...props} fmt={(v) => `${v} clientes`} />} />
                  <Bar dataKey="cantidad" name="Cantidad" radius={[0, 6, 6, 0]}>
                    {porKAM.map((k) => <Cell key={k.kam} fill={k.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">GMV primer servicio por KAM</p>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
              {porKAM.map((k) => (
                <div key={k.kam}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold" style={{ color: k.color }}>{k.fullNombre}</span>
                    <span className="text-gray-600">{k.cantidad} · <strong>{M(k.gmv)}</strong></span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(k.gmv / maxGMV) * 100}%`, backgroundColor: k.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detalle filtrable */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Detalle por cliente</p>
            <div className="flex flex-wrap gap-1.5 ml-auto">
              <button
                onClick={() => setFiltroKAM(null)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition ${!filtroKAM ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-600 hover:bg-emerald-50"}`}
              >Todos</button>
              {kamsDisponibles.map((kam, i) => (
                <button key={kam}
                  onClick={() => setFiltroKAM(filtroKAM === kam ? null : kam)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition ${filtroKAM === kam ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-emerald-50"}`}
                  style={filtroKAM === kam ? { background: COLORES[data.kams.findIndex(k => k.nombre === kam) % COLORES.length] } : {}}
                >{kam.split(" ")[0]}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-emerald-50 text-emerald-800">
                  <th className="text-left p-2.5">KAM</th>
                  <th className="text-left p-2.5">Cliente</th>
                  <th className="text-right p-2.5">Servicios</th>
                  <th className="text-right p-2.5">GMV</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-gray-400">Sin clientes nuevos para este KAM</td></tr>
                ) : clientesFiltrados.map((c) => (
                  <tr key={`${c.kam}-${c.cliente}`} className="border-b border-gray-50 hover:bg-emerald-50/50 transition">
                    <td className="p-2.5 text-gray-500 font-medium">{c.kam.split(" ")[0]}</td>
                    <td className="p-2.5 font-semibold text-gray-800">{c.cliente}</td>
                    <td className="p-2.5 text-right text-gray-700">{c.servicios}</td>
                    <td className="p-2.5 text-right text-emerald-700 font-bold whitespace-nowrap">{M(c.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-right text-xs text-gray-400 mt-1">{clientesFiltrados.length} cliente(s)</p>
        </div>
      </div>
    </section>
  );
}
