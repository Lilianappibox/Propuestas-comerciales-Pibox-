export const TEMPLATE_STORAGE_KEY = "pibox_template";
export const TEMPLATE_HISTORY_KEY = "pibox_template_history";

export const TEMPLATE_FIELDS = [
  // ── INTRODUCCIÓN ──────────────────────────────────────
  {
    id: "intro1",
    seccion: "Introducción",
    label: "Párrafo 1 — Presentación corporativa",
    tipo: "textarea",
  },
  {
    id: "intro2",
    seccion: "Introducción",
    label: "Párrafo 2 — App y trazabilidad",
    tipo: "textarea",
  },
  {
    id: "intro3",
    seccion: "Introducción",
    label: "Párrafo 3 — Propuesta de valor",
    tipo: "textarea",
  },
  // ── PLATAFORMA TECNOLÓGICA ────────────────────────────
  {
    id: "plataformaTech",
    seccion: "Plataforma Tecnológica",
    label: "Descripción de acceso a la plataforma",
    tipo: "textarea",
  },
  {
    id: "onDemandCard",
    seccion: "Plataforma Tecnológica",
    label: "⚡ On Demand — descripción en tarjeta",
    tipo: "textarea",
  },
  {
    id: "programadoCard",
    seccion: "Plataforma Tecnológica",
    label: "🛵 Programado — descripción en tarjeta",
    tipo: "textarea",
  },
  {
    id: "picargaCard",
    seccion: "Plataforma Tecnológica",
    label: "🚚 Picarga — descripción en tarjeta",
    tipo: "textarea",
  },
  {
    id: "storageCard",
    seccion: "Plataforma Tecnológica",
    label: "📦 Storage — descripción en tarjeta",
    tipo: "textarea",
  },
  // ── PROPUESTA COMERCIAL — CABECERA ────────────────────
  {
    id: "propuestaIntro",
    seccion: "Propuesta Comercial",
    label: "Párrafo introductorio de la propuesta",
    tipo: "textarea",
  },
  // ── ON DEMAND ─────────────────────────────────────────
  {
    id: "onDemandDesc",
    seccion: "On Demand",
    label: "Descripción del módulo",
    tipo: "textarea",
  },
  {
    id: "onDemandNotas",
    seccion: "On Demand",
    label: "Notas al pie de la tabla de tarifas",
    tipo: "textarea",
  },
  {
    id: "onDemandAns",
    seccion: "On Demand",
    label: "Texto ANS (Acuerdos de Nivel de Servicio)",
    tipo: "textarea",
  },
  // ── PROGRAMADO BLOQUE HORAS ───────────────────────────
  {
    id: "programadoBHDesc",
    seccion: "Programado — Bloque de Horas",
    label: "Descripción del módulo",
    tipo: "textarea",
  },
  {
    id: "programadoBHAns",
    seccion: "Programado — Bloque de Horas",
    label: "Texto ANS",
    tipo: "textarea",
  },
  // ── PROGRAMADO RUTAS ──────────────────────────────────
  {
    id: "programadoRutasDesc",
    seccion: "Programado — Rutas",
    label: "Descripción del módulo",
    tipo: "textarea",
  },
  {
    id: "programadoRutasAns",
    seccion: "Programado — Rutas",
    label: "Texto ANS",
    tipo: "textarea",
  },
  // ── PICARGA ───────────────────────────────────────────
  {
    id: "picargaDesc",
    seccion: "Picarga",
    label: "Descripción del módulo",
    tipo: "textarea",
  },
  {
    id: "picargaAns",
    seccion: "Picarga",
    label: "Texto ANS",
    tipo: "textarea",
  },
  // ── STORAGE ───────────────────────────────────────────
  {
    id: "storageDesc",
    seccion: "Storage",
    label: "Descripción del módulo",
    tipo: "textarea",
  },
  {
    id: "storageNotas",
    seccion: "Storage",
    label: "Nota al pie (tarifas y condiciones)",
    tipo: "text",
  },
  // ── ADN TECNOLÓGICO ───────────────────────────────────
  {
    id: "adnTitulo",
    seccion: "ADN Tecnológico",
    label: "Título de la sección",
    tipo: "text",
  },
  {
    id: "adnIntro1",
    seccion: "ADN Tecnológico",
    label: "Párrafo 1 — Registro corporativo",
    tipo: "textarea",
  },
  {
    id: "adnRegistroUrl",
    seccion: "ADN Tecnológico",
    label: "URL de registro corporativo",
    tipo: "text",
  },
  {
    id: "adnRegistroLabel",
    seccion: "ADN Tecnológico",
    label: "Texto del enlace de registro",
    tipo: "text",
  },
  {
    id: "adnIntro2",
    seccion: "ADN Tecnológico",
    label: "Párrafo 2 — Configuración del usuario",
    tipo: "textarea",
  },
  {
    id: "adnNegociacionTitulo",
    seccion: "ADN Tecnológico",
    label: "Subtítulo — Configurables en la negociación",
    tipo: "text",
  },
  {
    id: "adnNegociacionItems",
    seccion: "ADN Tecnológico",
    label: "Ítems configurables en la negociación (uno por línea)",
    tipo: "textarea",
  },
  {
    id: "adnWebTitulo",
    seccion: "ADN Tecnológico",
    label: "Subtítulo — Configurables desde el usuario web",
    tipo: "text",
  },
  {
    id: "adnWebItems",
    seccion: "ADN Tecnológico",
    label: "Ítems configurables desde el usuario web (uno por línea)",
    tipo: "textarea",
  },
  // ── URLs POR MÓDULO ───────────────────────────────────
  {
    id: "urlPlataforma",
    seccion: "URLs y Vínculos",
    label: "URL — Plataforma principal",
    tipo: "text",
  },
  {
    id: "urlOnDemand",
    seccion: "URLs y Vínculos",
    label: "URL — Pibox On Demand",
    tipo: "text",
  },
  {
    id: "urlProgramadoBH",
    seccion: "URLs y Vínculos",
    label: "URL — Programado Bloque de Horas",
    tipo: "text",
  },
  {
    id: "urlProgramadoRutas",
    seccion: "URLs y Vínculos",
    label: "URL — Programado Rutas",
    tipo: "text",
  },
  {
    id: "urlPicarga",
    seccion: "URLs y Vínculos",
    label: "URL — Picarga",
    tipo: "text",
  },
  {
    id: "urlStorage",
    seccion: "URLs y Vínculos",
    label: "URL — Pibox Storage",
    tipo: "text",
  },
  {
    id: "urlAdnRegistro",
    seccion: "URLs y Vínculos",
    label: "URL — Registro Corporativo (ADN)",
    tipo: "text",
  },
  {
    id: "urlTerminos",
    seccion: "URLs y Vínculos",
    label: "URL — Términos y Condiciones",
    tipo: "text",
  },
  {
    id: "urlPipay",
    seccion: "URLs y Vínculos",
    label: "URL — Plataforma de pagos (Pipay)",
    tipo: "text",
  },
  // ── TÉRMINOS Y CONDICIONES ────────────────────────────
  {
    id: "tcFormaPagoIntro",
    seccion: "Términos y Condiciones",
    label: "Forma de pago — párrafo introductorio",
    tipo: "textarea",
  },
  {
    id: "tcFormaPagoItems",
    seccion: "Términos y Condiciones",
    label: "Opciones de pago (una por línea, formato: a) texto)",
    tipo: "textarea",
  },
  {
    id: "tcFacturacionIntro",
    seccion: "Términos y Condiciones",
    label: "Facturación — texto principal",
    tipo: "textarea",
  },
  {
    id: "tcFacturacionTimeline",
    seccion: "Términos y Condiciones",
    label: "Tiempos de prefactura (uno por línea)",
    tipo: "textarea",
  },
  {
    id: "tcTerminosRemision",
    seccion: "Términos y Condiciones",
    label: "Remisión a Términos y Condiciones",
    tipo: "textarea",
  },
  {
    id: "vigenciaOferta",
    seccion: "Términos y Condiciones",
    label: "Vigencia de la oferta",
    tipo: "textarea",
  },
  {
    id: "vigenciaTarifas",
    seccion: "Términos y Condiciones",
    label: "Vigencia de tarifas",
    tipo: "textarea",
  },
  // ── ACEPTACIÓN DE LA OFERTA ───────────────────────────
  {
    id: "aceptacionIntro",
    seccion: "Aceptación y Contrato",
    label: "Texto introductorio sección de firma",
    tipo: "textarea",
  },
  {
    id: "contratoIntro",
    seccion: "Aceptación y Contrato",
    label: "Contrato — texto introductorio",
    tipo: "textarea",
  },
  {
    id: "contratoDocumentos",
    seccion: "Aceptación y Contrato",
    label: "Documentos requeridos (uno por línea)",
    tipo: "textarea",
  },
  // ── CIERRE ────────────────────────────────────────────
  {
    id: "cierreParrafo",
    seccion: "Cierre",
    label: "Párrafo de cierre",
    tipo: "textarea",
  },
  {
    id: "cierreFirma",
    seccion: "Cierre",
    label: "Nombre del firmante / equipo",
    tipo: "text",
  },
  {
    id: "cierreSubtitulo",
    seccion: "Cierre",
    label: "Subtítulo y datos de contacto",
    tipo: "text",
  },
];

