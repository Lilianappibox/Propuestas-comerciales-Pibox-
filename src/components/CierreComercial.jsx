import { useState, useCallback, useEffect } from "react";
import { publishToServer, fetchFromServer } from "./serverSync";
import { dataInicial } from "../data/cierreComercial";
import { MonedaProvider } from "./cierre/MonedaContext";
import BarraTRM from "./cierre/BarraTRM";
import CumplimientoEquipo from "./cierre/CumplimientoEquipo";
import CumplimientoKAM from "./cierre/CumplimientoKAM";
import Top10Clientes from "./cierre/Top10Clientes";
import FacturacionLinea from "./cierre/FacturacionLinea";
import ClientesNuevos from "./cierre/ClientesNuevos";
import ClientesPerdidos from "./cierre/ClientesPerdidos";
import MapaCiudades from "./cierre/MapaCiudades";
import Tendencias from "./cierre/Tendencias";
import Insights from "./cierre/Insights";
import Configuracion from "./cierre/Configuracion";
import ProyeccionCierre from "./cierre/ProyeccionCierre";
import ExportPDF from "./cierre/ExportPDF";
import PiboxLogo from "./PiboxLogo";

// ── localStorage — clave admin ────────────────────────────────────────────
const SK = "pibox_cierre_v2";

function leer(isAdmin) {
  // Admin: lee de localStorage si tiene datos guardados, sino dataInicial
  if (isAdmin) {
    try {
      const s = localStorage.getItem(SK);
      if (s) {
        const data = JSON.parse(s);
        if (data.proyeccion) {
          let changed = false;
          if (data.proyeccion.evolucionDiaria) { delete data.proyeccion.evolucionDiaria; changed = true; }
          if (data.proyeccion.archivoOps && !data.proyeccion.diasEvolucion) { delete data.proyeccion.archivoOps; changed = true; }
          if (changed) localStorage.setItem(SK, JSON.stringify(data));
        }
        return data;
      }
    } catch {}
    return JSON.parse(JSON.stringify(dataInicial));
  }
  // KAM: retorna dataInicial; el servidor se carga en useEffect
  return JSON.parse(JSON.stringify(dataInicial));
}

function escribir(data) {
  try { localStorage.setItem(SK, JSON.stringify(data)); } catch {}
}

// ── Secciones ──────────────────────────────────────────────────────────────
const SECCIONES_ALL = [
  { id: "cumplimiento", label: "Cumplimiento", icon: "🎯" },
  { id: "lineas",       label: "Líneas",        icon: "📦" },
  { id: "mapa",         label: "Mapa",          icon: "🗺️" },
  { id: "kams",         label: "KAMs",          icon: "👥" },
  { id: "top10",        label: "Top 10",        icon: "🏆" },
  { id: "nuevos",       label: "Nuevos",        icon: "🌱" },
  { id: "perdidos",     label: "Perdidos",      icon: "⚠️" },
  { id: "proyeccion",   label: "Proyección",    icon: "🎯" },
  { id: "tendencias",   label: "Tendencias",    icon: "📈" },
  { id: "insights",     label: "Insights",      icon: "💡" },
  { id: "config",       label: "Config",        icon: "⚙️", adminOnly: true },
];

// Pestañas que requieren base plana activa para mostrar contenido
const DATA_TABS = new Set(["cumplimiento","kams","top10","lineas","nuevos","perdidos","mapa","tendencias"]);

