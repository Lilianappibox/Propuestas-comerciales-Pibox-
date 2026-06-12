import { useState } from "react";

const TABS = [
  { id: "distancia", label: "Distancia (Km)" },
  { id: "horas", label: "Horas" },
  { id: "paquetes", label: "Paquetes" },
  { id: "recargos", label: "Recargos y Adicionales" },
  { id: "storage", label: "Storage" },
  { id: "seguros", label: "Seguros" },
  { id: "rent", label: "Rent B2B" },
  { id: "tat", label: "TAT (Rendimiento)" },
];

const fmt = (v) => {
  if (v === null || v === undefined || v === "" || v === "—") return "—";
  if (typeof v === "string" && v.startsWith("$")) return v; // already formatted
  if (typeof v === "string") return v;
  return `$${v.toLocaleString("es-CO")}`;
};

const distanciaHeaders = [
  "Ciudad", "Tipo Vehículo", "Base Km", "Tarifa Base", "Km Extra",
  "Parada Adicional", "Recargo Nocturno", "Recargo Dominical",
];
const distanciaRows = [
  ["Bogotá - Nacional", "Moto", "3 Km", "$6.650", "$1.250", "$4.500", "$665", "$1.330"],
  ["Medellín, Cali, B/quilla, B/manga", "Moto", "3 Km", "$7.300", "$1.250", "$4.500", "$3.700", "$3.650"],
  ["Bogotá - Nacional", "Carry", "10 Km", "$70.000", "$4.000", "$6.000", "—", "$17.500"],
  ["Bogotá - Nacional", "NHR", "10 Km", "$87.500", "$5.500", "$7.000", "—", "$21.875"],
  ["Medellín, Cali, B/quilla", "Carry", "10 Km", "$75.000", "$4.300", "$6.500", "—", "$18.750"],
  ["Medellín, Cali, B/quilla", "NHR", "10 Km", "$93.750", "$5.800", "$7.500", "—", "$23.437"],
  ["Bogotá - Nacional", "NPR", "10 Km", "$120.000", "$7.000", "$10.000", "—", "$30.000"],
];

const horasHeaders = [
  "Ciudad", "Tipo Vehículo", "Tarifa Hora (Km Base)", "Tarifa Hora (15 Km)",
  "Tarifa Hora (20 Km)", "Recargo Nocturno", "Hora Extra", "Min Horas",
];
const horasRows = [
  ["Colombia", "Moto", "$16.400", "$18.900", "$21.400", "$6.550", "$8.200", "4h"],
  ["Bogotá - Nacional", "Carry", "$33.150", "N/A", "N/A", "$14.200", "$16.575", "4h"],
  ["Bogotá - Nacional", "NHR", "$42.000", "N/A", "N/A", "$17.300", "$21.000", "8h"],
  ["Bogotá - Nacional", "NPR", "$55.000", "N/A", "N/A", "$22.000", "$27.500", "8h"],
  ["Medellín, Cali", "Carry", "$36.200", "N/A", "N/A", "$15.500", "$18.100", "4h"],
  ["Medellín, Cali", "NHR", "$45.900", "N/A", "N/A", "$18.900", "$22.950", "8h"],
];

const paquetesHeaders = [
  "Ciudad", "Tamaño", "Paquetes/Ruta", "Tarifa Paquete (3%)",
  "Tarifa Ruta", "Recargo Nocturno", "Recargo Dominical",
];
const paquetesRows = [
  ["Bogotá", "Entregas Optimizadas", ">10", "$12.000", "—", "—", "—"],
  ["Bogotá", "Pequeño", "10", "$11.000", "$110.000", "$6.550", "$9.350"],
  ["Bogotá", "Pequeño", "12", "$9.600", "$115.200", "—", "—"],
  ["Bogotá", "Mediano", "10", "$13.500", "$135.000", "—", "—"],
  ["Bogotá", "Grande", "8", "$17.000", "$136.000", "—", "—"],
];

const recargosHeaders = [
  "Tipo Vehículo", "Periferia", "Aledaños", "Lejanía", "Auxiliar",
  "Hora Aux.", "Stand By", "Parada Falso", "Capacidad Kg", "Dimensiones",
];
const recargosRows = [
  ["Moto", "$12.800", "—", "—", "—", "—", "100% tarifa", "60% tarifa", "50 kg", "50x50x50"],
  ["Carry", "$36.300", "$41.700", "$53.500", "$74.000", "$9.250", "100% tarifa", "60% tarifa", "700 kg", "1.5L x 1A x 1H"],
  ["NHR", "$37.200", "$43.900", "$53.500", "$80.000", "$10.000", "100% tarifa", "60% tarifa", "1000 kg", "—"],
  ["NPR", "$62.500", "$68.800", "$75.000", "$120.000", "$15.000", "100% tarifa", "60% tarifa", "3500 kg", "—"],
];

