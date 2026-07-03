import { useState } from "react";
import { fmtMoney, fmtM } from "./utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMoneda } from "./MonedaContext";
import { TooltipSimple } from "./TooltipCustom";

const BRAND_RED = "linear-gradient(135deg,#991b1b 0%,#dc2626 50%,#f87171 100%)";
const COLORES   = ["#ef4444", "#f97316", "#eab308", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899"];

export default function ClientesPerdidos({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  const [filtroKAM, setFiltroKAM] = useState(null);

  const totalGmv               = data.clientesPerdidos.reduce((a, c) => a + c.gmvMesAnterior, 0);
  const totalMesAnteriorEquipo = data.cumplimientoEquipo.mesPasadoGmv;
  const pesoEnFacturacion      = totalMesAnteriorEquipo > 0 ? ((totalGmv / totalMesAnteriorEquipo) * 100).toFixed(2) : "0";

  const kamsUnicos = [...new Set(data.clientesPerdidos.map((c) => c.kam))];

  const porKAM = kamsUnicos.map((nombre, i) => {
    const clientes = data.clientesPerdidos.filter((c) => c.kam === nombre);
    return {
      kam: nombre.split(" ")[0],
      fullNombre: nombre,
      cantidad: clientes.length,
      gmv: clientes.reduce((a, c) => a + c.gmvMesAnterior, 0),
      gmvConv: clientes.reduce((a, c) => a + conv(c.gmvMesAnterior), 0),
      color: COLORES[i % COLORES.length],
    };
  }).filter((k) => k.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad);

  const porKAMGmv = [...porKAM].sort((a, b) => b.gmv - a.gmv);
  const maxGMV    = Math.max(...porKAM.map((x) => x.gmv), 1);

  const top3 = [...data.clientesPerdidos].sort((a, b) => b.gmvMesAnterior - a.gmvMesAnterior).slice(0, 3);

  const kamsDisponibles  = kamsUnicos;
  const clientesFiltrados = filtroKAM
    ? data.clientesPerdidos.filter((c) => c.kam === filtroKAM)
    : data.clientesPerdidos;

  return (
    <section className="rounded-2xl overflow-hidden shadow-lg">

      {/* Banner */}
      <div style={{ background: BRAND_RED }} className="px-6 py-5">
        <h2 className="text-xl font-extrabold text-white tracking-tight mb-4">⚠️ Clientes Perdidos</h2>
        <div className="flex flex-wrap gap-4">
          <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 border border-white/20 min-w-[140px]">
            <p className="text-white/60 text-xs font-medium">Total perdidos</p>
            <p className="text-white font-extrabold text-2xl leading-tight">{data.clientesPerdidos.length}</p>
            <p className="text-white/50 text-xs">clientes</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 border border-white/20 min-w-[180px]">
            <p className="text-white/60 text-xs font-medium">💸 GMV mes anterior</p>
            <p className="text-white font-extrabold text-xl leading-tight">{M(totalGmv)}</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 border border-white/20 min-w-[140px]">
            <p className="text-white/60 text-xs font-medium">📊 Peso en facturación</p>
            <p className="text-white font-extrabold text-2xl leading-tight">{pesoEnFacturacion}%</p>
          </div>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="bg-white p-5">

        {/* Top 3 mayores pérdidas */}
        {top3.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {top3.map((c, i) => (
              <div key={c.cliente} className="rounded-xl p-3 text-center bg-red-50 border-2 border-red-200">
                <span className="text-xl">⚠️</span>
                <p className="text-xs font-bold mt-1 text-gray-700 truncate">{c.cliente}</p>
                <p className="text-sm font-extrabold text-red-600 whitespace-nowrap mt-0.5">{M(c.gmvMesAnterior)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{c.kam.split(" ")[0]}</p>
                <p className="text-[10px] text-orange-500">
                  {totalMesAnteriorEquipo > 0 ? ((c.gmvMesAnterior / totalMesAnteriorEquipo) * 100).toFixed(2) : "0"}% del equipo
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Gráficos: cantidad y GMV por KAM */}
        <div className="grid md:grid-cols-2 gap-5 mb-6">

          {/* Clientes perdidos por KAM (cantidad) */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Clientes perdidos por KAM</p>
            <div className="bg-gray-50 rounded-xl p-3">
              <ResponsiveContainer width="100%" height={Math.max(140, porKAM.length * 45)}>
                <BarChart data={porKAM} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="kam" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip content={(props) => <TooltipSimple {...props} fmt={(v) => `${v} clientes`} />} />
                  <Bar dataKey="cantidad" name="Clientes perdidos" radius={[0, 6, 6, 0]}>
                    {porKAM.map((k) => <Cell key={k.kam} fill={k.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GMV perdido por KAM */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">GMV perdido por KAM</p>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
              {porKAMGmv.map((k) => (
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

        {/* Detalle filtrable por KAM */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Detalle por cliente</p>
            <div className="flex flex-wrap gap-1.5 ml-auto">
              <button
                onClick={() => setFiltroKAM(null)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition ${!filtroKAM ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-600 hover:bg-red-50"}`}
              >Todos</button>
              {kamsDisponibles.map((kam, i) => (
                <button key={kam}
                  onClick={() => setFiltroKAM(filtroKAM === kam ? null : kam)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition ${filtroKAM === kam ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-red-50"}`}
                  style={filtroKAM === kam ? { background: COLORES[i % COLORES.length] } : {}}
                >{kam.split(" ")[0]}</button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-50 text-red-800">
                  <th className="text-left p-2.5">KAM</th>
                  <th className="text-left p-2.5">Cliente</th>
                  <th className="text-right p-2.5">GMV mes ant.</th>
                  <th className="text-right p-2.5">Peso</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-gray-400">Sin clientes perdidos para este KAM</td></tr>
                ) : clientesFiltrados
                    .slice()
                    .sort((a, b) => b.gmvMesAnterior - a.gmvMesAnterior)
                    .map((c) => (
                  <tr key={`${c.kam}-${c.cliente}`} className="border-b border-gray-50 hover:bg-red-50/50 transition">
                    <td className="p-2.5 text-gray-500 font-medium">{c.kam.split(" ")[0]}</td>
                    <td className="p-2.5 font-semibold text-gray-800">{c.cliente}</td>
                    <td className="p-2.5 text-right text-red-600 font-bold whitespace-nowrap">{M(c.gmvMesAnterior)}</td>
                    <td className="p-2.5 text-right text-orange-500 whitespace-nowrap">
                      {totalMesAnteriorEquipo > 0 ? ((c.gmvMesAnterior / totalMesAnteriorEquipo) * 100).toFixed(2) : "0"}%
                    </td>
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
