export const TARIFAS_DEFAULT = {
  onDemand: {
    ciudades: [
      { ciudad: "Bogotá", vehiculo: "Motocicleta", kmBase: 3, tarifaKmBase: 9800, tarifaKmExtra: 1200, paradaAdicional: 2500, vdRuta: 5000000 },
      { ciudad: "Medellín", vehiculo: "Motocicleta", kmBase: 10, tarifaKmBase: 9800, tarifaKmExtra: 1200, paradaAdicional: 2500, vdRuta: 5000000 },
      { ciudad: "Cali", vehiculo: "Motocicleta", kmBase: 10, tarifaKmBase: 9800, tarifaKmExtra: 1200, paradaAdicional: 2500, vdRuta: 5000000 },
    ],
    adicionales: [
      { ciudad: "Nacional", vehiculo: "Moto", tiempoEspera: "5 minutos", tarifaMinuto: 350, bonificacion: 2000, recargo: 3500, aledanos: "N.A", lejania: "N.A" },
    ],
  },
  programadoBloqueHoras: {
    reservas: [
      { ciudad: "Bogotá", pilotos: 3, horasDia: 4, tarifaHora: 15500, cobertura: "8Km", vdRuta: 5000000, recaudoRuta: 1500000 },
    ],
    adicionales: {
      recaudoIdaVuelta: 5,
      paradaEnFalso: 0,
      recargo: 0,
      aledanos: "N.A",
      lejania: "N.A",
      indumentaria: "",
    },
  },
  programadoRutas: {
    rutas: [
      { ciudad: "Bogotá", paquetesPorRuta: 10, paquetesDia: 50, tarifaPaquete: 8500, vdRuta: 5000000, recaudoRuta: 1500000 },
    ],
    adicionales: {
      recaudoIdaVuelta: 5,
      medioRecaudo: "Datáfono / Efectivo",
      intentosEntrega: 1,
      tarifaDevoluciones: 8500,
      recargoPeriferia: 0,
      aledanos: "N.A",
      lejania: "N.A",
    },
  },
  picarga: {
    // ── Tarifas por distancia (Km) ─────────────────────
    ciudades: [
      { ciudad: "Bogotá",   vehiculo: "Carry", kmBase: 10, tarifaKmBase: 65000, tarifaKmExtra: 4500, paradaAdicional: 15000, vdRuta: 5000000 },
      { ciudad: "Medellín", vehiculo: "Carry", kmBase: 10, tarifaKmBase: 65000, tarifaKmExtra: 4500, paradaAdicional: 15000, vdRuta: 5000000 },
    ],
    // ── Bloque de Horas ────────────────────────────────
    reservas: [
      { ciudad: "Bogotá", vehiculo: "Carry", vehiculos: 1, horasDia: 8, tarifaHora: 65000, cobertura: "Ciudad", vdRuta: 5000000, recaudoRuta: 1500000 },
    ],
    // ── Tarifas adicionales distancia ─────────────────
    adicionales: [
      { ciudad: "Nacional", vehiculo: "Carry, NHR", tiempoEspera: "5 minutos", tarifaMinuto: 1500, bonificacion: 5000,
        periferia: "N.A", aledanos: "N.A", lejania: "N.A",
        tarifaAuxiliar: "N.A", horaExtraAuxiliar: "N.A" },
    ],
    // ── Tarifas adicionales bloque de horas ───────────
    adicionalesBH: {
      recaudoIdaVuelta: 5,
      paradaEnFalso: 0,
      tarifaAuxiliar: "N.A",
      horaExtraAuxiliar: "N.A",
    },
  },
  entregasOptimizadas: {
    rutas: [
      { ciudad: "Bogotá", paquetesPorRuta: 10, paquetesDia: 50, tarifaPaquete: 8500, vdRuta: 5000000, recaudoRuta: 1500000 },
    ],
    adicionales: {
      recaudoIdaVuelta: 5,
      medioRecaudo: "Datáfono / Efectivo",
      intentosEntrega: 1,
      tarifaDevoluciones: 8500,
      recargoPeriferia: 0,
      aledanos: "N.A",
      lejania: "N.A",
    },
  },
  storage: {
    // ── Tabla de Almacenamiento ────────────────────────
    almacenamiento: [
      {
        ciudad: "Bogotá",
        item: "Estante / Estiba",
        capacidadUnitaria: "1 m * 1,20 m * 1,20 m Altura 2 m",
        pesoMaximo: "1000 kg",
        negociacion: "3 Estantes",
        tarifa: "N.A",
      },
    ],
    // ── Tabla de Alistamientos ─────────────────────────
    alistamientos: [
      {
        tipo: "Simple",
        descripcion: "Especificar el proceso o los pasos",
        rangos: [
          { rango: "1 - 100",   tarifa: "N.A" },
          { rango: "101 - 250", tarifa: "N.A" },
          { rango: "251 - 500", tarifa: "N.A" },
          { rango: "> 500",     tarifa: "N.A" },
        ],
      },
    ],
    // ── Términos de negociación ────────────────────────
    terminos: [
      "Si se requiere ampliar la ocupación es preciso comunicar con cinco días hábiles de anticipación con el fin de validar el espacio disponible.",
      "La liquidación de alistamientos se harán de acuerdo a la tabla mensualmente descrita en la propuesta.",
      "El material de alistamiento y empaque lo deberá proveer el cliente y el espacio que ocupe el mismo se tendrá en cuenta dentro de los costos de almacenamiento.",
      "La disponibilidad de la bodega está sujeta a la fecha de inicio de operación.",
      "Las tarifas descritas, no incluyen el IVA.",
      "Para el retiro total del inventario se deberá estar a paz y salvo por todo concepto.",
    ],
    // ── Seguro (compartido con tab Seguro) ────────────
    seguro: [
      { unidad: "Pibox", montoDesde: 0,       montoHasta: 1000000, costoSeguro: "Incluido ($300)" },
      { unidad: "Pibox", montoDesde: 1000001, montoHasta: 2000000, costoSeguro: "0,03%" },
      { unidad: "Pibox", montoDesde: 2000001, montoHasta: 5000000, costoSeguro: "0,02%" },
    ],
  },
};

