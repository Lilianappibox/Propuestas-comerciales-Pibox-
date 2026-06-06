import { useState, useEffect, useCallback } from "react";
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

const SK_CIERRE = "pibox_cierre_data";

// ── Persistencia ───────────────────────────────────────────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem(SK_CIERRE);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return dataInicial;
}

function saveData(d) {
  try { localStorage.setItem(SK_CIERRE, JSON.stringify(d)); } catch { /* ignore */ }
}

// ── Secciones ──────────────────────────────────────────────────────────────
const SECCIONES = [
  { id: "cumplimiento", label: "Cumplimiento", icon: "🎯" },
  { id: "kams",         label: "KAMs",         icon: "👥" },
  { id: "top10",        label: "Top 10",        icon: "🏆" },
  { id: "lineas",       label: "Líneas",        icon: "📦" },
  { id: "nuevos",       label: "Nuevos",        icon: "🌱" },
  { id: "perdidos",     label: "Perdidos",      icon: "⚠️" },
  { id: "mapa",         label: "Mapa",          icon: "🗺️" },
  { id: "tendencias",   label: "Tendencias",    icon: "📈" },
  { id: "insights",     label: "Insights",      icon: "💡" },
  { id: "config",       label: "Config",        icon: "⚙️" },
];

// ── Tablero ────────────────────────────────────────────────────────────────
function Tablero({ data, onSave }) {
  const [seccionActiva, setSeccionActiva] = useState("cumplimiento");
  const [modoVista, setModoVista]         = useState("nav");
  const [toast, setToast]                 = useState("");

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // onSave con feedback
  const handleSave = useCallback((nuevaData) => {
    onSave(nuevaData);
    showToast("✅ Cambios guardados correctamente");
  }, [onSave, showToast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">

      {/* Toast global */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-purple-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-sm">P</div>
            <span className="font-black text-lg bg-gradient-to-r from-purple-700 to-pink-500 bg-clip-text text-transparent">pibox</span>
            <div className="h-6 w-px bg-purple-200" />
            <div>
              <h1 className="font-bold text-gray-800 text-sm leading-tight">Cierre Comercial</h1>
              <p className="text-xs text-purple-600 font-semibold">{data.mes}</p>
            </div>
          </div>
          <BarraTRM />
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setModoVista(modoVista === "nav" ? "full" : "nav")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-purple-200 text-purple-600 hover:bg-purple-50 transition"
            >
              {modoVista === "nav" ? "📋 Vista completa" : "🧭 Navegación"}
            </button>
            <ExportPDF targetId="tablero-contenido" mes={data.mes} />
          </div>
        </div>

        {/* Nav tabs */}
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSeccionActiva(s.id); setModoVista("nav"); }}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                seccionActiva === s.id && modoVista === "nav"
                  ? "bg-purple-600 text-white shadow"
                  : "text-gray-600 hover:bg-purple-50"
              }`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido — vista completa */}
      {modoVista === "full" && (
        <div id="tablero-contenido" className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          <CumplimientoEquipo data={data} />
          <CumplimientoKAM    data={data} />
          <Top10Clientes      data={data} />
          <FacturacionLinea   data={data} />
          <ClientesNuevos     data={data} />
          <ClientesPerdidos   data={data} />
          <MapaCiudades       data={data} />
          <Tendencias         data={data} />
          <Insights           data={data} />
        </div>
      )}

      {/* Contenido — navegación por sección
          IMPORTANTE: Configuracion se mantiene SIEMPRE montada (display:none cuando
          no está activa) para que su estado interno no se pierda al cambiar de tab. */}
      {modoVista === "nav" && (
        <div id="tablero-contenido" className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {seccionActiva === "cumplimiento" && <CumplimientoEquipo data={data} />}
          {seccionActiva === "kams"         && <CumplimientoKAM    data={data} />}
          {seccionActiva === "top10"        && <Top10Clientes      data={data} />}
          {seccionActiva === "lineas"       && <FacturacionLinea   data={data} />}
          {seccionActiva === "nuevos"       && <ClientesNuevos     data={data} />}
          {seccionActiva === "perdidos"     && <ClientesPerdidos   data={data} />}
          {seccionActiva === "mapa"         && <MapaCiudades       data={data} />}
          {seccionActiva === "tendencias"   && <Tendencias         data={data} />}
          {seccionActiva === "insights"     && <Insights           data={data} />}

          {/* Configuracion: siempre montada, oculta visualmente cuando no está activa */}
          <div style={{ display: seccionActiva === "config" ? "block" : "none" }}>
            <Configuracion data={data} onSave={handleSave} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function CierreComercial() {
  // Carga desde localStorage (persiste entre recargas y navegación)
  const [data, setData] = useState(loadData);

  // Persiste en localStorage cada vez que cambia
  useEffect(() => {
    saveData(data);
  }, [data]);

  return (
    <MonedaProvider>
      <Tablero data={data} onSave={setData} />
    </MonedaProvider>
  );
}
