import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { fmtMoney, fmtM, PIBOX_PURPLE, PIBOX_PINK } from "./utils";
import { useMoneda } from "./MonedaContext";
import { TooltipComparativo, TooltipCrecimiento } from "./TooltipCustom";

const KAMS = ["Todos", "Natalia Olivera", "Johana Navarrete", "Juliana Rojas", "Bavaria", "Keeping Deal"];

export default function Top10Clientes({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  const [filtroKAM, setFiltroKAM] = useState("Todos");
  const [vista, setVista] = useState("tabla");

  const clientes = filtroKAM === "Todos"
    ? data.top10Clientes
    : data.top10Clientes.filter((c) => c.kam === filtroKAM);
  const top10 = clientes.slice(0, 10);

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-purple-800">Top 10 Clientes — {data.mes}</h2>
        <div className="flex flex-wrap gap-2">
          {KAMS.map((k) => (
            <button
              key={k}
              onClick={() => setFiltroKAM(k)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${filtroKAM === k ? "bg-purple-600 text-white" : "border-gray-300 text-gray-600 hover:bg-purple-50"}`}
            >
              {k === "Todos" ? k : k.split(" ")[0]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {["tabla", "barras", "crecimiento"].map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition capitalize ${vista === v ? "bg-pink-500 text-white" : "border-gray-300 text-gray-600 hover:bg-pink-50"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {vista === "tabla" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-purple-50 text-purple-800">
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Cliente</th>
                <th className="text-left p-2 hidden md:table-cell">KAM</th>
                <th className="text-right p-2">GMV {data.periodo}</th>
                <th className="text-right p-2 hidden sm:table-cell">GMV Ant.</th>
                <th className="text-right p-2">Crecimiento</th>
                <th className="text-right p-2 hidden sm:table-cell">Participación</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((c, i) => (
                <tr key={c.cliente} className={`border-b hover:bg-purple-50 ${i < 3 ? "font-semibold" : ""}`}>
                  <td className="p-2 text-purple-500 font-bold">{i + 1}</td>
                  <td className="p-2">{c.cliente}</td>
                  <td className="p-2 text-gray-500 hidden md:table-cell">{c.kam}</td>
                  <td className="p-2 text-right text-purple-700 whitespace-nowrap">{M(c.gmvActual)}</td>
                  <td className="p-2 text-right text-gray-400 hidden sm:table-cell whitespace-nowrap">{M(c.gmvAnterior)}</td>
                  <td className={`p-2 text-right font-semibold whitespace-nowrap ${c.crecimiento >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {c.crecimiento >= 0 ? "▲" : "▼"} {Math.abs(c.crecimiento).toFixed(2)}%
                  </td>
                  <td className="p-2 text-right text-gray-500 hidden sm:table-cell">{c.participacion.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vista === "barras" && (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top10.map((c) => ({ ...c, gmvActualConv: conv(c.gmvActual), gmvAnteriorConv: conv(c.gmvAnterior) }))} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" tickFormatter={Mx} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="cliente" tick={{ fontSize: 10 }} width={130} />
            <Tooltip content={(props) => <TooltipComparativo {...props} fmt={(v) => M(moneda === "USD" ? v * trm : v)} keyActual="gmvActualConv" keyAnterior="gmvAnteriorConv" />} />
            <Bar dataKey="gmvActualConv"   name={data.periodo}     fill={PIBOX_PINK}   radius={[0, 4, 4, 0]} />
            <Bar dataKey="gmvAnteriorConv" name="Mes Anterior"     fill={PIBOX_PURPLE} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {vista === "crecimiento" && (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top10} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" unit="%" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="cliente" tick={{ fontSize: 10 }} width={130} />
            <Tooltip content={(props) => <TooltipCrecimiento {...props} />} />
            <ReferenceLine x={0} stroke="#ccc" />
            <Bar dataKey="crecimiento" name="Crecimiento %" radius={[0, 4, 4, 0]}>
              {top10.map((c) => (
                <Cell key={c.cliente} fill={c.crecimiento >= 0 ? "#22c55e" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
