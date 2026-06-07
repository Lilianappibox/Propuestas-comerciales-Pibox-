import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";
import { fmtMoney, fmtM } from "./utils";
import { useMoneda } from "./MonedaContext";
import { TooltipSimple } from "./TooltipCustom";

const COLORS = ["#7C22D4", "#E040FB", "#8B5CF6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444"];
const ICONOS = {
  Bavaria: "🍺", Carga: "🚛", Horas: "⏱️", "On Demand": "⚡",
  "Paquetería": "📦", Rent: "🔑", Storage: "🏢",
};

function Variacion({ actual, anterior, suffix = "" }) {
  if (!anterior || anterior === 0) return <span className="text-xs text-gray-400">—</span>;
  const pct = ((actual - anterior) / anterior) * 100;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-bold ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%{suffix}
    </span>
  );
}

export default function FacturacionLinea({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  const lineas = data.facturacionLinea;
  const total = lineas.reduce((a, l) => a + l.gmv, 0);
  const totalAnt = lineas.reduce((a, l) => a + (l.gmvAnt || 0), 0);
  const totalServ = lineas.reduce((a, l) => a + l.servicios, 0);
  const totalPaq = lineas.reduce((a, l) => a + (l.paquetes || 0), 0);
  const chartLineas = lineas.map((l) => ({ ...l, gmvConv: conv(l.gmv) }));

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-bold text-purple-800 mb-1">Facturación por Línea de Servicio</h2>

      {/* Resumen general */}
      <div className="flex flex-wrap gap-3 mb-5 text-sm">
        <div className="bg-purple-50 rounded-lg px-3 py-2">
          <p className="text-gray-500 text-xs">GMV Total</p>
          <p className="font-bold text-purple-700">{M(total)}</p>
          <Variacion actual={total} anterior={totalAnt} />
        </div>
        <div className="bg-blue-50 rounded-lg px-3 py-2">
          <p className="text-gray-500 text-xs">Servicios</p>
          <p className="font-bold text-blue-700">{totalServ.toLocaleString()}</p>
        </div>
        <div className="bg-amber-50 rounded-lg px-3 py-2">
          <p className="text-gray-500 text-xs">Paquetes</p>
          <p className="font-bold text-amber-700">{totalPaq.toLocaleString()}</p>
        </div>
      </div>

      {/* Cards por línea */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        {lineas.map((l, i) => {
          const pct = ((l.gmv / total) * 100).toFixed(1);
          return (
            <div
              key={l.linea}
              className="rounded-xl p-4 border-2 transition hover:shadow-md"
              style={{ backgroundColor: COLORS[i % COLORS.length] + "12", borderColor: COLORS[i % COLORS.length] + "30" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{ICONOS[l.linea] || "📊"}</span>
                <p className="text-xs font-bold text-gray-700">{l.linea}</p>
              </div>

              {/* GMV */}
              <p className="text-sm font-bold leading-tight" style={{ color: COLORS[i % COLORS.length] }}>
                {M(l.gmv)}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{pct}%</span>
                <Variacion actual={l.gmv} anterior={l.gmvAnt} />
              </div>

              {/* Servicios */}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Servicios</span>
                  <span className="text-xs font-bold text-gray-700">{l.servicios.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">vs ant.</span>
                  <Variacion actual={l.servicios} anterior={l.serviciosAnt} />
                </div>
              </div>

              {/* Paquetes */}
              {(l.paquetes > 0 || l.paquetesAnt > 0) && (
                <div className="mt-1 pt-1 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Paquetes</span>
                    <span className="text-xs font-bold text-gray-700">{l.paquetes.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">vs ant.</span>
                    <Variacion actual={l.paquetes} anterior={l.paquetesAnt} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Distribución GMV</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={chartLineas} dataKey="gmvConv" nameKey="linea"
                cx="50%" cy="50%" outerRadius={85} innerRadius={40}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartLineas.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={(props) => <TooltipSimple {...props} fmt={(v) => M(moneda === "USD" ? v * trm : v)} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">GMV por Línea</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartLineas} margin={{ left: 0 }}>
              <XAxis dataKey="linea" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tickFormatter={Mx} tick={{ fontSize: 10 }} />
              <Tooltip content={(props) => <TooltipSimple {...props} fmt={(v) => M(moneda === "USD" ? v * trm : v)} />} />
              <Bar dataKey="gmvConv" name="GMV" radius={[6, 6, 0, 0]}>
                {chartLineas.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla comparativa detallada */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-purple-50 text-purple-800">
              <th className="text-left p-2">Línea</th>
              <th className="text-right p-2">GMV</th>
              <th className="text-right p-2">Var. GMV</th>
              <th className="text-right p-2">Servicios</th>
              <th className="text-right p-2">Var. Serv.</th>
              <th className="text-right p-2">Paquetes</th>
              <th className="text-right p-2">Var. Paq.</th>
              <th className="text-right p-2">Part.</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={l.linea} className="border-b hover:bg-purple-50 transition">
                <td className="p-2 font-semibold flex items-center gap-1">
                  <span>{ICONOS[l.linea] || "📊"}</span> {l.linea}
                </td>
                <td className="p-2 text-right font-bold whitespace-nowrap" style={{ color: COLORS[i % COLORS.length] }}>
                  {M(l.gmv)}
                </td>
                <td className="p-2 text-right">
                  <Variacion actual={l.gmv} anterior={l.gmvAnt} />
                </td>
                <td className="p-2 text-right font-semibold">{l.servicios.toLocaleString()}</td>
                <td className="p-2 text-right">
                  <Variacion actual={l.servicios} anterior={l.serviciosAnt} />
                </td>
                <td className="p-2 text-right font-semibold">{(l.paquetes || 0).toLocaleString()}</td>
                <td className="p-2 text-right">
                  <Variacion actual={l.paquetes || 0} anterior={l.paquetesAnt || 0} />
                </td>
                <td className="p-2 text-right text-gray-500">{((l.gmv / total) * 100).toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="bg-purple-100 font-bold text-purple-900">
              <td className="p-2">TOTAL</td>
              <td className="p-2 text-right whitespace-nowrap">{M(total)}</td>
              <td className="p-2 text-right"><Variacion actual={total} anterior={totalAnt} /></td>
              <td className="p-2 text-right">{totalServ.toLocaleString()}</td>
              <td className="p-2 text-right">—</td>
              <td className="p-2 text-right">{totalPaq.toLocaleString()}</td>
              <td className="p-2 text-right">—</td>
              <td className="p-2 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
