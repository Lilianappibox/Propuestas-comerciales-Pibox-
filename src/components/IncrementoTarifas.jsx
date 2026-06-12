import { useState, useMemo, useCallback } from "react";
import clientesDB from "../data/tarifasCliente.json";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";

const RATE_FIELDS = [
  { key: "baseFare",     label: "Tarifa Base" },
  { key: "minimumFare",  label: "Tarifa Mínima" },
  { key: "distanceFare", label: "Tarifa Distancia" },
  { key: "extraStopFare",label: "Parada Adicional" },
  { key: "hourFare",     label: "Tarifa Hora" },
  { key: "hourBaseFare", label: "Tarifa Hora Base" },
  { key: "packageFare",  label: "Tarifa Paquete" },
];

const MAX_DISPLAY = 50;

const fmt = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  return `$${Number(v).toLocaleString("es-CO")}`;
};

// Unique sorted values for dropdown filters
const uniqueValues = (key) => {
  const set = new Set(clientesDB.map((c) => c[key]).filter(Boolean));
  return [...set].sort();
};

const tiposServicio = uniqueValues("tipoServicio");
const ciudades      = uniqueValues("ciudad");
const kams          = uniqueValues("kam");

export default function IncrementoTarifas() {
  // Step 1 — filters & selection
  const [searchText, setSearchText]       = useState("");
  const [filterTipo, setFilterTipo]       = useState("");
  const [filterCiudad, setFilterCiudad]   = useState("");
  const [filterKam, setFilterKam]         = useState("");
  const [selectedIds, setSelectedIds]     = useState(new Set());

  // Step 2 — increment config
  const [pctIncremento, setPctIncremento] = useState(10);
  const [selectedFields, setSelectedFields] = useState(
    new Set(RATE_FIELDS.map((f) => f.key))
  );

  // Step 3/4
  const [step, setStep] = useState(1); // 1 = select, 2 = config, 3 = preview
  const [toast, setToast] = useState("");

  // ---------- filtered clients ----------
  const filtered = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return clientesDB.filter((c, idx) => {
      if (q && !c.nombre.toLowerCase().includes(q)) return false;
      if (filterTipo && c.tipoServicio !== filterTipo) return false;
      if (filterCiudad && c.ciudad !== filterCiudad) return false;
      if (filterKam && c.kam !== filterKam) return false;
      return true;
    });
  }, [searchText, filterTipo, filterCiudad, filterKam]);

  const displayed = useMemo(() => filtered.slice(0, MAX_DISPLAY), [filtered]);

  // ---------- selection helpers ----------
  const toggleClient = useCallback((idx) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((c) => {
        const idx = clientesDB.indexOf(c);
        next.add(idx);
      });
      return next;
    });
  }, [filtered]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ---------- field toggle helpers ----------
  const toggleField = (key) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllFields = () => {
    if (selectedFields.size === RATE_FIELDS.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(RATE_FIELDS.map((f) => f.key)));
    }
  };

  // ---------- computed new rates ----------
  const selectedClients = useMemo(
    () => [...selectedIds].map((i) => clientesDB[i]),
    [selectedIds]
  );

  const multiplier = 1 + pctIncremento / 100;

  const computeNew = (client) => {
    const newRates = {};
    RATE_FIELDS.forEach(({ key }) => {
      if (selectedFields.has(key)) {
        newRates[key] = Math.round(client[key] * multiplier);
      } else {
        newRates[key] = client[key];
      }
    });
    return newRates;
  };

  // ---------- actions ----------
  const handleApprove = () => {
    const records = selectedClients.map((c) => {
      const newRates = computeNew(c);
      const tarifasAntiguas = {};
      const tarifasNuevas = {};
      RATE_FIELDS.forEach(({ key }) => {
        if (selectedFields.has(key)) {
          tarifasAntiguas[key] = c[key];
          tarifasNuevas[key] = newRates[key];
        }
      });
      return {
        cliente: c.nombre,
        tipoServicio: c.tipoServicio,
        ciudad: c.ciudad,
        moneda: c.moneda,
        tarifasAntiguas,
        tarifasNuevas,
        fecha: new Date().toISOString(),
        porcentaje: pctIncremento,
      };
    });

    const prev = JSON.parse(localStorage.getItem("pibox_incrementos_aprobados") || "[]");
    localStorage.setItem("pibox_incrementos_aprobados", JSON.stringify([...prev, ...records]));

    setToast(`Incremento aprobado para ${records.length} clientes`);
    setTimeout(() => setToast(""), 3500);
  };

  const handleCopyProposal = () => {
    const data = JSON.parse(localStorage.getItem("pibox_incrementos_aprobados") || "[]");
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setToast("Datos copiados al portapapeles");
      setTimeout(() => setToast(""), 3000);
    });
  };

  // ---------- render helpers ----------
  const activeFieldsMeta = RATE_FIELDS.filter((f) => selectedFields.has(f.key));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-purple-100 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ background: BRAND_GRADIENT }}
            >
              %
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">
                Incremento de Tarifas
              </p>
              <p className="text-xs text-gray-500">
                Ajuste masivo de tarifas para clientes corporativos
              </p>
            </div>
          </div>

          {/* Step tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 1, icon: "1", label: "Seleccionar Clientes" },
              { id: 2, icon: "2", label: "Configurar Incremento" },
              { id: 3, icon: "3", label: "Vista Previa y Aprobar" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setStep(t.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  step === t.id
                    ? "bg-purple-600 text-white shadow"
                    : "text-gray-500 hover:bg-purple-50 hover:text-purple-700"
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ---------- STEP 1 ---------- */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Filtros de Clientes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none"
                />
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                >
                  <option value="">Todos los tipos de servicio</option>
                  {tiposServicio.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={filterCiudad}
                  onChange={(e) => setFilterCiudad(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                >
                  <option value="">Todas las ciudades</option>
                  {ciudades.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={filterKam}
                  onChange={(e) => setFilterKam(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                >
                  <option value="">Todos los KAM</option>
                  {kams.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selection actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={selectAllFiltered}
                className="px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition"
              >
                Seleccionar todos los filtrados ({filtered.length})
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={clearSelection}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-300 transition"
                >
                  Limpiar seleccion
                </button>
              )}
              <span className="text-sm font-semibold text-purple-700">
                {selectedIds.size} clientes seleccionados
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                Mostrando {displayed.length} de {filtered.length} resultados
              </span>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-purple-50 text-purple-800">
                    <th className="px-3 py-2 text-left w-8"></th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Tipo Servicio</th>
                    <th className="px-3 py-2 text-left">Ciudad</th>
                    <th className="px-3 py-2 text-right">Tarifa Base</th>
                    <th className="px-3 py-2 text-right">Tarifa Min</th>
                    <th className="px-3 py-2 text-left">KAM</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((c) => {
                    const idx = clientesDB.indexOf(c);
                    const checked = selectedIds.has(idx);
                    return (
                      <tr
                        key={idx}
                        onClick={() => toggleClient(idx)}
                        className={`border-t border-gray-50 cursor-pointer transition ${
                          checked ? "bg-purple-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleClient(idx)}
                            className="accent-purple-600"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800 max-w-[200px] truncate">
                          {c.nombre}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{c.tipoServicio}</td>
                        <td className="px-3 py-2 text-gray-600">{c.ciudad}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(c.baseFare)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(c.minimumFare)}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">{c.kam}</td>
                      </tr>
                    );
                  })}
                  {displayed.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        No se encontraron clientes con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Next button */}
            {selectedIds.size > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow"
                >
                  Siguiente: Configurar Incremento →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------- STEP 2 ---------- */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-xl">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Configurar Incremento</h3>

              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Porcentaje de incremento (%)
                </label>
                <input
                  type="number"
                  value={pctIncremento}
                  onChange={(e) => setPctIncremento(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 focus:ring-2 focus:ring-purple-400 outline-none"
                  min={-100}
                  max={500}
                />
              </div>

              <div className="mb-2">
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Tarifas a incrementar
                </label>
                <label className="flex items-center gap-2 mb-2 text-sm text-purple-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFields.size === RATE_FIELDS.length}
                    onChange={toggleAllFields}
                    className="accent-purple-600"
                  />
                  Seleccionar todas
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {RATE_FIELDS.map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.has(f.key)}
                        onChange={() => toggleField(f.key)}
                        className="accent-purple-600"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg px-4 py-3 text-sm text-purple-800">
              <strong>{selectedIds.size}</strong> clientes seleccionados &middot; Incremento del{" "}
              <strong>{pctIncremento}%</strong> en{" "}
              <strong>{selectedFields.size}</strong> campos tarifarios
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300 transition"
              >
                ← Volver
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selectedFields.size === 0}
                className="px-6 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow disabled:opacity-40"
              >
                Vista Previa →
              </button>
            </div>
          </div>
        )}

        {/* ---------- STEP 3 ---------- */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="bg-purple-50 rounded-lg px-4 py-3 flex flex-wrap items-center gap-4 text-sm text-purple-800">
              <span>
                Total clientes: <strong>{selectedClients.length}</strong>
              </span>
              <span>
                Incremento: <strong>{pctIncremento}%</strong>
              </span>
              <span>
                Campos: <strong>{activeFieldsMeta.map((f) => f.label).join(", ")}</strong>
              </span>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-purple-50 text-purple-800">
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Tipo Servicio</th>
                    <th className="px-3 py-2 text-left">Ciudad</th>
                    {activeFieldsMeta.map((f) => (
                      <th key={f.key} className="px-3 py-2 text-right whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedClients.slice(0, MAX_DISPLAY).map((c, i) => {
                    const newRates = computeNew(c);
                    return (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800 max-w-[180px] truncate">
                          {c.nombre}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{c.tipoServicio}</td>
                        <td className="px-3 py-2 text-gray-600">{c.ciudad}</td>
                        {activeFieldsMeta.map(({ key }) => {
                          const oldVal = c[key];
                          const newVal = newRates[key];
                          const diff = newVal - oldVal;
                          const color =
                            diff > 0
                              ? "text-green-700 bg-green-50"
                              : diff < 0
                              ? "text-red-700 bg-red-50"
                              : "text-gray-500";
                          return (
                            <td key={key} className="px-3 py-2 text-right whitespace-nowrap">
                              <span className="text-gray-400">{fmt(oldVal)}</span>
                              <span className="mx-1 text-gray-300">→</span>
                              <span className={`px-1 rounded ${color} font-semibold`}>
                                {fmt(newVal)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {selectedClients.length > MAX_DISPLAY && (
                <div className="px-4 py-2 text-xs text-gray-400 border-t">
                  Mostrando {MAX_DISPLAY} de {selectedClients.length} clientes
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300 transition"
              >
                ← Volver
              </button>
              <button
                onClick={handleApprove}
                className="px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition shadow"
              >
                Aprobar incremento
              </button>
              <button
                onClick={handleCopyProposal}
                className="px-6 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow"
              >
                Generar propuesta
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-pulse z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
