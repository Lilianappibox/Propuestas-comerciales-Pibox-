import { useState, useRef } from "react";
import {
  procesarDatos, deleteMes, mesesDisponibles,
  saveIndex, loadIndex, mesKey, labelMes, MESES_ES, PIBOX_PURPLE,
  saveMesData,
} from "./utils";

const MESES_NUM = Array.from({length:12},(_,i)=>i+1);
const ANIOS = [2024,2025,2026,2027];

export default function ConfiguracionRiesgo({ onMesesChange }) {
  const [anio, setAnio]       = useState(2026);
  const [mes, setMes]         = useState(5);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);
  const fileRef               = useRef();
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
      const XLSX = await import("xlsx");
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

      // Guardar índice
      const idx = loadIndex();
      idx[key] = entry;
      saveIndex(idx);

      // Guardar data procesada (empresas + ciudades)
      saveMesData(key, { ...entry, empresas: processed.empresas, ciudades: processed.ciudades });

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

  const handleDelete = (key, label) => {
    if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    deleteMes(key);
    const fresh = mesesDisponibles();
    setMeses(fresh);
    onMesesChange?.(fresh);
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
    try { return JSON.parse(localStorage.getItem(SK) || "null") || {}; }
    catch { return {}; }
  };
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const u  = {
      gmv_caida_rojo:     Number(fd.get("gmv"))/100,
      cancel_rojo:        Number(fd.get("cancel"))/100,
      completado_rojo:    Number(fd.get("completado"))/100,
    };
    localStorage.setItem(SK, JSON.stringify(u));
    setSaved(true);
    setTimeout(()=>setSaved(false),2500);
  };

  const cur = load();

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
      <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
        <span className="bg-red-100 text-red-700 rounded-lg p-1 text-sm">🎯</span>
        Umbrales de alerta (riesgo crítico 🔴)
      </h3>
      <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { name:"gmv",       label:"Caída de GMV crítica (%)", def: Math.abs((cur.gmv_caida_rojo??-0.15)*100) },
          { name:"cancel",    label:"Cancelaciones críticas (%)",def: (cur.cancel_rojo??0.20)*100 },
          { name:"completado",label:"Completado mínimo (%)",     def: (cur.completado_rojo??0.70)*100 },
        ].map(({name,label,def}) => (
          <div key={name}>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</label>
            <input type="number" name={name} defaultValue={def} min={0} max={100} step={1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
        ))}
        <div className="sm:col-span-3">
          <button type="submit"
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{background:"linear-gradient(135deg,#5B17A8,#7C22D4,#C026D3)"}}>
            {saved ? "✅ Guardado" : "💾 Guardar umbrales"}
          </button>
        </div>
      </form>
    </div>
  );
}
