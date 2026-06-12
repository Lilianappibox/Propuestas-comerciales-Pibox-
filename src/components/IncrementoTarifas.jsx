import { useState, useMemo, useCallback, useRef } from "react";
import clientesDefault from "../data/tarifasCliente.json";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const SK_BD = "pibox_tarifas_clientes_bd";
const SK_HIST = "pibox_tarifas_clientes_hist";

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

function loadBD() {
  try {
    const s = localStorage.getItem(SK_BD);
    if (s) return JSON.parse(s);
  } catch {}
  return clientesDefault;
}

function saveBD(data) {
  try { localStorage.setItem(SK_BD, JSON.stringify(data)); } catch {}
}

function loadHistorial() {
  try {
    const s = localStorage.getItem(SK_HIST);
    if (s) return JSON.parse(s);
  } catch {}
  return [{ fecha: "2026-01-01", registros: clientesDefault.length, origen: "Base inicial (código)" }];
}

function saveHistorial(h) {
  try { localStorage.setItem(SK_HIST, JSON.stringify(h.slice(-20))); } catch {}
}

const uniqueFrom = (data, key) => {
  const set = new Set(data.map((c) => c[key]).filter(Boolean));
  return [...set].sort();
};

function parseExcelClientes(file) {
  return new Promise((resolve, reject) => {
    import("xlsx").then((XLSX) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
          // Auto-detect header row
          const headerRow = raw.find((r) => {
            const vals = Object.values(r).map((v) => String(v).toLowerCase());
            return vals.some((v) => v.includes("name_company") || v.includes("nombre") || v.includes("company"));
          });
          if (!headerRow) {
            // Try using row 1 as headers (like the original file)
            const rows = raw.slice(1).filter((r) => {
              const first = Object.values(r)[0];
              return first && String(first).trim() && String(first) !== "name_company";
            });
            const keys = Object.keys(raw[0] || {});
            const clients = rows.map((r) => ({
              nombre: String(r[keys[0]] || "").trim(),
              moneda: String(r[keys[1]] || "").trim(),
              tipoServicio: String(r[keys[2]] || "").trim(),
              ciudad: String(r[keys[3]] || "").trim(),
              baseFare: Number(r[keys[4]]) || 0,
              minimumFare: Number(r[keys[5]]) || 0,
              distanceFare: Number(r[keys[6]]) || 0,
              extraStopFare: Number(r[keys[7]]) || 0,
              hourFare: Number(r[keys[8]]) || 0,
              hourBaseFare: Number(r[keys[9]]) || 0,
              packageFare: Number(r[keys[10]]) || 0,
              comission: Number(r[keys[11]]) || 0,
              utilidadCorp: Number(r[keys[12]]) || 0,
              credit: Number(r[keys[13]]) || 0,
              tieneCredito: String(r[keys[14]] || "").trim(),
              mercadoFlex: String(r[keys[15]] || "").trim(),
              kam: String(r[keys[16]] || "").trim(),
            })).filter((c) => c.nombre);
            resolve(clients);
            return;
          }
          resolve([]);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  });
}

export default function IncrementoTarifas({ isAdmin }) {
  // BD dinámica
  const [clientesDB, setClientesDB] = useState(loadBD);
  const [historial, setHistorial] = useState(loadHistorial);
  const [showHist, setShowHist] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  // Filtros derivados de la BD actual
  const tiposServicio = useMemo(() => uniqueFrom(clientesDB, "tipoServicio"), [clientesDB]);
  const ciudades = useMemo(() => uniqueFrom(clientesDB, "ciudad"), [clientesDB]);
  const kams = useMemo(() => uniqueFrom(clientesDB, "kam"), [clientesDB]);

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

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  // Upload Excel
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const clientes = await parseExcelClientes(file);
      if (!clientes.length) { showToast("⚠️ No se encontraron datos en el archivo"); setUploading(false); return; }
      // Save new BD
      setClientesDB(clientes);
      saveBD(clientes);
      // Save history
      const entry = { fecha: new Date().toISOString().slice(0, 19).replace("T", " "), registros: clientes.length, origen: file.name };
      const newHist = [...historial, entry];
      setHistorial(newHist);
      saveHistorial(newHist);
      setSelectedIds(new Set());
      showToast(`✅ Base de datos actualizada: ${clientes.length.toLocaleString()} clientes desde "${file.name}"`);
    } catch (err) {
      showToast(`❌ Error al leer el archivo: ${err.message}`);
    }
    setUploading(false);
  };

  // Restore version from history (reload from default)
  const handleRestoreDefault = () => {
    if (!confirm("¿Restaurar la base de datos original? Se perderán los cambios cargados.")) return;
    localStorage.removeItem(SK_BD);
    setClientesDB(clientesDefault);
    const entry = { fecha: new Date().toISOString().slice(0, 19).replace("T", " "), registros: clientesDefault.length, origen: "Restauración a base original" };
    const newHist = [...historial, entry];
    setHistorial(newHist);
    saveHistorial(newHist);
    setSelectedIds(new Set());
    showToast("🔄 Base de datos restaurada a la versión original");
  };

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
      {/* Toast */}
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* Header */}
      <div className="border-b border-purple-100 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: BRAND_GRADIENT }}>%</div>
              <div>
                <p className="font-bold text-gray-800 text-sm leading-tight">Incremento de Tarifas</p>
                <p className="text-xs text-gray-500">{clientesDB.length.toLocaleString()} clientes en la base de datos</p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex gap-2 items-center flex-wrap">
                <label className={`px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition cursor-pointer ${uploading ? "opacity-50" : ""}`}>
                  {uploading ? "Cargando..." : "📥 Subir Base de Datos (.xlsx)"}
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
                <button onClick={() => setShowHist(!showHist)}
                  className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200 transition">
                  📋 Historial ({historial.length})
                </button>
                <button onClick={handleRestoreDefault}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 transition">
                  🔄 Restaurar original
                </button>
              </div>
            )}
          </div>

          {/* Historial de versiones */}
          {showHist && (
            <div className="mb-3 bg-purple-50 border border-purple-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-purple-800 mb-2">📋 Historial de versiones de la BD</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-purple-100 text-purple-800">
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Fecha</th>
                      <th className="text-right p-2">Registros</th>
                      <th className="text-left p-2">Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...historial].reverse().map((h, i) => (
                      <tr key={i} className={`border-t border-purple-100 ${i === 0 ? "bg-green-50 font-semibold" : ""}`}>
                        <td className="p-2 text-purple-500">{i === 0 ? "Actual" : historial.length - i}</td>
                        <td className="p-2">{h.fecha}</td>
                        <td className="p-2 text-right">{h.registros.toLocaleString()}</td>
                        <td className="p-2 text-gray-600">{h.origen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
