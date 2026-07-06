import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";
import { fmtMoney, fmtM } from "./utils";
import { useMoneda } from "./MonedaContext";
import { TooltipSimple } from "./TooltipCustom";

const COLORS = ["#7C22D4", "#E040FB", "#8B5CF6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444"];

const GRADIENTS = [
  "linear-gradient(135deg,#5B17A8,#7C22D4)",
  "linear-gradient(135deg,#9333ea,#E040FB)",
  "linear-gradient(135deg,#4f46e5,#8B5CF6)",
  "linear-gradient(135deg,#0891b2,#06b6d4)",
  "linear-gradient(135deg,#b45309,#f59e0b)",
  "linear-gradient(135deg,#047857,#10b981)",
  "linear-gradient(135deg,#b91c1c,#ef4444)",
];

const ICONOS = {
  Bavaria: "🍺", Carga: "🚛", Horas: "⏱️", "On Demand": "⚡",
  "Paquetería": "📦", Rent: "🔑", Storage: "🏢",
};

function Variacion({ actual, anterior }) {
  if (!anterior || anterior === 0) return <span className="text-xs text-gray-400">—</span>;
  const pct = ((actual - anterior) / anterior) * 100;
  const up  = pct >= 0;
  return (
    <span className={`text-xs font-bold ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function LineaCard({ l, i, total, M }) {
  const pct    = ((l.gmv / total) * 100).toFixed(1);
  const color  = COLORS[i % COLORS.length];
  const grad   = GRADIENTS[i % GRADIENTS.length];
  const gmvVar = l.gmvAnt && l.gmvAnt > 0 ? ((l.gmv - l.gmvAnt) / l.gmvAnt) * 100 : null;
  const varUp  = gmvVar !== null && gmvVar >= 0;
  const barW   = Math.min(Number(pct) * 2.5, 100);

  return (
    <div className="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 hover:scale-[1.01]">
      {/* Header gradiente */}
      <div style={{ background: grad }} className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{ICONOS[l.linea] || "📊"}</span>
            <p className="text-white font-extrabold text-base">{l.linea}</p>
          </div>
          {gmvVar !== null && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${varUp ? "bg-emerald-400/30 text-white" : "bg-red-400/30 text-white"}`}>
              {varUp ? "▲" : "▼"} {Math.abs(gmvVar).toFixed(1)}%
            </span>
          )}
        </div>
        {/* Barra de participación */}
        <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/70 rounded-full" style={{ width: `${barW}%` }} />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-white/50 text-[10px]">participación</span>
          <span className="text-white/80 text-[10px] font-bold">{pct}% del GMV</span>
        </div>
      </div>

      {/* Cuerpo blanco */}
      <div className="bg-white px-4 py-3">
        {/* GMV */}
        <p className="font-extrabold text-lg leading-tight mb-0.5" style={{ color }}>{M(l.gmv)}</p>

        <div className="border-t border-gray-100 mt-2 pt-2 space-y-1.5">
          {/* Servicios */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 font-medium">Servicios</span>
            <span className="text-xs font-extrabold text-gray-800">{l.servicios.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">vs ant.</span>
            <Variacion actual={l.servicios} anterior={l.serviciosAnt} />
          </div>

          {/* Paquetes */}
          {(l.paquetes > 0 || l.paquetesAnt > 0) && (
            <>
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <span className="text-xs text-gray-600 font-medium">Paquetes</span>
                <span className="text-xs font-extrabold text-gray-800">{(l.paquetes || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">vs ant.</span>
                <Variacion actual={l.paquetes || 0} anterior={l.paquetesAnt || 0} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const BRAND = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";

export default function FacturacionLinea({ data }) {
  const { moneda, trm } = useMoneda();
  const M   = (n) => fmtMoney(n, moneda, trm);
  const Mx  = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  const lineas     = data.facturacionLinea;
  const total      = lineas.reduce((a, l) => a + l.gmv, 0);
  const totalAnt   = lineas.reduce((a, l) => a + (l.gmvAnt || 0), 0);
  const totalServ  = lineas.reduce((a, l) => a + l.servicios, 0);
  const totalPaq   = lineas.reduce((a, l) => a + (l.paquetes || 0), 0);
  const chartLineas = lineas.map((l) => ({ ...l, gmvConv: conv(l.gmv) }));

  const gmvVar   = totalAnt > 0 ? ((total - totalAnt) / totalAnt) * 100 : null;
  const gmvVarUp = gmvVar !== null && gmvVar >= 0;

  return (
    <section className="rounded-2xl overflow-hidden shadow-lg">

      {/* Banner de cabecera */}
      <div style={{ background: BRAND }} className="px-6 py-5">
        <h2 className="text-xl font-extrabold text-white tracking-tight mb-4">Facturación por Línea de Servicio</h2>
        <div className="flex flex-wrap gap-4">
          {/* GMV Total */}
          <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 border border-white/20 min-w-[160px]">
            <p className="text-white/60 text-xs font-medium">💰 GMV Total</p>
            <p className="text-white font-extrabold text-xl leading-tight">{M(total)}</p>
            {gmvVar !== null && (
              <span className={`text-xs font-bold mt-0.5 inline-block ${gmvVarUp ? "text-emerald-300" : "text-red-300"}`}>
                {gmvVarUp ? "▲" : "▼"} {Math.abs(gmvVar).toFixed(1)}%
              </span>
            )}
          </div>
          {/* Servicios */}
          <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 border border-white/20 min-w-[130px]">
            <p className="text-white/60 text-xs font-medium">📋 Servicios</p>
            <p className="text-white font-extrabold text-xl leading-tight">{totalServ.toLocaleString()}</p>
          </div>
          {/* Paquetes */}
          <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 border border-white/20 min-w-[130px]">
            <p className="text-white/60 text-xs font-medium">📦 Paquetes</p>
            <p className="text-white font-extrabold text-xl leading-tight">{totalPaq.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="bg-white p-5">
        {/* Cards por línea */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {lineas.map((l, i) => (
            <LineaCard key={l.linea} l={l} i={i} total={total} M={M} />
          ))}
        </div>

        {/* Gráficos — ocultos en PDF */}
        <div className="grid md:grid-cols-2 gap-4 mb-5 cierre-print-hide">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Distribución GMV</p>
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
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">GMV por Línea</p>
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

        {/* Tabla comparativa */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Detalle comparativo</p>
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-purple-50 text-purple-800">
                <th className="text-left p-2.5">Línea</th>
                <th className="text-right p-2.5">GMV</th>
                <th className="text-right p-2.5">Var. GMV</th>
                <th className="text-right p-2.5">Servicios</th>
                <th className="text-right p-2.5">Var. Serv.</th>
                <th className="text-right p-2.5">Paquetes</th>
                <th className="text-right p-2.5">Var. Paq.</th>
                <th className="text-right p-2.5">Part.</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={l.linea} className="border-b border-gray-50 hover:bg-purple-50/50 transition">
                  <td className="p-2.5 font-semibold flex items-center gap-1.5">
                    <span>{ICONOS[l.linea] || "📊"}</span> {l.linea}
                  </td>
                  <td className="p-2.5 text-right font-bold whitespace-nowrap" style={{ color: COLORS[i % COLORS.length] }}>
                    {M(l.gmv)}
                  </td>
                  <td className="p-2.5 text-right"><Variacion actual={l.gmv} anterior={l.gmvAnt} /></td>
                  <td className="p-2.5 text-right font-semibold">{l.servicios.toLocaleString()}</td>
                  <td className="p-2.5 text-right"><Variacion actual={l.servicios} anterior={l.serviciosAnt} /></td>
                  <td className="p-2.5 text-right font-semibold">{(l.paquetes || 0).toLocaleString()}</td>
                  <td className="p-2.5 text-right"><Variacion actual={l.paquetes || 0} anterior={l.paquetesAnt || 0} /></td>
                  <td className="p-2.5 text-right text-gray-500">{((l.gmv / total) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="bg-purple-100 font-bold text-purple-900">
                <td className="p-2.5">TOTAL</td>
                <td className="p-2.5 text-right whitespace-nowrap">{M(total)}</td>
                <td className="p-2.5 text-right"><Variacion actual={total} anterior={totalAnt} /></td>
                <td className="p-2.5 text-right">{totalServ.toLocaleString()}</td>
                <td className="p-2.5 text-right">—</td>
                <td className="p-2.5 text-right">{totalPaq.toLocaleString()}</td>
                <td className="p-2.5 text-right">—</td>
                <td className="p-2.5 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
