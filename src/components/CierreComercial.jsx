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

function Tablero({ data, onSave }) {
  const [seccionActiva, setSeccionActiva] = useState("cumplimiento");
  const [modoVista, setModoVista] = useState("nav"); // nav | full

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
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

          {/* Barra TRM */}
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
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${seccionActiva === s.id && modoVista === "nav" ? "bg-purple-600 text-white shadow" : "text-gray-600 hover:bg-purple-50"}`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div id="tablero-contenido" className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {modoVista === "full" ? (
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
            {seccionActiva === "cumplimiento" && <CumplimientoEquipo data={data} />}
            {seccionActiva === "kams"         && <CumplimientoKAM    data={data} />}
            {seccionActiva === "top10"        && <Top10Clientes      data={data} />}
            {seccionActiva === "lineas"       && <FacturacionLinea   data={data} />}
            {seccionActiva === "nuevos"       && <ClientesNuevos     data={data} />}
            {seccionActiva === "perdidos"     && <ClientesPerdidos   data={data} />}
            {seccionActiva === "mapa"         && <MapaCiudades       data={data} />}
            {seccionActiva === "tendencias"   && <Tendencias         data={data} />}
            {seccionActiva === "insights"     && <Insights           data={data} />}
            {seccionActiva === "config"       && <Configuracion data={data} onSave={onSave} />}
          </>
        )}
      </div>
    </div>
  );
}

export default function CierreComercial() {
  const [data, setData] = useState(dataInicial);
  return (
    <MonedaProvider>
      <Tablero data={data} onSave={setData} />
    </MonedaProvider>
  );
}
