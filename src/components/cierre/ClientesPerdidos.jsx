import { fmtMoney, fmtM } from "./utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMoneda } from "./MonedaContext";
import { TooltipSimple } from "./TooltipCustom";

const COLORES = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#06b6d4"];

export default function ClientesPerdidos({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  const totalGmv = data.clientesPerdidos.reduce((a, c) => a + c.gmvMesAnterior, 0);
  const totalMesAnteriorEquipo = data.cumplimientoEquipo.mesPasadoGmv;
  const pesoEnFacturacion = ((totalGmv / totalMesAnteriorEquipo) * 100).toFixed(2);

  const porKAM = ["Johana Navarrete", "Juliana Rojas", "Natalia Olivera", "Bavaria", "Pibox"].map((nombre, i) => {
    const clientes = data.clientesPerdidos.filter((c) => c.kam === nombre);
    return {
      kam: nombre.split(" ")[0],
      fullNombre: nombre,
      cantidad: clientes.length,
      gmv: clientes.reduce((a, c) => a + c.gmvMesAnterior, 0),
      gmvConv: clientes.reduce((a, c) => a + conv(c.gmvMesAnterior), 0),
      color: COLORES[i % COLORES.length],
    };
  }).filter((k) => k.cantidad > 0);

  const top3 = [...data.clientesPerdidos].sort((a, b) => b.gmvMesAnterior - a.gmvMesAnterior).slice(0, 3);

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-bold text-purple-800 mb-1">Análisis Clientes Perdidos</h2>
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <div className="bg-red-50 rounded-lg px-3 py-2">
          <p className="text-gray-500 text-xs">Total perdidos</p>
          <p className="font-bold text-red-600">{data.clientesPerdidos.length} clientes</p>
        </div>
        <div className="bg-red-50 rounded-lg px-3 py-2">
          <p className="text-gray-500 text-xs">GMV mes anterior</p>
          <p className="font-bold text-red-600 whitespace-nowrap">{M(totalGmv)}</p>
        </div>
        <div className="bg-orange-50 rounded-lg px-3 py-2">
          <p className="text-gray-500 text-xs">Peso en facturación anterior</p>
          <p className="font-bold text-orange-600">{pesoEnFacturacion}%</p>
        </div>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {top3.map((c, i) => (
          <div key={c.cliente} className="rounded-xl p-3 text-center bg-red-50 border-2 border-red-200">
            <span className="text-xl">⚠️</span>
            <p className="text-xs font-semibold mt-1 text-gray-700 truncate">{c.cliente}</p>
            <p className="text-sm font-bold text-red-600 whitespace-nowrap">{M(c.gmvMesAnterior)}</p>
            <p className="text-xs text-gray-400">{c.kam.split(" ")[0]}</p>
            <p className="text-xs text-orange-500">Peso: {((c.gmvMesAnterior / totalMesAnteriorEquipo) * 100).toFixed(2)}%</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">GMV perdido por KAM</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={porKAM} layout="vertical">
              <XAxis type="number" tickFormatter={Mx} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="kam" tick={{ fontSize: 11 }} width={65} />
              <Tooltip content={(props) => <TooltipSimple {...props} fmt={(v) => M(moneda === "USD" ? v * trm : v)} />} />
              <Bar dataKey="gmvConv" name="GMV mes anterior" radius={[0, 4, 4, 0]}>
                {porKAM.map((k) => <Cell key={k.kam} fill={k.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-red-50 text-red-800">
                <th className="text-left p-2">KAM</th>
                <th className="text-left p-2">Cliente</th>
                <th className="text-right p-2">GMV Ant.</th>
                <th className="text-right p-2">Peso</th>
              </tr>
            </thead>
            <tbody>
              {data.clientesPerdidos.map((c) => (
                <tr key={`${c.kam}-${c.cliente}`} className="border-b hover:bg-red-50">
                  <td className="p-2 text-gray-500">{c.kam.split(" ")[0]}</td>
                  <td className="p-2 font-medium truncate max-w-[120px]">{c.cliente}</td>
                  <td className="p-2 text-right text-red-600 font-semibold whitespace-nowrap">{M(c.gmvMesAnterior)}</td>
                  <td className="p-2 text-right text-orange-500 whitespace-nowrap">{((c.gmvMesAnterior / totalMesAnteriorEquipo) * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
