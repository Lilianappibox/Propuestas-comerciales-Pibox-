import { useState, useMemo, useEffect, useCallback } from "react";
import IncrementoTarifas from "./IncrementoTarifas";
import InformeTada from "./InformeTada";

const TABS = [
  { id: "politicasGenerales", label: "📋 Políticas Generales" },
  { id: "distancia", label: "Distancia (Km)" },
  { id: "horas", label: "Horas" },
  { id: "paquetes", label: "Paquetes" },
  { id: "tarifasTada", label: "TaDa" },
  { id: "recargos", label: "Recargos y Adicionales" },
  { id: "manifiesto", label: "Manifiesto" },
  { id: "storage", label: "Storage" },
  { id: "seguros", label: "Seguros y Recaudo" },
  { id: "rent", label: "Rent B2B" },
  { id: "cobertura", label: "Cobertura" },
  { id: "onboarding", label: "🚀 Onboarding 2.0" },
  { id: "calculadora", label: "🧮 Calculadora" },
  { id: "incremento", label: "📈 Incremento Tarifas" },
  { id: "incrementoAnual", label: "Incremento Anual Tarifario" },
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
  ["Bogotá", "Bogotá", "Soacha, Funza, Madrid, Mosquera, Cota, Chía, La Calera", "Facatativá, Cajicá", "Sopó, Sibaté, Zipaquirá, Tabio, Tenjo", "Quiba, Mochuelo Bajo, Illimani, Paraíso, Lucero Alto, Bella Flor, Usme Pueblo, Arbolizadora Alta, Moralba, Miraflores, Ramajal la Gloria, Gaviotas, El Codito"],
  ["Cali", "Cali", "Palmira, Yumbo, Jamundí, Dapa", "La Nubia", "Villa Gorgona, Potreritos, Candelaria", "Siloé, Las Palmas, Polvorines, Los Chorros, Terrón Colorado, Villa del Sur, Manuela Beltrán, Marroquín 1 y 2, Sucre, Agua Blanca, Potrero Grande, Pizanos 1-2-3, Valle Grande, Mariano Ramos, Último Llorena, Charco Azul, El Calvario, Petecuy 1-2-3, El Hoyo, El Navarro, Poblado Campestre, Cecepaz, Llano Verde, Andrés Sanín"],
  ["Medellín", "Medellín, Envigado, Itagüí, Bello, Sabaneta", "Barbosa, Caldas, Girardota, Copacabana, La Estrella, San Cristóbal, San Antonio de Prado", "Rionegro, Llano Grande, Santa Elena", "La Unión, Guarne, Marinilla, La Ceja, Carmen de Viboral", "Manrique La Cruz parte alta, Santo Domingo, Enciso, San Javier la Loma, Moravia, Belén Aguas Frías, La Sierra, Carpinelo (Bello), Santa Rita arriba (Bello), Zona Centro (Candelaria), San Javier comunas altas, Manrique, El Popular, Villa Hermosa, Llanaditas, Los Mangos, Trece de Noviembre"],
  ["Barranquilla", "Barranquilla", "Soledad, Palermo, San Isidro", "Puerto Colombia, Galapa, Juan Mina", "Sabana Grande, Baranoa", "Rebolo, La Luz, La Chinita, Los Olivos I y II, El Rubí, La Pradera, Bajo Valle, La Florida, Nueva Colombia, El Bosque, Las Malvinas, El Ferry, Las Nieves · Soledad: La Bonga, Ferrocarril, Cabrera, Cruz de Mayo, Primero de Mayo, Normandía, Los Cúsules, La Central, Don Bosco"],
  ["Bucaramanga", "Bucaramanga", "Floridablanca, Girón", "Piedecuesta", "—", "—"],
  ["Armenia", "Armenia", "Circasia, Calarcá", "—", "Montenegro", "—"],
  ["Cartagena", "Cartagena", "La Boquilla, Pradera, La Esperanza, Casa Blanca, Nelson Mandela", "—", "Serena del Mar, Tierra Baja, Las Ramplas", "—"],
  ["Santa Marta", "Santa Marta", "Taganga, Bonda, Gaira", "—", "Zazue", "—"],
];

// ── Políticas por pestaña ──
const POL = ["Ítem", "Política / Observaciones"];

