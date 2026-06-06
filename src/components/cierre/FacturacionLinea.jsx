import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";
import { fmtMoney, fmtM } from "./utils";
import { useMoneda } from "./MonedaContext";
import { TooltipSimple } from "./TooltipCustom";

const COLORS = ["#8B2FC9", "#E040FB", "#CE93D8", "#7C3AED"];
const ICONOS = { "Servicios Carga": "🚛", "Servicios Moto": "🏍️", "Servicios Rent": "📦", "Servicios Storage": "🏢" };

export default function FacturacionLinea({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  const total = data.facturacionLinea.reduce((a, l) => a + l.gmv, 0);
  const chartLineas = data.facturacionLinea.map((l) => ({ ...l, gmvConv: conv(l.gmv) }));

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-bold text-purple-800 mb-4">Facturación por Línea de Servicio</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {data.facturacionLinea.map((l, i) => (
          <div key={l.linea} className="rounded-xl p-4 text-center" style={{ backgroundColor: COLORS[i] + "18", border: `2px solid ${COLORS[i]}30` }}>
            <p className="text-2xl mb-1">{ICONOS[l.linea]}</p>
            <p className="text-xs font-semibold text-gray-600">{l.linea}</p>
            <p className="text-base font-bold mt-1 leading-tight" style={{ color: COLORS[i] }}>{M(l.gmv)}</p>
            <p className="text-xs text-gray-400">{((l.gmv / total) * 100).toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">{l.servicios.toLocaleString()} servicios</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartLineas} dataKey="gmvConv" nameKey="linea"
              cx="50%" cy="50%" outerRadius={80}
              label={({ name, percent }) => `${name.replace("Servicios ", "")} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chartLineas.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Tooltip content={(props) => <TooltipSimple {...props} fmt={(v) => M(moneda === "USD" ? v * trm : v)} />} />
          </PieChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartLineas} margin={{ left: 0 }}>
            <XAxis dataKey="linea" tick={{ fontSize: 9 }} tickFormatter={(v) => v.replace("Servicios ", "")} />
            <YAxis tickFormatter={Mx} tick={{ fontSize: 10 }} />
            <Tooltip content={(props) => <TooltipSimple {...props} fmt={(v) => M(moneda === "USD" ? v * trm : v)} />} />
            <Bar dataKey="gmvConv" name="GMV" radius={[6, 6, 0, 0]}>
              {chartLineas.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
