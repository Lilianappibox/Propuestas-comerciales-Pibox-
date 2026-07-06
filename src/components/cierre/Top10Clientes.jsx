import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { fmtMoney, fmtM, PIBOX_PURPLE, PIBOX_PINK } from "./utils";
import { useMoneda } from "./MonedaContext";
import { TooltipComparativo, TooltipCrecimiento } from "./TooltipCustom";

const norm  = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, " ");
const normK = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function Top10Clientes({ data }) {
  const { moneda, trm } = useMoneda();
  const M  = (n) => fmtMoney(n, moneda, trm);
  const Mx = (n) => fmtM(n, moneda, trm);
  const conv = (n) => moneda === "USD" ? n / trm : n;

  const [filtroKAM, setFiltroKAM] = useState("Todos");
  const [vista, setVista] = useState("tabla");

  // Genera lista dinámica de KAMs desde data.kams
  const kamsDisponibles = ["Todos", ...(data.kams ?? []).map((k) => k.nombre)];

  // Resuelve los clientes según la selección activa:
  // • Todos  → top10Clientes global (ya tiene KAM en cada fila)
  // • KAM X  → kamDetalle[X].top10 (hasta 10 clientes propios del KAM)
  const clientes = (() => {
    if (filtroKAM === "Todos") return data.top10Clientes || [];

    // Lookup normalizado para tolerar diferencias de capitalización
    const kd = data.kamDetalle?.[filtroKAM]
      ?? Object.entries(data.kamDetalle || {}).find(([k]) => normK(k) === normK(filtroKAM))?.[1];

    if (kd?.top10?.length) {
      return kd.top10.map(c => ({ ...c, kam: filtroKAM }));
    }

    // Fallback: filtrar global (por si kamDetalle aún no existe)
    return (data.top10Clientes || []).filter(
      (c) => norm(c.kam).includes(norm(filtroKAM.split(" ")[0])) ||
             norm(filtroKAM).includes(norm((c.kam || "").split(" ")[0]))
    );
  })();

  const top10 = clientes.slice(0, 10);

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-purple-800">Top 10 Clientes — {data.mes}</h2>

        {/* Filtros KAM — dinámicos */}
        <div className="flex flex-wrap gap-2">
          {kamsDisponibles.map((k) => (
            <button
              key={k}
              onClick={() => setFiltroKAM(k)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                filtroKAM === k
                  ? "bg-purple-600 text-white border-purple-600"
                  : "border-gray-300 text-gray-600 hover:bg-purple-50"
              }`}
            >
              {k === "Todos" ? k : k.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Vistas */}
        <div className="flex gap-2">
          {["tabla", "barras", "crecimiento"].map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition capitalize ${
                vista === v ? "bg-pink-500 text-white" : "border-gray-300 text-gray-600 hover:bg-pink-50"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Sin datos para el KAM seleccionado */}
      {top10.length === 0 && filtroKAM !== "Todos" && (
        <div className="text-center py-10 text-gray-400 text-sm">
          Sin clientes registrados para <strong>{filtroKAM}</strong> en este período.
          <br />
          <span className="text-xs">Verifica que el campo KAM en el Top 10 coincida con el nombre del KAM.</span>
        </div>
      )}

      {/* ── Tabla ── */}
      {vista === "tabla" && top10.length > 0 && (
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
                <tr
                  key={`${c.cliente}-${i}`}
                  className={`border-b hover:bg-purple-50 ${i < 3 ? "font-semibold" : ""}`}
                >
                  <td className="p-2 text-purple-500 font-bold">{i + 1}</td>
                  <td className="p-2">{c.cliente}</td>
                  <td className="p-2 text-gray-500 hidden md:table-cell">{c.kam}</td>
                  <td className="p-2 text-right text-purple-700 whitespace-nowrap">{M(c.gmvActual)}</td>
                  <td className="p-2 text-right text-gray-400 hidden sm:table-cell whitespace-nowrap">
                    {c.gmvAnterior > 0 ? M(c.gmvAnterior) : "—"}
                  </td>
                  <td className={`p-2 text-right font-semibold whitespace-nowrap ${
                    c.gmvAnterior > 0
                      ? c.crecimiento >= 0 ? "text-green-500" : "text-red-500"
                      : "text-gray-400"
                  }`}>
                    {c.gmvAnterior > 0
                      ? `${c.crecimiento >= 0 ? "▲" : "▼"} ${Math.abs(c.crecimiento).toFixed(2)}%`
                      : "Nuevo"}
                  </td>
                  <td className="p-2 text-right text-gray-500 hidden sm:table-cell">{c.participacion.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Barras ── */}
      {vista === "barras" && top10.length > 0 && (
        <ResponsiveContainer width="100%" height={Math.max(260, top10.length * 45)}>
          <BarChart
            data={top10.map((c) => ({
              ...c,
              gmvActualConv:   conv(c.gmvActual),
              gmvAnteriorConv: conv(c.gmvAnterior),
            }))}
            layout="vertical"
            margin={{ left: 10 }}
          >
            <XAxis type="number" tickFormatter={Mx} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="cliente" tick={{ fontSize: 10 }} width={140} />
            <Tooltip
              content={(props) => (
                <TooltipComparativo
                  {...props}
                  fmt={(v) => M(moneda === "USD" ? v * trm : v)}
                  keyActual="gmvActualConv"
                  keyAnterior="gmvAnteriorConv"
                />
              )}
            />
            <Bar dataKey="gmvActualConv"   name={data.periodo}  fill={PIBOX_PINK}   radius={[0, 4, 4, 0]} />
            <Bar dataKey="gmvAnteriorConv" name="Mes Anterior"  fill={PIBOX_PURPLE} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* ── Crecimiento ── */}
      {vista === "crecimiento" && top10.length > 0 && (
        <ResponsiveContainer width="100%" height={Math.max(260, top10.length * 45)}>
          <BarChart data={top10} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" unit="%" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="cliente" tick={{ fontSize: 10 }} width={140} />
            <Tooltip content={(props) => <TooltipCrecimiento {...props} />} />
            <ReferenceLine x={0} stroke="#ccc" />
            <Bar dataKey="crecimiento" name="Crecimiento %" radius={[0, 4, 4, 0]}>
              {top10.map((c, i) => (
                <Cell key={`${c.cliente}-${i}`} fill={c.crecimiento >= 0 ? "#22c55e" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
