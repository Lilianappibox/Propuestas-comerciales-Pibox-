import { useState, useRef } from "react";
import XLSX from "../../utils/xlsxHelper";
import {
  procesarDatos, deleteMes, mesesDisponibles,
  saveIndex, loadIndex, mesKey, labelMes, MESES_ES, PIBOX_PURPLE, idbSaveDrivers, idbDeleteDrivers,
  saveMesData, idbSaveHorasRows, idbDeleteHorasRows, UMBRALES_DEFAULT,
} from "./utils";

const MESES_NUM = Array.from({length:12},(_,i)=>i+1);
const ANIOS = [2024,2025,2026,2027];

export default function ConfiguracionRiesgo({ onMesesChange }) {
  const [anio, setAnio]       = useState(2026);
  const [mes, setMes]         = useState(5);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);
  const fileRef               = useRef();
  const importRef             = useRef();
  const [meses, setMeses]     = useState(mesesDisponibles);

  const toast = (txt, ok=true) => {
    setMsg({txt, ok});
    setTimeout(()=>setMsg(null),3500);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMsg(null);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(new Uint8Array(buf), {type:"array", cellDates:true});
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:"", raw:false});

      if (!rows.length) throw new Error("El archivo está vacío.");

      const processed = procesarDatos(rows);
      const key       = mesKey(anio, mes);
      const entry     = {
        key, anio, mes,
        label: labelMes(anio, mes),
        archivo: file.name,
        savedAt: new Date().toISOString(),
        totales: processed.totales,
      };

      // Guardar data en IndexedDB — incluye drivers embebido para que quede en el export
      await saveMesData(key, {
        ...entry,
        empresas: processed.empresas,
        ciudades: processed.ciudades,
        drivers: processed.drivers || [],
      });

      // Guardar índice (solo metadata, muy pequeño)
      const idx = loadIndex();
      idx[key] = entry;
      saveIndex(idx);

      // Drivers también en IDB separado (para compatibilidad)
      if (processed.drivers) idbSaveDrivers(key, processed.drivers);

      // Filas crudas Horas+OD+Bavaria para la pestaña "Empresas por Horas"
      const horasOdRows = rows.filter(r => {
        const op = String(r["operation_type"] || "").trim().toLowerCase();
        return op === "horas" || op === "on demand" || op === "bavaria paquetes tada";
      });
      if (horasOdRows.length > 0) await idbSaveHorasRows(key, horasOdRows);

      const fresh = mesesDisponibles();
      setMeses(fresh);
      onMesesChange?.(fresh);
      toast(`✅ ${labelMes(anio,mes)} guardado — ${rows.length.toLocaleString()} servicios, ${processed.empresas.length} empresas`);
    } catch (err) {
      toast(`❌ Error: ${err.message}`, false);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (key, label) => {
    if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    await deleteMes(key);
    idbDeleteDrivers(key);
    idbDeleteHorasRows(key);
    const fresh = mesesDisponibles();
    setMeses(fresh);
    onMesesChange?.(fresh);
  };

  const handleImportJSON = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMsg(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.index || !data.meses) throw new Error("Archivo inválido: estructura incorrecta.");

      // Guardar índice
      const localIdx = loadIndex();
      const merged = { ...localIdx, ...data.index };
      saveIndex(merged);

      // Guardar datos de mes (métricas, ranking, ciudad, empresa, clientes, drivers embebidos)
      await Promise.all(Object.entries(data.meses).map(([key, mesData]) => saveMesData(key, mesData)));

      // Guardar filas crudas de Empresas por Horas
      if (data.horasRows) {
        await Promise.all(Object.entries(data.horasRows).map(([key, rows]) => idbSaveHorasRows(key, rows)));
      }

      // Drivers: desde campo separado o embebidos en mesData
      await Promise.all(Object.entries(data.meses).map(([key, mesData]) => {
        const drs = data.drivers?.[key] || mesData.drivers;
        if (drs && drs.length > 0) return idbSaveDrivers(key, drs);
      }));

      // Restaurar umbrales de Configuración
      if (data.umbrales && Object.keys(data.umbrales).length > 0) {
        localStorage.setItem("pibox_riesgo_umbrales", JSON.stringify(data.umbrales));
      }

      const fresh = mesesDisponibles();
      setMeses(fresh);
      onMesesChange?.(fresh);
      const nMeses = Object.keys(data.meses).length;
      toast(`✅ Importado correctamente — ${nMeses} mes${nMeses !== 1 ? "es" : ""} cargados`);
    } catch (err) {
      toast(`❌ Error al importar: ${err.message}`, false);
    } finally {
      setLoading(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Mensaje toast */}
      {msg && (
        <div className={`rounded-xl px-5 py-3 text-sm font-medium ${
          msg.ok ? "bg-green-50 text-green-800 border border-green-200"
                 : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {msg.txt}
        </div>
      )}

      {/* Info */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800">
        <b>¿Cómo funciona?</b> Sube el archivo de servicios de cada mes.
        El sistema lo procesa en tu navegador y guarda los datos comprimidos de forma persistente.
        Cada mes nuevo se compara automáticamente con el mes anterior en las <b>Métricas</b>.
      </div>

      {/* Indicador de espacio */}
      {(() => {
        let totalBytes = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("pibox_")) totalBytes += (localStorage.getItem(k) || "").length * 2;
        }
        const usedMB = (totalBytes / 1024 / 1024).toFixed(1);
        const pct = Math.min((totalBytes / (5 * 1024 * 1024)) * 100, 100);
        const color = pct > 80 ? "#DC2626" : pct > 60 ? "#D97706" : "#16A34A";
        return (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
            <span className="text-xs text-gray-500">Almacenamiento:</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-xs font-semibold" style={{ color }}>{usedMB} MB / ~5 MB</span>
          </div>
        );
      })()}

      {/* Formulario de carga */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
          <span className="bg-purple-100 text-purple-700 rounded-lg p-1 text-sm">📂</span>
          Subir nuevo mes
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Año</label>
            <select value={anio} onChange={e=>setAnio(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {ANIOS.map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Mes</label>
            <select value={mes} onChange={e=>setMes(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              {MESES_NUM.map(m=><option key={m} value={m}>{MESES_ES[m]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Archivo Excel (.xlsx)</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls"
              onChange={handleFile} disabled={loading}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 disabled:opacity-50" />
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-3 text-purple-700 text-sm py-3">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Procesando archivo... esto puede tomar unos segundos.
          </div>
        )}
      </div>

      {/* Importar JSON del equipo */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 text-base mb-1 flex items-center gap-2">
          <span className="bg-green-100 text-green-700 rounded-lg p-1 text-sm">📥</span>
          Importar datos del equipo
        </h3>
        <p className="text-xs text-gray-500 mb-4">Carga el archivo <b>riesgo-export.json</b> exportado por un administrador para sincronizar todos los meses, pilotos, Empresas por Horas y configuración.</p>
        <input ref={importRef} type="file" accept=".json"
          onChange={handleImportJSON} disabled={loading}
          className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200 disabled:opacity-50" />
      </div>

      {/* Lista de meses */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-700 rounded-lg p-1 text-sm">📅</span>
          Meses disponibles ({meses.length})
        </h3>

        {meses.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm">Aún no hay meses cargados.<br/>Sube tu primer archivo arriba.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...meses].reverse().map(m => (
              <div key={m.key} className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:border-purple-200 transition-colors">
                {/* Período */}
                <div className="flex-1">
                  <p className="font-bold text-purple-700">{m.label}</p>
                  <p className="text-xs text-gray-500">{m.archivo}</p>
                </div>
                {/* Stats */}
                {m.totales && (
                  <div className="hidden sm:flex items-center gap-4 text-xs text-gray-600">
                    <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-full font-semibold">
                      {m.totales.servicios?.toLocaleString()} servicios
                    </span>
                    <span className="bg-fuchsia-50 text-fuchsia-700 px-2 py-1 rounded-full font-semibold">
                      {m.totales.n_empresas} empresas
                    </span>
                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full font-semibold">
                      ${(m.totales.gmv/1e6).toFixed(1)}M GMV
                    </span>
                  </div>
                )}
                {/* Guarddado */}
                <span className="text-xs text-gray-400 hidden md:block">
                  {new Date(m.savedAt).toLocaleDateString("es-CO")}
                </span>
                {/* Eliminar */}
                <button onClick={()=>handleDelete(m.key, m.label)}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors text-sm"
                  title="Eliminar">
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Umbrales */}
      <UmbralesConfig />
    </div>
  );
}

function UmbralesConfig() {
  const SK = "pibox_riesgo_umbrales";
  const load = () => {
    try { return { ...UMBRALES_DEFAULT, ...JSON.parse(localStorage.getItem(SK) || "{}") }; }
    catch { return { ...UMBRALES_DEFAULT }; }
  };
  const [saved, setSaved] = useState(false);
  const [vals, setVals]   = useState(() => {
    const u = load();
    return {
      completado_rojo:     Math.round((u.completado_rojo     ?? 0.70) * 100),
      completado_amarillo: Math.round((u.completado_amarillo ?? 0.85) * 100),
      cancel_rojo:         Math.round((u.cancel_rojo         ?? 0.20) * 100),
      cancel_amarillo:     Math.round((u.cancel_amarillo     ?? 0.10) * 100),
      expirado_rojo:       Math.round((u.expirado_rojo       ?? 0.15) * 100),
      expirado_amarillo:   Math.round((u.expirado_amarillo   ?? 0.05) * 100),
      gmv_caida_rojo:      Math.round(Math.abs(u.gmv_caida_rojo     ?? 0.15) * 100),
      gmv_caida_amarillo:  Math.round(Math.abs(u.gmv_caida_amarillo ?? 0.05) * 100),
    };
  });

  const set = (k, v) => setVals(prev => ({ ...prev, [k]: Number(v) }));

  const handleSave = () => {
    const u = {
      completado_rojo:      vals.completado_rojo     / 100,
      completado_amarillo:  vals.completado_amarillo / 100,
      cancel_rojo:          vals.cancel_rojo         / 100,
      cancel_amarillo:      vals.cancel_amarillo     / 100,
      expirado_rojo:        vals.expirado_rojo       / 100,
      expirado_amarillo:    vals.expirado_amarillo   / 100,
      gmv_caida_rojo:      -(vals.gmv_caida_rojo     / 100),
      gmv_caida_amarillo:  -(vals.gmv_caida_amarillo / 100),
    };
    localStorage.setItem(SK, JSON.stringify(u));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    localStorage.removeItem(SK);
    setVals({
      completado_rojo:     70,
      completado_amarillo: 85,
      cancel_rojo:         20,
      cancel_amarillo:     10,
      expirado_rojo:       15,
      expirado_amarillo:   5,
      gmv_caida_rojo:      15,
      gmv_caida_amarillo:  5,
    });
  };

  const Input = ({ label, field, min=0, max=100 }) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-600 flex-1">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number" value={vals[field]} min={min} max={max} step={1}
          onChange={e => set(field, e.target.value)}
          className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <span className="text-xs text-gray-400">%</span>
      </div>
    </div>
  );

  const Section = ({ icon, title, children }) => (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{icon} {title}</p>
      {children}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
          <span className="bg-red-100 text-red-700 rounded-lg p-1 text-sm">🎯</span>
          Umbrales de riesgo
        </h3>
        <button onClick={handleReset}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
          ↩ Restaurar valores por defecto
        </button>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 mb-5 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-600 inline-block"/> Rojo — Riesgo crítico</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"/> Amarillo — Riesgo moderado</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">

        {/* Ef. Operativa */}
        <Section icon="📉" title="Ef. Operativa">
          <p className="text-[10px] text-gray-400">Umbral mínimo de Completado / (Completado + Cancel. Driver + Expirados)</p>
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-600 mb-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"/> Baja (🔴)</div>
            <Input label="Ef. Operativa menor a:" field="completado_rojo" />
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 mb-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/> Moderada (🟡)</div>
            <Input label="Ef. Operativa menor a:" field="completado_amarillo" />
          </div>
        </Section>

        {/* Cancelaciones */}
        <Section icon="❌" title="Cancelaciones">
          <p className="text-[10px] text-gray-400">% de servicios cancelados sobre el total</p>
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-600 mb-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"/> Altas (🔴)</div>
            <Input label="Cancelaciones mayores a:" field="cancel_rojo" />
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 mb-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/> Moderadas (🟡)</div>
            <Input label="Cancelaciones mayores a:" field="cancel_amarillo" />
          </div>
        </Section>

        {/* Expirados */}
        <Section icon="⏰" title="Expirados">
          <p className="text-[10px] text-gray-400">% de servicios expirados sobre el total</p>
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-600 mb-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"/> Altos (🔴)</div>
            <Input label="Expirados mayores a:" field="expirado_rojo" />
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 mb-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/> Moderados (🟡)</div>
            <Input label="Expirados mayores a:" field="expirado_amarillo" />
          </div>
        </Section>

        {/* Caída de GMV */}
        <Section icon="💸" title="Caída de GMV vs mes anterior">
          <p className="text-[10px] text-gray-400">% de caída respecto al mes anterior</p>
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-600 mb-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"/> Cayó (🔴)</div>
            <Input label="GMV cayó más de:" field="gmv_caida_rojo" />
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 mb-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/> Bajó (🟡)</div>
            <Input label="GMV bajó más de:" field="gmv_caida_amarillo" />
          </div>
        </Section>

      </div>

      <button onClick={handleSave}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{background:"linear-gradient(135deg,#5B17A8,#7C22D4,#C026D3)"}}>
        {saved ? "✅ Umbrales guardados" : "💾 Guardar umbrales"}
      </button>
    </div>
  );
}
