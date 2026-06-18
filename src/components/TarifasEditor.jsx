import { useState, useEffect, useMemo } from "react";

// ── Calculadora de Utilidades Adicionales (tarifas base PIBOX) ──────────────

const SK_TARIFARIO = "pibox_tarifario_interno";

// Defaults from TarifarioInterno TABLE_DATA (read-only copy of the relevant tabs)
const TARIFARIO_DEFAULTS = {
  distancia: {
    headers: ["Ciudad", "Tipo Vehículo", "Base Km", "Tarifa Base", "Km Extra", "Parada Adicional", "Recargo Nocturno", "Recargo Dominical"],
    rows: [
      ["Bogotá - Nacional", "Moto", "3 Km", "$6.650", "$1.250", "$4.500", "$665", "$1.330"],
      ["Medellín, Cali, B/quilla, B/manga", "Moto", "3 Km", "$7.300", "$1.250", "$4.500", "$3.700", "$3.650"],
      ["Bogotá - Nacional", "Carry", "10 Km", "$70.000", "$4.000", "$6.000", "—", "$17.500"],
      ["Bogotá - Nacional", "NHR", "10 Km", "$87.500", "$5.500", "$7.000", "—", "$21.875"],
      ["Medellín, Cali, B/quilla", "Carry", "10 Km", "$75.000", "$4.300", "$6.500", "—", "$18.750"],
      ["Medellín, Cali, B/quilla", "NHR", "10 Km", "$93.750", "$5.800", "$7.500", "—", "$23.437"],
      ["Bogotá - Nacional", "NPR", "10 Km", "$120.000", "$7.000", "$10.000", "—", "$30.000"],
    ],
  },
  horas: {
    headers: ["Ciudad", "Tipo Vehículo", "Tarifa Hora (Km Base)", "Tarifa Hora (15 Km)", "Tarifa Hora (20 Km)", "Recargo Nocturno", "Hora Extra", "Min Horas"],
    rows: [
      ["Colombia", "Moto", "$16.400", "$18.900", "$21.400", "$6.550", "$8.200", "4h"],
      ["Bogotá - Nacional", "Carry", "$33.150", "N/A", "N/A", "$14.200", "$16.575", "4h"],
      ["Bogotá - Nacional", "NHR", "$42.000", "N/A", "N/A", "$17.300", "$21.000", "8h"],
      ["Bogotá - Nacional", "NPR", "$55.000", "N/A", "N/A", "$22.000", "$27.500", "8h"],
      ["Medellín, Cali", "Carry", "$36.200", "N/A", "N/A", "$15.500", "$18.100", "4h"],
      ["Medellín, Cali", "NHR", "$45.900", "N/A", "N/A", "$18.900", "$22.950", "8h"],
    ],
  },
  paquetes: {
    headers: ["Ciudad", "Tamaño", "Paquetes/Ruta", "Tarifa Paquete (3%)", "Tarifa Ruta", "Recargo Nocturno", "Recargo Dominical"],
    rows: [
      ["Bogotá", "Entregas Optimizadas", ">10", "$12.000", "—", "—", "—"],
      ["Bogotá", "Pequeño", "10", "$11.000", "$110.000", "$6.550", "$9.350"],
      ["Bogotá", "Pequeño", "12", "$9.600", "$115.200", "—", "—"],
      ["Bogotá", "Mediano", "10", "$13.500", "$135.000", "—", "—"],
      ["Bogotá", "Grande", "8", "$17.000", "$136.000", "—", "—"],
    ],
  },
  tat: {
    headers: ["Ciudad", "Tipo Vehículo", "Disponibilidad 8h", "Máx Paradas", "Tarifa Parada Extra", "Observaciones"],
    rows: [
      ["Bogotá - Nacional", "Carry", "$120.000", "40", "$3.500", "Utilidad corporativa 3%"],
      ["Bogotá - Nacional", "NHR", "$152.000", "40", "$4.000", "—"],
      ["Medellín y Área Metro", "Carry", "$130.000", "40", "$3.800", "—"],
      ["Medellín y Área Metro", "NHR", "$170.000", "40", "$4.500", "—"],
    ],
  },
  storage: {
    headers: ["Ocupación", "Ítem", "Medidas", "Capacidad", "Costo", "Peso Max Kg", "Observaciones"],
    rows: [
      ["Mensual", "Metro / Estiba", "1m x 1,20m x 1,20m Alt. 2m", "1 Mtr", "$165.950", "1.000", "—"],
      ["Mensual", "Estante 4 Entrepaños", "1,76 x 50 x 70 cm", "2 Mtrs", "$331.850", "200", "50 kg por Entrepaño"],
      ["Mensual", "1/2 Estante 2 Entrepaños", "—", "1 Mtr", "$199.100", "100", "50 kg por Entrepaño"],
      ["Quincenal", "Estiba", "1m x 1,20m x 1,20m Alt. 2m", "1 Mtr", "$94.000", "1.000", "—"],
      ["Quincenal", "Estante", "1,76 x 50 x 70 cm", "4 Mtrs", "$199.000", "200", "50 kg por Entrepaño"],
      ["Quincenal", "1/2 Estante", "—", "2 Mtrs", "$119.500", "100", "50 kg por Entrepaño"],
      ["Semanal", "Estiba", "1m x 1,20m x 1,20m Alt. 2m", "1 Mtr", "$56.500", "1.000", "—"],
      ["Semanal", "Estante", "1,76 x 50 x 70 cm", "4 Mtrs", "$119.500", "200", "50 kg por Entrepaño"],
      ["Semanal", "1/2 Estante", "—", "2 Mtrs", "$71.700", "100", "50 kg por Entrepaño"],
      ["Cross", "Día / Paso por Bodega", "N/A", "Unidad", "$700", "30", "Máx 80x20x20 cm"],
      ["Cross", "Noche / Pernocte", "N/A", "Unidad", "$900", "30", "—"],
    ],
  },
};

