import { useState } from "react";

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
              <Row label="Parada en Falso ($)">
                <Input value={tarifas.programadoBloqueHoras.adicionales.paradaEnFalso} onChange={(v) => update("programadoBloqueHoras.adicionales.paradaEnFalso", v)} prefix="$" />
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
              <Row label="Parada en Falso ($)">
                <Input value={tarifas.picarga.adicionalesBH?.paradaEnFalso ?? "N.A"} onChange={(v) => update("picarga.adicionalesBH.paradaEnFalso", v)} prefix="$" />
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
