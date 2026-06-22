import { useState, useEffect, lazy, Suspense } from "react";
import { loadIndex, SK_MES, loadIndexReadonly, loadMesDataReadonly, saveIndex, saveMesData, loadMesDataAsync } from "./riesgo/utils";

const ConfiguracionRiesgo = lazy(() => import("./riesgo/ConfiguracionRiesgo"));
const MetricasRiesgo      = lazy(() => import("./riesgo/MetricasRiesgo"));
const RankingRiesgo       = lazy(() => import("./riesgo/RankingRiesgo"));
const InformeEmpresa      = lazy(() => import("./riesgo/InformeEmpresa"));
const AnalisisCiudad      = lazy(() => import("./riesgo/AnalisisCiudad"));
const AnalisisPilotos     = lazy(() => import("./riesgo/AnalisisPilotos"));
const ClientesNuevos      = lazy(() => import("./riesgo/ClientesNuevos"));
const ClientesPerdidos    = lazy(() => import("./riesgo/ClientesPerdidos"));
const InformeCliente      = lazy(() => import("./riesgo/InformeCliente"));
const EmpresasHoras       = lazy(() => import("./riesgo/EmpresasHoras"));

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";

const TABS = [
  { id:"metricas", icon:"📊",  label:"Métricas"           },
  { id:"ranking",  icon:"🗂️",  label:"Ranking"            },
  { id:"ciudad",   icon:"🏙️",  label:"Análisis por Ciudad" },
  { id:"informe",  icon:"📄",  label:"Análisis por Empresa" },
  { id:"empresasHoras",  icon:"⏱️", label:"Empresas por Horas" },
  { id:"pilotos",  icon:"👤",  label:"Análisis Pilotos"    },
  { id:"nuevos",   icon:"🆕",  label:"Clientes Nuevos"    },
  { id:"perdidos", icon:"📉",  label:"Clientes Perdidos"  },
  { id:"informeCliente", icon:"📋", label:"Informe Clientes" },
  { id:"config",   icon:"⚙️",  label:"Configuración"      },
];

export default function RiesgoComercial({ currentUser }) {
  const [tab, setTab]     = useState("metricas");
  const [, forceRender]   = useState(0);
  const isAdmin = currentUser?.rol === "Administrativo";

  // Precargar datos de IndexedDB al cache en memoria
  useEffect(() => {
    const idx = loadIndex();
    const keys = Object.keys(idx);
    if (keys.length > 0) {
      Promise.all(keys.map(k => loadMesDataAsync(k))).then(() => forceRender(n => n + 1));
    }
  }, []);

  // No-admin: sincronizar meses del código que falten localmente
  useEffect(() => {
    if (isAdmin) return;
    const codeIndex = loadIndexReadonly();
    const codeKeys = Object.keys(codeIndex);
    if (codeKeys.length === 0) return;
    const localIndex = loadIndex();
    const missing = codeKeys.filter(k => !localIndex[k]);
    if (missing.length === 0) return;
    try {
      const merged = { ...localIndex };
      for (const key of missing) {
        merged[key] = codeIndex[key];
        const mesData = loadMesDataReadonly(key);
        if (mesData) saveMesData(key, mesData);
      }
      saveIndex(merged);
    } catch {}
    forceRender(n => n + 1);
  }, [isAdmin]);

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
              <button onClick={async () => {
                const idx = loadIndex();
                const allData = { index: idx, meses: {} };
                await Promise.all(Object.keys(idx).map(async (key) => {
                  const d = await loadMesDataAsync(key);
                  if (d) allData.meses[key] = d;
                }));
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
          {tab === "metricas" && <MetricasRiesgo />}
          {tab === "ranking"  && <RankingRiesgo />}
          {tab === "ciudad"   && <AnalisisCiudad />}
          {tab === "informe"  && <InformeEmpresa />}
          {tab === "pilotos"  && <AnalisisPilotos />}
          {tab === "nuevos"   && <ClientesNuevos />}
          {tab === "perdidos" && <ClientesPerdidos />}
          {tab === "informeCliente" && <InformeCliente currentUser={currentUser} />}
          {tab === "empresasHoras"  && <EmpresasHoras currentUser={currentUser} />}
          {tab === "config"   && <ConfiguracionRiesgo onMesesChange={handleMesesChange}/>}
        </Suspense>
      </div>
    </div>
  );
}
