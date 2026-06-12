import { useState } from "react";
import ConfiguracionRiesgo from "./riesgo/ConfiguracionRiesgo";
import MetricasRiesgo      from "./riesgo/MetricasRiesgo";
import InformeEmpresa      from "./riesgo/InformeEmpresa";
import AnalisisCiudad      from "./riesgo/AnalisisCiudad";

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
        {tab === "config"   && <ConfiguracionRiesgo onMesesChange={handleMesesChange}/>}
        {tab === "metricas" && <MetricasRiesgo />}
        {tab === "ciudad"   && <AnalisisCiudad />}
        {tab === "informe"  && <InformeEmpresa />}
      </div>
    </div>
  );
}
