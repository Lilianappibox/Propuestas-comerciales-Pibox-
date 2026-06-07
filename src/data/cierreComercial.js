// Estructura de datos del tablero de cierre comercial - editable mes a mes

export const mesesDisponibles = ["Enero 2025", "Febrero 2025"];

export const dataInicial = {
  mes: "Enero 2025",
  periodo: "Enero",
  anio: 2025,

  // ─── CUMPLIMIENTO EQUIPO ──────────────────────────────────────────────────
  cumplimientoEquipo: {
    meta: 1550000000,
    gmv: 1301423276,
    utilidadBruta: 195213491, // 15% aprox
    mesPasadoMeta: 2248000000,
    mesPasadoGmv: 1683790653,
    anioPasadoMeta: 1345000000,
    anioPasadoGmv: 1227626481,
  },

  // ─── KAMs ─────────────────────────────────────────────────────────────────
  kams: [
    {
      nombre: "Johana Navarrete",
      meta: 512717231,
      gmv: 389412405,
      cumplimiento: 75.95,
      okr: 115.14,
      crecimientoVsMes: -276096112,
      crecimientoVsMesPct: -41.49,
      crecimientoVsAnio: -815686,
      crecimientoVsAnioPct: 0.21,
    },
    {
      nombre: "Juliana Rojas",
      meta: 209021657,
      gmv: 169474810,
      cumplimiento: 81.08,
      okr: 91,
      crecimientoVsMes: 145466457,
      crecimientoVsMesPct: 14.8,
      crecimientoVsAnio: 60000000,
      crecimientoVsAnioPct: 0,
    },
    {
      nombre: "Natalia Olivera",
      meta: 398261112,
      gmv: 387257597,
      cumplimiento: 97.24,
      okr: 116.7,
      crecimientoVsMes: 0,
      crecimientoVsMesPct: 0,
      crecimientoVsAnio: 0,
      crecimientoVsAnioPct: 0,
    },
    {
      nombre: "Bavaria",
      meta: 350000000,
      gmv: 297222814,
      cumplimiento: 84.92,
      okr: 0,
      crecimientoVsMes: 0,
      crecimientoVsMesPct: 0,
      crecimientoVsAnio: 0,
      crecimientoVsAnioPct: 0,
    },
    {
      nombre: "Keeping Deal",
      meta: 80000000,
      gmv: 58069650,
      cumplimiento: 72.59,
      okr: 0,
      crecimientoVsMes: 0,
      crecimientoVsMesPct: 0,
      crecimientoVsAnio: 0,
      crecimientoVsAnioPct: 0,
    },
  ],

  // ─── TOP 10 CLIENTES ──────────────────────────────────────────────────────
  top10Clientes: [
    { cliente: "Bavaria", kam: "Bavaria", gmvActual: 292641554, gmvAnterior: 380644090, crecimiento: -30.07, participacion: 22.49 },
    { cliente: "Cruz Verde", kam: "Natalia Olivera", gmvActual: 257296512, gmvAnterior: 281795101, crecimiento: -8.69, participacion: 19.77 },
    { cliente: "Dislicores", kam: "Johana Navarrete", gmvActual: 89312800, gmvAnterior: 319136677, crecimiento: -257.32, participacion: 6.86 },
    { cliente: "Drogueria Cutis", kam: "Johana Navarrete", gmvActual: 72900833, gmvAnterior: 76432902, crecimiento: -4.85, participacion: 5.60 },
    { cliente: "Mundimotos", kam: "Juliana Rojas", gmvActual: 59512950, gmvAnterior: 52165125, crecimiento: 12.35, participacion: 4.57 },
    { cliente: "FUXION", kam: "Natalia Olivera", gmvActual: 56017350, gmvAnterior: 48861500, crecimiento: 12.77, participacion: 4.30 },
    { cliente: "Calypso", kam: "Juliana Rojas", gmvActual: 43953000, gmvAnterior: 52347100, crecimiento: -19.1, participacion: 3.38 },
    { cliente: "HORTIFRUT", kam: "Johana Navarrete", gmvActual: 37915800, gmvAnterior: 37451600, crecimiento: 1.22, participacion: 2.91 },
    { cliente: "AGILEX EXPRESS SAS", kam: "Johana Navarrete", gmvActual: 28143600, gmvAnterior: 30966450, crecimiento: -10.03, participacion: 2.16 },
    { cliente: "Colanta", kam: "Juliana Rojas", gmvActual: 28118100, gmvAnterior: 26517400, crecimiento: 5.69, participacion: 2.16 },
    { cliente: "BUILDER FLEX", kam: "Juliana Rojas", gmvActual: 26176600, gmvAnterior: 31531600, crecimiento: -20.46, participacion: 2.01 },
    { cliente: "La Fresita", kam: "Natalia Olivera", gmvActual: 17954000, gmvAnterior: 16319800, crecimiento: 9.1, participacion: 1.38 },
  ],

  // ─── FACTURACIÓN POR LÍNEA ────────────────────────────────────────────────
  facturacionLinea: [
    { linea: "Bavaria",    gmv: 320000000, servicios: 890,  paquetes: 14200, gmvAnt: 298000000, serviciosAnt: 820,  paquetesAnt: 13100 },
    { linea: "Carga",      gmv: 460000000, servicios: 1250, paquetes: 3800,  gmvAnt: 430000000, serviciosAnt: 1180, paquetesAnt: 3500 },
    { linea: "Horas",      gmv: 185000000, servicios: 620,  paquetes: 0,     gmvAnt: 172000000, serviciosAnt: 580,  paquetesAnt: 0 },
    { linea: "On Demand",  gmv: 125000000, servicios: 4800, paquetes: 5200,  gmvAnt: 138000000, serviciosAnt: 5100, paquetesAnt: 5600 },
    { linea: "Paquetería", gmv: 98000000,  servicios: 2400, paquetes: 18500, gmvAnt: 85000000,  serviciosAnt: 2100, paquetesAnt: 16200 },
    { linea: "Rent",       gmv: 72000000,  servicios: 320,  paquetes: 0,     gmvAnt: 68000000,  serviciosAnt: 290,  paquetesAnt: 0 },
    { linea: "Storage",    gmv: 41423276,  servicios: 95,   paquetes: 1200,  gmvAnt: 38500000,  serviciosAnt: 88,   paquetesAnt: 1050 },
  ],

  // ─── CLIENTES NUEVOS ──────────────────────────────────────────────────────
  clientesNuevos: [
    { kam: "Johana Navarrete", cliente: "Be jappy SAS", gmv: 19700, servicios: 2 },
    { kam: "Johana Navarrete", cliente: "Big Medical SAS", gmv: 159500, servicios: 6 },
    { kam: "Johana Navarrete", cliente: "Publimpresos Sas", gmv: 186300, servicios: 18 },
    { kam: "Johana Navarrete", cliente: "RETTERLAB SAS", gmv: 148450, servicios: 7 },
    { kam: "Juliana Rojas", cliente: "Bon-Bonite", gmv: 142200, servicios: 15 },
    { kam: "Juliana Rojas", cliente: "ENVÍOS CLP", gmv: 10200, servicios: 4 },
    { kam: "Juliana Rojas", cliente: "ESTRATEGO IPS SAS", gmv: 525700, servicios: 29 },
    { kam: "Juliana Rojas", cliente: "Hell of the north store", gmv: 1392000, servicios: 12 },
    { kam: "Juliana Rojas", cliente: "KOREA DIESEL", gmv: 105000, servicios: 5 },
    { kam: "Juliana Rojas", cliente: "PURIFICACION Y ANALISIS DE FLUIDOS", gmv: 17500, servicios: 2 },
    { kam: "Juliana Rojas", cliente: "SOT CHOCOLATE", gmv: 31200, servicios: 2 },
    { kam: "Juliana Rojas", cliente: "Tienda Almar", gmv: 32700, servicios: 2 },
    { kam: "Natalia Olivera", cliente: "Stärken Vegano S.A.S. BIC", gmv: 29600, servicios: 1 },
  ],

  // ─── CLIENTES PERDIDOS ────────────────────────────────────────────────────
  clientesPerdidos: [
    { kam: "Johana Navarrete", cliente: "Coordinadora", gmvMesAnterior: 22406800 },
    { kam: "Johana Navarrete", cliente: "Elixir by la maga", gmvMesAnterior: 1233900 },
    { kam: "Johana Navarrete", cliente: "FRISBY CARGA", gmvMesAnterior: 868000 },
    { kam: "Johana Navarrete", cliente: "KIGGU SAS", gmvMesAnterior: 400100 },
    { kam: "Juliana Rojas", cliente: "FIOTTI", gmvMesAnterior: 9384000 },
    { kam: "Juliana Rojas", cliente: "grupo empresarial Giraldo", gmvMesAnterior: 4777750 },
    { kam: "Juliana Rojas", cliente: "Commerk Sas", gmvMesAnterior: 894000 },
    { kam: "Natalia Olivera", cliente: "Partes y suministros Oriental de repuestos", gmvMesAnterior: 530400 },
    { kam: "Pibox", cliente: "GRUPO DE INVERSIONES COLOMBIANO SAS", gmvMesAnterior: 754200 },
  ],

  // ─── FACTURACIÓN POR CIUDAD ───────────────────────────────────────────────
  facturacionCiudad: [
    { ciudad: "Bogotá", lat: 4.711, lng: -74.0721, gmv: 780000000, participacion: 59.94 },
    { ciudad: "Medellín", lat: 6.2442, lng: -75.5812, gmv: 210000000, participacion: 16.14 },
    { ciudad: "Cali", lat: 3.4516, lng: -76.532, gmv: 150000000, participacion: 11.53 },
    { ciudad: "Barranquilla", lat: 10.9685, lng: -74.7813, gmv: 95000000, participacion: 7.30 },
    { ciudad: "Bucaramanga", lat: 7.1254, lng: -73.1198, gmv: 42000000, participacion: 3.23 },
    { ciudad: "Pereira", lat: 4.8133, lng: -75.6961, gmv: 24423276, participacion: 1.88 },
  ],

  // ─── TENDENCIAS / HISTÓRICO ───────────────────────────────────────────────
  // Datos mensuales: mes, gmv, meta, servicios (para análisis estacional y predicción)
  tendencias: [
    // 2023
    { mes: "Ene 23", gmv: 620000000,  meta: 700000000,  servicios: 3200 },
    { mes: "Feb 23", gmv: 650000000,  meta: 720000000,  servicios: 3350 },
    { mes: "Mar 23", gmv: 710000000,  meta: 750000000,  servicios: 3600 },
    { mes: "Abr 23", gmv: 690000000,  meta: 740000000,  servicios: 3500 },
    { mes: "May 23", gmv: 740000000,  meta: 760000000,  servicios: 3700 },
    { mes: "Jun 23", gmv: 780000000,  meta: 800000000,  servicios: 3900 },
    { mes: "Jul 23", gmv: 760000000,  meta: 810000000,  servicios: 3800 },
    { mes: "Ago 23", gmv: 800000000,  meta: 830000000,  servicios: 4000 },
    { mes: "Sep 23", gmv: 850000000,  meta: 870000000,  servicios: 4200 },
    { mes: "Oct 23", gmv: 920000000,  meta: 900000000,  servicios: 4500 },
    { mes: "Nov 23", gmv: 1050000000, meta: 980000000,  servicios: 5100 },
    { mes: "Dic 23", gmv: 1280000000, meta: 1350000000, servicios: 6200 },
    // 2024
    { mes: "Ene 24", gmv: 880000000,  meta: 950000000,  servicios: 4400 },
    { mes: "Feb 24", gmv: 920000000,  meta: 980000000,  servicios: 4600 },
    { mes: "Mar 24", gmv: 980000000,  meta: 1020000000, servicios: 4900 },
    { mes: "Abr 24", gmv: 960000000,  meta: 1000000000, servicios: 4800 },
    { mes: "May 24", gmv: 1020000000, meta: 1050000000, servicios: 5100 },
    { mes: "Jun 24", gmv: 1080000000, meta: 1100000000, servicios: 5400 },
    { mes: "Jul 24", gmv: 1050000000, meta: 1080000000, servicios: 5250 },
    { mes: "Ago 24", gmv: 1120000000, meta: 1150000000, servicios: 5600 },
    { mes: "Sep 24", gmv: 1100000000, meta: 1200000000, servicios: 5500 },
    { mes: "Oct 24", gmv: 1180000000, meta: 1250000000, servicios: 5900 },
    { mes: "Nov 24", gmv: 1320000000, meta: 1300000000, servicios: 6600 },
    { mes: "Dic 24", gmv: 1683790653, meta: 2248000000, servicios: 8400 },
    // 2025
    { mes: "Ene 25", gmv: 1301423276, meta: 1550000000, servicios: 6500 },
  ],
};

export function getResumenPorKam(data) {
  return data.kams.map((k) => {
    const nuevos = data.clientesNuevos.filter((c) => c.kam === k.nombre);
    const perdidos = data.clientesPerdidos.filter((c) => c.kam === k.nombre);
    return {
      ...k,
      totalClientesNuevos: nuevos.length,
      gmvClientesNuevos: nuevos.reduce((a, c) => a + c.gmv, 0),
      totalClientesPerdidos: perdidos.length,
      gmvClientesPerdidos: perdidos.reduce((a, c) => a + c.gmvMesAnterior, 0),
    };
  });
}