export const TEMPLATE_DEFAULT = {
  intro1:
    "Somos Digital Platforms Colombia / Digital Network Colombia SAS, administramos la marca Pibox en Colombia. Hemos desarrollado tecnología de vanguardia para la logística, conectando a través de nuestra plataforma digital una de las redes de vehículos más extensas del país.",
  intro2:
    "Cada driver cuenta con una App que le permite mantenerse conectado y garantizar una trazabilidad permanente, con actualización en tiempo real de cada estado del envío hasta su finalización.",
  intro3:
    "Nuestra solución atiende de manera eficiente la primera y última milla para miles de usuarios, operando como una red de crowdsourcing de alto impacto. Ofrecemos un portafolio flexible de soluciones diseñado para aportar agilidad operativa y eficiencia de costos a su cadena de suministro.",
  plataformaTech:
    "Las solicitudes a PIBOX se realizan a través de un usuario registrado en la Aplicación o página Web https://pibox.app/ ; su uso y funcionalidades serán socializadas y aceptadas como entendidas. Es responsabilidad de cada contratante hacer buen uso.",
  onDemandCard:
    "Conectamos su logística con agilidad inteligente. Localiza y asigna en tiempo real al driver más cercano utilizando georreferenciación e inteligencia artificial.",
  programadoCard:
    "Optimice su logística con planificación inteligente. Programe y asigne de forma anticipada conductores con vehículos específicos en bloques de horas y rutas optimizadas.",
  picargaCard:
    "Conexión con drivers de vehículos tipo Carry y NHR para entregas programadas en bloques de horas y/o rutas, con capacidad de carga superior.",
  storageCard:
    "Warehouses estratégicos que funcionan como puntos de almacenamiento, distribución y cross-docking.",
  propuestaIntro:
    "Nuestra propuesta está construida en el análisis de necesidades logísticas para su marca. Contempla los siguientes escenarios:",
  onDemandDesc:
    "El cálculo de la tarifa se determina de manera dinámica, considerando las siguientes variables operativas:",
  onDemandNotas:
    "* Km base: Corresponde a la tarifa mínima.\n* Km extra: Conteo después del km base.\n* Parada Adicional: Conteo a partir de la segunda parada.\n* VD/Ruta: Valor máximo declarado por ruta.\n* Para esta modalidad no se tiene recaudo contra entrega.",
  onDemandAns:
    "• Tiempo de asignación Bogotá: ≤ 5 min (valle) / ≤ 10 min (pico)\n• Ejecución Bogotá: ≥ 96% completados (Q1-Q3) / ≥ 95% (Q4)\n• Disponibilidad: 24/7 | Soporte: ≤ 3 min | Capacidad Moto: 50×50×50 cm / hasta 50kg",
  programadoBHDesc:
    "Optimizamos su operación recurrente con drivers fidelizados asignados. Bloques mínimos de 4 horas con rutas optimizadas y trazabilidad en tiempo real.",
  programadoBHAns:
    "• Asignación: 98% de reservas asignadas exitosamente\n• Efectividad operativa: 97% de tareas completadas\n• Cumplimiento en tiempos: 97%\n• Capacidad Moto: 50×50×50 cm / hasta 50kg",
  programadoRutasDesc:
    "Rutas optimizadas con trazabilidad en tiempo real. Mínimo de 10 entregas agrupables organizadas estratégicamente por sectores.",
  programadoRutasAns:
    "• ANS: 98% | Hora de recogida máxima: 3:00 PM\n• Capacidad Moto: 50×50×50 cm / hasta 50kg",
  picargaDesc:
    "Servicio para gestión de entregas con vehículos tipo Carry y NHR. Entregas programadas en bloques de horas y/o rutas, según capacidad de carga.",
  picargaAns:
    "• Bogotá: ANS 98% (3h anticipación) | Medellín: ANS 95% (24h anticipación)\n• Carry: hasta 700kg",
  storageDesc:
    "Operamos warehouses estratégicos que funcionan como puntos de almacenamiento, distribución y cross-docking. Nuestras instalaciones están diseñadas para optimizar su cadena logística con ubicaciones en las principales ciudades del país.",
  storageNotas:
    "Las tarifas de Storage se presentan según volumetría y requerimientos específicos del cliente.",
  adnTitulo: "ADN TECNOLÓGICO PIBOX",
  adnIntro1:
    "Crea un usuario y contraseña a través de la web",
  adnRegistroUrl: "https://pibox.app/registro-corporativo",
  adnRegistroLabel: "Registro Pibox Corporativo",
  adnIntro2:
    "adjunta la documentación requerida para ser un cliente corporativo. Una vez activo su usuario corporativo puede ser configurado de acuerdo a sus necesidades.",
  adnNegociacionTitulo: "Configurables en la negociación",
  adnNegociacionItems:
    "⚙ Visualización imágenes de recogida y entrega.\n⚙ Envío link tracking a cliente final SMS y correo.\n⚙ Activación código de seguridad en recolección.\n⚙ Activación código de seguridad en la entrega.\n⚙ Usuario super administrador.",
  adnWebTitulo: "Configurables desde su usuario web",
  adnWebItems:
    "☀ Direcciones favoritas.\n☀ Sedes y usuarios.\n☀ Enrutamiento y optimización.\n☀ Integración tecnológica Api.\n☀ Descargar Informes.\n☀ Seguridad.",
  urlPlataforma:      "https://pibox.app/",
  urlOnDemand:        "https://pibox.app/on-demand",
  urlProgramadoBH:    "https://pibox.app/programado",
  urlProgramadoRutas: "https://pibox.app/programado-rutas",
  urlPicarga:         "https://pibox.app/picarga",
  urlStorage:         "https://pibox.app/storage",
  urlAdnRegistro:     "https://pibox.app/registro-corporativo",
  urlTerminos:        "https://pibox.app/terminos",
  urlPipay:           "https://pipay.pibox.app/login",
  tcFormaPagoIntro: "Contará con diferentes formas de pago:",
  tcFormaPagoItems:
    "a) Registro de tarjeta de crédito desde la App: Finalizado el servicio será descontado de la tarjeta asociada el valor total del servicio prestado.\nb) Recarga de Bolsillo Virtual (Picash) App y Web: Puede realizar recarga de su billetera virtual, mediante PSE o tarjeta, y tener un saldo virtual utilizado para el pago de los servicios realizados.\nc) Efectivo: Puede seleccionar la opción de pagar en efectivo en el origen o destino directamente al prestador del servicio.\nd) Crédito: Plazo a 30 días facturados mes vencido, los pagos deberán realizarse a través de la plataforma https://pipay.pibox.app/login",
  tcFacturacionIntro:
    "Al contar con la opción de pago crédito, pagará como remuneración las sumas derivadas de los servicios prestados y facturados de acuerdo a las tarifas presentadas.\nDesde la web puede ejecutar informes descargables en formato Excel y CSV para calcular los montos de facturación mensual.\nEn caso de requerir un formato de pre-factura que contenga los servicios prestados y los envíos realmente entregados en el mes, se expedirá dentro de los primeros 5 días hábiles siguientes al cierre de facturación mensual.",
  tcFacturacionTimeline:
    "a) 5 días calendario para la aprobación o revisión de la prefactura o factura.\nb) La emisión de órdenes de compra debe ser previamente pactada en la propuesta comercial y el periodo de vencimiento de la factura, empezará a correr 3 días después de la aprobación de la prefactura.\nc) Dentro de las peticiones de revisión, deben estar contempladas todas las dudas y sugerencias, las prefacturas solo irán a revisión una única vez, salvo que sea responsabilidad de la Empresa y no responda a la solicitud realizada por el cliente.",
  tcTerminosRemision:
    "Con la suscripción de la presente propuesta comercial, el Contratante declara que ha leído y que acepta en su integridad los Términos y Condiciones de Uso Corporativo publicados en la página web: https://pibox.app/",
  vigenciaOferta:
    "Esta propuesta tiene una vigencia de 1 mes a partir de la fecha de emisión y presentación de esta.",
  vigenciaTarifas:
    "Las tarifas aquí establecidas rigen a partir de la firma de la presente oferta comercial, las cuales se incrementarán anualmente y de forma automática con base en el Índice de Precios al Consumidor – IPC o el Índice de Costos del Transporte de Carga por carretera – ICTC, ambos fijados por el DANE, a criterio de Pibox.\nNo obstante, cuando circunstancias extraordinarias, imprevistas o imprevisibles, posteriores a la firma de la presente oferta comercial, alteren o agraven la prestación de los servicios a cargo de Pibox, en grado tal que le resulte excesivamente onerosa, las partes evaluarán de mutuo acuerdo un incremento extraordinario de las tarifas.",
  aceptacionIntro:
    "Para iniciar los trámites correspondientes de la operación se podrá contactar con la comercial:",
  contratoIntro:
    "Para los trámites de contrato e inicio de operación se requiere la siguiente documentación:",
  contratoDocumentos:
    "RUT.\nCámara de comercio actualizada.\nFotocopia de la cédula de representante legal.\nAceptación de acuerdo comercial.\nCertificado Bancario.\nEstados financieros.\nRenta.",
  cierreParrafo:
    "Quedamos atentos a sus comentarios y disponibles para una reunión de presentación detallada.",
  cierreFirma: "Equipo Comercial PIBOX",
  cierreSubtitulo: "Digital Platforms Colombia SAS | www.pibox.app",
};

export function loadTemplate() {
  try {
    const saved = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!saved) return { ...TEMPLATE_DEFAULT };
    // Merge with defaults so new fields always exist
    return { ...TEMPLATE_DEFAULT, ...JSON.parse(saved) };
  } catch {
    return { ...TEMPLATE_DEFAULT };
  }
}

export function saveTemplate(texts) {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(texts));
}

export function loadHistory() {
  try {
    const saved = localStorage.getItem(TEMPLATE_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history) {
  // Keep last 200 entries
  const trimmed = history.slice(-200);
  localStorage.setItem(TEMPLATE_HISTORY_KEY, JSON.stringify(trimmed));
}

export function addHistoryEntry(history, userId, userName, campoId, valorAnterior, valorNuevo) {
  const campo = TEMPLATE_FIELDS.find((f) => f.id === campoId);
  return [
    ...history,
    {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      userId,
      userName,
      campoId,
      campoLabel: campo ? `${campo.seccion} › ${campo.label}` : campoId,
      valorAnterior,
      valorNuevo,
    },
  ];
}
