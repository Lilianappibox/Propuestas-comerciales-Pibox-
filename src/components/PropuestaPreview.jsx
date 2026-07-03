import { fmt } from "../utils/formatCurrency";
import { COBERTURA } from "../data/tarifas";
import { TEMPLATE_DEFAULT } from "../data/templateTexts";
import PiboxLogo from "./PiboxLogo";

// ── Colores de marca PIBOX ──────────────────────────────────────
const PURPLE   = "#7C22D4";
const MAGENTA  = "#C026D3";
const STRIPE   = "#FAF5FF";  // purple-50
const GRADIENT = "linear-gradient(135deg, #7C22D4, #C026D3)";

const fmtU = (value, unidad) => {
  if (value === "N.A" || value === 0 || value === "" || value == null) return fmt(value);
  return unidad === "%" ? `${value}%` : fmt(value);
};

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2
      className="text-base font-bold pb-1 mb-4"
      style={{ color: PURPLE, borderBottom: `2px solid ${PURPLE}` }}
    >
      {title}
    </h2>
    {children}
  </div>
);

const DataTable = ({ headers, rows }) => (
  <div className="overflow-x-auto mb-4">
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr style={{ background: GRADIENT }}>
          {headers.map((h, i) => (
            <th key={i} className="px-3 py-2 text-left font-semibold text-xs text-white border border-purple-900">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? "#ffffff" : STRIPE }}>
            {row.map((cell, ci) => (
              <td key={ci} className="px-3 py-2 text-xs border border-purple-100">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PolicyTable = ({ rows }) => (
  <div className="overflow-x-auto mb-4">
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr style={{ backgroundColor: "#4B1181" }}>
          <th className="px-3 py-2 text-left text-xs text-white border border-purple-900 w-1/3">Ítem</th>
          <th className="px-3 py-2 text-left text-xs text-white border border-purple-900">Observaciones</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([item, obs], i) => (
          <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : STRIPE }}>
            <td className="px-3 py-2 text-xs border border-purple-100 font-medium">{item}</td>
            <td className="px-3 py-2 text-xs border border-purple-100">{obs}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Render multiline text (split \n into <p> elements)
const ML = ({ text, className = "" }) => (
  <>
    {(text || "").split("\n").map((line, i) => (
      <p key={i} className={`text-xs text-gray-600 ${className}`}>{line}</p>
    ))}
  </>
);


export default function PropuestaPreview({ propuesta, tarifas, modulos, texts: textsProp, currentUser, coberturaTodasCiudades }) {
  const T = { ...TEMPLATE_DEFAULT, ...(textsProp || {}) };
  const { cliente, ciudad, fecha, contacto, email, notas } = propuesta;

  // Razón social activa — reemplaza dinámicamente en todos los textos
  const RS = propuesta.razonSocial || "Digital Platforms Colombia S.A.S.";

  // intro1 ajustado según la razón social seleccionada
  const intro1 = T.intro1
    .replace(/Digital Platforms Colombia(?: \/ Digital Network Colombia)? SAS/gi, RS)
    .replace(/Digital Network Colombia(?: \/ Digital Platforms Colombia)? SAS/gi, RS)
    .replace(/Digital Platforms Colombia S\.A\.S\./gi, RS)
    .replace(/Digital Network Colombia S\.A\.S\./gi, RS);

  const fechaFmt = fecha
    ? new Date(fecha + "T12:00:00").toLocaleDateString("es-CO", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "_____ de 2026";

  return (
    <div id="propuesta-preview" className="bg-white text-gray-900 font-sans p-8 max-w-4xl mx-auto print:p-0">

      {/* ── Banda de color superior con logo ── */}
      <div
        className="rounded-xl p-4 mb-6 flex justify-between items-center"
        style={{ background: GRADIENT }}
      >
        <PiboxLogo size="md" white />
        <div className="text-right text-white">
          <p className="text-sm font-semibold">{fechaFmt}</p>
          {ciudad && <p className="text-xs text-white/80">{ciudad}</p>}
          <p className="text-xs text-white/60 mt-1">{RS}</p>
        </div>
      </div>

      {/* Destinatario */}
      <div className="mb-6 border-l-4 pl-4" style={{ borderColor: PURPLE }}>
        {contacto && <p className="font-semibold text-gray-700">Señor(a): {contacto}</p>}
        {cliente && <p className="font-bold text-lg" style={{ color: PURPLE }}>{cliente}</p>}
        {ciudad && <p className="text-gray-600 text-sm">📍 {ciudad}</p>}
        {email && <p className="text-gray-600 text-sm">✉️ {email}</p>}
        <p className="mt-2 font-semibold text-gray-700">Asunto: Propuesta Comercial PIBOX</p>
      </div>

      {/* Intro */}
      <div className="mb-6 text-sm text-gray-700 leading-relaxed space-y-3">
        <p>{intro1}</p>
        <p>{T.intro2}</p>
        <p>{T.intro3}</p>
      </div>

      {/* Plataforma tecnológica */}
      <Section title="Nuestra Plataforma Tecnológica">
        <p className="text-sm text-gray-700 mb-4">{T.plataformaTech}</p>
        <div className="grid grid-cols-1 gap-3">
          {modulos.onDemand && (
            <div className="flex gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-bold text-sm">Pibox On demand</p>
                <p className="text-xs text-gray-600">{T.onDemandCard}</p>
              </div>
            </div>
          )}
          {(modulos.programadoBloqueHoras || modulos.programadoRutas) && (
            <div className="flex gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <span className="text-2xl">🛵</span>
              <div>
                <p className="font-bold text-sm">Pibox Programado</p>
                <p className="text-xs text-gray-600">{T.programadoCard}</p>
              </div>
            </div>
          )}
          {modulos.entregasOptimizadas && (
            <div className="flex gap-3 p-3 bg-sky-50 rounded-lg border border-sky-200">
              <span className="text-2xl">🚀</span>
              <div>
                <p className="font-bold text-sm">Entregas Optimizadas</p>
                <p className="text-xs text-gray-600">{T.entregasOptimizadasCard}</p>
              </div>
            </div>
          )}
          {modulos.picarga && (
            <div className="flex gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <span className="text-2xl">🚚</span>
              <div>
                <p className="font-bold text-sm">Picarga</p>
                <p className="text-xs text-gray-600">{T.picargaCard}</p>
              </div>
            </div>
          )}
          {modulos.storage && (
            <div className="flex gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <span className="text-2xl">📦</span>
              <div>
                <p className="font-bold text-sm">Pibox Storage</p>
                <p className="text-xs text-gray-600">{T.storageCard}</p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Propuesta Comercial */}
      <Section title="Propuesta Comercial">
        <p className="text-sm text-gray-700 mb-4">
          {(T.propuestaIntro || "")
            .replace(/\bsu marca\b/gi, cliente || "su marca")
            .replace(/\bempresa\b/gi, cliente || "su empresa")}
        </p>

        {/* ON DEMAND */}
        {modulos.onDemand && (
          <div className="mb-8">
            <h3 className="font-bold text-yellow-700 text-base mb-3">⚡ Pibox On Demand</h3>
            <p className="text-xs text-gray-600 mb-3">{T.onDemandDesc}</p>
            <DataTable
              headers={["Ciudad", "Tipo de Vehículo", "Km Base", "Tarifa Km Base", "Tarifa Km Extra", "Parada Adicional", "VD / Ruta"]}
              rows={tarifas.onDemand.ciudades.map((c) => [
                c.ciudad, c.vehiculo, `${c.kmBase} Km`, fmt(c.tarifaKmBase), fmt(c.tarifaKmExtra), fmt(c.paradaAdicional), fmt(c.vdRuta),
              ])}
            />
            <div className="mb-3"><ML text={T.onDemandNotas} /></div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Tarifas Adicionales:</p>
            <DataTable
              headers={["Ciudad", "Vehículo", "Tiempo de Espera", "Tarifa Minuto Adicional", "Bonificación", "Recargo Periferia"]}
              rows={tarifas.onDemand.adicionales.map((a) => [
                a.ciudad, a.vehiculo, a.tiempoEspera, fmt(a.tarifaMinuto), fmt(a.bonificacion), fmt(a.recargo),
              ])}
            />
            <PolicyTable rows={[
              ["Política de Recaudo", "Pilotos con base para pagar al recoger paquetes hasta $200.000."],
              ["Comodatos — Responsabilidad Pibox", "Para préstamos de artículos a un piloto, se debe gestionar en la web la asignación en comodato."],
              ["Datáfonos", "Máximo valor declarado del datáfono es de $600.000."],
              ["Condiciones de Entrega", "La entrega se realiza en la ubicación (frente al domicilio/comercio). El ingreso a residencias no está incluido."],
              ["Devoluciones", "Toda devolución genera un cobro por los kilómetros recorridos para retornar el paquete al origen."],
              ["Cobros Adicionales", "Todas las entregas o recogidas en centros comerciales requieren bonificación de parqueadero."],
            ]} />
            <p className="text-xs font-semibold text-gray-700 mb-2">Acuerdos de Nivel de Servicio (ANS) — Moto</p>
            <div className="text-xs text-gray-600 space-y-1 bg-blue-50 p-3 rounded">
              <ML text={T.onDemandAns} />
            </div>
          </div>
        )}

        {/* PROGRAMADO BLOQUE HORAS */}
        {modulos.programadoBloqueHoras && (
          <div className="mb-8">
            <h3 className="font-bold text-green-700 text-base mb-3">🛵 Pibox Programado — 📆 Modalidad Bloque de Horas</h3>
            <p className="text-xs text-gray-600 mb-3">{T.programadoBHDesc}</p>
            <DataTable
              headers={["Ciudad", "Pilotos", "Horas/Día", "Tarifa Hora", "Cobertura", "VD / Ruta", "Recaudo / Ruta"]}
              rows={tarifas.programadoBloqueHoras.reservas.map((r) => [
                r.ciudad, r.pilotos, r.horasDia, fmt(r.tarifaHora), r.cobertura, fmt(r.vdRuta), fmt(r.recaudoRuta),
              ])}
            />
            <p className="text-xs text-gray-600 mb-3">* Hora adicional: con el mismo costo.</p>
            <DataTable
              headers={["Tipo de Recaudo", "% Recaudo Ida/Vuelta", "Parada en Falso", "Recargo Periferia"]}
              rows={[[
                "Ida y vuelta",
                `${tarifas.programadoBloqueHoras.adicionales.recaudoIdaVuelta}%`,
                fmtU(tarifas.programadoBloqueHoras.adicionales.paradaEnFalso, tarifas.programadoBloqueHoras.adicionales.paradaEnFalsoUnidad || "$"),
                fmt(tarifas.programadoBloqueHoras.adicionales.recargo),
              ]]}
            />
            <PolicyTable rows={[
              ["Tareas de una reserva", "Todas las reservas deben tener asociadas las tareas para garantizar la trazabilidad, monitoreo y los valores declarados."],
              ["Política de Cancelación", "Mínimo 3 horas hábiles. Cancelaciones con menos de 4h generan parada en falso."],
              ["Datáfonos", "Máximo valor declarado del datáfono es de $600.000."],
            ]} />
            <div className="text-xs text-gray-600 space-y-1 bg-blue-50 p-3 rounded">
              <ML text={T.programadoBHAns} />
            </div>
          </div>
        )}

        {/* PROGRAMADO RUTAS */}
        {modulos.programadoRutas && (
          <div className="mb-8">
            <h3 className="font-bold text-green-700 text-base mb-3">🔁 Pibox Programado — Modalidad Rutas</h3>
            <p className="text-xs text-gray-600 mb-3">{T.programadoRutasDesc}</p>
            <DataTable
              headers={["Ciudad", "Paquetes/Ruta", "Paquetes/Día", "Tarifa Paquete", "VD / Ruta", "Recaudo / Ruta"]}
              rows={tarifas.programadoRutas.rutas.map((r) => [
                r.ciudad, r.paquetesPorRuta, r.paquetesDia, fmt(r.tarifaPaquete), fmt(r.vdRuta), fmt(r.recaudoRuta),
              ])}
            />
            <DataTable
              headers={["Tipo de Recaudo", "Medio de Recaudo", "% Ida/Vuelta", "Intentos de Entrega", "Tarifa Devoluciones"]}
              rows={[[
                "Ida y vuelta",
                tarifas.programadoRutas.adicionales.medioRecaudo,
                `${tarifas.programadoRutas.adicionales.recaudoIdaVuelta}%`,
                tarifas.programadoRutas.adicionales.intentosEntrega,
                fmt(tarifas.programadoRutas.adicionales.tarifaDevoluciones),
              ]]}
            />
            <div className="text-xs text-gray-600 space-y-1 bg-blue-50 p-3 rounded">
              <ML text={T.programadoRutasAns} />
            </div>
          </div>
        )}

        {/* ENTREGAS OPTIMIZADAS */}
        {modulos.entregasOptimizadas && tarifas.entregasOptimizadas && (
          <div className="mb-8">
            <h3 className="font-bold text-base mb-3" style={{ color: "#0369a1" }}>🚀 Entregas Optimizadas</h3>
            <p className="text-xs text-gray-600 mb-3">{T.entregasOptimizadasDesc}</p>
            <DataTable
              headers={["Ciudad", "Paquetes/Ruta", "Paquetes/Día", "Tarifa Paquete", "VD / Ruta", "Recaudo / Ruta"]}
              rows={(tarifas.entregasOptimizadas.rutas || []).map((r) => [
                r.ciudad, r.paquetesPorRuta, r.paquetesDia, fmt(r.tarifaPaquete), fmt(r.vdRuta), fmt(r.recaudoRuta),
              ])}
            />
            <DataTable
              headers={["Tipo de Recaudo", "Medio de Recaudo", "% Ida/Vuelta", "Intentos de Entrega", "Tarifa Devoluciones"]}
              rows={[[
                "Ida y vuelta",
                tarifas.entregasOptimizadas.adicionales?.medioRecaudo || "Datáfono / Efectivo",
                `${tarifas.entregasOptimizadas.adicionales?.recaudoIdaVuelta || 5}%`,
                tarifas.entregasOptimizadas.adicionales?.intentosEntrega || 1,
                fmt(tarifas.entregasOptimizadas.adicionales?.tarifaDevoluciones || 0),
              ]]}
            />
            <div className="text-xs text-gray-600 space-y-1 bg-blue-50 p-3 rounded">
              <ML text={T.entregasOptimizadasAns} />
            </div>
          </div>
        )}

        {/* PICARGA */}
        {modulos.picarga && (
          <div className="mb-8">
            <h3 className="font-bold text-orange-700 text-base mb-3">🚚 Picarga</h3>
            <p className="text-xs text-gray-600 mb-3">{T.picargaDesc}</p>

            {/* Tarifas por distancia */}
            <p className="text-xs font-semibold text-gray-700 mb-2">Tarifas por Distancia:</p>
            <DataTable
              headers={["Ciudad", "Vehículo", "Km Base", "Tarifa Km Base", "Km Extra", "Parada Adicional", "VD / Ruta"]}
              rows={tarifas.picarga.ciudades.map((c) => [
                c.ciudad, c.vehiculo, `${c.kmBase} Km`, fmt(c.tarifaKmBase), fmt(c.tarifaKmExtra), fmt(c.paradaAdicional), fmt(c.vdRuta),
              ])}
            />

            {/* Bloque de horas */}
            {(tarifas.picarga.reservas || []).length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-700 mb-2 mt-4">Bloque de Horas:</p>
                <DataTable
                  headers={["Ciudad", "Vehículo", "Vehículos", "Horas/Día", "Tarifa Hora", "Cobertura", "VD / Ruta", "Recaudo / Ruta"]}
                  rows={(tarifas.picarga.reservas || []).map((r) => [
                    r.ciudad, r.vehiculo, r.vehiculos, r.horasDia, fmt(r.tarifaHora), r.cobertura, fmt(r.vdRuta), fmt(r.recaudoRuta),
                  ])}
                />
                <DataTable
                  headers={["% Recaudo Ida/Vuelta", "Parada en Falso", "Tarifa Auxiliar", "Hora Extra Auxiliar"]}
                  rows={[[
                    `${tarifas.picarga.adicionalesBH?.recaudoIdaVuelta ?? 5}%`,
                    fmtU(tarifas.picarga.adicionalesBH?.paradaEnFalso ?? "N.A", tarifas.picarga.adicionalesBH?.paradaEnFalsoUnidad || "$"),
                    fmt(tarifas.picarga.adicionalesBH?.tarifaAuxiliar ?? "N.A"),
                    fmt(tarifas.picarga.adicionalesBH?.horaExtraAuxiliar ?? "N.A"),
                  ]]}
                />
              </>
            )}

            {/* Adicionales distancia */}
            <p className="text-xs font-semibold text-gray-700 mb-2 mt-4">Tarifas Adicionales:</p>
            <DataTable
              headers={["Ciudad", "Vehículo", "T. Espera", "Tarifa Minuto", "Bonificación", "Periferia", "Aledaños", "Lejanía", "Auxiliar", "Hora Extra Aux."]}
              rows={tarifas.picarga.adicionales.map((a) => [
                a.ciudad, a.vehiculo, a.tiempoEspera,
                fmt(a.tarifaMinuto), fmt(a.bonificacion),
                fmt(a.periferia ?? "N.A"), fmt(a.aledanos ?? "N.A"), fmt(a.lejania ?? "N.A"),
                fmt(a.tarifaAuxiliar ?? "N.A"), fmt(a.horaExtraAuxiliar ?? "N.A"),
              ])}
            />

            <PolicyTable rows={[
              ["Condiciones de Entrega", "La entrega se realiza frente al domicilio/comercio. El ingreso a residencias no está incluido."],
              ["Carga/Descarga", "Si se requiere asistencia para subir la carga, deberá pagar un auxiliar de carga."],
              ["Devoluciones", "Toda devolución genera un cobro por los kilómetros recorridos para retornar al origen."],
            ]} />
            <div className="text-xs text-gray-600 space-y-1 bg-blue-50 p-3 rounded">
              <ML text={T.picargaAns} />
            </div>
          </div>
        )}

        {/* STORAGE */}
        {modulos.storage && (
          <div className="mb-8">
            <h3 className="font-bold text-purple-700 text-base mb-3">📦 Pibox Storage</h3>
            <p className="text-sm text-gray-700 mb-3">{T.storageDesc}</p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-xs text-gray-700 space-y-2 mb-4">
              <p>✅ Almacenamiento por posición / m²</p>
              <p>✅ Cross-docking y distribución de última milla</p>
              <p>✅ Trazabilidad integrada con la plataforma PIBOX</p>
              <p>✅ Disponibilidad en Bogotá, Medellín y Cali</p>
            </div>

            {/* Tabla de Almacenamiento */}
            {(tarifas.storage?.almacenamiento || []).length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-700 mb-2">Almacenamiento:</p>
                <DataTable
                  headers={["Ciudad", "Ítem", "Capacidad Unitaria", "Peso Máximo Unitario", "Negociación", "Tarifa"]}
                  rows={tarifas.storage.almacenamiento.map((a) => [
                    a.ciudad, a.item, a.capacidadUnitaria, a.pesoMaximo, a.negociacion, fmt(a.tarifa),
                  ])}
                />
              </>
            )}

            {/* Tabla de Alistamientos */}
            {(tarifas.storage?.alistamientos || []).length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-700 mb-2 mt-4">Alistamientos:</p>
                {tarifas.storage.alistamientos.map((al, idx) => (
                  <div key={idx} className="mb-4">
                    <p className="text-xs text-gray-600 mb-1">
                      <span className="font-semibold">Tipo:</span> {al.tipo}
                      {al.descripcion && <> — {al.descripcion}</>}
                    </p>
                    <DataTable
                      headers={["Rango (alistamientos / mes)", "Tarifa"]}
                      rows={(al.rangos || []).map((r) => [r.rango, fmt(r.tarifa)])}
                    />
                  </div>
                ))}
              </>
            )}

            {/* Términos de negociación */}
            {(tarifas.storage?.terminos || []).length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-700 mb-2 mt-4">Términos de negociación Storage / Crossdocking:</p>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-1 mb-4">
                  {tarifas.storage.terminos.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </>
            )}

            <p className="text-gray-500 italic text-xs">* {T.storageNotas}</p>
          </div>
        )}
      </Section>

      {/* ADN TECNOLÓGICO */}
      {modulos.adnTecnologico && (
        <Section title={`🔬 ${T.adnTitulo}`}>
          <p className="text-sm text-gray-700 mb-3">
            {T.adnIntro1}{" "}
            <a
              href={T.adnRegistroUrl}
              style={{ color: PURPLE }}
              className="underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              {T.adnRegistroLabel}
            </a>{" "}
            {T.adnIntro2}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {/* Configurables en la negociación */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="font-bold text-blue-800 text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                {T.adnNegociacionTitulo}
              </p>
              <ul className="space-y-1.5">
                {(T.adnNegociacionItems || "").split("\n").filter(Boolean).map((item, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Configurables desde usuario web */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="font-bold text-green-800 text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-600 inline-block"></span>
                {T.adnWebTitulo}
              </p>
              <ul className="space-y-1.5">
                {(T.adnWebItems || "").split("\n").filter(Boolean).map((item, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      )}

      {/* COBERTURA */}
      {modulos.cobertura && (() => {
        // Extraer ciudades usadas en las tarifas de la propuesta
        const ciudadesSet = new Set();
        if (modulos.onDemand) tarifas.onDemand?.ciudades?.forEach((c) => ciudadesSet.add(c.ciudad));
        if (modulos.programadoBloqueHoras) tarifas.programadoBloqueHoras?.reservas?.forEach((r) => ciudadesSet.add(r.ciudad));
        if (modulos.programadoRutas) tarifas.programadoRutas?.rutas?.forEach((r) => ciudadesSet.add(r.ciudad));
        if (modulos.entregasOptimizadas) tarifas.entregasOptimizadas?.rutas?.forEach((r) => ciudadesSet.add(r.ciudad));
        if (modulos.picarga) {
          tarifas.picarga?.ciudades?.forEach((c) => ciudadesSet.add(c.ciudad));
          tarifas.picarga?.reservas?.forEach((r) => ciudadesSet.add(r.ciudad));
        }
        // Normalizar para comparar (ej: "Bogotá" vs "bogotá")
        const ciudadesNorm = new Set([...ciudadesSet].map((c) => c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
        const coberturaFiltrada = coberturaTodasCiudades
          ? COBERTURA
          : COBERTURA.filter((row) => ciudadesNorm.has(row.ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));

        return coberturaFiltrada.length > 0 ? (
          <Section title="📍 Cobertura Pibox">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: GRADIENT }}>
                    {["Ciudad", "Origen / Área Metropolitana", "Periferia", "Aledaños", "Lejanías", "Zonas Rojas / No Acceso"].map((h, i) => (
                      <th key={i} className="px-2 py-2 text-left font-semibold text-white border border-purple-900">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coberturaFiltrada.map((row, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : STRIPE }}>
                      <td className="px-2 py-2 border border-purple-100 font-semibold" style={{ color: PURPLE }}>{row.ciudad}</td>
                      <td className="px-2 py-2 border border-purple-100">{row.origen}{row.metropolitana ? `, ${row.metropolitana}` : ""}</td>
                      <td className="px-2 py-2 border border-purple-100">{row.periferia || "—"}</td>
                      <td className="px-2 py-2 border border-purple-100">{row.aledanos || "—"}</td>
                      <td className="px-2 py-2 border border-purple-100">—</td>
                      <td className="px-2 py-2 border border-purple-100 text-red-600">{row.zonasRojas || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null;
      })()}

      {/* Notas de negociación */}
      {notas && (
        <Section title="📝 Notas de Negociación">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{notas}</p>
          </div>
        </Section>
      )}

      {/* TÉRMINOS Y CONDICIONES */}
      {modulos.terminosCondiciones && (
        <Section title="📋 Términos y Condiciones de la Propuesta">
          {/* Forma de pago */}
          <h3 className="font-bold text-gray-800 text-sm underline mb-2">Forma de pago</h3>
          <p className="text-xs text-gray-700 mb-2">{T.tcFormaPagoIntro}</p>
          <div className="space-y-1 mb-4">
            {(T.tcFormaPagoItems || "").split("\n").filter(Boolean).map((item, i) => (
              <p key={i} className="text-xs text-gray-700 ml-3">{item}</p>
            ))}
          </div>

          {/* Facturación */}
          <h3 className="font-bold text-gray-800 text-sm underline mb-2">Facturación</h3>
          <div className="space-y-1 mb-2">
            {(T.tcFacturacionIntro || "").split("\n").filter(Boolean).map((p, i) => (
              <p key={i} className="text-xs text-gray-700 mb-1">{p}</p>
            ))}
          </div>
          <p className="text-xs text-gray-700 mb-1">Una vez recibido el informe de prefactura, corren los siguientes tiempos:</p>
          <div className="space-y-1 mb-4">
            {(T.tcFacturacionTimeline || "").split("\n").filter(Boolean).map((item, i) => (
              <p key={i} className="text-xs text-gray-700 ml-3">{item}</p>
            ))}
          </div>

          {/* Tarifa Seguro */}
          {tarifas.storage?.seguro?.length > 0 && (
            <>
              <h3 className="font-bold text-gray-800 text-sm underline mb-2">Tarifa por Seguro</h3>
              <p className="text-xs text-gray-600 mb-2">Calculado sobre el valor declarado de cada servicio (Ruta / Booking).</p>
              <DataTable
                headers={["Unidad de Negocio", "Monto a declarar", "Costo de seguro"]}
                rows={tarifas.storage.seguro.map((r) => [
                  r.unidad,
                  `$${Number(r.montoDesde).toLocaleString("es-CO")} – $${Number(r.montoHasta).toLocaleString("es-CO")}`,
                  r.costoSeguro,
                ])}
              />
            </>
          )}

          {/* Vigencia */}
          <h3 className="font-bold text-gray-800 text-sm underline mb-2">Vigencia de la oferta</h3>
          <p className="text-xs text-gray-700 mb-4">{T.vigenciaOferta}</p>

          <h3 className="font-bold text-gray-800 text-sm underline mb-2">Vigencia de Tarifas</h3>
          <div className="space-y-2 mb-4">
            {(T.vigenciaTarifas || "").split("\n").filter(Boolean).map((p, i) => (
              <p key={i} className="text-xs text-gray-700">{p}</p>
            ))}
          </div>

          {/* Remisión T&C */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-700 italic">{T.tcTerminosRemision}</p>
          </div>
        </Section>
      )}

      {/* ACEPTACIÓN DE LA OFERTA */}
      {modulos.terminosCondiciones && (
        <Section title="✒️ Aceptación de la Oferta">
          {/* Firma del cliente */}
          <p className="text-sm font-semibold text-gray-700 mb-6">FIRMA</p>
          <div className="border-b-2 border-gray-400 w-72 mb-2"></div>
          <p className="text-xs text-gray-500">Nombre Representante Legal</p>
          <p className="text-xs text-gray-500">C.C. de Representante Legal</p>
          <p className="text-xs text-gray-500">Razón social de la Compañía</p>
          <p className="text-xs font-bold text-gray-700 mt-1">( Firma electrónica )</p>

          {/* Contrato */}
          <div className="mt-6">
            <h3 className="font-bold text-gray-800 text-sm mb-2">Contrato:</h3>
            <p className="text-xs text-gray-700 mb-2">{T.contratoIntro}</p>
            <ul className="space-y-1">
              {(T.contratoDocumentos || "").split("\n").filter(Boolean).map((doc, i) => (
                <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                  <span style={{ color: PURPLE }} className="shrink-0">●</span>
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* Cierre */}
      <div className="mt-12 pt-6 border-t border-purple-100 text-sm text-gray-700">
        <p className="mb-6">{T.cierreParrafo}</p>
        <p className="font-semibold text-gray-500 mb-6">Cordialmente,</p>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            {currentUser ? (
              <>
                <p className="font-bold text-lg mb-1" style={{ color: PURPLE }}>{currentUser.nombre}</p>
                {currentUser.cargo && <p className="text-sm text-gray-600 mb-0.5">{currentUser.cargo}</p>}
                <p className="text-xs text-gray-500">{currentUser.email}</p>
                {currentUser.celular && <p className="text-xs text-gray-500">📱 {currentUser.celular}</p>}
                <p className="text-xs text-gray-400 mt-2">{RS} | www.pibox.app</p>
              </>
            ) : (
              <>
                <p className="font-bold" style={{ color: PURPLE }}>{T.cierreFirma}</p>
                <p className="text-xs text-gray-500">{RS} | www.pibox.app</p>
              </>
            )}
          </div>
          {/* Logo en el cierre */}
          <div className="opacity-80">
            <PiboxLogo size="sm" white={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
