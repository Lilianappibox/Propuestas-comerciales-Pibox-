import { useState, useCallback, useEffect } from "react";
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
import ExportPDF from "./cierre/ExportPDF";
import PiboxLogo from "./PiboxLogo";

// ── localStorage — claves ─────────────────────────────────────────────────
const SK = "pibox_cierre_v2";
// Clave compartida: cuando el Admin guarda, también escribe aquí
// Los KAMs leen de esta clave para ver los datos del Admin
const SK_SHARED = "pibox_cierre_shared";

function leer(isAdmin) {
  try {
    // Admin lee sus propios datos editables
    if (isAdmin) {
      const s = localStorage.getItem(SK);
      if (s) return JSON.parse(s);
    } else {
      // KAM lee los datos compartidos por el Admin, si existen
      const shared = localStorage.getItem(SK_SHARED);
      if (shared) return JSON.parse(shared);
      // Fallback: datos locales o iniciales
      const s = localStorage.getItem(SK);
      if (s) return JSON.parse(s);
    }
  } catch {}
  return JSON.parse(JSON.stringify(dataInicial));
}

function escribir(data, isAdmin) {
  try {
    localStorage.setItem(SK, JSON.stringify(data));
    // El Admin también escribe en la clave compartida
    if (isAdmin) {
      localStorage.setItem(SK_SHARED, JSON.stringify(data));
    }
  } catch {}
}

// ── Secciones ──────────────────────────────────────────────────────────────
const SECCIONES_ALL = [
  { id: "cumplimiento", label: "Cumplimiento", icon: "🎯" },
  { id: "kams",         label: "KAMs",         icon: "👥" },
  { id: "top10",        label: "Top 10",        icon: "🏆" },
  { id: "lineas",       label: "Líneas",        icon: "📦" },
  { id: "nuevos",       label: "Nuevos",        icon: "🌱" },
  { id: "perdidos",     label: "Perdidos",      icon: "⚠️" },
  { id: "mapa",         label: "Mapa",          icon: "🗺️" },
  { id: "tendencias",   label: "Tendencias",    icon: "📈" },
  { id: "insights",     label: "Insights",      icon: "💡" },
  { id: "config",       label: "Config",        icon: "⚙️", adminOnly: true },
];

// ── App ─────────────────────────────────────────────────────────────────────
export default function CierreComercial({ currentUser }) {
  const isAdmin = currentUser?.rol === "Administrativo";
  const [data, setData] = useState(() => leer(isAdmin));
  const [seccion, setSeccion] = useState("cumplimiento");
  const [toast, setToast] = useState("");
  const [printing, setPrinting] = useState(false);

  // KAMs: recargar datos compartidos cuando la pestaña obtiene foco
  // (por si el Admin actualizó en otro momento)
  useEffect(() => {
    if (isAdmin) return;
    const handleFocus = () => {
      const fresh = leer(false);
      setData(fresh);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [isAdmin]);

  const secciones = SECCIONES_ALL.filter((s) => !s.adminOnly || isAdmin);

  const actualizar = (nuevaData) => {
    setData(nuevaData);
    escribir(nuevaData, isAdmin);
  };

  const mostrarToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleSave = (nuevaData) => {
    actualizar(nuevaData);
    mostrarToast("✅ Cambios guardados y compartidos con el equipo");
  };

  const handlePrint = useCallback(() => {
    setPrinting(true);
    const prevTitle = document.title;
    document.title = " ";
    setTimeout(() => {
      window.print();
      document.title = prevTitle;
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
          {printing ? (
            <>
              <CumplimientoEquipo data={data} />
              <CumplimientoKAM    data={data} />
              <Top10Clientes      data={data} />
              <FacturacionLinea   data={data} />
              <ClientesNuevos     data={data} />
              <ClientesPerdidos   data={data} />
              <MapaCiudades       data={data} />
              <Tendencias         data={data} />
              <Insights           data={data} />
            </>
          ) : (
            <>
              {seccion === "cumplimiento" && <CumplimientoEquipo data={data} />}
              {seccion === "kams"         && <CumplimientoKAM    data={data} />}
              {seccion === "top10"        && <Top10Clientes      data={data} />}
              {seccion === "lineas"       && <FacturacionLinea   data={data} />}
              {seccion === "nuevos"       && <ClientesNuevos     data={data} />}
              {seccion === "perdidos"     && <ClientesPerdidos   data={data} />}
              {seccion === "mapa"         && <MapaCiudades       data={data} />}
              {seccion === "tendencias"   && <Tendencias         data={data} />}
              {seccion === "insights"     && <Insights           data={data} />}
              {seccion === "config" && isAdmin && (
                <Configuracion data={data} onSave={handleSave} />
              )}
            </>
          )}
        </div>
      </div>
    </MonedaProvider>
  );
}