// Map TarifasEditor tab ids → TarifarioInterno tab ids
const TAB_TO_TARIFARIO = {
  onDemand: "distancia",
  programadoBloqueHoras: "horas",
  programadoRutas: "paquetes",
  entregasOptimizadas: "paquetes",
  picarga: "tat",
  storage: "storage",
};

/** Parse "$6.650" or "$165.950" → 6650, 165950.  Returns NaN for non-monetary. */
function parsePesos(s) {
  if (typeof s !== "string" || !s.startsWith("$")) return NaN;
  const clean = s.replace(/\$/g, "").replace(/\./g, "").replace(/,/g, ".").trim();
  return Number(clean);
}

/** Format number → "$6.650" Colombian pesos with dots as thousands separator */
function formatPesos(n) {
  if (isNaN(n)) return "—";
  return "$" + Math.round(n).toLocaleString("es-CO");
}

/** Apply utility % to a cell: only monetary values get multiplied */
function applyUtility(cell, pct) {
  const n = parsePesos(cell);
  if (isNaN(n)) return cell; // non-monetary → unchanged
  return formatPesos(n * (1 + pct / 100));
}

function TarifasBaseSection({ activeTab }) {
  const tarifarioKey = TAB_TO_TARIFARIO[activeTab];
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(0);
  const [copiedMsg, setCopiedMsg] = useState("");

  // Load tarifario data from localStorage or defaults
  const tarifarioData = useMemo(() => {
    try {
      const stored = localStorage.getItem(SK_TARIFARIO);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[tarifarioKey]) return parsed[tarifarioKey];
      }
    } catch {}
    return TARIFARIO_DEFAULTS[tarifarioKey] || null;
  }, [tarifarioKey]);

  if (!tarifarioKey || !tarifarioData) return null;

  const { headers, rows } = tarifarioData;

  const rowsWithUtility = useMemo(() => {
    if (pct === 0) return rows;
    return rows.map((row) => row.map((cell) => applyUtility(cell, pct)));
  }, [rows, pct]);

  const handleCopyTable = () => {
    const source = pct === 0 ? rows : rowsWithUtility;
    const lines = [headers.join("\t"), ...source.map((r) => r.join("\t"))];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopiedMsg("Tabla copiada al portapapeles");
      setTimeout(() => setCopiedMsg(""), 2500);
    });
  };

  const tabLabels = {
    onDemand: "Distancia (On Demand)",
    programadoBloqueHoras: "Horas (Bloque Horas)",
    programadoRutas: "Paquetes (Rutas)",
    entregasOptimizadas: "Paquetes (Entregas Opt.)",
    picarga: "TAT (Picarga)",
    storage: "Storage",
  };

  return (
    <div className="mb-4 border border-purple-200 rounded-xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-150 transition-colors"
      >
        <span className="text-sm font-semibold text-purple-800 flex items-center gap-2">
          <span className="text-base">📊</span>
          Tarifas Base PIBOX + Utilidad Adicional
          <span className="text-xs font-normal text-purple-500">({tabLabels[activeTab] || activeTab})</span>
        </span>
        <span className={`text-purple-600 text-xs transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-white">
          {/* Utility % input */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">% Utilidad Adicional:</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={pct}
                onChange={(e) => setPct(Number(e.target.value) || 0)}
                className="w-20 border border-purple-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-400 text-center"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <button
              onClick={handleCopyTable}
              className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200 transition-colors flex items-center gap-1"
            >
              📋 Copiar tabla
            </button>
            {copiedMsg && <span className="text-xs text-green-600 font-medium">{copiedMsg}</span>}
          </div>

          {/* Info */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 text-xs text-purple-700">
            {pct > 0
              ? `Las tarifas monetarias se muestran multiplicadas por ${(1 + pct / 100).toFixed(4)} (base + ${pct}% utilidad). Los valores no monetarios no cambian.`
              : "Tarifas base del Tarifario Interno PIBOX. Ajusta el % de utilidad para calcular las tarifas con margen adicional."}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-purple-600 text-white">
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsWithUtility.map((row, ri) => (
                  <tr key={ri} className={`border-t border-gray-100 ${ri % 2 === 0 ? "bg-white" : "bg-purple-50/40"} hover:bg-purple-50 transition-colors`}>
                    {row.map((cell, ci) => {
                      const isModified = pct > 0 && !isNaN(parsePesos(rows[ri][ci]));
                      return (
                        <td key={ci} className={`px-3 py-2 whitespace-nowrap ${ci === 0 ? "font-medium text-gray-800" : "text-gray-600"} ${isModified ? "text-purple-700 font-semibold bg-purple-50/60" : ""}`}>
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Show original vs modified comparison when utility > 0 */}
          {pct > 0 && (
            <p className="text-xs text-gray-400 italic">
              Los valores resaltados en morado han sido ajustados con la utilidad del {pct}%.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Original TarifasEditor components ─────────────────────────────────────────

const Input = ({ value, onChange, prefix = "", type = "number", className = "", placeholder = "" }) => {
  const isNum = type === "number";
  // raw: lo que el usuario está escribiendo en el campo
  const [raw, setRaw] = useState(null); // null = usar value externo
  const isNA = value === "N.A";

  const displayed = raw !== null ? raw : (value ?? "");

  const handleChange = (e) => {
    setRaw(e.target.value); // siempre actualiza lo que se ve
  };

  const handleBlur = () => {
    const trimmed = (raw ?? "").trim().toUpperCase();
    if (trimmed === "N.A" || trimmed === "NA") {
      onChange("N.A");
    } else if (raw === "" || raw === null) {
      onChange(isNum ? 0 : "");
    } else if (isNum) {
      const n = Number(raw);
      onChange(isNaN(n) ? "N.A" : n);
    } else {
      onChange(raw);
    }
    setRaw(null); // vuelve al valor controlado
  };

  const handleFocus = () => {
    // Al enfocar, empieza a editar desde el valor actual
    setRaw(value === "N.A" ? "" : String(value ?? ""));
  };

  return (
    <div className="flex items-center gap-1">
      {prefix && !isNA && <span className="text-xs text-gray-400">{prefix}</span>}
      <input
        type="text"
        value={displayed}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || (isNum ? "Valor ó N.A" : "")}
        className={`w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
          isNA && raw === null
            ? "border-dashed border-gray-300 bg-gray-50 text-gray-400"
            : "border-gray-300 bg-white"
        } ${className}`}
      />
    </div>
  );
};

const Row = ({ label, children }) => (
  <div className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
    <span className="text-xs text-gray-600 w-44 shrink-0">{label}</span>
    <div className="flex-1">{children}</div>
  </div>
);

const VEHICULOS_PICARGA = ["Carry", "NHR", "NKR", "NPR", "Turbo", "Furgón", "Camioneta"];

const InputConUnidad = ({ value, unidad, onChangeValue, onChangeUnidad }) => (
  <div className="flex gap-1 items-center">
    <Input value={value} onChange={onChangeValue} prefix={unidad === "$" ? "$" : ""} />
    <div className="flex shrink-0 border border-gray-300 rounded overflow-hidden">
      {["$", "%"].map((u) => (
        <button key={u} type="button" onClick={() => onChangeUnidad(u)}
          className={`px-2 py-1 text-xs font-medium transition-colors ${
            unidad === u ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-100"
          }`}>{u}</button>
      ))}
    </div>
  </div>
);

const VehiculoSelect = ({ value, onChange }) => {
  const isCustom = value && !VEHICULOS_PICARGA.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);
  const [customVal, setCustomVal] = useState(isCustom ? value : "");

  return showCustom ? (
    <div className="flex gap-1 items-center">
      <input
        type="text"
        value={customVal}
        onChange={(e) => setCustomVal(e.target.value)}
        onBlur={() => { if (customVal.trim()) onChange(customVal.trim()); else { setShowCustom(false); onChange(VEHICULOS_PICARGA[0]); } }}
        placeholder="Tipo de vehículo"
        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        autoFocus
      />
      <button onClick={() => { setShowCustom(false); onChange(VEHICULOS_PICARGA[0]); setCustomVal(""); }}
        className="text-xs text-gray-400 hover:text-gray-600">✕</button>
    </div>
  ) : (
    <div className="flex gap-1 items-center">
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === "__custom__") { setShowCustom(true); setCustomVal(""); }
          else onChange(e.target.value);
        }}
        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
      >
        {VEHICULOS_PICARGA.map((v) => <option key={v} value={v}>{v}</option>)}
        <option value="__custom__">+ Otro vehículo...</option>
      </select>
    </div>
  );
};

// Generic helpers
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const cityTemplate = {
  onDemand: { ciudad: "Nueva Ciudad", vehiculo: "Motocicleta", kmBase: 3, tarifaKmBase: 9800, tarifaKmExtra: 1200, paradaAdicional: 2500, vdRuta: 5000000 },
  picarga:         { ciudad: "Nueva Ciudad", vehiculo: "Carry", kmBase: 10, tarifaKmBase: 65000, tarifaKmExtra: 4500, paradaAdicional: 15000, vdRuta: 5000000 },
  picargaReserva:  { ciudad: "Nueva Ciudad", vehiculo: "Carry", vehiculos: 1, horasDia: 8, tarifaHora: 65000, cobertura: "Ciudad", vdRuta: 5000000, recaudoRuta: 1500000 },
  programadoBloqueHoras:  { ciudad: "Nueva Ciudad", pilotos: 1, horasDia: 4, tarifaHora: 15500, cobertura: "8Km", vdRuta: 5000000, recaudoRuta: 1500000 },
  programadoRutas:        { ciudad: "Nueva Ciudad", paquetesPorRuta: 10, paquetesDia: 50, tarifaPaquete: 8500, vdRuta: 5000000, recaudoRuta: 1500000 },
  entregasOptimizadas:    { ciudad: "Nueva Ciudad", paquetesPorRuta: 10, paquetesDia: 50, tarifaPaquete: 8500, vdRuta: 5000000, recaudoRuta: 1500000 },
  storage: { ciudad: "Nueva Ciudad", tarifaPosicionPallet: 35000, tarifaPosicionCaja: 15000, tarifaM2Mes: 18000, picking: 800, crossDocking: 2500, facturaMinima: 500000 },
};

export default function TarifasEditor({ tarifas, onChange }) {
  const [tab, setTab] = useState("onDemand");

  const update = (path, value) => {
    const cp = deepClone(tarifas);
    const keys = path.split(".");
    let obj = cp;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
    onChange(cp);
  };

  const addRow = (modulo, listKey) => {
    const cp = deepClone(tarifas);
    const tmpl = deepClone(cityTemplate[modulo] || {});
    cp[modulo][listKey].push(tmpl);
    onChange(cp);
  };

  const removeRow = (modulo, listKey, idx) => {
    const cp = deepClone(tarifas);
    cp[modulo][listKey].splice(idx, 1);
    onChange(cp);
  };

  const tabs = [
    { id: "onDemand",              label: "⚡ On Demand" },
    { id: "programadoBloqueHoras", label: "🛵 Bloque Horas" },
    { id: "programadoRutas",       label: "🔁 Rutas" },
    { id: "entregasOptimizadas",   label: "🚀 Entregas Opt." },
    { id: "picarga",               label: "🚚 Picarga" },
    { id: "storage",               label: "📦 Storage" },
    { id: "seguro",                label: "🛡️ Seguro" },
  ];

  return (
    <div>
      {/* Calculadora de Utilidades Adicionales */}
      <TarifasBaseSection activeTab={tab} />

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">

        {/* ── ON DEMAND ── */}
        {tab === "onDemand" && (
          <div>
            <SectionHeader label="Tarifas por Ciudad" onAdd={() => addRow("onDemand", "ciudades")} />
            {tarifas.onDemand.ciudades.map((c, i) => (
              <CityCard key={i} title={`${c.ciudad} — ${c.vehiculo}`} onDelete={() => removeRow("onDemand", "ciudades", i)}>
                <Row label="Ciudad">
                  <Input value={c.ciudad} type="text" onChange={(v) => update(`onDemand.ciudades.${i}.ciudad`, v)} />
                </Row>
                <Row label="Vehículo">
                  <Input value={c.vehiculo} type="text" onChange={(v) => update(`onDemand.ciudades.${i}.vehiculo`, v)} />
                </Row>
                <Row label="Km Base">
                  <Input value={c.kmBase} onChange={(v) => update(`onDemand.ciudades.${i}.kmBase`, v)} />
                </Row>
                <Row label="Tarifa Km Base ($)">
                  <Input value={c.tarifaKmBase} onChange={(v) => update(`onDemand.ciudades.${i}.tarifaKmBase`, v)} prefix="$" />
                </Row>
                <Row label="Tarifa Km Extra ($)">
                  <Input value={c.tarifaKmExtra} onChange={(v) => update(`onDemand.ciudades.${i}.tarifaKmExtra`, v)} prefix="$" />
                </Row>
                <Row label="Parada Adicional ($)">
                  <Input value={c.paradaAdicional} onChange={(v) => update(`onDemand.ciudades.${i}.paradaAdicional`, v)} prefix="$" />
                </Row>
                <Row label="VD / Ruta ($)">
                  <Input value={c.vdRuta} onChange={(v) => update(`onDemand.ciudades.${i}.vdRuta`, v)} prefix="$" />
                </Row>
              </CityCard>
            ))}
            <SectionHeader label="Tarifas Adicionales" />
            {tarifas.onDemand.adicionales.map((a, i) => (
              <CityCard key={i} title={`${a.ciudad} — ${a.vehiculo}`}>
                <Row label="Tarifa Minuto ($)">
                  <Input value={a.tarifaMinuto} onChange={(v) => update(`onDemand.adicionales.${i}.tarifaMinuto`, v)} prefix="$" />
                </Row>
                <Row label="Bonificación ($)">
                  <Input value={a.bonificacion} onChange={(v) => update(`onDemand.adicionales.${i}.bonificacion`, v)} prefix="$" />
                </Row>
                <Row label="Recargo Periferia ($)">
                  <Input value={a.recargo} onChange={(v) => update(`onDemand.adicionales.${i}.recargo`, v)} prefix="$" />
                </Row>
              </CityCard>
            ))}
          </div>
        )}

        {/* ── BLOQUE HORAS ── */}
        {tab === "programadoBloqueHoras" && (
          <div>
            <SectionHeader label="Reservas por Ciudad" onAdd={() => addRow("programadoBloqueHoras", "reservas")} />
            {tarifas.programadoBloqueHoras.reservas.map((r, i) => (
              <CityCard key={i} title={r.ciudad} onDelete={() => removeRow("programadoBloqueHoras", "reservas", i)}>
                <Row label="Ciudad">
                  <Input value={r.ciudad} type="text" onChange={(v) => update(`programadoBloqueHoras.reservas.${i}.ciudad`, v)} />
                </Row>
                <Row label="Pilotos">
                  <Input value={r.pilotos} onChange={(v) => update(`programadoBloqueHoras.reservas.${i}.pilotos`, v)} />
                </Row>
                <Row label="Horas al Día">
                  <Input value={r.horasDia} onChange={(v) => update(`programadoBloqueHoras.reservas.${i}.horasDia`, v)} />
                </Row>
                <Row label="Tarifa / Hora ($)">
                  <Input value={r.tarifaHora} onChange={(v) => update(`programadoBloqueHoras.reservas.${i}.tarifaHora`, v)} prefix="$" />
                </Row>
                <Row label="Cobertura">
                  <Input value={r.cobertura} type="text" onChange={(v) => update(`programadoBloqueHoras.reservas.${i}.cobertura`, v)} />
                </Row>
                <Row label="VD / Ruta ($)">
                  <Input value={r.vdRuta} onChange={(v) => update(`programadoBloqueHoras.reservas.${i}.vdRuta`, v)} prefix="$" />
                </Row>
                <Row label="Recaudo / Ruta ($)">
                  <Input value={r.recaudoRuta} onChange={(v) => update(`programadoBloqueHoras.reservas.${i}.recaudoRuta`, v)} prefix="$" />
                </Row>
              </CityCard>
            ))}
            <SectionHeader label="Adicionales" />
            <div className="bg-gray-50 rounded-lg p-3">
              <Row label="% Recaudo Ida/Vuelta">
                <Input value={tarifas.programadoBloqueHoras.adicionales.recaudoIdaVuelta} onChange={(v) => update("programadoBloqueHoras.adicionales.recaudoIdaVuelta", v)} />
              </Row>
              <Row label="Parada en Falso">
                <InputConUnidad
                  value={tarifas.programadoBloqueHoras.adicionales.paradaEnFalso}
                  unidad={tarifas.programadoBloqueHoras.adicionales.paradaEnFalsoUnidad || "$"}
                  onChangeValue={(v) => update("programadoBloqueHoras.adicionales.paradaEnFalso", v)}
                  onChangeUnidad={(u) => update("programadoBloqueHoras.adicionales.paradaEnFalsoUnidad", u)}
                />
              </Row>
              <Row label="Recargo Periferia ($)">
                <Input value={tarifas.programadoBloqueHoras.adicionales.recargo} onChange={(v) => update("programadoBloqueHoras.adicionales.recargo", v)} prefix="$" />
              </Row>
            </div>
          </div>
        )}

        {/* ── RUTAS ── */}
        {tab === "programadoRutas" && (
          <div>
            <SectionHeader label="Rutas por Ciudad" onAdd={() => addRow("programadoRutas", "rutas")} />
            {tarifas.programadoRutas.rutas.map((r, i) => (
              <CityCard key={i} title={r.ciudad} onDelete={() => removeRow("programadoRutas", "rutas", i)}>
                <Row label="Ciudad">
                  <Input value={r.ciudad} type="text" onChange={(v) => update(`programadoRutas.rutas.${i}.ciudad`, v)} />
                </Row>
                <Row label="Paquetes / Ruta">
                  <Input value={r.paquetesPorRuta} onChange={(v) => update(`programadoRutas.rutas.${i}.paquetesPorRuta`, v)} />
                </Row>
                <Row label="Paquetes / Día">
                  <Input value={r.paquetesDia} onChange={(v) => update(`programadoRutas.rutas.${i}.paquetesDia`, v)} />
                </Row>
                <Row label="Tarifa Paquete ($)">
                  <Input value={r.tarifaPaquete} onChange={(v) => update(`programadoRutas.rutas.${i}.tarifaPaquete`, v)} prefix="$" />
                </Row>
                <Row label="VD / Ruta ($)">
                  <Input value={r.vdRuta} onChange={(v) => update(`programadoRutas.rutas.${i}.vdRuta`, v)} prefix="$" />
                </Row>
                <Row label="Recaudo / Ruta ($)">
                  <Input value={r.recaudoRuta} onChange={(v) => update(`programadoRutas.rutas.${i}.recaudoRuta`, v)} prefix="$" />
                </Row>
              </CityCard>
            ))}
            <SectionHeader label="Adicionales" />
            <div className="bg-gray-50 rounded-lg p-3">
              <Row label="% Recaudo Ida/Vuelta">
                <Input value={tarifas.programadoRutas.adicionales.recaudoIdaVuelta} onChange={(v) => update("programadoRutas.adicionales.recaudoIdaVuelta", v)} />
              </Row>
              <Row label="Intentos de Entrega">
                <Input value={tarifas.programadoRutas.adicionales.intentosEntrega} onChange={(v) => update("programadoRutas.adicionales.intentosEntrega", v)} />
              </Row>
              <Row label="Tarifa Devoluciones ($)">
                <Input value={tarifas.programadoRutas.adicionales.tarifaDevoluciones} onChange={(v) => update("programadoRutas.adicionales.tarifaDevoluciones", v)} prefix="$" />
              </Row>
            </div>
          </div>
        )}

        {/* ── ENTREGAS OPTIMIZADAS ── */}
        {tab === "entregasOptimizadas" && (
          <div>
            <SectionHeader label="Rutas por Ciudad" onAdd={() => addRow("entregasOptimizadas", "rutas")} />
            {(tarifas.entregasOptimizadas?.rutas || []).map((r, i) => (
              <CityCard key={i} title={r.ciudad} onDelete={() => removeRow("entregasOptimizadas", "rutas", i)}>
                <Row label="Ciudad">
                  <Input value={r.ciudad} type="text" onChange={(v) => update(`entregasOptimizadas.rutas.${i}.ciudad`, v)} />
                </Row>
                <Row label="Paquetes / Ruta">
                  <Input value={r.paquetesPorRuta} onChange={(v) => update(`entregasOptimizadas.rutas.${i}.paquetesPorRuta`, v)} />
                </Row>
                <Row label="Paquetes / Día">
                  <Input value={r.paquetesDia} onChange={(v) => update(`entregasOptimizadas.rutas.${i}.paquetesDia`, v)} />
                </Row>
                <Row label="Tarifa Paquete ($)">
                  <Input value={r.tarifaPaquete} onChange={(v) => update(`entregasOptimizadas.rutas.${i}.tarifaPaquete`, v)} prefix="$" />
                </Row>
                <Row label="VD / Ruta ($)">
                  <Input value={r.vdRuta} onChange={(v) => update(`entregasOptimizadas.rutas.${i}.vdRuta`, v)} prefix="$" />
                </Row>
                <Row label="Recaudo / Ruta ($)">
                  <Input value={r.recaudoRuta} onChange={(v) => update(`entregasOptimizadas.rutas.${i}.recaudoRuta`, v)} prefix="$" />
                </Row>
              </CityCard>
            ))}
            <SectionHeader label="Adicionales" />
            <div className="bg-gray-50 rounded-lg p-3">
              <Row label="% Recaudo Ida/Vuelta">
                <Input value={tarifas.entregasOptimizadas?.adicionales?.recaudoIdaVuelta || 0} onChange={(v) => update("entregasOptimizadas.adicionales.recaudoIdaVuelta", v)} />
              </Row>
              <Row label="Intentos de Entrega">
                <Input value={tarifas.entregasOptimizadas?.adicionales?.intentosEntrega || 1} onChange={(v) => update("entregasOptimizadas.adicionales.intentosEntrega", v)} />
              </Row>
              <Row label="Tarifa Devoluciones ($)">
                <Input value={tarifas.entregasOptimizadas?.adicionales?.tarifaDevoluciones || 0} onChange={(v) => update("entregasOptimizadas.adicionales.tarifaDevoluciones", v)} prefix="$" />
              </Row>
            </div>
          </div>
        )}

        {/* ── PICARGA ── */}
        {tab === "picarga" && (
          <div>
            <SectionHeader label="Tarifas por Ciudad" onAdd={() => addRow("picarga", "ciudades")} />
            {tarifas.picarga.ciudades.map((c, i) => (
              <CityCard key={i} title={`${c.ciudad} — ${c.vehiculo}`} onDelete={() => removeRow("picarga", "ciudades", i)}>
                <Row label="Ciudad">
                  <Input value={c.ciudad} type="text" onChange={(v) => update(`picarga.ciudades.${i}.ciudad`, v)} />
                </Row>
                <Row label="Vehículo">
                  <VehiculoSelect value={c.vehiculo} onChange={(v) => update(`picarga.ciudades.${i}.vehiculo`, v)} />
                </Row>
                <Row label="Km Base">
                  <Input value={c.kmBase} onChange={(v) => update(`picarga.ciudades.${i}.kmBase`, v)} />
                </Row>
                <Row label="Tarifa Km Base ($)">
                  <Input value={c.tarifaKmBase} onChange={(v) => update(`picarga.ciudades.${i}.tarifaKmBase`, v)} prefix="$" />
                </Row>
                <Row label="Tarifa Km Extra ($)">
                  <Input value={c.tarifaKmExtra} onChange={(v) => update(`picarga.ciudades.${i}.tarifaKmExtra`, v)} prefix="$" />
                </Row>
                <Row label="Parada Adicional ($)">
                  <Input value={c.paradaAdicional} onChange={(v) => update(`picarga.ciudades.${i}.paradaAdicional`, v)} prefix="$" />
                </Row>
                <Row label="VD / Ruta ($)">
                  <Input value={c.vdRuta} onChange={(v) => update(`picarga.ciudades.${i}.vdRuta`, v)} prefix="$" />
                </Row>
              </CityCard>
            ))}
            {/* ── Bloque de Horas ── */}
            <SectionHeader label="Bloque de Horas" onAdd={() => {
              const cp = deepClone(tarifas);
              cp.picarga.reservas = cp.picarga.reservas || [];
              cp.picarga.reservas.push(deepClone(cityTemplate.picargaReserva));
              onChange(cp);
            }} />
            <p className="text-xs text-gray-400 mb-3 italic">Escribe "N.A" en cualquier campo para indicar que no aplica.</p>
            {(tarifas.picarga.reservas || []).map((r, i) => (
              <CityCard key={i} title={`${r.ciudad} — ${r.vehiculo}`} onDelete={() => {
                const cp = deepClone(tarifas); cp.picarga.reservas.splice(i, 1); onChange(cp);
              }}>
                <Row label="Ciudad">
                  <Input value={r.ciudad} type="text" onChange={(v) => update(`picarga.reservas.${i}.ciudad`, v)} />
                </Row>
                <Row label="Vehículo">
                  <VehiculoSelect value={r.vehiculo} onChange={(v) => update(`picarga.reservas.${i}.vehiculo`, v)} />
                </Row>
                <Row label="Cantidad vehículos">
                  <Input value={r.vehiculos} onChange={(v) => update(`picarga.reservas.${i}.vehiculos`, v)} />
                </Row>
                <Row label="Horas al Día">
                  <Input value={r.horasDia} onChange={(v) => update(`picarga.reservas.${i}.horasDia`, v)} />
                </Row>
                <Row label="Tarifa / Hora ($)">
                  <Input value={r.tarifaHora} onChange={(v) => update(`picarga.reservas.${i}.tarifaHora`, v)} prefix="$" />
                </Row>
                <Row label="Cobertura">
                  <Input value={r.cobertura} type="text" onChange={(v) => update(`picarga.reservas.${i}.cobertura`, v)} />
                </Row>
                <Row label="VD / Ruta ($)">
                  <Input value={r.vdRuta} onChange={(v) => update(`picarga.reservas.${i}.vdRuta`, v)} prefix="$" />
                </Row>
                <Row label="Recaudo / Ruta ($)">
                  <Input value={r.recaudoRuta} onChange={(v) => update(`picarga.reservas.${i}.recaudoRuta`, v)} prefix="$" />
                </Row>
              </CityCard>
            ))}
            <SectionHeader label="Adicionales Bloque de Horas" />
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <Row label="% Recaudo Ida/Vuelta">
                <Input value={tarifas.picarga.adicionalesBH?.recaudoIdaVuelta ?? 5} onChange={(v) => update("picarga.adicionalesBH.recaudoIdaVuelta", v)} />
              </Row>
              <Row label="Parada en Falso">
                <InputConUnidad
                  value={tarifas.picarga.adicionalesBH?.paradaEnFalso ?? "N.A"}
                  unidad={tarifas.picarga.adicionalesBH?.paradaEnFalsoUnidad || "$"}
                  onChangeValue={(v) => update("picarga.adicionalesBH.paradaEnFalso", v)}
                  onChangeUnidad={(u) => update("picarga.adicionalesBH.paradaEnFalsoUnidad", u)}
                />
              </Row>
              <Row label="Tarifa Auxiliar ($)">
                <Input value={tarifas.picarga.adicionalesBH?.tarifaAuxiliar ?? "N.A"} onChange={(v) => update("picarga.adicionalesBH.tarifaAuxiliar", v)} prefix="$" />
              </Row>
              <Row label="Hora Extra Auxiliar ($)">
                <Input value={tarifas.picarga.adicionalesBH?.horaExtraAuxiliar ?? "N.A"} onChange={(v) => update("picarga.adicionalesBH.horaExtraAuxiliar", v)} prefix="$" />
              </Row>
            </div>

            {/* ── Tarifas Adicionales Distancia ── */}
            <SectionHeader label="Tarifas Adicionales — Distancia" />
            {tarifas.picarga.adicionales.map((a, i) => (
              <CityCard key={i} title={`${a.ciudad} — ${a.vehiculo}`}>
                <Row label="Ciudad">
                  <Input value={a.ciudad} type="text" onChange={(v) => update(`picarga.adicionales.${i}.ciudad`, v)} />
                </Row>
                <Row label="Vehículo">
                  <VehiculoSelect value={a.vehiculo} onChange={(v) => update(`picarga.adicionales.${i}.vehiculo`, v)} />
                </Row>
                <Row label="Tarifa Minuto ($)">
                  <Input value={a.tarifaMinuto} onChange={(v) => update(`picarga.adicionales.${i}.tarifaMinuto`, v)} prefix="$" />
                </Row>
                <Row label="Bonificación ($)">
                  <Input value={a.bonificacion} onChange={(v) => update(`picarga.adicionales.${i}.bonificacion`, v)} prefix="$" />
                </Row>
                <Row label="Recargo Periferia ($)">
                  <Input value={a.periferia ?? "N.A"} onChange={(v) => update(`picarga.adicionales.${i}.periferia`, v)} prefix="$" />
                </Row>
                <Row label="Recargo Aledaños ($)">
                  <Input value={a.aledanos ?? "N.A"} onChange={(v) => update(`picarga.adicionales.${i}.aledanos`, v)} prefix="$" />
                </Row>
                <Row label="Recargo Lejanía ($)">
                  <Input value={a.lejania ?? "N.A"} onChange={(v) => update(`picarga.adicionales.${i}.lejania`, v)} prefix="$" />
                </Row>
                <Row label="Tarifa Auxiliar ($)">
                  <Input value={a.tarifaAuxiliar ?? "N.A"} onChange={(v) => update(`picarga.adicionales.${i}.tarifaAuxiliar`, v)} prefix="$" />
                </Row>
                <Row label="Hora Extra Auxiliar ($)">
                  <Input value={a.horaExtraAuxiliar ?? "N.A"} onChange={(v) => update(`picarga.adicionales.${i}.horaExtraAuxiliar`, v)} prefix="$" />
                </Row>
              </CityCard>
            ))}
          </div>
        )}

        {/* ── STORAGE ── */}
        {tab === "storage" && (
          <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700">
              📦 Configura las tarifas de almacenamiento, alistamientos y los términos de negociación.
              Escribe <strong>"N.A"</strong> para indicar que no aplica.
            </div>

            {/* ── Almacenamiento ── */}
            <div>
              <SectionHeader label="Almacenamiento" onAdd={() => {
                const cp = deepClone(tarifas);
                cp.storage.almacenamiento = cp.storage.almacenamiento || [];
                cp.storage.almacenamiento.push({ ciudad: "Nueva Ciudad", item: "", capacidadUnitaria: "", pesoMaximo: "", negociacion: "", tarifa: "N.A" });
                onChange(cp);
              }} />
              {(tarifas.storage.almacenamiento || []).map((c, i) => (
                <CityCard key={i} title={`${c.ciudad} — ${c.item || "Ítem"}`} onDelete={() => {
                  const cp = deepClone(tarifas); cp.storage.almacenamiento.splice(i, 1); onChange(cp);
                }}>
                  <Row label="Ciudad">
                    <Input value={c.ciudad} type="text" onChange={(v) => update(`storage.almacenamiento.${i}.ciudad`, v)} />
                  </Row>
                  <Row label="Ítem">
                    <Input value={c.item} type="text" onChange={(v) => update(`storage.almacenamiento.${i}.item`, v)} placeholder="Ej: Estante / Estiba" />
                  </Row>
                  <Row label="Capacidad Unitaria">
                    <Input value={c.capacidadUnitaria} type="text" onChange={(v) => update(`storage.almacenamiento.${i}.capacidadUnitaria`, v)} placeholder="Ej: 1m * 1,20m * 1,20m" />
                  </Row>
                  <Row label="Peso Máximo Unitario">
                    <Input value={c.pesoMaximo} type="text" onChange={(v) => update(`storage.almacenamiento.${i}.pesoMaximo`, v)} placeholder="Ej: 1000 kg" />
                  </Row>
                  <Row label="Negociación">
                    <Input value={c.negociacion} type="text" onChange={(v) => update(`storage.almacenamiento.${i}.negociacion`, v)} placeholder="Ej: 3 Estantes" />
                  </Row>
                  <Row label="Tarifa ($)">
                    <Input value={c.tarifa} onChange={(v) => update(`storage.almacenamiento.${i}.tarifa`, v)} prefix="$" />
                  </Row>
                </CityCard>
              ))}
            </div>

            {/* ── Alistamientos ── */}
            <div>
              <SectionHeader label="Alistamientos" onAdd={() => {
                const cp = deepClone(tarifas);
                cp.storage.alistamientos = cp.storage.alistamientos || [];
                cp.storage.alistamientos.push({
                  tipo: "Simple", descripcion: "",
                  rangos: [
                    { rango: "1 - 100", tarifa: "N.A" }, { rango: "101 - 250", tarifa: "N.A" },
                    { rango: "251 - 500", tarifa: "N.A" }, { rango: "> 500", tarifa: "N.A" },
                  ],
                });
                onChange(cp);
              }} />
              {(tarifas.storage.alistamientos || []).map((a, i) => (
                <CityCard key={i} title={`${a.tipo} — ${a.descripcion || "sin descripción"}`} onDelete={() => {
                  const cp = deepClone(tarifas); cp.storage.alistamientos.splice(i, 1); onChange(cp);
                }}>
                  {/* Tipo: Simple / Especial */}
                  <Row label="Tipo de alistamiento">
                    <div className="flex gap-2">
                      {["Simple", "Especial"].map((t) => (
                        <label key={t} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                          a.tipo === t ? "bg-purple-50 border-purple-400 text-purple-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}>
                          <input type="radio" checked={a.tipo === t}
                            onChange={() => update(`storage.alistamientos.${i}.tipo`, t)}
                            className="accent-purple-600" />
                          {t}
                        </label>
                      ))}
                    </div>
                  </Row>
                  <Row label="Descripción">
                    <Input value={a.descripcion} type="text" onChange={(v) => update(`storage.alistamientos.${i}.descripcion`, v)} placeholder="Especificar el proceso o los pasos" />
                  </Row>
                  {/* Rangos de alistamiento */}
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Tarifas por rango de alistamientos / mes:</p>
                    <div className="space-y-1">
                      {(a.rangos || []).map((r, j) => (
                        <Row key={j} label={`Rango ${r.rango}`}>
                          <Input value={r.tarifa} onChange={(v) => update(`storage.alistamientos.${i}.rangos.${j}.tarifa`, v)} prefix="$" />
                        </Row>
                      ))}
                    </div>
                  </div>
                </CityCard>
              ))}
            </div>

            {/* ── Términos de negociación ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Términos de negociación Storage / Crossdocking</p>
                <button onClick={() => {
                  const cp = deepClone(tarifas);
                  cp.storage.terminos = [...(cp.storage.terminos || []), ""];
                  onChange(cp);
                }} className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 rounded-lg px-3 py-1 hover:bg-purple-50">
                  + Agregar término
                </button>
              </div>
              <div className="space-y-2">
                {(tarifas.storage.terminos || []).map((t, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-gray-400 text-xs mt-2 shrink-0">*</span>
                    <input
                      type="text" value={t}
                      onChange={(e) => {
                        const cp = deepClone(tarifas);
                        cp.storage.terminos[i] = e.target.value;
                        onChange(cp);
                      }}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <button onClick={() => {
                      const cp = deepClone(tarifas);
                      cp.storage.terminos.splice(i, 1);
                      onChange(cp);
                    }} className="text-red-400 hover:text-red-600 text-xs mt-2 shrink-0">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SEGURO ── */}
        {tab === "seguro" && (
          <div>
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              🛡️ La tarifa de seguro se calcula sobre el <strong>valor declarado</strong> de cada servicio (Ruta / Booking).
              Escribe <strong>"N.A"</strong> en Costo de Seguro para indicar que no aplica en ese rango.
            </div>

            {/* Botón agregar fila */}
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rangos de valor declarado</p>
              <button
                onClick={() => {
                  const cp = deepClone(tarifas);
                  cp.storage.seguro = cp.storage.seguro || [];
                  cp.storage.seguro.push({ unidad: "Pibox", montoDesde: 0, montoHasta: 0, costoSeguro: "N.A" });
                  onChange(cp);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50 transition-colors"
              >
                + Agregar rango
              </button>
            </div>

            <div className="space-y-3">
              {(tarifas.storage.seguro || []).map((row, i) => (
                <div key={i} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">Rango {i + 1}</span>
                    <button
                      onClick={() => {
                        const cp = deepClone(tarifas);
                        cp.storage.seguro.splice(i, 1);
                        onChange(cp);
                      }}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50"
                    >
                      ✕ Eliminar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Row label="Unidad de Negocio">
                      <Input value={row.unidad} type="text" onChange={(v) => update(`storage.seguro.${i}.unidad`, v)} />
                    </Row>
                    <Row label="Costo de Seguro">
                      <Input value={row.costoSeguro} type="text" onChange={(v) => update(`storage.seguro.${i}.costoSeguro`, v)} placeholder="Ej: $300, 0.03% ó N.A" />
                    </Row>
                    <Row label="Monto Desde ($)">
                      <Input value={row.montoDesde} onChange={(v) => update(`storage.seguro.${i}.montoDesde`, v)} prefix="$" />
                    </Row>
                    <Row label="Monto Hasta ($)">
                      <Input value={row.montoHasta} onChange={(v) => update(`storage.seguro.${i}.montoHasta`, v)} prefix="$" />
                    </Row>
                  </div>
                </div>
              ))}

              {(tarifas.storage.seguro || []).length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                  No hay rangos configurados. Haz clic en <strong>"+ Agregar rango"</strong> para comenzar.
                </div>
              )}
            </div>

            {/* Resumen visual */}
            {(tarifas.storage.seguro || []).length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vista previa de la tabla</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-blue-700 text-white">
                        {["Unidad de Negocio", "Monto Desde", "Monto Hasta", "Costo de Seguro"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left border border-blue-800">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(tarifas.storage.seguro || []).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                          <td className="px-3 py-2 border border-gray-200">{row.unidad}</td>
                          <td className="px-3 py-2 border border-gray-200">${Number(row.montoDesde || 0).toLocaleString("es-CO")}</td>
                          <td className="px-3 py-2 border border-gray-200">${Number(row.montoHasta || 0).toLocaleString("es-CO")}</td>
                          <td className="px-3 py-2 border border-gray-200 font-medium">{row.costoSeguro}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function SectionHeader({ label, onAdd }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      {onAdd && (
        <button
          onClick={onAdd}
          className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50 transition-colors flex items-center gap-1"
        >
          + Agregar ciudad
        </button>
      )}
    </div>
  );
}

function CityCard({ title, children, onDelete }) {
  return (
    <div className="mb-4 bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm text-gray-700">{title}</p>
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50 transition-colors"
          >
            ✕ Eliminar
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
