import { useState } from "react";
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

// ── localStorage — clave única ─────────────────────────────────────────────
const SK = "pibox_cierre_v2";

function leer() {
  try {
    const s = localStorage.getItem(SK);
    if (s) return JSON.parse(s);
  } catch {}
  return JSON.parse(JSON.stringify(dataInicial));
}

function escribir(data) {
  try { localStorage.setItem(SK, JSON.stringify(data)); } catch {}
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

// ── App ─────────────────────────────────────────────────────────────────────
export default function CierreComercial() {
  const [data, setData] = useState(leer);
  const [seccion, setSeccion] = useState("cumplimiento");
  const [toast, setToast] = useState("");

  // Única función de actualización: modifica estado Y persiste al mismo tiempo
  const actualizar = (nuevaData) => {
    setData(nuevaData);
    escribir(nuevaData);
  };

  const mostrarToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleSave = (nuevaData) => {
    actualizar(nuevaData);
    mostrarToast("✅ Cambios guardados");
  };

  return (
    <MonedaProvider>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">

        {/* Toast */}
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
              <ExportPDF targetId="tablero-contenido" mes={data.mes} />
            </div>
          </div>

          {/* Nav */}
          <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
            {SECCIONES.map((s) => (
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

        {/* Contenido */}
        <div id="tablero-contenido" className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {seccion === "cumplimiento" && <CumplimientoEquipo data={data} />}
          {seccion === "kams"         && <CumplimientoKAM    data={data} />}
          {seccion === "top10"        && <Top10Clientes      data={data} />}
          {seccion === "lineas"       && <FacturacionLinea   data={data} />}
          {seccion === "nuevos"       && <ClientesNuevos     data={data} />}
          {seccion === "perdidos"     && <ClientesPerdidos   data={data} />}
          {seccion === "mapa"         && <MapaCiudades       data={data} />}
          {seccion === "tendencias"   && <Tendencias         data={data} />}
          {seccion === "insights"     && <Insights           data={data} />}
          {seccion === "config"       && (
            <Configuracion
              data={data}
              onSave={handleSave}
            />
          )}
        </div>
      </div>
    </MonedaProvider>
  );
}
