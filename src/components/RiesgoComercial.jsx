import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { loadIndex, SK_MES, loadIndexReadonly, loadMesDataReadonly, saveIndex, saveMesData, loadMesDataAsync, idbLoadDrivers, idbLoadHorasRows, idbSaveDrivers, idbSaveHorasRows, UMBRALES_DEFAULT, SLA_DEFAULT, procesarDatos, mesKey, labelMes } from "./riesgo/utils";
import { publishToServer, fetchFromServer, clearFromServer } from "./serverSync";
import { RiesgoProvider } from "./riesgo/RiesgoContext";

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
const ProyeccionCliente   = lazy(() => import("./riesgo/ProyeccionCliente"));

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
  { id:"proyeccion",    icon:"🔮", label:"Proyección por cliente" },
  { id:"config",   icon:"⚙️",  label:"Configuración", adminOnly: true },
];

function RiesgoComercialInner({ currentUser }) {
  const [tab, setTab]       = useState("metricas");
  const [, forceRender]     = useState(0);
  const [importMsg, setImportMsg] = useState(null);
  const [importing, setImporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState(null);
  const [loadingServer, setLoadingServer] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [riesgoUmbrales, setRiesgoUmbrales] = useState(UMBRALES_DEFAULT);
  const [riesgoSlaConfig, setRiesgoSlaConfig] = useState(SLA_DEFAULT);
  const [chDesde, setChDesde] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
  });
  const [chHasta, setChHasta] = useState(() => new Date().toISOString().slice(0,10));
  const [chStatus, setChStatus] = useState("idle");
  const [chMsg, setChMsg]     = useState(null);
  const chPollRef = useRef(null);
  const importRef = useRef();
  const isAdmin = currentUser?.rol === "Administrativo";

  const saveChData = async (rawRows) => {
    const d0   = new Date(chDesde + "T12:00:00");
    const anio = d0.getFullYear();
    const mes  = d0.getMonth() + 1;
    const key  = mesKey(anio, mes);
    // Label muestra el rango exacto consultado en vez del nombre del mes
    const fmtD = (s) => s.split("-").reverse().join("/");
    const lbl  = `${fmtD(chDesde)} – ${fmtD(chHasta)}`;
    const processed = procesarDatos(rawRows, riesgoSlaConfig);
    const entry = {
      key, anio, mes,
      label:   lbl,
      archivo: `ClickHouse (${chDesde} → ${chHasta})`,
      savedAt: new Date().toISOString(),
      totales: processed.totales,
    };
    await saveMesData(key, { ...entry, empresas: processed.empresas, ciudades: processed.ciudades, drivers: processed.drivers || [] });
    const idx = loadIndex();
    idx[key] = entry;
    saveIndex(idx);
    if (processed.drivers?.length) await idbSaveDrivers(key, processed.drivers);
    // Solo columnas que usa EmpresasHoras — evita payload gigante al publicar
    const HORAS_COLS = ["company","city","date","booking_id","operation_type",
                        "service_status","estado_booking","driver_name","passenger_name",
                        "gmv","packages","cant_stops","route_time","cancelacion","cancelation"];
    const horasOdRows = rawRows
      .filter(r => {
        const op = String(r["operation_type"] || "").trim().toLowerCase();
        return op === "horas" || op === "on demand" || op === "bavaria paquetes tada";
      })
      .map(r => {
        const slim = {};
        for (const c of HORAS_COLS) slim[c] = r[c];
        slim.cancelacion = r.cancelacion || r.cancelation || "";
        return slim;
      });
    if (horasOdRows.length > 0) await idbSaveHorasRows(key, horasOdRows);
    setChStatus("idle");
    setChMsg({ ok: true, txt: `✅ ${lbl} cargado desde ClickHouse — ${rawRows.length.toLocaleString()} servicios, ${processed.empresas.length} empresas` });
    forceRender(n => n + 1);
  };

  const loadFromClickHouse = async () => {
    if (chStatus === "loading" || chStatus === "polling") return;
    setChStatus("loading");
    setChMsg(null);
    try {
      const res  = await fetch(`/api/riesgo_comercial/consulta?desde=${chDesde}&hasta=${chHasta}`);
      const json = await res.json();
      if (json.status === "done")  { await saveChData(json.data); return; }
      if (json.status === "error") {
        setChStatus("idle");
        setChMsg({ ok: false, txt: `❌ ${json.error}` });
        return;
      }
      setChStatus("polling");
      let attempts = 0;
      chPollRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 120) {
          clearInterval(chPollRef.current);
          setChStatus("idle");
          setChMsg({ ok: false, txt: "❌ Tiempo de espera agotado. Intenta de nuevo." });
          return;
        }
        try {
          const r2 = await fetch(`/api/riesgo_comercial/status?desde=${chDesde}&hasta=${chHasta}`);
          const j2 = await r2.json();
          if (j2.status === "done")  { clearInterval(chPollRef.current); await saveChData(j2.data); }
          else if (j2.status === "error") {
            clearInterval(chPollRef.current);
            setChStatus("idle");
            setChMsg({ ok: false, txt: `❌ ${j2.error}` });
          }
        } catch {}
      }, 5000);
    } catch (err) {
      setChStatus("idle");
      setChMsg({ ok: false, txt: `❌ Error de red: ${err.message}` });
    }
  };

  // Limpiar intervalo al desmontar
  useEffect(() => () => { if (chPollRef.current) clearInterval(chPollRef.current); }, []);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.index || !data.meses) throw new Error("Archivo inválido: estructura incorrecta.");
      const localIdx = loadIndex();
      saveIndex({ ...localIdx, ...data.index });
      await Promise.all(Object.entries(data.meses).map(([key, mesData]) => saveMesData(key, mesData)));
      if (data.horasRows) await Promise.all(Object.entries(data.horasRows).map(([key, rows]) => idbSaveHorasRows(key, rows)));
      // Drivers: desde campo separado o embebidos en mesData
      await Promise.all(Object.entries(data.meses).map(([key, mesData]) => {
        const drs = data.drivers?.[key] || mesData.drivers;
        if (drs && drs.length > 0) return idbSaveDrivers(key, drs);
      }));
      if (data.umbrales && Object.keys(data.umbrales).length > 0) {
        setRiesgoUmbrales(data.umbrales);
      }
      const nMeses = Object.keys(data.meses).length;
      setImportMsg({ ok: true, txt: `✅ ${nMeses} mes${nMeses !== 1 ? "es" : ""} importados correctamente` });
      forceRender(n => n + 1);
    } catch (err) {
      setImportMsg({ ok: false, txt: `❌ Error: ${err.message}` });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
      setTimeout(() => setImportMsg(null), 4000);
    }
  };

  // Precargar datos de IndexedDB al cache en memoria
  useEffect(() => {
    const idx = loadIndex();
    const keys = Object.keys(idx);
    if (keys.length > 0) {
      Promise.all(keys.map(k => loadMesDataAsync(k))).then(() => forceRender(n => n + 1));
    }
  }, []);

  // No-admin: cargar snapshot publicado y sondear actualizaciones automáticamente
  useEffect(() => {
    if (isAdmin) return;
    const applySnap = async (d, serverTs) => {
      saveIndex({ ...loadIndex(), ...d.index });
      await Promise.all([
        ...Object.entries(d.meses || {}).map(([k, v]) => saveMesData(k, v)),
        ...Object.entries(d.meses || {}).map(([k, v]) => {
          const drs = d.drivers?.[k] || v.drivers;
          if (drs?.length) return idbSaveDrivers(k, drs);
        }).filter(Boolean),
      ]);
      if (d.umbrales) setRiesgoUmbrales(d.umbrales);
      if (d.slaConfig) setRiesgoSlaConfig(d.slaConfig);
      if (serverTs) setLastSyncAt(serverTs);
      forceRender(n => n + 1);
    };

    let lastAppliedTs = null;
    const syncFromServer = async (skipIfSameTs = false) => {
      const snap = await fetchFromServer("riesgo").catch(() => null);
      if (!snap?.ok || !snap?.data?.index) {
        // Fallback al JSON bundled si no hay snapshot en servidor
        const codeIndex = loadIndexReadonly();
        const codeKeys = Object.keys(codeIndex);
        if (codeKeys.length > 0) {
          const localIndex = loadIndex();
          const missing = codeKeys.filter(k => !localIndex[k]);
          if (missing.length > 0) {
            const merged = { ...localIndex };
            for (const key of missing) {
              merged[key] = codeIndex[key];
              const mesData = loadMesDataReadonly(key);
              if (mesData) saveMesData(key, mesData);
            }
            saveIndex(merged);
          }
        }
        forceRender(n => n + 1);
        return false;
      }
      const serverTs = snap.published_at;
      // En sondeos periódicos, solo actualizar si hay nueva publicación
      if (skipIfSameTs && serverTs && lastAppliedTs === serverTs) return false;
      await applySnap(snap.data, serverTs);
      lastAppliedTs = serverTs;
      return true;
    };

    // Carga inicial
    setLoadingServer(true);
    syncFromServer(false).finally(() => setLoadingServer(false));

    // Sondear cada 3 minutos: detecta cuando el admin publica y actualiza automáticamente
    const interval = setInterval(() => { syncFromServer(true); }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleMesesChange = () => forceRender(n=>n+1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner interno del módulo */}
      <div className="border-b border-purple-100 bg-white shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                 style={{background:BRAND_GRADIENT}}>📦</div>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">Operación Pibox</p>
              <p className="text-xs text-gray-500">Monitoreo automático de clientes · Detección de fuga y deterioro</p>
            </div>
            {loadingServer && (
              <span className="text-xs text-purple-600 font-medium animate-pulse shrink-0">⏳ Sincronizando con el servidor…</span>
            )}
            {!isAdmin && !loadingServer && lastSyncAt && (
              <span className="text-xs text-gray-400 shrink-0 ml-auto">
                🔄 Actualizado: {new Date(lastSyncAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                {publishMsg && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${publishMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {publishMsg.txt}
                  </span>
                )}
                <button disabled={publishing} onClick={async () => {
                  if (!confirm("¿Limpiar los datos publicados? Los usuarios del equipo verán el módulo vacío.")) return;
                  setPublishing(true); setPublishMsg(null);
                  try {
                    await clearFromServer("riesgo");
                    setPublishMsg({ ok: true, txt: "🗑️ Datos del equipo eliminados" });
                  } catch (err) {
                    setPublishMsg({ ok: false, txt: `❌ Error: ${err.message}` });
                  } finally {
                    setPublishing(false);
                    setTimeout(() => setPublishMsg(null), 6000);
                  }
                }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition shrink-0 ${publishing ? "opacity-60 cursor-not-allowed bg-gray-400" : "bg-gray-500 hover:bg-gray-600"}`}>
                  🗑️ Limpiar publicación
                </button>
                <button disabled={publishing} onClick={async () => {
                  setPublishing(true); setPublishMsg(null);
                  try {
                    const idx = loadIndex();
                    const keys = Object.keys(idx);
                    // horasRows y drivers se excluyen del snapshot: pueden ser
                    // muy grandes (decenas de miles de filas brutas) y causan 502.
                    // Los drivers ya van embebidos en meses[key].drivers.
                    const allData = { index: idx, meses: {} };
                    await Promise.all(keys.map(async (key) => {
                      const d = await loadMesDataAsync(key);
                      if (d) allData.meses[key] = d;
                    }));
                    allData.umbrales = riesgoUmbrales;
                    allData.slaConfig = riesgoSlaConfig;
                    const result = await publishToServer("riesgo", allData);
                    setPublishMsg({ ok: true, txt: `✅ Publicado – ${new Date(result.published_at).toLocaleString("es-CO")}` });
                    setTimeout(() => setPublishMsg(null), 8000);
                  } catch (err) {
                    setPublishMsg({ ok: false, txt: `❌ Error al publicar: ${err.message}` });
                  } finally {
                    setPublishing(false);
                  }
                }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition shrink-0 ${publishing ? "opacity-60 cursor-not-allowed bg-purple-400" : "bg-purple-600 hover:bg-purple-700"}`}>
                  {publishing ? "⏳ Publicando…" : "🌐 Publicar para el equipo"}
                </button>
              </div>
            )}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {TABS.filter(t => !t.adminOnly || isAdmin).map(t => (
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
        {/* Panel ClickHouse — encima del contenido, disponible para todos, no en config */}
        {tab !== "config" && (
          <div className="bg-white rounded-2xl shadow-md border border-purple-100 p-5 mb-6">
            <h3 className="font-bold text-gray-700 text-sm mb-3">⚡ Cargar desde ClickHouse</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Desde</label>
                <input type="date" value={chDesde} onChange={e => setChDesde(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Hasta</label>
                <input type="date" value={chHasta} onChange={e => setChHasta(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <button onClick={loadFromClickHouse}
                disabled={chStatus === "loading" || chStatus === "polling"}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${
                  chStatus === "loading" || chStatus === "polling"
                    ? "bg-purple-300 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700"
                }`}>
                {chStatus === "loading" || chStatus === "polling" ? "⏳ Consultando…" : "⚡ Consultar ClickHouse"}
              </button>
            </div>
            {chMsg && (
              <p className={`mt-2 text-xs font-semibold ${chMsg.ok ? "text-green-700" : "text-red-600"}`}>
                {chMsg.txt}
              </p>
            )}
            {(chStatus === "loading" || chStatus === "polling") && (
              <p className="mt-2 text-xs text-purple-500 animate-pulse">
                Consultando ClickHouse… esto puede tardar hasta 2 minutos.
              </p>
            )}
          </div>
        )}

        <Suspense fallback={<div className="text-center py-10 text-purple-400 text-sm">Cargando...</div>}>
          {tab === "metricas" && <MetricasRiesgo umbrales={riesgoUmbrales} />}
          {tab === "ranking"  && <RankingRiesgo umbrales={riesgoUmbrales} />}
          {tab === "ciudad"   && <AnalisisCiudad />}
          {tab === "informe"  && <InformeEmpresa umbrales={riesgoUmbrales} />}
          {tab === "pilotos"  && <AnalisisPilotos />}
          {tab === "nuevos"   && <ClientesNuevos />}
          {tab === "perdidos" && <ClientesPerdidos />}
          {tab === "informeCliente" && <InformeCliente currentUser={currentUser} />}
          {tab === "empresasHoras"  && <EmpresasHoras currentUser={currentUser} />}
          {tab === "proyeccion"     && <ProyeccionCliente />}
          {tab === "config"   && <ConfiguracionRiesgo onMesesChange={handleMesesChange} slaConfig={riesgoSlaConfig} onSlaChange={setRiesgoSlaConfig} umbralesConfig={riesgoUmbrales} onUmbralesChange={setRiesgoUmbrales} />}
        </Suspense>
      </div>
    </div>
  );
}

export default function RiesgoComercial({ currentUser }) {
  return (
    <RiesgoProvider>
      <RiesgoComercialInner currentUser={currentUser} />
    </RiesgoProvider>
  );
}
