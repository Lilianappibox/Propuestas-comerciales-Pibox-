import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { fmtMoney, fmtM, PIBOX_PURPLE, PIBOX_PINK } from "./utils";
import { useMoneda } from "./MonedaContext";
import { TooltipMetaGMV } from "./TooltipCustom";

export default function Tendencias({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  const chartData = data.tendencias.map((t) => ({
    mes: t.mes,
    Meta:    conv(t.meta),
    GMV:     conv(t.gmv),
    metaOrig: t.meta,
    gmvOrig:  t.gmv,
  }));

  const ult  = data.tendencias[data.tendencias.length - 1];
  const prev = data.tendencias[data.tendencias.length - 2];
  const tendencia = ult && prev ? ult.gmv - prev.gmv : 0;

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-purple-800">Tendencias del Mercado</h2>
          <p className="text-sm text-gray-500">Histórico GMV vs Meta</p>
        </div>
        <div className={`rounded-lg px-3 py-2 ${tendencia >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <p className="text-gray-500 text-xs">Tendencia mes</p>
          <p className={`font-bold text-sm ${tendencia >= 0 ? "text-green-600" : "text-red-500"}`}>
            {tendencia >= 0 ? "↑" : "↓"} {M(Math.abs(tendencia))}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={Mx} tick={{ fontSize: 10 }} />
          <Tooltip content={(props) => <TooltipMetaGMV {...props} fmt={Mx} />} />
          <Legend />
          <Line type="monotone" dataKey="Meta" name="Meta" stroke={PIBOX_PURPLE} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
          <Line type="monotone" dataKey="GMV"  name="GMV Real" stroke={PIBOX_PINK} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm">
        <div className="bg-purple-50 rounded-xl p-3">
          <p className="font-semibold text-purple-700">📈 Análisis de Tendencia</p>
          <p className="text-gray-600 mt-1 text-xs">
            {tendencia >= 0
              ? `El GMV creció ${M(tendencia)} vs el mes anterior, señal positiva de recuperación.`
              : `El GMV cayó ${M(Math.abs(tendencia))} vs el mes anterior. Enero históricamente es bajo por estacionalidad.`}
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="font-semibold text-blue-700">📊 Estacionalidad</p>
          <p className="text-gray-600 mt-1 text-xs">
            Enero presenta caída estacional típica frente a diciembre. El crecimiento vs año anterior es +6.01%, señal de recuperación anual.
          </p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="font-semibold text-green-700">🎯 Meta Siguiente Mes</p>
          <p className="text-gray-600 mt-1 text-xs">
            GMV: <strong>{M(1580000000)}</strong> · Revenue 15%: <strong>{M(237000000)}</strong> · Retención: 95%
          </p>
        </div>
      </div>
    </section>
  );
}