function SinBasePlana({ isAdmin, onGoConfig }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-14 text-center max-w-lg mx-auto mt-8">
      <p className="text-5xl mb-5">📊</p>
      <h3 className="text-lg font-bold text-gray-700 mb-2">Sin datos cargados</h3>
      <p className="text-sm text-gray-400 mb-7">
        Sube la <strong>base plana mensual</strong> desde{" "}
        <strong>⚙️ Config</strong> y haz clic en{" "}
        <strong>Publicar para el equipo</strong> para activar esta pestaña.
      </p>
      {isAdmin && (
        <button
          onClick={onGoConfig}
          className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition"
        >
          ⚙️ Ir a Configuración
        </button>
      )}
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function CierreComercial({ currentUser }) {
  const isAdmin = currentUser?.rol === "Administrativo";
  const [data, setData] = useState(() => leer(isAdmin));
  const [seccion, setSeccion] = useState("cumplimiento");
  const [toast, setToast] = useState("");
  const [printing, setPrinting] = useState(false);
  const [loadingServer, setLoadingServer] = useState(false);

  // Cargar datos publicados desde el servidor
  // KAMs: siempre desde servidor. Admins: solo si no tienen datos locales.
  const syncFromServerCierre = useCallback(async () => {
    const tieneLocal = isAdmin && !!localStorage.getItem(SK);
    if (tieneLocal) return;
    setLoadingServer(true);
    try {
      const json = await fetchFromServer("cierre");
      if (json?.ok && json.data && typeof json.data === "object") {
        setData(json.data);
      }
    } finally {
      setLoadingServer(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    syncFromServerCierre();
    if (isAdmin) return;
    const interval = setInterval(syncFromServerCierre, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [syncFromServerCierre]);

  const secciones = SECCIONES_ALL.filter((s) => !s.adminOnly || isAdmin);

  const actualizar = (nuevaData) => {
    setData(nuevaData);
    if (isAdmin) escribir(nuevaData);
  };

  const mostrarToast = (msg, dur = 4000) => {
    setToast(msg);
    setTimeout(() => setToast(""), dur);
  };

  const handleSave = async (nuevaData) => {
    actualizar(nuevaData);
    try {
      const json = await publishToServer("cierre", nuevaData);
      if (json.ok) mostrarToast("✅ Publicado para el equipo");
      else mostrarToast(`⚠️ Error al publicar: ${json.error || "intenta de nuevo"}`);
    } catch (err) {
      mostrarToast(`⚠️ Error: ${err.message}`);
    }
  };

  const handlePrint = useCallback(() => {
    setPrinting(true);
    const prevTitle = document.title;
    document.title = " ";
    // Inyectar @page landscape temporalmente
    const style = document.createElement("style");
    style.id = "cierre-print-landscape";
    style.textContent = "@page { size: A4 landscape; margin: 0; }";
    document.head.appendChild(style);
    setTimeout(() => {
      window.print();
      document.title = prevTitle;
      style.remove();
      setPrinting(false);
    }, 300);
  }, []);

  return (
    <MonedaProvider>
      <div className={`min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 ${printing ? "cierre-printing" : ""}`}>

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-[9999] bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg print:hidden">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-purple-100 shadow-sm print:hidden">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <PiboxLogo size="xs" white={false} />
              <div className="h-6 w-px bg-purple-200" />
              <div>
                <h1 className="font-bold text-gray-800 text-sm leading-tight">Cierre Comercial</h1>
                <p className="text-xs text-purple-600 font-semibold">{data.mes}</p>
              </div>
            </div>
            <BarraTRM />
            <div className="flex gap-2 items-center">
              {!isAdmin && loadingServer && (
                <span className="text-xs text-purple-600 font-medium animate-pulse">⏳ Sincronizando…</span>
              )}
              {!isAdmin && !loadingServer && (
                <button onClick={syncFromServerCierre}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                  title="Actualizar datos del servidor">
                  🔄 Actualizar
                </button>
              )}
              {!isAdmin && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Solo lectura</span>
              )}
              <ExportPDF mes={data.mes} onPrint={handlePrint} />
            </div>
          </div>

          {/* Nav */}
          <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
            {secciones.map((s) => (
              <button
                key={s.id}
                onClick={() => setSeccion(s.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  seccion === s.id
                    ? "bg-purple-600 text-white shadow"
                    : "text-gray-600 hover:bg-purple-50"
                }`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block px-8 pt-6 pb-4 border-b-2 border-purple-200 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <PiboxLogo size="sm" white={false} />
              <div>
                <h1 className="text-xl font-bold text-purple-800">Cierre Comercial</h1>
                <p className="text-sm text-purple-600 font-semibold">{data.mes}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Informe ejecutivo</p>
          </div>
        </div>

        {/* Contenido */}
        <div id="tablero-contenido" className="max-w-7xl mx-auto px-4 py-6 space-y-6 print:px-6 print:max-w-none">
          {(() => {
            const activa = data._basePlanaActiva === true;
            const sinDatos = <SinBasePlana isAdmin={isAdmin} onGoConfig={() => setSeccion("config")} />;

            if (printing) return activa ? (
              <>
                <CumplimientoEquipo data={data} />
                <CumplimientoKAM    data={data} printing={true} />
                <FacturacionLinea   data={data} />
                <MapaCiudades       data={data} />
                <Tendencias         data={data} />
                <ProyeccionCierre   data={data} printing={true} />
                <Insights           data={data} />
              </>
            ) : sinDatos;

            return (
              <>
                {seccion === "cumplimiento" && (activa ? <CumplimientoEquipo data={data} /> : sinDatos)}
                {seccion === "kams"         && (activa ? <CumplimientoKAM    data={data} /> : sinDatos)}
                {seccion === "top10"        && (activa ? <Top10Clientes      data={data} /> : sinDatos)}
                {seccion === "lineas"       && (activa ? <FacturacionLinea   data={data} /> : sinDatos)}
                {seccion === "nuevos"       && (activa ? <ClientesNuevos     data={data} /> : sinDatos)}
                {seccion === "perdidos"     && (activa ? <ClientesPerdidos   data={data} /> : sinDatos)}
                {seccion === "mapa"         && (activa ? <MapaCiudades       data={data} /> : sinDatos)}
                {seccion === "tendencias"   && (activa ? <Tendencias         data={data} /> : sinDatos)}
                {seccion === "proyeccion"   && <ProyeccionCierre data={data} />}
                {seccion === "insights"     && <Insights         data={data} />}
                {seccion === "config" && isAdmin && (
                  <Configuracion data={data} onSave={handleSave} />
                )}
              </>
            );
          })()}
        </div>
      </div>
    </MonedaProvider>
  );
}