const TABLE_DATA = {
  politicasGenerales: {
    headers: ["Ítem", "Política / Observaciones"],
    rows: [
      ["Utilidad de Tarifas Base", "Todas las tarifas están calculadas con utilidad corporativa del 3%. Es posible negociar utilidad adicional según volumen y tipo de cliente."],
      ["Negociación de Tarifas", "Todas las negociaciones parten de las tarifas base (15% utilidad). Excepción: pagos en efectivo o recargas no permiten configurar utilidad corporativa."],
      ["Recargos Periferia", "Se aplican en doble vía (ida y vuelta al punto de origen/destino en dichas zonas). Ver tabla de cobertura por ciudad."],
      ["Capacidad Vehículo", "El solicitante debe verificar la capacidad cúbica del vehículo asegurando que la mercancía pueda transportarse adecuadamente."],
      ["Política de Cancelación", "Cancelaciones con mínimo 3 horas hábiles de anticipación (Lun-Sáb, 6am-7pm). Menos de 4h genera parada en falso."],
      ["Stand By", "Se cobra cuando el vehículo permanezca sin carga, previamente planificado. Equivale al 100% de la tarifa. Fee adicional: 20%."],
      ["Parada en Falso", "Después de 2 horas de espera y se cancela el servicio. Se cobra 60% de la tarifa. Aplica a jornadas de 8 horas."],
      ["Carga Pesada (Carry)", "Para 4+ unidades o peso ≥90kg, es obligatorio cobrar auxiliar de carga o que el cliente garantice personal."],
      ["Seguro y Valor Declarado", "Carry y NHR: VD máximo por servicio $20.000.000. Cobertura aliado hasta $1.000.000.000."],
      ["Recaudo", "Las tarifas no incluyen recaudo. Ninguna negociación puede recaudar por encima del 270% de su facturación."],
      ["Devoluciones", "Toda devolución genera cobro por los kilómetros recorridos para retornar el paquete al origen."],
      ["Inhouse", "Costo adicional: $2.800.000. Escalar a líderes con: horario, funciones, lugar, cantidad de horas/semana."],
    ],
  },
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
  tarifasTada: {
    headers: ["Concepto", "Pago a Piloto", "Cobro a Cliente", "Fee"],
    rows: [
      ["Paquete", "$7.300", "$8.870", "18%"],
      ["Incentivo", "$1.300", "$1.580", "18%"],
      ["Paquete cancelado", "$7.000", "$8.505", "18%"],
      ["Tarea", "$5.000", "$6.075", "18%"],
      ["Garantizado L-J", "$70.000", "$85.050", "18%"],
      ["Garantizado V-D", "$80.000", "$97.200", "18%"],
    ],
    politicas: { headers: POL, rows: [
      ["Utilidad Corporativa", "Tarifas base calculadas con utilidad corporativa del 3%."],
      ["Fee", "El fee del 18% se aplica sobre el pago a piloto para obtener el cobro a cliente."],
      ["Garantizado", "L-J: Lunes a Jueves. V-D: Viernes a Domingo y festivos."],
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
  cobertura: {
    headers: coberturaHeaders, rows: coberturaRows,
    politicas: { headers: POL, rows: [
      ["Recargos zona", "Periferia, aledaños y lejanía generan recargo adicional según tabla de recargos."],
      ["Zonas rojas", "Zonas de no acceso — no se presta servicio en estas zonas por seguridad."],
      ["Doble vía", "Los recargos de zona se aplican en doble vía (ida y vuelta)."],
    ]},
  },
  onboarding: {
    headers: ["Tipo de Solicitud", "Solicitud Mínima Operaciones", "Tiempo Compromiso — Moto", "Tiempo Compromiso — Carro", "Tiempo Compromiso — Carry", "Cumplimiento (Ciudad Fácil)", "Cumplimiento (Ciudad Complicada)"],
    rows: [
      ["Planeada", "7 días calendario antes", "Cobertura en fecha solicitada", "Cobertura en fecha solicitada +1 día", "Cobertura en fecha solicitada +2 días", "95%", "85%"],
      ["Prioritaria", "72 horas antes", "Cobertura en máx. 72 horas", "Cobertura en máx. 96 horas", "Cobertura en máx. 120 horas", "90%", "75%"],
      ["Urgente", "24 horas antes", "Gestión inmediata según disponibilidad (objetivo 48h)", "Gestión inmediata según disponibilidad (objetivo 72h)", "Gestión inmediata según disponibilidad (objetivo 5 días)", "60%", "40%"],
      ["Emergencia crítica", "Menos de 24 horas", "Sin garantía total (mejor esfuerzo)", "Sin garantía total (mejor esfuerzo, prioridad baja)", "Sin garantía (lista de espera)", "30%", "15%"],
    ],
    politicas: { headers: POL, rows: [
      ["Planeada", "Es el tipo ideal de solicitud. Se recomienda planificar con 7 días de anticipación para garantizar cobertura total en la fecha solicitada."],
      ["Prioritaria", "Solicitar con mínimo 72 horas de anticipación. El tiempo de compromiso varía según tipo de vehículo y complejidad de la ciudad."],
      ["Urgente", "Se gestiona de forma inmediata según disponibilidad operativa. No se garantiza cobertura total. El objetivo de cumplimiento varía entre 40-60%."],
      ["Emergencia crítica", "Solicitudes con menos de 24 horas. Se atiende con mejor esfuerzo, sin garantía. Prioridad baja para vehículos de carga."],
      ["Ciudad fácil", "Bogotá, Medellín, Cali, Barranquilla — ciudades con mayor flota disponible y cobertura operativa."],
      ["Ciudad complicada", "Ciudades secundarias o con menor cobertura operativa. El cumplimiento esperado es menor."],
    ]},
  },
};

function DataTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-purple-600 text-white">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
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
                  className={`px-3 py-1.5 ${
                    ci === 0 ? "font-medium text-gray-800 max-w-[180px]" : "text-gray-600 whitespace-nowrap"
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

const f = (n) => `$${Math.round(n).toLocaleString("es-CO")}`;

// ── Helpers compartidos ──────────────────────────────────────────────────────

function CalcField({ label, value, onChange, prefix = "", suffix = "" }) {
  const [raw, setRaw] = useState(null);
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-gray-400">{prefix}</span>}
        <input
          type="text" inputMode="decimal"
          value={raw !== null ? raw : value}
          onFocus={(e) => { setRaw(String(value)); e.target.select(); }}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => {
            const clean = (raw || "").replace(/[^0-9.,\-]/g, "").replace(",", ".");
            const n = Number(clean);
            onChange(isNaN(n) || clean === "" ? 0 : n);
            setRaw(null);
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

function CalcResult({ label, value, color = "text-gray-800" }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

const fCalc = (n) => `$${Math.round(n).toLocaleString("es-CO")}`;
const fPct  = (n) => `${Number(n).toFixed(1)}%`;

// ── Proyección Tarifa Cliente ─────────────────────────────────────────────────

function ProyeccionTarifaCliente() {
  const [search,   setSearch]   = useState("");
  const [chStatus, setChStatus] = useState("idle"); // idle | loading | polling | done | error
  const [chData,   setChData]   = useState([]);
  const [chError,  setChError]  = useState("");
  const [selected, setSelected] = useState(null);
  const [calcMode, setCalcMode] = useState("tarifa");

  // Calculator fields — pre-llenados desde la tarifa seleccionada
  const [tarifaCliente, setTarifaCliente] = useState(0);
  const [utilCorp,      setUtilCorp]      = useState(3);
  const [utilPlat,      setUtilPlat]      = useState(15);
  const [kmBase,        setKmBase]        = useState(3);
  const [tarifaBase,    setTarifaBase]    = useState(0);
  const [kmRecorridos,  setKmRecorridos]  = useState(10);
  const [tarifaKmExtra, setTarifaKmExtra] = useState(0);
  const [paradasExtra,  setParadasExtra]  = useState(0);
  const [tarifaParada,  setTarifaParada]  = useState(0);
  const [paquetes,      setPaquetes]      = useState(1);
  const [tarifaHora,    setTarifaHora]    = useState(0);
  const [horas,         setHoras]         = useState(4);
  const [horasExtra,    setHorasExtra]    = useState(0);
  const [tarifaHoraExtra, setTarifaHoraExtra] = useState(0);
  const [utilCorpH,     setUtilCorpH]     = useState(3);

  // Carga datos de ClickHouse
  const handleCargar = useCallback(async () => {
    if (chStatus === "loading" || chStatus === "polling" || chStatus === "done") return;
    setChStatus("loading");
    setChError("");
    try {
      const res  = await fetch("/api/tarifas_clickhouse/consulta", { credentials: "same-origin" });
      const json = await res.json();
      if (json.status === "done") {
        setChData(json.data || []);
        setChStatus("done");
      } else if (json.status === "error") {
        setChError(json.error || "Error");
        setChStatus("error");
      } else {
        setChStatus("polling");
      }
    } catch (e) {
      setChError(e.message);
      setChStatus("error");
    }
  }, [chStatus]);

  useEffect(() => {
    if (chStatus !== "polling") return;
    const t = setInterval(async () => {
      try {
        const res  = await fetch("/api/tarifas_clickhouse/status", { credentials: "same-origin" });
        const json = await res.json();
        if (json.status === "done") {
          setChData(json.data || []);
          setChStatus("done");
        } else if (json.status === "error") {
          setChError(json.error || "Error");
          setChStatus("error");
        }
      } catch (e) {
        setChError(e.message);
        setChStatus("error");
      }
    }, 5000);
    return () => clearInterval(t);
  }, [chStatus]);

  // Pre-llenar campos al seleccionar una tarifa
  const handleSelect = useCallback((row) => {
    setSelected(row);
    const base  = Number(row.base_fare)           || 0;
    const dist  = Number(row.distance_fare)       || 0;
    const hora  = Number(row.hour_fare)           || 0;
    const stop  = Number(row.extra_stop_fare)     || 0;
    const comm  = Number(row.comission)           || 3;
    const util  = Number(row.utilidad_corporativa)|| 3;
    setTarifaCliente(base);
    setUtilCorp(comm);
    setUtilPlat(15);
    setTarifaBase(base);
    setTarifaKmExtra(dist);
    setTarifaParada(stop);
    setTarifaHora(hora);
    setTarifaHoraExtra(Math.round(hora * 1.25));
    setUtilCorpH(util || 3);
    setCalcMode("tarifa");
  }, []);

  // Filtrar resultados
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || chStatus !== "done") return [];
    return chData.filter(r =>
      String(r.name_company || "").toLowerCase().includes(q) ||
      String(r.id_company   || "").toLowerCase().includes(q)
    ).slice(0, 30);
  }, [search, chData, chStatus]);

  // Cálculos
  const utilCorpVal  = tarifaCliente * (utilCorp / 100);
  const pagoSinPlat  = tarifaCliente - utilCorpVal;
  const utilPlatVal  = pagoSinPlat   * (utilPlat / 100);
  const pagoPiloto   = pagoSinPlat   - utilPlatVal;
  const utilTotal    = utilCorpVal   + utilPlatVal;
  const kmExtraCount = Math.max(0, kmRecorridos - kmBase);
  const costoKmExtra = kmExtraCount  * tarifaKmExtra;
  const costoParadas = paradasExtra  * tarifaParada;
  const totalServicio= tarifaBase    + costoKmExtra + costoParadas;
  const costoPorPaq  = paquetes > 0  ? totalServicio / paquetes : 0;
  const costoBaseH   = tarifaHora    * horas;
  const costoExtraH  = horasExtra    * tarifaHoraExtra;
  const totalHoras   = costoBaseH    + costoExtraH;
  const utilCorpHVal = totalHoras    * (utilCorpH / 100);
  const cobroClienteH= totalHoras    + utilCorpHVal;

  const fmtM = (v) => { const n = Number(v); return n > 0 ? `$${Math.round(n).toLocaleString("es-CO")}` : "—"; };

  return (
    <div className="space-y-5">
      {/* Buscador */}
      <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); if (chStatus === "idle") handleCargar(); }}
              placeholder="Buscar empresa por nombre o ID de ClickHouse..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          {chStatus === "idle" && (
            <button onClick={handleCargar}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition">
              🔄 Cargar desde ClickHouse
            </button>
          )}
          {chStatus === "loading" && (
            <span className="flex items-center gap-1.5 text-xs text-purple-600 font-medium">
              <span className="animate-spin w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full inline-block" />
              Cargando...
            </span>
          )}
          {chStatus === "polling" && (
            <span className="flex items-center gap-1.5 text-xs text-purple-600 font-medium">
              <span className="animate-spin w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full inline-block" />
              Consultando ClickHouse...
            </span>
          )}
          {chStatus === "done" && (
            <span className="text-xs text-gray-400">{chData.length.toLocaleString()} tarifas disponibles</span>
          )}
          {chStatus === "error" && (
            <span className="text-xs text-red-600">❌ {chError}</span>
          )}
        </div>

        {/* Resultados de búsqueda */}
        {results.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-64">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-purple-600 text-white">
                <tr>
                  {["Empresa","Tipo Servicio","Ciudad","Estado","Tarifa Base","Distancia","Hora","Comisión","Util. Corp","KAM"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap text-[10px] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => {
                  const isSelected = selected?.tarifa_id === row.tarifa_id;
                  return (
                    <tr key={i} onClick={() => handleSelect(row)}
                      className={`border-t border-gray-100 cursor-pointer transition ${isSelected ? "bg-purple-100" : i % 2 === 0 ? "bg-white hover:bg-purple-50" : "bg-purple-50/30 hover:bg-purple-50"}`}>
                      <td className="px-3 py-1.5 font-medium text-gray-800 max-w-[160px] truncate">{row.name_company}</td>
                      <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{row.type_service}</td>
                      <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{row.ciudad}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.estado === "activo" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{row.estado}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-purple-700 font-semibold">{fmtM(row.base_fare)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{fmtM(row.distance_fare)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{fmtM(row.hour_fare)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{row.comission ? `${row.comission}%` : "—"}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{row.utilidad_corporativa ? `${row.utilidad_corporativa}%` : "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500 max-w-[120px] truncate">{row.name_kam}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {search.trim() && chStatus === "done" && results.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">Sin resultados para "{search}"</p>
        )}
      </div>

      {/* Tarjeta de la tarifa seleccionada + calculadora */}
      {selected && (
        <div className="space-y-4">
          {/* Info card */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-xl border border-purple-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-bold text-purple-900 text-base">{selected.name_company}</p>
                <p className="text-xs text-purple-600">{selected.name_business !== selected.name_company ? selected.name_business + " · " : ""}{selected.type_service} · {selected.ciudad}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${selected.estado === "activo" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{selected.estado}</span>
                {selected.tiene_credito?.includes("Tiene") && <span className="px-2 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700">Con crédito</span>}
                {selected.etiqueta && selected.etiqueta !== "No MercadoFlex" && <span className="px-2 py-1 rounded-lg text-xs font-bold bg-orange-100 text-orange-700">{selected.etiqueta}</span>}
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-xs">
              {[
                { l: "Tarifa Base",    v: fmtM(selected.base_fare) },
                { l: "Mínima",        v: fmtM(selected.minimum_fare) },
                { l: "Distancia/km",  v: fmtM(selected.distance_fare) },
                { l: "Hora",          v: fmtM(selected.hour_fare) },
                { l: "Parada Extra",  v: fmtM(selected.extra_stop_fare) },
                { l: "Paquete",       v: fmtM(selected.package_fare) },
                { l: "Comisión",      v: selected.comission ? `${selected.comission}%` : "—" },
                { l: "Util. Corp.",   v: selected.utilidad_corporativa ? `${selected.utilidad_corporativa}%` : "—" },
              ].map(({ l, v }) => (
                <div key={l} className="bg-white/70 rounded-lg p-2 text-center border border-purple-100">
                  <p className="text-gray-400 text-[9px] uppercase tracking-wide mb-0.5">{l}</p>
                  <p className="font-bold text-purple-800">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">KAM: {selected.name_kam} · Tarifa ID: <span className="font-mono">{selected.tarifa_id?.slice(0, 20)}…</span></p>
          </div>

          {/* Sub-modo calculadora */}
          <div className="flex gap-2 flex-wrap">
            {[
              { id: "tarifa", label: "💰 Utilidades por Tarifa" },
              { id: "ruta",   label: "🛣️ Costeo de Ruta (Km)" },
              { id: "horas",  label: "⏱️ Costeo por Horas" },
            ].map(m => (
              <button key={m.id} onClick={() => setCalcMode(m.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${calcMode === m.id ? "bg-purple-600 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-purple-50"}`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Calculadora: Utilidades por tarifa */}
          {calcMode === "tarifa" && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-bold text-purple-800 text-sm">Datos de entrada</h3>
                <CalcField label="Tarifa al Cliente" value={tarifaCliente} onChange={setTarifaCliente} prefix="$" />
                <CalcField label="Utilidad Corporativa" value={utilCorp} onChange={setUtilCorp} suffix="%" />
                <CalcField label="Utilidad Plataforma Pibox" value={utilPlat} onChange={setUtilPlat} suffix="%" />
              </div>
              <div className="bg-purple-50 rounded-xl p-5 border border-purple-200">
                <h3 className="font-bold text-purple-800 text-sm mb-3">Resultados</h3>
                <CalcResult label="Tarifa al Cliente"              value={fCalc(tarifaCliente)} color="text-purple-700" />
                <CalcResult label={`Utilidad Corporativa (${utilCorp}%)`} value={fCalc(utilCorpVal)} color="text-green-600" />
                <CalcResult label="Pago piloto antes de plataforma" value={fCalc(pagoSinPlat)} />
                <CalcResult label={`Utilidad Plataforma (${utilPlat}%)`} value={fCalc(utilPlatVal)} color="text-blue-600" />
                <CalcResult label="Pago al Piloto final"            value={fCalc(pagoPiloto)} color="text-orange-600" />
                <div className="mt-3 pt-3 border-t-2 border-purple-300">
                  <CalcResult label="Utilidad Total (Corp + Plat)"  value={fCalc(utilTotal)} color="text-green-700" />
                  <CalcResult label="% Utilidad sobre tarifa"        value={tarifaCliente > 0 ? fPct((utilTotal / tarifaCliente) * 100) : "—"} color="text-green-700" />
                </div>
              </div>
            </div>
          )}

          {/* Calculadora: Costeo de ruta */}
          {calcMode === "ruta" && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-bold text-purple-800 text-sm">Datos de la ruta</h3>
                <div className="grid grid-cols-2 gap-3">
                  <CalcField label="Km Base"         value={kmBase}        onChange={setKmBase} />
                  <CalcField label="Tarifa Base"      value={tarifaBase}    onChange={setTarifaBase}    prefix="$" />
                  <CalcField label="Km Recorridos"   value={kmRecorridos}  onChange={setKmRecorridos} />
                  <CalcField label="Tarifa Km Extra"  value={tarifaKmExtra} onChange={setTarifaKmExtra} prefix="$" />
                  <CalcField label="Paradas Extra"   value={paradasExtra}  onChange={setParadasExtra} />
                  <CalcField label="Tarifa Parada"    value={tarifaParada}  onChange={setTarifaParada}  prefix="$" />
                  <CalcField label="Paquetes en ruta" value={paquetes}      onChange={setPaquetes} />
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                <h3 className="font-bold text-blue-800 text-sm mb-3">Desglose del Servicio</h3>
                <CalcResult label="Costo Base" value={fCalc(tarifaBase)} />
                <CalcResult label={`Km Extra (${kmExtraCount} km × ${fCalc(tarifaKmExtra)})`} value={fCalc(costoKmExtra)} />
                <CalcResult label={`Paradas Extra (${paradasExtra} × ${fCalc(tarifaParada)})`} value={fCalc(costoParadas)} />
                <div className="mt-3 pt-3 border-t-2 border-blue-300">
                  <CalcResult label="Total Servicio"                value={fCalc(totalServicio)} color="text-blue-700" />
                  <CalcResult label={`Costo por Paquete (${paquetes} paq)`} value={fCalc(costoPorPaq)} color="text-purple-700" />
                </div>
              </div>
            </div>
          )}

          {/* Calculadora: Costeo por horas */}
          {calcMode === "horas" && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-bold text-purple-800 text-sm">Datos del bloque</h3>
                <div className="grid grid-cols-2 gap-3">
                  <CalcField label="Tarifa / Hora"     value={tarifaHora}      onChange={setTarifaHora}      prefix="$" />
                  <CalcField label="Horas contratadas" value={horas}           onChange={setHoras} />
                  <CalcField label="Horas extra"       value={horasExtra}      onChange={setHorasExtra} />
                  <CalcField label="Tarifa hora extra" value={tarifaHoraExtra} onChange={setTarifaHoraExtra} prefix="$" />
                  <CalcField label="Utilidad Corp."    value={utilCorpH}       onChange={setUtilCorpH}       suffix="%" />
                </div>
              </div>
              <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                <h3 className="font-bold text-green-800 text-sm mb-3">Desglose</h3>
                <CalcResult label={`Base (${horas}h × ${fCalc(tarifaHora)})`} value={fCalc(costoBaseH)} />
                {horasExtra > 0 && <CalcResult label={`Horas extra (${horasExtra}h × ${fCalc(tarifaHoraExtra)})`} value={fCalc(costoExtraH)} />}
                <CalcResult label="Subtotal" value={fCalc(totalHoras)} />
                <CalcResult label={`Utilidad Corp. (${utilCorpH}%)`} value={fCalc(utilCorpHVal)} color="text-green-600" />
                <div className="mt-3 pt-3 border-t-2 border-green-300">
                  <CalcResult label="Cobro al Cliente" value={fCalc(cobroClienteH)} color="text-green-700" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!selected && chStatus === "idle" && (
        <div className="bg-purple-50 rounded-xl border border-purple-100 p-8 text-center">
          <p className="text-sm text-purple-700 font-medium mb-1">Busca una empresa para pre-cargar sus tarifas</p>
          <p className="text-xs text-purple-400">Escribe en el buscador o haz clic en "Cargar desde ClickHouse"</p>
        </div>
      )}
    </div>
  );
}

