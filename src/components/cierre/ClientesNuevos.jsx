import { fmtMoney, fmtM, PIBOX_PURPLE } from "./utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMoneda } from "./MonedaContext";
import { TooltipSimple } from "./TooltipCustom";

const COLORES = ["#8B2FC9", "#E040FB", "#7C3AED", "#A855F7", "#C084FC"];

export default function ClientesNuevos({ data }) {
  const { moneda, trm } = useMoneda();
  const M = (n) => fmtMoney(n, moneda, trm);

  const porKAM = data.kams.map((k, i) => {
    const clientes = data.clientesNuevos.filter((c) => c.kam === k.nombre);
    return {
      kam: k.nombre.split(" ")[0],
      fullNombre: k.nombre,
      cantidad: clientes.length,
      gmv: clientes.reduce((a, c) => a + c.gmv, 0),
      clientes,
      color: COLORES[i % COLORES.length],
    };
  });

  const totalGmv     = data.clientesNuevos.reduce((a, c) => a + c.gmv, 0);
  const totalCantidad = data.clientesNuevos.length;
  const top3 = [...data.clientesNuevos].sort((a, b) => b.gmv - a.gmv).slice(0, 3);
  const maxGMV = Math.max(...porKAM.map((x) => x.gmv), 1);

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-bold text-purple-800 mb-1">Análisis Clientes Nuevos</h2>
      <p className="text-sm text-gray-500 mb-4">
        {totalCantidad} clientes nuevos · <span className="font-semibold text-purple-700">{M(totalGmv)}</span> GMV primer servicio
      </p>

      {/* Top 3 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {top3.map((c, i) => (
          <div key={c.cliente} className={`rounded-xl p-3 text-center ${i === 0 ? "bg-yellow-50 border-2 border-yellow-300" : i === 1 ? "bg-gray-50 border-2 border-gray-300" : "bg-orange-50 border-2 border-orange-300"}`}>
            <span className="text-2xl">{["🥇", "🥈", "🥉"][i]}</span>
            <p className="text-xs font-semibold mt-1 text-gray-700 truncate">{c.cliente}</p>
            <p className="text-sm font-bold text-purple-700">{M(c.gmv)}</p>
            <p className="text-xs text-gray-400">{c.kam.split(" ")[0]}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Clientes nuevos por KAM</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={porKAM} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="kam" tick={{ fontSize: 11 }} width={65} />
              <Tooltip content={(props) => <TooltipSimple {...props} fmt={(v) => `${v} clientes`} />} />
              <Bar dataKey="cantidad" name="Cantidad" radius={[0, 4, 4, 0]}>
                {porKAM.map((k) => <Cell key={k.kam} fill={k.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">GMV primer servicio por KAM</h3>
          <div className="space-y-2">
            {porKAM.filter((k) => k.cantidad > 0).map((k) => (
              <div key={k.kam}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold" style={{ color: k.color }}>{k.fullNombre}</span>
                  <span className="text-gray-600">{k.cantidad} · <strong>{M(k.gmv)}</strong></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(k.gmv / maxGMV) * 100}%`, backgroundColor: k.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-4">
        <summary className="text-sm font-semibold text-purple-700 cursor-pointer hover:text-purple-900">Ver detalle por cliente</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-purple-50 text-purple-800">
                <th className="text-left p-2">KAM</th>
                <th className="text-left p-2">Cliente</th>
                <th className="text-right p-2">Servicios</th>
                <th className="text-right p-2">GMV</th>
              </tr>
            </thead>
            <tbody>
              {data.clientesNuevos.map((c) => (
                <tr key={`${c.kam}-${c.cliente}`} className="border-b hover:bg-purple-50">
                  <td className="p-2 text-gray-500">{c.kam.split(" ")[0]}</td>
                  <td className="p-2 font-medium">{c.cliente}</td>
                  <td className="p-2 text-right">{c.servicios}</td>
                  <td className="p-2 text-right text-purple-700 font-semibold whitespace-nowrap">{M(c.gmv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
