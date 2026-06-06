import { useState } from "react";
import { useMoneda } from "./MonedaContext";

export default function BarraTRM() {
  const { trm, setTrm, moneda, toggleMoneda } = useMoneda();
  const [editando, setEditando] = useState(false);
  const [tmp, setTmp] = useState(trm);

  const confirmar = () => {
    setTrm(tmp);
    setEditando(false);
  };

  return (
    <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-sm flex-wrap">
      {/* Indicador TRM */}
      <div className="flex items-center gap-2">
        <span className="text-purple-600 font-semibold">💱 TRM:</span>
        {editando ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={tmp}
              onChange={(e) => setTmp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmar()}
              className="w-28 border border-purple-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
              autoFocus
            />
            <button
              onClick={confirmar}
              className="px-2 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
            >
              ✓
            </button>
            <button
              onClick={() => setEditando(false)}
              className="px-2 py-1 bg-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-300"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setTmp(trm); setEditando(true); }}
            className="font-bold text-purple-800 hover:underline hover:text-purple-600 transition"
          >
            ${new Intl.NumberFormat("es-CO").format(trm)} COP/USD
          </button>
        )}
        <span className="text-gray-400 text-xs">(clic para editar)</span>
      </div>

      {/* Toggle moneda */}
      <div className="flex items-center gap-2 ml-2">
        <span className="text-gray-500 text-xs">Mostrar en:</span>
        <button
          onClick={toggleMoneda}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${
            moneda === "USD" ? "bg-green-500" : "bg-purple-500"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              moneda === "USD" ? "translate-x-8" : "translate-x-1"
            }`}
          />
        </button>
        <span className={`font-bold text-sm ${moneda === "USD" ? "text-green-600" : "text-purple-700"}`}>
          {moneda === "USD" ? "🇺🇸 USD" : "🇨🇴 COP"}
        </span>
      </div>

      {/* Equivalencia rápida */}
      {moneda === "USD" && (
        <span className="text-xs text-gray-500 italic">
          $1.000.000 COP = ${(1000000 / trm).toFixed(0)} USD
        </span>
      )}
    </div>
  );
}
