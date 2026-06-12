import { useState } from "react";

const TABS = [
  { id: "distancia", label: "Distancia (Km)" },
  { id: "horas", label: "Horas" },
  { id: "paquetes", label: "Paquetes" },
  { id: "recargos", label: "Recargos y Adicionales" },
  { id: "manifiesto", label: "Manifiesto" },
  { id: "premium", label: "Distancia Premium" },
  { id: "storage", label: "Storage" },
  { id: "seguros", label: "Seguros y Recaudo" },
  { id: "rent", label: "Rent B2B" },
  { id: "tat", label: "TAT (Rendimiento)" },
  { id: "cobertura", label: "Cobertura" },
  { id: "terceros", label: "Terceros" },
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

// ── Manifiesto ──
const manifiestoHeaders = ["Ciudad", "Tipo Vehículo", "Máx Paradas", "Tarifa Hora", "Flete", "Manifiesto", "Cobro Cliente"];
const manifiestoRows = [
  ["Bogotá Urbano", "Carry", "50", "$38.375", "$307.000", "$1.800", "$308.800"],
  ["Bogotá Urbano", "NHR", "30", "$50.750", "$406.000", "$1.800", "$407.800"],
  ["Medellín, Cali, B/quilla", "Carry", "50", "$41.950", "$335.600", "$1.800", "$337.400"],
  ["Medellín, Cali, B/quilla", "NHR", "30", "$55.200", "$441.600", "$1.800", "$443.400"],
];

// ── Distancia Premium ──
const premiumHeaders = ["Ciudad", "Tipo VH", "Disponibilidad", "Base 3 Km", "Km Extra", "Parada Adicional"];
const premiumRows = [
  ["Bogotá - Nacional", "Moto", "4 Horas — $30.000", "$3.800", "$950", "$700"],
  ["Medellín y Área Metro", "Moto", "4 Horas — $35.000", "$4.000", "$1.000", "$800"],
  ["Bogotá - Nacional", "Moto", "8 Horas — $50.000", "$3.800", "$950", "$700"],
  ["Medellín y Área Metro", "Moto", "8 Horas — $55.000", "$4.000", "$1.000", "$800"],
];

// ── Storage completo (almacenamiento + alistamiento) ──
const storageFullHeaders = ["Ocupación", "Ítem", "Medidas", "Capacidad", "Costo", "Peso Max Kg", "Observaciones"];
const storageFullRows = [
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
];

const alistamientoHeaders = ["Tipo", "Descripción", "Rango", "Costo Unitario"];
const alistamientoRows = [
  ["Simple", "Picking (1-5 uds) y packing", "1 - 100", "$1.200"],
  ["Simple", "", "101 - 250", "$1.100"],
  ["Simple", "", "251 - 500", "$1.000"],
  ["Simple", "", "> 500", "$900"],
  ["Especial", "Picking y packing especial (hasta 4 procesos)", "1 - 100", "$2.200"],
  ["Especial", "", "100 - 250", "$2.100"],
  ["Especial", "", "251 - 500", "$2.000"],
  ["Especial", "", "> 500", "$1.900"],
];

// ── Seguros y Recaudo ──
const recaudoHeaders = ["Soporte Legal", "Tipo Recaudo", "Tope Booking", "Cobro %", "Utilidad Corp. Mín.", "Observaciones"];
const recaudoRows = [
  ["T&C / Contrato", "Ida y vuelta", "$500.000", "1,5%", "3%", "Requiere autorización de líderes"],
  ["T&C / Contrato", "Conciliación", "$1.500.000", "3,5%", "3%", "Ninguna negociación puede recaudar por encima del 270% de su facturación"],
];

// ── Cobertura por ciudad ──
const coberturaHeaders = ["Ciudad", "Área Metropolitana", "Periferia", "Aledaños", "Lejanías", "Zonas Rojas"];
const coberturaRows = [
  ["Bogotá", "Bogotá", "Soacha, Funza, Madrid, Mosquera, Cota, Chía, La Calera", "Facatativá, Cajicá", "Sopó, Sibaté, Zipaquirá, Tabio, Tenjo", "Quiba, Mochuelo Bajo, Usme Pueblo"],
  ["Cali", "Cali", "Palmira, Yumbo, Jamundí, Dapa", "La Nubia", "Villa Gorgona, Potreritos, Candelaria", "Siloé, Polvorines, Agua Blanca"],
  ["Medellín", "Medellín, Envigado, Itagüí, Bello, Sabaneta", "Barbosa, Caldas, Girardota, Copacabana, La Estrella", "Rionegro, Llano Grande, Santa Elena", "La Unión, Guarne, Marinilla, La Ceja", "Manrique La Cruz, Santo Domingo"],
  ["Barranquilla", "Barranquilla", "Soledad, Palermo, San Isidro", "Puerto Colombia, Galapa, Juan Mina", "Sabana Grande, Baranoa", "Rebolo, La Luz, La Chinita"],
  ["Bucaramanga", "Bucaramanga", "Floridablanca, Girón", "Piedecuesta", "—", "—"],
  ["Armenia", "Armenia", "Circasia, Calarcá", "—", "Montenegro", "—"],
  ["Cartagena", "Cartagena", "La Boquilla, Pradera, La Esperanza, Nelson Mandela", "—", "Serena del Mar, Tierra Baja", "—"],
  ["Santa Marta", "Santa Marta", "Taganga, Bonda, Gaira", "—", "Zazue", "—"],
];

// ── Políticas por pestaña ──
const POL = ["Ítem", "Política / Observaciones"];

const TABLE_DATA = {
  distancia: {
    headers: distanciaHeaders, rows: distanciaRows,
    politicas: { headers: POL, rows: [
      ["Negociación de Tarifas", "Todas las negociaciones parten de las tarifas base (15% utilidad). Es posible negociar utilidad adicional. Excepción: pagos en efectivo o recargas no permiten configurar utilidad corporativa."],
      ["Tarifas calculadas", "Estas tarifas están calculadas con utilidad corporativa del 3%."],
      ["Recargos Periferia", "Se aplican en doble vía (ida y vuelta al punto de origen/destino en dichas zonas)."],
      ["Capacidad Vehículo", "El solicitante debe verificar la capacidad cúbica del vehículo asegurando que la mercancía pueda transportarse adecuadamente."],
    ]},
  },
  horas: {
    headers: horasHeaders, rows: horasRows,
    politicas: { headers: POL, rows: [
      ["Política de Cancelación", "Cancelaciones con mínimo 3 horas hábiles de anticipación (Lun-Sáb, 6am-7pm). Menos de 4h genera parada en falso."],
      ["Tiempo de Espera (Stand By)", "Se cobra cuando el vehículo permanezca sin carga, previamente planificado. Equivale al 50% de la tarifa."],
      ["Inhouse", "Costo adicional: $2.800.000. Escalar a líderes con: horario, funciones, lugar, cantidad de horas/semana."],
      ["Mínimo de horas", "Bloques mínimos de 4 horas para Moto y Carry. NHR y NPR mínimo 8 horas."],
    ]},
  },
  paquetes: {
    headers: paquetesHeaders, rows: paquetesRows,
    politicas: { headers: POL, rows: [
      ["Entregas Optimizadas", "Mínimo >10 paquetes por ruta agrupados por sector geográfico."],
      ["Recargos", "Recargo nocturno y dominical aplican según tabla. Verificar con líder operaciones."],
      ["Devoluciones", "Toda devolución genera cobro por los kilómetros recorridos para retornar el paquete al origen."],
    ]},
  },
  recargos: {
    headers: recargosHeaders, rows: recargosRows,
    politicas: { headers: POL, rows: [
      ["Stand By", "2 horas de espera al cargue. Se cobra 100% de la tarifa cuando aplica. Fee adicional: 20%."],
      ["Parada en Falso", "Después de 2 horas de espera y se cancela el servicio. Se cobra 60% de la tarifa. Aplica a jornadas de 8 horas."],
      ["Recargos Periferia", "Se aplican en doble vía (ida y vuelta). Ver tabla de cobertura por ciudad."],
      ["Carga Pesada (Carry)", "Para 4+ unidades o peso ≥90kg, es obligatorio cobrar auxiliar de carga o que el cliente garantice personal."],
    ]},
  },
  manifiesto: {
    headers: manifiestoHeaders, rows: manifiestoRows,
    politicas: { headers: POL, rows: [
      ["Auxiliar de Carga", "Carry: $94.000 por servicio."],
      ["Escolta", "Carry / NHR: $307.000 por servicio."],
      ["Cargue y Descargue", "No incluido en tarifas. Si se requiere, solicitar auxiliar y asumir el costo."],
      ["Política de Recaudo", "Las tarifas no incluyen recaudo."],
      ["Seguro y VD", "Carry y NHR: VD máximo por servicio $20.000.000. Cobertura aliado hasta $1.000.000.000."],
      ["Cancelación", "Mínimo 3 horas hábiles de anticipación. Menos de 4h genera parada en falso."],
      ["Cobros Adicionales", "Recargos periferia se aplican en doble vía."],
      ["Stand By", "Se cobra cuando el vehículo permanezca sin carga (previamente acordado). Equivale al 50% de la tarifa."],
      ["Cargue y Descargue", "Las tarifas no incluyen este servicio. Solicitar auxiliar si se requiere."],
      ["Inhouse", "Costo adicional $2.800.000. Escalar a líderes con horario, funciones, lugar y horas/semana."],
      ["Carga Pesada", "Para 4+ unidades o peso ≥90kg, obligatorio cobrar auxiliar o que el cliente garantice personal."],
      ["Capacidad", "Verificar capacidad cúbica del vehículo para asegurar transporte adecuado de la mercancía."],
    ]},
  },
  premium: {
    headers: premiumHeaders, rows: premiumRows,
    politicas: { headers: POL, rows: [
      ["Alcance", "Aplica para distancias hasta 10 Km, solo perímetro urbano/metropolitano (Medellín incluye área metro)."],
      ["Pilotos", "Enfocado a pilotos fidelizados y capacitados."],
      ["Vehículo", "Únicamente para negociaciones en Moto."],
    ]},
  },
  storage: {
    headers: storageFullHeaders, rows: storageFullRows,
    extra: { headers: alistamientoHeaders, rows: alistamientoRows, title: "Alistamientos" },
    politicas: { headers: POL, rows: [
      ["Refrigeración", "Recargo del 30% sobre la tarifa de almacenamiento."],
      ["Insumos", "Clientes deben proporcionar su insumo (cinta, papel, vinipel)."],
      ["Liquidación", "La liquidación de alistamientos es por ciudad."],
      ["IVA", "Todos los valores de Storage son sin IVA. Se debe aclarar en la propuesta."],
      ["Horarios", "Tener en cuenta los horarios de bodega."],
      ["Info requerida", "Ficha técnica, referencias (cantidad) / stock, espacio actual y proyectado."],
    ]},
  },
  seguros: {
    headers: segurosHeaders, rows: segurosRows,
    extra: { headers: recaudoHeaders, rows: recaudoRows, title: "Base de Negociación Recaudo" },
    politicas: { headers: POL, rows: [
      ["Seguro obligatorio", "Todas las negociaciones deben tener % de seguro."],
      ["Recaudo + seguro", "Toda negociación con recaudo debe quedar marcada en la web con costo de seguro asociado."],
      ["GMV", "El valor de seguros no entra a la bolsa de GMV."],
      ["Facturación", "Las facturas de recaudo llevan IVA."],
      ["Límite recaudo", "Ninguna negociación puede recaudar por encima del 270% de su facturación."],
      ["Autorización", "El modelo de recaudo ida y vuelta requiere autorización de los líderes."],
    ]},
  },
  rent: {
    headers: rentHeaders, rows: rentRows,
    politicas: { headers: POL, rows: [
      ["Tarifas", "Tarifas nacionales. Sujeto a T&C de Picap Rent. Aplican tarifas dinámicas."],
      ["Modelo", "Modelo de autogestión. En caso de incidencias será atendida por agentes de soporte."],
      ["Configuración", "No requiere configuración de tarifas."],
      ["Códigos", "El cliente debe generar desde su dashboard los códigos para los usuarios."],
      ["Portal", "https://picap.rent/login"],
    ]},
  },
  tat: {
    headers: tatHeaders, rows: tatRows,
    politicas: { headers: POL, rows: [
      ["Utilidad", "Estas tarifas están calculadas con utilidad corporativa del 3%."],
      ["Paradas", "Máximo 40 paradas efectivas por jornada de 8 horas."],
      ["Parada Extra", "Tarifa por cada parada efectiva adicional al máximo pactado."],
    ]},
  },
  cobertura: {
    headers: coberturaHeaders, rows: coberturaRows,
    politicas: { headers: POL, rows: [
      ["Recargos zona", "Periferia, aledaños y lejanía generan recargo adicional según tabla de recargos."],
      ["Zonas rojas", "Zonas de no acceso — no se presta servicio en estas zonas por seguridad."],
      ["Doble vía", "Los recargos de zona se aplican en doble vía (ida y vuelta)."],
    ]},
  },
  terceros: {
    headers: ["Política"], rows: [
      ["Estas tarifas pueden cambiar de un mes a otro. Se debe solicitar cotización antes de comprometer tarifas."],
      ["La cotización se debe solicitar por correo al líder de operaciones, con copia al líder comercial."],
      ["Proveedor principal: BULMATIC"],
    ],
  },
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

      {/* Extra table (ej: alistamientos dentro de storage, recaudo dentro de seguros) */}
      {current.extra && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-gray-700 mb-2">{current.extra.title}</h3>
          <DataTable headers={current.extra.headers} rows={current.extra.rows} />
        </div>
      )}

      {/* Políticas específicas de esta pestaña */}
      {current.politicas && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
            <span className="bg-purple-100 rounded-lg px-2 py-0.5">📋</span> Políticas Comerciales y Operativas
          </h3>
          <div className="overflow-x-auto rounded-lg border border-purple-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-purple-100">
                  {current.politicas.headers.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-purple-800 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.politicas.rows.map((row, ri) => (
                  <tr key={ri} className={`border-t border-purple-100 ${ri % 2 === 0 ? "bg-white" : "bg-purple-50/30"} hover:bg-purple-50 transition-colors`}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={`px-4 py-2 ${ci === 0 ? "font-semibold text-purple-700 whitespace-nowrap" : "text-gray-600"}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