function Calculadora() {
  const [mode, setMode] = useState("tarifa"); // tarifa | ruta | horas | proyeccion
  // Calculadora de tarifa
  const [tarifaCliente, setTarifaCliente] = useState(128000);
  const [utilCorp, setUtilCorp] = useState(15);
  const [utilPlat, setUtilPlat] = useState(15);
  // Calculadora de ruta (distancia)
  const [kmBase, setKmBase] = useState(3);
  const [tarifaBase, setTarifaBase] = useState(6650);
  const [kmRecorridos, setKmRecorridos] = useState(10);
  const [tarifaKmExtra, setTarifaKmExtra] = useState(1250);
  const [paradasExtra, setParadasExtra] = useState(2);
  const [tarifaParada, setTarifaParada] = useState(4500);
  const [paquetes, setPaquetes] = useState(3);
  // Calculadora horas
  const [tarifaHora, setTarifaHora] = useState(16400);
  const [horas, setHoras] = useState(4);
  const [horasExtra, setHorasExtra] = useState(0);
  const [tarifaHoraExtra, setTarifaHoraExtra] = useState(8200);
  const [utilCorpH, setUtilCorpH] = useState(3);

  // Cálculos tarifa
  const utilCorpVal = tarifaCliente * (utilCorp / 100);
  const pagoSinPlat = tarifaCliente - utilCorpVal;
  const utilPlatVal = pagoSinPlat * (utilPlat / 100);
  const pagoPiloto = pagoSinPlat - utilPlatVal;
  const utilTotal = utilCorpVal + utilPlatVal;

  // Cálculos ruta
  const kmExtraCount = Math.max(0, kmRecorridos - kmBase);
  const costoBase = tarifaBase;
  const costoKmExtra = kmExtraCount * tarifaKmExtra;
  const costoParadas = paradasExtra * tarifaParada;
  const totalServicio = costoBase + costoKmExtra + costoParadas;
  const costoPorPaquete = paquetes > 0 ? totalServicio / paquetes : 0;

  // Cálculos horas
  const costoBaseH = tarifaHora * horas;
  const costoExtraH = horasExtra * tarifaHoraExtra;
  const totalHoras = costoBaseH + costoExtraH;
  const utilCorpHVal = totalHoras * (utilCorpH / 100);
  const cobroClienteH = totalHoras + utilCorpHVal;

  return (
    <div className="space-y-5">
      {/* Mode selector */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "tarifa",     label: "💰 Utilidades por Tarifa" },
          { id: "ruta",       label: "🛣️ Costeo de Ruta (Km)" },
          { id: "horas",      label: "⏱️ Costeo por Horas" },
          { id: "proyeccion", label: "🎯 Proyección Tarifa Cliente" },
        ].map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              mode === m.id ? "bg-purple-600 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-purple-50"
            }`}>{m.label}</button>
        ))}
      </div>

      {mode === "tarifa" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-bold text-purple-800 text-sm">Datos de entrada</h3>
            <CalcField label="Tarifa al Cliente" value={tarifaCliente} onChange={setTarifaCliente} prefix="$" />
            <CalcField label="Utilidad Corporativa" value={utilCorp} onChange={setUtilCorp} suffix="%" />
            <CalcField label="Utilidad Plataforma Pibox" value={utilPlat} onChange={setUtilPlat} suffix="%" />
          </div>
          <div className="bg-purple-50 rounded-xl p-5 border border-purple-200">
            <h3 className="font-bold text-purple-800 text-sm mb-3">Resultados</h3>
            <CalcResult label="Tarifa al Cliente" value={f(tarifaCliente)} color="text-purple-700" />
            <CalcResult label={`Utilidad Corporativa (${utilCorp}%)`} value={f(utilCorpVal)} color="text-green-600" />
            <CalcResult label="Pago piloto antes de plataforma" value={f(pagoSinPlat)} />
            <CalcResult label={`Utilidad Plataforma (${utilPlat}%)`} value={f(utilPlatVal)} color="text-blue-600" />
            <CalcResult label="Pago al Piloto final" value={f(pagoPiloto)} color="text-orange-600" />
            <div className="mt-3 pt-3 border-t-2 border-purple-300">
              <CalcResult label="Utilidad Total (Corp + Plat)" value={f(utilTotal)} color="text-green-700" />
              <CalcResult label="% Utilidad sobre tarifa" value={`${((utilTotal / tarifaCliente) * 100).toFixed(1)}%`} color="text-green-700" />
            </div>
          </div>
        </div>
      )}

      {mode === "ruta" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-bold text-purple-800 text-sm">Datos de la ruta</h3>
            <div className="grid grid-cols-2 gap-3">
              <CalcField label="Km Base" value={kmBase} onChange={setKmBase} />
              <CalcField label="Tarifa Base" value={tarifaBase} onChange={setTarifaBase} prefix="$" />
              <CalcField label="Km Recorridos" value={kmRecorridos} onChange={setKmRecorridos} />
              <CalcField label="Tarifa Km Extra" value={tarifaKmExtra} onChange={setTarifaKmExtra} prefix="$" />
              <CalcField label="Paradas Extra" value={paradasExtra} onChange={setParadasExtra} />
              <CalcField label="Tarifa Parada" value={tarifaParada} onChange={setTarifaParada} prefix="$" />
              <CalcField label="Paquetes en ruta" value={paquetes} onChange={setPaquetes} />
            </div>
          </div>
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
            <h3 className="font-bold text-blue-800 text-sm mb-3">Desglose del Servicio</h3>
            <CalcResult label="Costo Base" value={f(costoBase)} />
            <CalcResult label={`Km Extra (${kmExtraCount} km × ${f(tarifaKmExtra)})`} value={f(costoKmExtra)} />
            <CalcResult label={`Paradas Extra (${paradasExtra} × ${f(tarifaParada)})`} value={f(costoParadas)} />
            <div className="mt-3 pt-3 border-t-2 border-blue-300">
              <CalcResult label="Total Servicio" value={f(totalServicio)} color="text-blue-700" />
              <CalcResult label={`Costo por Paquete (${paquetes} paq)`} value={f(costoPorPaquete)} color="text-purple-700" />
            </div>
          </div>
        </div>
      )}

      {mode === "proyeccion" && <ProyeccionTarifaCliente />}

      {mode === "horas" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-bold text-purple-800 text-sm">Datos del bloque</h3>
            <div className="grid grid-cols-2 gap-3">
              <CalcField label="Tarifa / Hora" value={tarifaHora} onChange={setTarifaHora} prefix="$" />
              <CalcField label="Horas contratadas" value={horas} onChange={setHoras} />
              <CalcField label="Horas extra" value={horasExtra} onChange={setHorasExtra} />
              <CalcField label="Tarifa hora extra" value={tarifaHoraExtra} onChange={setTarifaHoraExtra} prefix="$" />
              <CalcField label="Utilidad Corporativa" value={utilCorpH} onChange={setUtilCorpH} suffix="%" />
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-5 border border-green-200">
            <h3 className="font-bold text-green-800 text-sm mb-3">Desglose</h3>
            <CalcResult label={`Base (${horas}h × ${f(tarifaHora)})`} value={f(costoBaseH)} />
            {horasExtra > 0 && <CalcResult label={`Horas extra (${horasExtra}h × ${f(tarifaHoraExtra)})`} value={f(costoExtraH)} />}
            <CalcResult label="Subtotal" value={f(totalHoras)} />
            <CalcResult label={`Utilidad Corp. (${utilCorpH}%)`} value={f(utilCorpHVal)} color="text-green-600" />
            <div className="mt-3 pt-3 border-t-2 border-green-300">
              <CalcResult label="Cobro al Cliente" value={f(cobroClienteH)} color="text-green-700" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SK_TARIFARIO = "pibox_tarifario_interno";

function mergeWithDefaults(saved) {
  if (!saved) return JSON.parse(JSON.stringify(TABLE_DATA));
  return { ...JSON.parse(JSON.stringify(TABLE_DATA)), ...saved };
}

function loadDataLocal() {
  try {
    const s = localStorage.getItem(SK_TARIFARIO);
    if (s) return mergeWithDefaults(JSON.parse(s));
  } catch {}
  return JSON.parse(JSON.stringify(TABLE_DATA));
}

function EditableTable({ headers, rows, onChange }) {
  const updateCell = (ri, ci, val) => {
    const next = rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r);
    onChange(next);
  };
  const addRow = () => onChange([...rows, headers.map(() => "")]);
  const delRow = (ri) => onChange(rows.filter((_, i) => i !== ri));

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-purple-600 text-white">
              {headers.map((h, i) => (
                <th key={i} className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={`border-t border-gray-100 ${ri % 2 === 0 ? "bg-white" : "bg-purple-50/40"}`}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-1 py-1">
                    <input value={cell} onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 min-w-[80px]" />
                  </td>
                ))}
                <td className="px-1 py-1">
                  <button onClick={() => delRow(ri)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addRow} className="mt-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200">+ Agregar fila</button>
    </div>
  );
}

/* ── Incremento Anual ─────────────────────────────────────────────────────── */
const SK_INCREMENTO_LOG = "pibox_tarifario_incremento_log";
const TABS_CON_TARIFAS = ["distancia","horas","paquetes","tarifasTada","recargos","manifiesto","storage","seguros","rent"];

function parsePesoVal(s) {
  if (typeof s !== "string") return null;
  const m = s.match(/^\$?\s*([\d.,]+)/);
  if (!m) return null;
  return Number(m[1].replace(/\./g, "").replace(",", "."));
}
function formatPesoVal(n) {
  return "$" + Math.round(n).toLocaleString("es-CO");
}
function applyPctToCell(cell, pct) {
  const n = parsePesoVal(cell);
  if (n === null || n === 0) return cell;
  return formatPesoVal(n * (1 + pct / 100));
}
function applyPctToData(data, pct) {
  const next = JSON.parse(JSON.stringify(data));
  for (const key of TABS_CON_TARIFAS) {
    if (!next[key]) continue;
    if (next[key].rows) next[key].rows = next[key].rows.map(row => row.map(c => applyPctToCell(c, pct)));
    if (next[key].extra?.rows) next[key].extra.rows = next[key].extra.rows.map(row => row.map(c => applyPctToCell(c, pct)));
  }
  return next;
}

function loadIncrementoLog() {
  try { return JSON.parse(localStorage.getItem(SK_INCREMENTO_LOG) || "[]"); } catch { return []; }
}

function IncrementoAnual({ data, onApply, isAdmin }) {
  const [pct, setPct] = useState(0);
  const [previewTab, setPreviewTab] = useState("distancia");
  const log = useMemo(loadIncrementoLog, []);

  const preview = useMemo(() => {
    if (pct <= 0) return null;
    return applyPctToData(data, pct);
  }, [data, pct]);

  const handleApply = () => {
    if (pct <= 0) return;
    if (!confirm(`¿Aplicar incremento del ${pct}% a TODAS las tarifas? Esta acción no se puede deshacer.`)) return;
    // Guardar snapshot actual en el log
    const entry = {
      fecha: new Date().toISOString(),
      pct,
      label: `Incremento ${pct}% — ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long" })}`,
      snapshot: {},
    };
    for (const key of TABS_CON_TARIFAS) {
      if (data[key]?.rows) entry.snapshot[key] = { headers: data[key].headers, rows: data[key].rows };
    }
    const updatedLog = [entry, ...log];
    localStorage.setItem(SK_INCREMENTO_LOG, JSON.stringify(updatedLog));
    // Aplicar incremento
    const newData = applyPctToData(data, pct);
    onApply(newData);
    setPct(0);
  };

  const previewData = preview?.[previewTab];

  return (
    <div className="space-y-6">
      {/* Configurar incremento */}
      <div className="bg-white rounded-2xl shadow-md border border-purple-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Aplicar Incremento Anual a Todas las Tarifas</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">% Incremento</label>
            <input type="number" min="0" max="100" step="0.5" value={pct}
              onChange={e => setPct(Number(e.target.value) || 0)}
              className="w-24 border border-purple-300 rounded-lg px-3 py-2 text-sm font-bold text-purple-800 text-center focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          {pct > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-xs text-purple-700">
              Multiplicador: <b>×{(1 + pct / 100).toFixed(4)}</b> — Todas las tarifas monetarias se incrementarán en {pct}%
            </div>
          )}
          {isAdmin && pct > 0 && (
            <button onClick={handleApply}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition shadow">
              Aplicar incremento del {pct}%
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Vista previa con +{pct}%</h3>
          <div className="flex gap-1 overflow-x-auto mb-4 border-b border-gray-200">
            {TABS_CON_TARIFAS.filter(k => data[k]?.rows).map(k => (
              <button key={k} onClick={() => setPreviewTab(k)}
                className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-t-lg transition ${
                  previewTab === k ? "border-b-2 border-purple-600 text-purple-600 bg-purple-50" : "text-gray-400 hover:text-gray-600"
                }`}>{k}</button>
            ))}
          </div>
          {previewData?.rows && (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    {previewData.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.map((row, ri) => {
                    const origRow = data[previewTab]?.rows?.[ri];
                    return (
                      <tr key={ri} className={`border-t border-gray-100 ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                        {row.map((cell, ci) => {
                          const changed = origRow && origRow[ci] !== cell;
                          return (
                            <td key={ci} className={`px-3 py-1.5 whitespace-nowrap ${changed ? "text-purple-700 font-semibold bg-purple-50/60" : "text-gray-600"}`}>
                              {changed ? (
                                <span>{cell} <span className="text-[9px] text-gray-400 line-through ml-1">{origRow[ci]}</span></span>
                              ) : cell}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Historial de Incrementos</h3>
        {log.length === 0 ? (
          <p className="text-xs text-gray-400">No hay incrementos registrados.</p>
        ) : (
          <div className="space-y-3">
            {log.map((entry, idx) => (
              <HistorialEntry key={idx} entry={entry} defaultOpen={idx === 0} isAdmin={isAdmin} onRevert={() => {
                if (!confirm(`¿Reversar a las tarifas anteriores al "${entry.label}"? Las tarifas actuales se reemplazarán.`)) return;
                const reverted = JSON.parse(JSON.stringify(data));
                for (const [key, snap] of Object.entries(entry.snapshot)) {
                  if (reverted[key]) {
                    reverted[key].headers = snap.headers;
                    reverted[key].rows = snap.rows;
                  }
                }
                onApply(reverted);
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistorialEntry({ entry, defaultOpen, isAdmin, onRevert }) {
  const [open, setOpen] = useState(defaultOpen);
  const [viewTab, setViewTab] = useState(Object.keys(entry.snapshot || {})[0] || "distancia");
  const snap = entry.snapshot?.[viewTab];
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left">
        <div>
          <p className="text-xs font-bold text-gray-700">{entry.label}</p>
          <p className="text-[10px] text-gray-400">{new Date(entry.fecha).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">+{entry.pct}%</span>
          <span className={`text-gray-400 text-xs transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>
      {open && snap && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-400">Tarifas ANTES de aplicar el incremento:</p>
            {isAdmin && (
              <button onClick={onRevert}
                className="px-3 py-1 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-[10px] font-semibold hover:bg-orange-100 transition">
                Reversar a estas tarifas
              </button>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto mb-3 border-b border-gray-100">
            {Object.keys(entry.snapshot).map(k => (
              <button key={k} onClick={() => setViewTab(k)}
                className={`px-2 py-1 text-[10px] font-medium whitespace-nowrap rounded-t ${
                  viewTab === k ? "border-b border-purple-500 text-purple-600" : "text-gray-400"
                }`}>{k}</button>
            ))}
          </div>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="bg-gray-100">
                  {snap.headers.map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snap.rows.map((row, ri) => (
                  <tr key={ri} className={`border-t border-gray-50 ${ri % 2 ? "bg-gray-50/30" : ""}`}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1 text-gray-500 whitespace-nowrap">{cell}</td>
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

export default function TarifarioInterno({ currentUser }) {
  const isAdmin = currentUser?.rol === "Administrativo";
  const [tab, setTab] = useState("politicasGenerales");
  const [data, setData] = useState(loadDataLocal);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  // Cargar desde el servidor al montar — sobreescribe el localStorage
  useEffect(() => {
    fetch("/api/tarifario_spa", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data && Object.keys(json.data).length > 0) {
          const merged = mergeWithDefaults(json.data);
          setData(merged);
          localStorage.setItem(SK_TARIFARIO, JSON.stringify(json.data));
        }
      })
      .catch(() => {});
  }, []);

  const current = data[tab];

  const updateRows = (key, rows) => {
    setData((prev) => ({ ...prev, [key]: { ...prev[key], rows } }));
  };
  const updateExtraRows = (key, rows) => {
    setData((prev) => ({ ...prev, [key]: { ...prev[key], extra: { ...prev[key].extra, rows } } }));
  };
  const updatePoliticaRows = (key, rows) => {
    setData((prev) => ({ ...prev, [key]: { ...prev[key], politicas: { ...prev[key].politicas, rows } } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/tarifario_spa", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (res.ok) {
        localStorage.setItem(SK_TARIFARIO, JSON.stringify(data));
        setEditing(false);
        setToast("✅ Tarifario guardado en el servidor");
      } else {
        setToast("❌ Error al guardar. Intenta de nuevo.");
      }
    } catch {
      setToast("❌ Sin conexión. Guardado solo localmente.");
      localStorage.setItem(SK_TARIFARIO, JSON.stringify(data));
    }
    setSaving(false);
    setTimeout(() => setToast(""), 3000);
  };

  const handleReset = async () => {
    if (!confirm("¿Restaurar tarifario por defecto? Se perderán los cambios.")) return;
    const defaultData = JSON.parse(JSON.stringify(TABLE_DATA));
    setSaving(true);
    try {
      await fetch("/api/tarifario_spa", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: defaultData }),
      });
    } catch {}
    setSaving(false);
    localStorage.removeItem(SK_TARIFARIO);
    setData(defaultData);
    setEditing(false);
    setToast("🔄 Tarifario restaurado");
    setTimeout(() => setToast(""), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Tarifario Pibox</h2>
          <p className="text-sm text-gray-500 mt-1">
            Tarifario interno de negociaci&oacute;n. Utilidad corporativa base: 3%
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60">{saving ? "Guardando…" : "💾 Guardar"}</button>
                <button onClick={() => { setData(loadData()); setEditing(false); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300">Cancelar</button>
                <button onClick={handleReset} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-200">🔄 Restaurar</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">✏️ Editar tarifario</button>
            )}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className={`rounded-lg p-3 flex items-start gap-2 ${editing ? "bg-amber-50 border border-amber-200" : "bg-purple-50 border border-purple-200"}`}>
        <span className="text-sm mt-0.5">{editing ? "✏️" : "ℹ️"}</span>
        <p className={`text-xs ${editing ? "text-amber-700" : "text-purple-700"}`}>
          {editing
            ? "Modo edición activo — modifica las celdas directamente. Haz clic en Guardar cuando termines."
            : "Estas tarifas son la base de negociación. Para tarifas especiales consultar con el líder comercial."}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-1 -mb-px min-w-max">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg ${
                tab === t.id ? "border-b-2 border-purple-600 text-purple-600 bg-purple-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}>{t.label}</button>
          ))}
        </nav>
      </div>

      {/* Contenido */}
      {tab === "calculadora" ? (
        <Calculadora />
      ) : tab === "incremento" ? (
        <IncrementoTarifas isAdmin={isAdmin} />
      ) : tab === "incrementoAnual" ? (
        <IncrementoAnual data={data} isAdmin={isAdmin} onApply={(newData) => {
          setData(newData);
          fetch("/api/tarifario_spa", {
            method: "PUT", credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: newData }),
          }).catch(() => {});
          localStorage.setItem(SK_TARIFARIO, JSON.stringify(newData));
          setToast("✅ Incremento aplicado y guardado");
          setTimeout(() => setToast(""), 4000);
        }} />
      ) : tab === "tada" ? (
        <InformeTada isAdmin={isAdmin} />
      ) : (
        <>
          {editing && isAdmin ? (
            <EditableTable headers={current.headers} rows={current.rows} onChange={(rows) => updateRows(tab, rows)} />
          ) : (
            <DataTable headers={current.headers} rows={current.rows} />
          )}

          {current.extra && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-700 mb-2">{current.extra.title}</h3>
              {editing && isAdmin ? (
                <EditableTable headers={current.extra.headers} rows={current.extra.rows} onChange={(rows) => updateExtraRows(tab, rows)} />
              ) : (
                <DataTable headers={current.extra.headers} rows={current.extra.rows} />
              )}
            </div>
          )}
        </>
      )}

      {/* Políticas */}
      {current && current.politicas && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
            <span className="bg-purple-100 rounded-lg px-2 py-0.5">📋</span> Políticas Comerciales y Operativas
          </h3>
          {editing && isAdmin ? (
            <EditableTable headers={current.politicas.headers} rows={current.politicas.rows} onChange={(rows) => updatePoliticaRows(tab, rows)} />
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}