const storageHeaders = [
  "Ocupación", "Ítem", "Medidas", "Capacidad", "Costo", "Peso Max Kg", "Observaciones",
];
const storageRows = [
  ["Mensual", "Metro/Estiba", "1m x 1.20m x 1.20m Alt. 2m", "1 Mtr", "$165.950", "1.000", "—"],
  ["Mensual", "Estante 4 Entrepaños", "1.76 x 50 x 70 cm", "2 Mtrs", "$331.850", "200", "50 kg por Entrepaño"],
  ["Mensual", "1/2 Estante 2 Entrepaños", "—", "1 Mtr", "$199.100", "100", "50 kg por Entrepaño"],
  ["Quincenal", "Estiba", "1m x 1.20m x 1.20m Alt. 2m", "1 Mtr", "$94.000", "1.000", "—"],
  ["Quincenal", "Estante", "1.76 x 50 x 70 cm", "4 Mtrs", "$199.000", "200", "50 kg por Entrepaño"],
];

const segurosHeaders = [
  "Soporte Legal", "Tope Asegurable", "Rango 1", "Rango 2", "Rango 3",
  "% Rango 1", "% Rango 2", "% Rango 3",
];
const segurosRows = [
  ["T&C Corporativos", "$1.000.000", "$0 - $1M", "$1M - $2M", "$2M - $8M", "$300", "0.03%", "0.02%"],
  ["T&C Corporativos", "$5.000.000", "$0 - $1M", "$1M - $2M", "$2M - $5M", "Incluido", "0.03%", "0.02%"],
];

const rentHeaders = [
  "Ciudad", "Tipo Vehículo", "Base 3 Km", "Tarifa Minuto", "Km Extra",
];
const rentRows = [
  ["Nacional", "Moto", "—", "—", "—"],
  ["Nacional", "Carro", "—", "—", "—"],
];

const tatHeaders = [
  "Ciudad", "Tipo Vehículo", "Disponibilidad 8h", "Máx Paradas",
  "Tarifa Parada Extra", "Observaciones",
];
const tatRows = [
  ["Bogotá - Nacional", "Carry", "$120.000", "40", "$3.500", "Utilidad corporativa 3%"],
  ["Bogotá - Nacional", "NHR", "$152.000", "40", "$4.000", "—"],
  ["Medellín y Área Metro", "Carry", "$130.000", "40", "$3.800", "—"],
  ["Medellín y Área Metro", "NHR", "$170.000", "40", "$4.500", "—"],
];

const TABLE_DATA = {
  distancia: { headers: distanciaHeaders, rows: distanciaRows },
  horas: { headers: horasHeaders, rows: horasRows },
  paquetes: { headers: paquetesHeaders, rows: paquetesRows },
  recargos: { headers: recargosHeaders, rows: recargosRows },
  storage: { headers: storageHeaders, rows: storageRows },
  seguros: { headers: segurosHeaders, rows: segurosRows },
  rent: { headers: rentHeaders, rows: rentRows },
  tat: { headers: tatHeaders, rows: tatRows },
};

function DataTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-purple-600 text-white">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={`border-t border-gray-100 ${
                ri % 2 === 0 ? "bg-white" : "bg-purple-50/40"
              } hover:bg-purple-50 transition-colors`}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-2 whitespace-nowrap ${
                    ci === 0 ? "font-medium text-gray-800" : "text-gray-600"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TarifarioInterno() {
  const [tab, setTab] = useState("distancia");
  const current = TABLE_DATA[tab];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">Tarifario Interno</h2>
        <p className="text-sm text-gray-500 mt-1">
          Tarifario interno de negociaci&oacute;n &mdash; Solo consulta. Utilidad corporativa base: 3%
        </p>
      </div>

      {/* Info box */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
        <svg
          className="w-4 h-4 text-purple-500 mt-0.5 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-xs text-purple-700">
          Estas tarifas son la base de negociaci&oacute;n. Para tarifas especiales consultar con el l&iacute;der comercial.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-1 -mb-px min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg ${
                tab === t.id
                  ? "border-b-2 border-purple-600 text-purple-600 bg-purple-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Table */}
      <DataTable headers={current.headers} rows={current.rows} />
    </div>
  );
}
