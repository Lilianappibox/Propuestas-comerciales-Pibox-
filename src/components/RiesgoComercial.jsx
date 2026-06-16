import { useState, lazy, Suspense } from "react";
import { loadIndex, SK_MES } from "./riesgo/utils";

const ConfiguracionRiesgo = lazy(() => import("./riesgo/ConfiguracionRiesgo"));
const MetricasRiesgo      = lazy(() => import("./riesgo/MetricasRiesgo"));
const InformeEmpresa      = lazy(() => import("./riesgo/InformeEmpresa"));
const AnalisisCiudad      = lazy(() => import("./riesgo/AnalisisCiudad"));

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";

const TABS = [
  { id:"config",   icon:"⚙️",  label:"Configuración"      },
  { id:"metricas", icon:"📊",  label:"Métricas"           },
  { id:"ciudad",   icon:"🏙️",  label:"Análisis por Ciudad" },
  { id:"informe",  icon:"📄",  label:"Informe por Empresa" },
];

export default function RiesgoComercial({ currentUser }) {
  const [tab, setTab]     = useState("metricas");
  const [, forceRender]   = useState(0);

  const handleMesesChange = () => forceRender(n=>n+1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner interno del módulo */}
      <div className="border-b border-purple-100 bg-white shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                 style={{background:BRAND_GRADIENT}}>🚨</div>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">Riesgo Comercial 360°</p>
              <p className="text-xs text-gray-500">Monitoreo automático de clientes · Detección de fuga y deterioro</p>
            </div>
            {currentUser?.rol === "Administrativo" && (
              <button onClick={() => {
                const idx = loadIndex();
                const allData = { index: idx, meses: {} };
                for (const key of Object.keys(idx)) {
                  try {
                    const d = localStorage.getItem(SK_MES(key));
                    if (d) allData.meses[key] = JSON.parse(d);
                  } catch {}
                }
                const blob = new Blob([JSON.stringify(allData)], { type: "application/json" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                a.download = "riesgo-export.json"; a.click();
              }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition shrink-0">
                📤 Exportar para el equipo
              </button>
            )}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  tab === t.id
                    ? "bg-purple-600 text-white shadow"
                    : "text-gray-600 hover:bg-purple-50"
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Suspense fallback={<div className="text-center py-10 text-purple-400 text-sm">Cargando...</div>}>
          {tab === "config"   && <ConfiguracionRiesgo onMesesChange={handleMesesChange}/>}
          {tab === "metricas" && <MetricasRiesgo />}
          {tab === "ciudad"   && <AnalisisCiudad />}
          {tab === "informe"  && <InformeEmpresa />}
        </Suspense>
      </div>
    </div>
  );
}
