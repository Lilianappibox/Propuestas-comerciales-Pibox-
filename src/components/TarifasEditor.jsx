import { useState } from "react";

// Convierte el valor: si es "N.A" lo guarda como texto, si no como número
const parseVal = (raw, isNum) => {
  if (typeof raw === "string" && raw.trim().toUpperCase() === "N.A") return "N.A";
  return isNum ? (raw === "" ? "" : Number(raw)) : raw;
};

const Input = ({ value, onChange, prefix = "", type = "number", className = "", placeholder = "" }) => {
  const isNum = type === "number";
  const isNA  = value === "N.A";
  return (
    <div className="flex items-center gap-1">
      {prefix && !isNA && <span className="text-xs text-gray-400">{prefix}</span>}
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(parseVal(e.target.value, isNum))}
        placeholder={placeholder || (isNum ? "0 ó N.A" : "")}
        className={`w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
          isNA ? "border-gray-300 bg-gray-100 text-gray-400 italic" : "border-gray-300"
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
                  <Input value={c.vehiculo} type="text" onChange={(v) => update(`picarga.ciudades.${i}.vehiculo`, v)} />
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
                  <Input value={r.vehiculo} type="text" onChange={(v) => update(`picarga.reservas.${i}.vehiculo`, v)} />
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
          <div>
            <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700">
              📦 Las tarifas de Storage se presentan según volumetría y acuerdo con el cliente. Configure los valores base aquí.
            </div>
            <SectionHeader label="Tarifas por Ciudad" onAdd={() => addRow("storage", "ciudades")} />
            {tarifas.storage.ciudades.map((c, i) => (
              <CityCard key={i} title={c.ciudad} onDelete={() => removeRow("storage", "ciudades", i)}>
                <Row label="Ciudad">
                  <Input value={c.ciudad} type="text" onChange={(v) => update(`storage.ciudades.${i}.ciudad`, v)} />
                </Row>
                <Row label="Posición Pallet / mes ($)">
                  <Input value={c.tarifaPosicionPallet} onChange={(v) => update(`storage.ciudades.${i}.tarifaPosicionPallet`, v)} prefix="$" />
                </Row>
                <Row label="Posición Caja / mes ($)">
                  <Input value={c.tarifaPosicionCaja} onChange={(v) => update(`storage.ciudades.${i}.tarifaPosicionCaja`, v)} prefix="$" />
                </Row>
                <Row label="Tarifa m² / mes ($)">
                  <Input value={c.tarifaM2Mes} onChange={(v) => update(`storage.ciudades.${i}.tarifaM2Mes`, v)} prefix="$" />
                </Row>
                <Row label="Picking / unidad ($)">
                  <Input value={c.picking} onChange={(v) => update(`storage.ciudades.${i}.picking`, v)} prefix="$" />
                </Row>
                <Row label="Cross-docking ($)">
                  <Input value={c.crossDocking} onChange={(v) => update(`storage.ciudades.${i}.crossDocking`, v)} prefix="$" />
                </Row>
                <Row label="Facturación mínima ($)">
                  <Input value={c.facturaMinima} onChange={(v) => update(`storage.ciudades.${i}.facturaMinima`, v)} prefix="$" />
                </Row>
              </CityCard>
            ))}

            <SectionHeader label="Tarifa por Seguro" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse mb-2">
                <thead>
                  <tr className="bg-gray-700 text-white">
                    {["Unidad de Negocio", "Monto Desde", "Monto Hasta", "Costo de Seguro"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left border border-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(tarifas.storage.seguro || []).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 border border-gray-200">{row.unidad}</td>
                      <td className="px-3 py-2 border border-gray-200">
                        <Input value={row.montoDesde} onChange={(v) => update(`storage.seguro.${i}.montoDesde`, v)} prefix="$" />
                      </td>
                      <td className="px-3 py-2 border border-gray-200">
                        <Input value={row.montoHasta} onChange={(v) => update(`storage.seguro.${i}.montoHasta`, v)} prefix="$" />
                      </td>
                      <td className="px-3 py-2 border border-gray-200">
                        <Input value={row.costoSeguro} type="text" onChange={(v) => update(`storage.seguro.${i}.costoSeguro`, v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