export const MODULOS_CONFIG = [
  { id: "onDemand",              label: "⚡ Pibox On Demand",                  emoji: "⚡", desc: "Asignación en tiempo real con IA georreferenciada" },
  { id: "programadoBloqueHoras", label: "🛵 Pibox Programado — Bloque de Horas", emoji: "🛵", desc: "Drivers fidelizados en bloques mínimos de 4 horas" },
  { id: "programadoRutas",       label: "🔁 Pibox Programado — Rutas",          emoji: "🔁", desc: "Rutas optimizadas con mínimo 10 entregas agrupables" },
  { id: "entregasOptimizadas",   label: "🚀 Entregas Optimizadas",              emoji: "🚀", desc: "Rutas optimizadas con entregas agrupadas por paquete" },
  { id: "picarga",               label: "🚚 Picarga",                           emoji: "🚚", desc: "Vehículos Carry y NHR para carga pesada" },
  { id: "storage",               label: "📦 Pibox Storage",                     emoji: "📦", desc: "Warehouses estratégicos: almacenamiento y cross-docking" },
  { id: "adnTecnologico",        label: "🔬 ADN Tecnológico PIBOX",             emoji: "🔬", desc: "Registro corporativo, configuraciones y funcionalidades web" },
  { id: "terminosCondiciones",   label: "📋 Términos y Condiciones",            emoji: "📋", desc: "Forma de pago, facturación, vigencia y aceptación de oferta" },
  { id: "cobertura",             label: "📍 Cobertura Pibox",                   emoji: "📍", desc: "Tabla de cobertura por ciudad, zonas y restricciones" },
];

export const COBERTURA = [
  { ciudad: "Bogotá",      origen: "Bogotá",                                   metropolitana: "Soacha, Funza, Madrid, Mosquera, Cota, Chía, La Calera", periferia: "Facatativá, Cajicá",          aledanos: "Sopó, Sibaté, Zipaquirá, Tabio, Tenjo",            zonasRojas: "Quiba, Mochuelo Bajo, Usme Pueblo, Arborizadora Alta, El Codito" },
  { ciudad: "Cali",        origen: "Cali",                                     metropolitana: "Palmira, Yumbo, Jamundí, Dapa",                          periferia: "La Nubia",                    aledanos: "Villa Gorgona, Potreritos, Candelaria",             zonasRojas: "Siloe, Polvorines, Marroquin 1 y 2, Agua Blanca, Petecuy 1, 2 y 3" },
  { ciudad: "Medellín",    origen: "Medellín, Envigado, Itagüí, Bello, Sabaneta", metropolitana: "Barbosa, Caldas, Girardota, Copacabana, La Estrella", periferia: "Rionegro, Llano Grande, Santa Elena", aledanos: "La Unión, Guarne, Marinilla, La Ceja",      zonasRojas: "Manrique La Cruz alta, Santo Domingo, Las Comunas altas" },
  { ciudad: "Barranquilla",origen: "Barranquilla",                             metropolitana: "Soledad, Palermo, San Isidro",                           periferia: "Puerto Colombia, Galapa",      aledanos: "Sabana Grande, Baranoa",                            zonasRojas: "Rebolo, La Luz, La Chinita, El Bosque, Las Malvinas" },
  { ciudad: "Bucaramanga", origen: "Bucaramanga",                              metropolitana: "Floridablanca, Girón",                                   periferia: "Piedecuesta",                  aledanos: "",                                                  zonasRojas: "" },
  { ciudad: "Armenia",     origen: "Armenia",                                  metropolitana: "Circasia, Calarcá",                                      periferia: "",                             aledanos: "",                                                  zonasRojas: "" },
];
