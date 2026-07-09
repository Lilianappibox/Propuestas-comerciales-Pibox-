import { useState, useRef } from "react";
import { fmtM } from "./utils";
import { parseExcelFile, parseExcelRaw, PARSERS, parseBasePlana, aggregateBase, KAM_MAP } from "./excelParser";
import ProyeccionClickhouse from "./ProyeccionClickhouse";

const HIST_KEY = "pibox_cierre_historial_cargas";
const MAX_HIST = 20;

function loadHistorial() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { return []; }
}
function saveHistorial(h) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, MAX_HIST))); } catch {}
}
function addHistorialEntry(tipo, nombre, total, agg) {
  const prev = loadHistorial();
  const entry = {
    id:        Date.now(),
    tipo,
    nombre,
    total,
    empresas:  Object.keys(agg.companies || {}).length,
    ciudades:  Object.keys(agg.ciudades  || {}).length,
    fecha:     new Date().toISOString(),
  };
  saveHistorial([entry, ...prev]);
  return entry;
}

function fmtFechaHist(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Auto-actualización de tendencias desde flat file ──────────────────────
const MC = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function parseM(label) {
  const parts = String(label || "").trim().split(/\s+/);
  const n3 = parts[0].slice(0, 3).toLowerCase();
  const mesIdx = MC.findIndex(m => m.toLowerCase() === n3);
  const raw = parseInt(parts[1] || "0");
  const anio = raw < 100 ? 2000 + raw : raw;
  return { mesIdx, anio };
}
function autoUpdateTendencias(formData, actualAgg, anteriorAgg) {
  if (!formData.tendencias?.length) return formData;
  const tendencias = formData.tendencias.map(t => ({ ...t }));

  const totalGmv  = v => Object.values(v?.companies || {}).reduce((a, c) => a + c.gmv, 0);
  const totalServ = v => Object.values(v?.companies || {}).reduce((a, c) => a + (c.servicios || 0), 0);

  const upsert = (agg, mesIdx, anio) => {
    const gmv = Math.round(totalGmv(agg));
    if (!gmv || mesIdx < 0 || anio < 2020) return;
    const label = `${MC[mesIdx]} ${String(anio).slice(-2)}`;
    const idx = tendencias.findIndex(t => { const p = parseM(t.mes); return p.mesIdx === mesIdx && p.anio === anio; });
    const serv = totalServ(agg);
    if (idx >= 0) {
      tendencias[idx] = { ...tendencias[idx], gmv, ...(serv > 0 && { servicios: serv }) };
    } else {
      tendencias.push({ mes: label, gmv, meta: 0, ...(serv > 0 && { servicios: serv }) });
    }
  };

  // Periodo actual del formulario → mes del flat file actual
  // Si no viene año (periodo = "Junio"), inferir del año corriente
  let { mesIdx, anio } = parseM(formData.periodo || formData.mes || "");
  if (anio < 2020 && mesIdx >= 0) {
    const now = new Date();
    anio = now.getFullYear();
    if (mesIdx > now.getMonth()) anio -= 1; // mes indicado ya pasó el año anterior
  }
  upsert(actualAgg, mesIdx, anio);

  // Mes anterior
  if (anteriorAgg && mesIdx >= 0 && anio > 2020) {
    const prevMesIdx = (mesIdx - 1 + 12) % 12;
    const prevAnio   = mesIdx === 0 ? anio - 1 : anio;
    upsert(anteriorAgg, prevMesIdx, prevAnio);
  }

  tendencias.sort((a, b) => {
    const pa = parseM(a.mes), pb = parseM(b.mes);
    return pa.anio !== pb.anio ? pa.anio - pb.anio : pa.mesIdx - pb.mesIdx;
  });
  return { ...formData, tendencias };
}

export default function Configuracion({ data, onSave }) {
  const [form, setForm] = useState({ ...data });
  const [tab, setTab] = useState("general");
  const [msg, setMsg] = useState("");
  const [cargandoOps, setCargandoOps] = useState(false);
  const [cargandoBase, setCargandoBase] = useState({ anterior: false, actual: false });
  const [msgBase, setMsgBase] = useState("");
  const [baseAnterior, setBaseAnterior] = useState(null); // { nombre, agg }
  const [baseActual,   setBaseActual]   = useState(null); // { nombre, agg }
  const [historial, setHistorial] = useState(() => loadHistorial());
  const [mostrarHist, setMostrarHist] = useState(false);
  const fileRef         = useRef();
  const fileAnteriorRef = useRef();
  const fileActualRef   = useRef();

  const handleChange = (path, value) => {
    const keys = path.split(".");
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = isNaN(value) ? value : Number(value);
      return next;
    });
  };

  const handleKAMChange = (idx, field, value) => {
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      // nombre es texto; los demás campos son números
      next.kams[idx][field] = field === "nombre" ? value : (isNaN(value) ? value : Number(value));
      next.kams[idx].cumplimiento = next.kams[idx].meta > 0
        ? Number(((next.kams[idx].gmv / next.kams[idx].meta) * 100).toFixed(2))
        : 0;
      return next;
    });
  };

  const addKAM = () => {
    setForm((prev) => ({
      ...prev,
      kams: [...prev.kams, { nombre: "Nuevo KAM", meta: 0, gmv: 0, okr: 0, cumplimiento: 0,
        crecimientoVsMes: 0, crecimientoVsMesPct: 0, crecimientoVsAnio: 0, crecimientoVsAnioPct: 0 }],
    }));
  };

  const removeKAM = (idx) => {
    setForm((prev) => ({ ...prev, kams: prev.kams.filter((_, i) => i !== idx) }));
  };

  const leerBase = async (file, tipo) => {
    setCargandoBase(prev => ({ ...prev, [tipo]: true }));
    setMsgBase(`⏳ Leyendo "${file.name}"…`);
    try {
      const rows = await parseExcelFile(file);
      if (!rows.length) { setMsgBase("⚠️ El archivo está vacío."); setCargandoBase(prev => ({ ...prev, [tipo]: false })); return null; }
      const agg = aggregateBase(rows);
      addHistorialEntry(tipo, file.name, rows.length, agg);
      setHistorial(loadHistorial());
      return { nombre: file.name, agg, total: rows.length };
    } catch (err) {
      setMsgBase(`❌ Error al leer el archivo: ${err.message}`);
      return null;
    } finally {
      setCargandoBase(prev => ({ ...prev, [tipo]: false }));
    }
  };

  const aplicarComparativo = (actual, anterior) => {
    let nuevo = parseBasePlana(actual.agg, anterior?.agg || null, form);
    nuevo = autoUpdateTendencias(nuevo, actual.agg, anterior?.agg || null);
    setForm(nuevo);
    const antInfo = anterior
      ? ` comparado con "${anterior.nombre}"`
      : " (sin mes anterior — clientes nuevos/perdidos requieren ambos archivos)";
    setMsgBase(`✅ ${actual.total.toLocaleString("es-CO")} filas procesadas${antInfo}. Haz clic en 📢 Publicar para el equipo cuando estés lista.`);
  };

  const handleAnterior = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const result = await leerBase(file, "anterior");
    if (!result) return;
    setBaseAnterior(result);
    if (baseActual) aplicarComparativo(baseActual, result);
    else setMsgBase("✅ Mes anterior cargado. Ahora carga el archivo del mes actual.");
  };

  const handleActual = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const result = await leerBase(file, "actual");
    if (!result) return;
    setBaseActual(result);
    aplicarComparativo(result, baseAnterior);
  };

  const eliminarAnterior = () => {
    setBaseAnterior(null);
    if (baseActual) aplicarComparativo(baseActual, null);
    else setMsgBase("");
  };

  const eliminarActual = () => {
    setBaseActual(null);
    setForm(prev => ({ ...prev, top10Clientes: [], clientesNuevos: [], clientesPerdidos: [], facturacionLinea: [], facturacionCiudad: [] }));
    setMsgBase("");
  };

  const handleSave = () => {
    onSave(form);
    setMsg("✅ Configuración guardada correctamente");
    setTimeout(() => setMsg(""), 3000);
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setMsg(`⏳ Leyendo "${file.name}"...`);
    try {
      const rows   = await parseExcelFile(file);
      const parser = PARSERS[tab];
      if (!parser) { setMsg("⚠️ No hay parser definido para este tab."); return; }
      const nuevo  = parser(rows, form);
      if (!nuevo)  { setMsg("⚠️ No se encontraron datos reconocibles en el archivo. Revisa las cabeceras."); return; }
      setForm(nuevo);
      setMsg(`✅ ${file.name} cargado — ${rows.length} filas importadas. Haz clic en Guardar para confirmar.`);
    } catch (err) {
      setMsg(`❌ Error al leer el archivo: ${err.message}`);
    }
    setTimeout(() => setMsg(""), 6000);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(form, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cierre-${form.mes.replace(" ", "-")}.json`;
    a.click();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        setForm(parsed);
        setMsg("✅ Datos importados desde JSON");
        setTimeout(() => setMsg(""), 3000);
      } catch {
        setMsg("❌ Error al leer el archivo JSON");
      }
    };
    reader.readAsText(file);
  };

  const TABS = [
    { id: "general",           label: "General"           },
    { id: "kams",              label: "KAMs"              },
    { id: "top 10",            label: "Top 10"            },
    { id: "clientes nuevos",   label: "Clientes Nuevos"   },
    { id: "clientes perdidos", label: "Clientes Perdidos" },
    { id: "líneas",            label: "Líneas"            },
    { id: "ciudades",          label: "Ciudades"          },
    { id: "tendencias",        label: "Tendencias"        },
    { id: "proyeccion",        label: "Proyección Cierre" },
  ];

  const tabLabel = TABS.find((t) => t.id === tab)?.label ?? tab;

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      {/* ── Header global ── */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-purple-800">⚙️ Módulo de Configuración</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => onSave(form)}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition">
            📢 Publicar para el equipo
          </button>
          <button onClick={handleExportJSON}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
            💾 Exportar JSON
          </button>
          <label className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition cursor-pointer">
            📂 Importar JSON
            <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          </label>
        </div>
      </div>

      {msg && <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700 font-medium">{msg}</div>}

      {/* ── Carga de base plana ── */}
      <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
        <p className="font-bold text-indigo-800 text-sm mb-1">📊 Cargar base plana mensual</p>
        <p className="text-xs text-indigo-500 mb-4">
          Alimenta: <span className="font-semibold">Top 10 · Clientes Nuevos · Clientes Perdidos · Líneas · Ciudades</span>
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Mes anterior */}
          <div className="bg-white border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Mes anterior</p>
            {baseAnterior ? (
              <div className="flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-2">
                <span className="text-indigo-700 text-xs font-medium flex-1 truncate">📄 {baseAnterior.nombre}</span>
                <button onClick={eliminarAnterior} className="text-red-400 hover:text-red-600 font-bold text-sm shrink-0" title="Eliminar">✕</button>
              </div>
            ) : (
              <label className={`cursor-pointer flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold transition ${cargandoBase.anterior ? "border-indigo-200 text-indigo-300 cursor-not-allowed" : "border-indigo-300 text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50"}`}>
                {cargandoBase.anterior ? "⏳ Leyendo…" : "📥 Cargar mes anterior"}
                <input ref={fileAnteriorRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleAnterior} disabled={cargandoBase.anterior} />
              </label>
            )}
            <p className="text-xs text-gray-400 mt-2">Opcional — necesario para crecimiento y clientes nuevos/perdidos</p>
          </div>
          {/* Mes actual */}
          <div className="bg-white border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Mes actual (cierre)</p>
            {baseActual ? (
              <div className="flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-2">
                <span className="text-indigo-700 text-xs font-medium flex-1 truncate">📄 {baseActual.nombre}</span>
                <button onClick={eliminarActual} className="text-red-400 hover:text-red-600 font-bold text-sm shrink-0" title="Eliminar">✕</button>
              </div>
            ) : (
              <label className={`cursor-pointer flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold transition ${cargandoBase.actual ? "border-purple-200 text-purple-300 cursor-not-allowed" : "border-purple-400 text-purple-600 hover:border-purple-600 hover:bg-purple-50"}`}>
                {cargandoBase.actual ? "⏳ Leyendo…" : "📥 Cargar mes actual"}
                <input ref={fileActualRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleActual} disabled={cargandoBase.actual} />
              </label>
            )}
            <p className="text-xs text-gray-400 mt-2">Requerido — genera Top 10, Líneas y Ciudades</p>
          </div>
        </div>
        {msgBase && (
          <p className={`mt-3 text-xs font-semibold rounded-lg px-3 py-2 ${msgBase.startsWith("✅") ? "bg-green-50 text-green-700" : msgBase.startsWith("❌") ? "bg-red-50 text-red-600" : "bg-indigo-100 text-indigo-700"}`}>
            {msgBase}
          </p>
        )}

        {/* ── Acciones base plana ── */}
        {baseActual && (
          <div className="mt-4 flex gap-3 flex-wrap">
            <button
              onClick={() => onSave(form)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition shadow-sm"
            >
              📢 Guardar y publicar base plana
            </button>
            <button
              onClick={() => {
                const formLimpio = { ...form, top10Clientes: [], clientesNuevos: [], clientesPerdidos: [], facturacionLinea: [], facturacionCiudad: [] };
                eliminarActual();
                eliminarAnterior();
                onSave(formLimpio);
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition shadow-sm"
            >
              🗑️ Eliminar base plana publicada
            </button>
          </div>
        )}

        {/* ── Historial de cargas ── */}
        <div className="mt-4">
          <button
            onClick={() => setMostrarHist(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
          >
            <span>{mostrarHist ? "▾" : "▸"}</span>
            Historial de cargas
            {historial.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 text-[10px] font-bold">
                {historial.length}
              </span>
            )}
          </button>

          {mostrarHist && (
            <div className="mt-2">
              {historial.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Sin cargas registradas aún.</p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-indigo-100">
                    <table className="w-full text-xs">
                      <thead className="bg-indigo-50 text-[10px] text-indigo-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha y hora</th>
                          <th className="px-3 py-2 text-left">Tipo</th>
                          <th className="px-3 py-2 text-left">Archivo</th>
                          <th className="px-3 py-2 text-right">Filas</th>
                          <th className="px-3 py-2 text-right">Empresas</th>
                          <th className="px-3 py-2 text-right">Ciudades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historial.map((h, i) => (
                          <tr key={h.id} className={i % 2 === 0 ? "bg-white" : "bg-indigo-50/40"}>
                            <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{fmtFechaHist(h.fecha)}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${h.tipo === "actual" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                {h.tipo === "actual" ? "Mes actual" : "Mes anterior"}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-gray-700 max-w-[220px] truncate" title={h.nombre}>
                              📄 {h.nombre}
                            </td>
                            <td className="px-3 py-1.5 text-right font-semibold text-gray-700">{(h.total || 0).toLocaleString("es-CO")}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{(h.empresas || 0).toLocaleString("es-CO")}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{(h.ciudades || 0).toLocaleString("es-CO")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() => { saveHistorial([]); setHistorial([]); }}
                    className="mt-2 text-[10px] text-red-400 hover:text-red-600 transition"
                  >
                    🗑 Limpiar historial
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-1 mb-3 border-b border-purple-100 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-t text-xs font-semibold transition ${tab === t.id ? "bg-purple-600 text-white" : "text-gray-500 hover:text-purple-700 hover:bg-purple-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Barra de acciones del tab activo ── */}
      {tab !== "proyeccion" && (
      <div className="flex flex-wrap gap-2 items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5">
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition"
          >
            📥 Cargar Excel — {tabLabel}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
          {tab === "top 10" && (
            <button
              onClick={() => {
                const totalGmv = form.top10Clientes.reduce((a, c) => a + (c.gmvActual || 0), 0);
                const next = form.top10Clientes.map((c) => ({
                  ...c,
                  crecimiento:   c.gmvAnterior > 0 ? parseFloat((((c.gmvActual - c.gmvAnterior) / c.gmvAnterior) * 100).toFixed(2)) : 0,
                  participacion: totalGmv > 0       ? parseFloat(((c.gmvActual / totalGmv) * 100).toFixed(2))                        : 0,
                }));
                setForm((p) => ({ ...p, top10Clientes: next }));
                setMsg("🔄 Recalculado — guarda para confirmar");
                setTimeout(() => setMsg(""), 3000);
              }}
              className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
            >
              🔄 Recalcular crec. y part.
            </button>
          )}
        </div>
        <button
          onClick={handleSave}
          className="px-5 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-bold hover:bg-pink-700 transition shadow"
        >
          💾 Guardar {tabLabel}
        </button>
      </div>
      )}

      {/* Botón guardar para proyección */}
      {tab === "proyeccion" && (
        <div className="flex justify-end mb-5">
          <button onClick={handleSave}
            className="px-5 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-bold hover:bg-pink-700 transition shadow">
            💾 Guardar Proyección
          </button>
        </div>
      )}

      {tab === "general" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Mes" value={form.mes} onChange={(v) => handleChange("mes", v)} type="text" />
          <Field label="Período (ej: Enero)" value={form.periodo} onChange={(v) => handleChange("periodo", v)} type="text" />
          <Field label="Año" value={form.anio} onChange={(v) => handleChange("anio", v)} />
          <Field label="Meta Equipo" value={form.cumplimientoEquipo.meta} onChange={(v) => handleChange("cumplimientoEquipo.meta", v)} />
          <Field label="GMV Real" value={form.cumplimientoEquipo.gmv} onChange={(v) => handleChange("cumplimientoEquipo.gmv", v)} />
          <Field label="Utilidad Bruta" value={form.cumplimientoEquipo.utilidadBruta} onChange={(v) => handleChange("cumplimientoEquipo.utilidadBruta", v)} />
          <Field label="Meta Mes Pasado" value={form.cumplimientoEquipo.mesPasadoMeta} onChange={(v) => handleChange("cumplimientoEquipo.mesPasadoMeta", v)} />
          <Field label="GMV Mes Pasado" value={form.cumplimientoEquipo.mesPasadoGmv} onChange={(v) => handleChange("cumplimientoEquipo.mesPasadoGmv", v)} />
          <Field label="Meta Año Pasado" value={form.cumplimientoEquipo.anioPasadoMeta} onChange={(v) => handleChange("cumplimientoEquipo.anioPasadoMeta", v)} />
          <Field label="GMV Año Pasado" value={form.cumplimientoEquipo.anioPasadoGmv} onChange={(v) => handleChange("cumplimientoEquipo.anioPasadoGmv", v)} />
        </div>
      )}

      {tab === "kams" && (
        <div className="space-y-4">
          {form.kams.map((k, i) => (
            <div key={i} className="border border-purple-100 rounded-xl p-4">
              {/* Nombre del KAM — editable */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Nombre del KAM</label>
                  <input
                    value={k.nombre}
                    onChange={(e) => handleKAMChange(i, "nombre", e.target.value)}
                    className="w-full border border-purple-200 rounded-lg px-3 py-1.5 text-sm font-bold text-purple-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-300 bg-purple-50"
                    placeholder="Nombre del KAM"
                  />
                </div>
                <button
                  onClick={() => removeKAM(i)}
                  className="mt-4 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-2 py-1 text-xs font-semibold transition"
                >
                  ✕ Eliminar
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Meta ($)" value={k.meta} onChange={(v) => handleKAMChange(i, "meta", v)} />
                <Field label="GMV ($)"  value={k.gmv}  onChange={(v) => handleKAMChange(i, "gmv",  v)} />
                <Field label="OKR %"    value={k.okr}  onChange={(v) => handleKAMChange(i, "okr",  v)} />
                <div className="rounded-lg bg-purple-50 p-2 text-center flex flex-col justify-center">
                  <p className="text-xs text-gray-500">Cumplimiento</p>
                  <p className="text-lg font-bold text-purple-700">{(k.cumplimiento ?? 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addKAM}
            className="w-full py-2 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl text-sm font-semibold hover:bg-purple-50 transition"
          >
            + Agregar KAM
          </button>
        </div>
      )}

      {tab === "top 10" && (
        <div>
          <p className="text-xs text-gray-500 mb-3">
            Edita los clientes del ranking. El crecimiento y la participación se calculan automáticamente al guardar si los dejas en 0, o puedes ingresarlos manualmente.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-purple-50 text-purple-800 text-xs">
                  <th className="text-left p-2 w-6">#</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">KAM</th>
                  <th className="text-right p-2">GMV Mes Actual</th>
                  <th className="text-right p-2">GMV Mes Anterior</th>
                  <th className="text-right p-2">Crec. %</th>
                  <th className="text-right p-2">Participación %</th>
                  <th className="p-2 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {form.top10Clientes.map((row, ri) => (
                  <tr key={ri} className="border-b hover:bg-purple-50">
                    <td className="p-1 text-center text-purple-400 font-bold text-xs">{ri + 1}</td>
                    {["cliente", "kam"].map((col) => (
                      <td key={col} className="p-1">
                        <input
                          value={row[col] ?? ""}
                          onChange={(e) => {
                            const next = form.top10Clientes.map((r, i) =>
                              i === ri ? { ...r, [col]: e.target.value } : r
                            );
                            setForm((p) => ({ ...p, top10Clientes: next }));
                          }}
                          className="w-full border-b border-gray-200 px-2 py-1 text-xs focus:outline-none focus:border-purple-400 min-w-[100px]"
                        />
                      </td>
                    ))}
                    {["gmvActual", "gmvAnterior"].map((col) => (
                      <td key={col} className="p-1">
                        <input
                          type="number"
                          value={row[col] ?? ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const next = form.top10Clientes.map((r, i) => {
                              if (i !== ri) return r;
                              const updated = { ...r, [col]: val };
                              // Recalcula crecimiento automáticamente
                              if (updated.gmvAnterior > 0) {
                                updated.crecimiento = parseFloat((
                                  ((updated.gmvActual - updated.gmvAnterior) / updated.gmvAnterior) * 100
                                ).toFixed(2));
                              }
                              return updated;
                            });
                            setForm((p) => ({ ...p, top10Clientes: next }));
                          }}
                          className="w-full border-b border-gray-200 px-2 py-1 text-xs text-right focus:outline-none focus:border-purple-400 min-w-[110px]"
                        />
                      </td>
                    ))}
                    {/* Crecimiento — calculado pero editable */}
                    <td className="p-1">
                      <input
                        type="number"
                        value={row.crecimiento ?? ""}
                        onChange={(e) => {
                          const next = form.top10Clientes.map((r, i) =>
                            i === ri ? { ...r, crecimiento: Number(e.target.value) } : r
                          );
                          setForm((p) => ({ ...p, top10Clientes: next }));
                        }}
                        className={`w-full border-b px-2 py-1 text-xs text-right focus:outline-none focus:border-purple-400 min-w-[80px] ${
                          (row.crecimiento ?? 0) >= 0 ? "text-green-600 border-green-200" : "text-red-500 border-red-200"
                        }`}
                      />
                    </td>
                    {/* Participación */}
                    <td className="p-1">
                      <input
                        type="number"
                        value={row.participacion ?? ""}
                        onChange={(e) => {
                          const next = form.top10Clientes.map((r, i) =>
                            i === ri ? { ...r, participacion: Number(e.target.value) } : r
                          );
                          setForm((p) => ({ ...p, top10Clientes: next }));
                        }}
                        className="w-full border-b border-gray-200 px-2 py-1 text-xs text-right focus:outline-none focus:border-purple-400 min-w-[80px]"
                      />
                    </td>
                    <td className="p-1">
                      <button
                        onClick={() => setForm((p) => ({ ...p, top10Clientes: p.top10Clientes.filter((_, i) => i !== ri) }))}
                        className="text-red-400 hover:text-red-600 text-xs px-1"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-3 items-center">
            <button
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  top10Clientes: [
                    ...p.top10Clientes,
                    { cliente: "", kam: "", gmvActual: 0, gmvAnterior: 0, crecimiento: 0, participacion: 0 },
                  ],
                }))
              }
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200 transition"
            >
              + Agregar cliente
            </button>
          </div>

          {/* Vista previa rápida */}
          <details className="mt-4">
            <summary className="text-xs font-semibold text-purple-700 cursor-pointer hover:text-purple-900">
              Vista previa del ranking
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-purple-50 text-purple-800">
                    <th className="p-1 text-left">#</th>
                    <th className="p-1 text-left">Cliente</th>
                    <th className="p-1 text-left">KAM</th>
                    <th className="p-1 text-right">GMV Actual</th>
                    <th className="p-1 text-right">GMV Anterior</th>
                    <th className="p-1 text-right">Crec.</th>
                    <th className="p-1 text-right">Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {form.top10Clientes.map((c, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-1 font-bold text-purple-400">{i + 1}</td>
                      <td className="p-1 font-medium">{c.cliente}</td>
                      <td className="p-1 text-gray-500">{c.kam}</td>
                      <td className="p-1 text-right text-purple-700">${(c.gmvActual || 0).toLocaleString("es-CO")}</td>
                      <td className="p-1 text-right text-gray-400">${(c.gmvAnterior || 0).toLocaleString("es-CO")}</td>
                      <td className={`p-1 text-right font-semibold ${(c.crecimiento || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {(c.crecimiento || 0) >= 0 ? "▲" : "▼"} {Math.abs(c.crecimiento || 0).toFixed(2)}%
                      </td>
                      <td className="p-1 text-right text-gray-500">{(c.participacion || 0).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {tab === "clientes nuevos" && (
        <EditableTable
          rows={form.clientesNuevos}
          columns={["kam", "cliente", "gmv", "servicios"]}
          onChange={(rows) => setForm((p) => ({ ...p, clientesNuevos: rows }))}
        />
      )}

      {tab === "clientes perdidos" && (
        <EditableTable
          rows={form.clientesPerdidos}
          columns={["kam", "cliente", "gmvMesAnterior"]}
          onChange={(rows) => setForm((p) => ({ ...p, clientesPerdidos: rows }))}
        />
      )}

      {tab === "líneas" && (
        <EditableTable
          rows={form.facturacionLinea}
          columns={["linea", "gmv", "servicios", "paquetes", "gmvAnt", "serviciosAnt", "paquetesAnt"]}
          columnLabels={{ linea: "Línea", gmv: "GMV", servicios: "Servicios", paquetes: "Paquetes", gmvAnt: "GMV Anterior", serviciosAnt: "Serv. Anterior", paquetesAnt: "Paq. Anterior" }}
          onChange={(rows) => setForm((p) => ({ ...p, facturacionLinea: rows }))}
        />
      )}

      {tab === "ciudades" && (
        <EditableTable
          rows={form.facturacionCiudad}
          columns={["ciudad", "gmv", "participacion"]}
          onChange={(rows) => setForm((p) => ({ ...p, facturacionCiudad: rows }))}
        />
      )}

      {tab === "tendencias" && (
        <EditableTable
          rows={form.tendencias}
          columns={["mes", "gmv", "meta", "servicios"]}
          columnLabels={{ mes: "Mes", gmv: "GMV", meta: "Meta", servicios: "Servicios" }}
          onChange={(rows) => setForm((p) => ({ ...p, tendencias: rows }))}
        />
      )}

      {tab === "proyeccion" && (() => {
        const proy = form.proyeccion || {};
        const updateProy = (key, val) => {
          // Solo convertir a número si es string numérico, no arrays/objetos/null
          const parsed = (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val))) ? Number(val) : val;
          setForm((p) => ({ ...p, proyeccion: { ...(p.proyeccion || {}), [key]: parsed } }));
        };

        // Callback cuando ClickHouse devuelve datos: actualiza GMV, evolución y KAMs
        const handleClickHouseData = ({ gmvActual, evolucion, kamGmv }) => {
          const normK = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

          // Construye el conjunto de variantes aceptables para un nombre del formulario.
          // Ejemplo: "Cuentas Farmer" → {"cuentas farmer", "johana navarrete"}
          //          "Johana Navarrete" → {"johana navarrete", "cuentas farmer"}
          const buildMatchSet = (formName) => {
            const fn = normK(formName);
            const s  = new Set([fn]);
            // Forward: formName es clave en KAM_MAP → añadir su valor homologado
            if (KAM_MAP[fn]) s.add(normK(KAM_MAP[fn]));
            // Reverse: formName coincide con un valor de KAM_MAP → añadir su clave
            for (const [k, v] of Object.entries(KAM_MAP)) {
              if (normK(v) === fn) s.add(k);
            }
            return s;
          };

          // Fallback: todas las palabras del nombre más corto están en el más largo
          // Ej: "Jaime Girón" matchea con "Jaime Andrés Girón"
          const wordMatch = (a, b) => {
            const wa = normK(a).split(/\s+/).filter(Boolean);
            const wb = normK(b).split(/\s+/).filter(Boolean);
            const [shorter, longer] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
            return shorter.length > 0 && shorter.every(w => longer.includes(w));
          };

          setForm((prev) => {
            const p = { ...(prev.proyeccion || {}) };
            // 1. GMV Actual en Sistema
            p.gmvActual = gmvActual;
            // 2. Evolución diaria (cuenta de días)
            p.diasEvolucion = evolucion.length;
            p.archivoOps = `ClickHouse ${new Date().toLocaleDateString("es-CO")}`;
            // 3. GMV por KAM — matching bidireccional con KAM_MAP + fallback por palabras
            const baseKams = p.kams || prev.kams || [];
            if (baseKams.length && kamGmv.length) {
              p.kams = baseKams.map(k => {
                const ms = buildMatchSet(k.nombre);
                const match =
                  kamGmv.find(ch =>
                    ms.has(normK(ch.nombre)) || ms.has(normK(ch.rawNombre))
                  ) ||
                  kamGmv.find(ch =>
                    wordMatch(k.nombre, ch.rawNombre) || wordMatch(k.nombre, ch.nombre)
                  );
                if (!match) return k;
                const gmv = match.gmv;
                const cumplimiento = k.meta > 0 ? parseFloat(((gmv / k.meta) * 100).toFixed(2)) : 0;
                return { ...k, gmv, cumplimiento };
              });
            }
            return { ...prev, proyeccion: p };
          });
          setMsg("✅ Datos de ClickHouse aplicados. Haz clic en 📢 Publicar para el equipo.");
          setTimeout(() => setMsg(""), 8000);
        };

        return (
          <div className="space-y-4">
            <p className="text-xs text-gray-500 mb-2">Configura los datos de proyección del mes actual.</p>

            {/* ClickHouse sync */}
            <ProyeccionClickhouse onDataLoaded={handleClickHouseData} />

            {/* Upload evolución diaria */}
            <UploadEvolucion proy={proy} setForm={setForm} setMsg={setMsg} cargandoOps={cargandoOps} setCargandoOps={setCargandoOps} />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Mes a Proyectar" value={proy.mesProyeccion || ""} onChange={(v) => updateProy("mesProyeccion", v)} type="text" />
              <Field label="Meta del Mes ($)" value={proy.metaMes || ""} onChange={(v) => updateProy("metaMes", v)} />
              <Field label="GMV Actual en Sistema ($)" value={proy.gmvActual || ""} onChange={(v) => updateProy("gmvActual", v)} />
              <Field label="GMV TaDa Pendiente ($)" value={proy.gmvTadaPendiente || ""} onChange={(v) => updateProy("gmvTadaPendiente", v)} />
              <Field label="GMV Storage Pendiente ($)" value={proy.gmvStoragePendiente || ""} onChange={(v) => updateProy("gmvStoragePendiente", v)} />
              <Field label="Utilidad Proyectada ($)" value={proy.utilidadValor || ""} onChange={(v) => updateProy("utilidadValor", v)} />
              <Field label="Días Transcurridos" value={proy.diasTranscurridos || ""} onChange={(v) => updateProy("diasTranscurridos", v)} />
              <Field label="Días Totales del Mes" value={proy.diasTotalesMes || ""} onChange={(v) => updateProy("diasTotalesMes", v)} />
              <Field label="GMV Mes Pasado ($)" value={proy.gmvMesPasado || ""} onChange={(v) => updateProy("gmvMesPasado", v)} />
            </div>

            {/* Proyección por KAM */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-purple-800">👥 Meta y GMV por KAM</h4>
                  <p className="text-xs text-gray-400">Configura la meta y GMV individual. Puedes agregar KAMs adicionales.</p>
                </div>
                <button onClick={() => {
                  const kams = [...(proy.kams || form.kams.map(km => ({ nombre: km.nombre, meta: km.meta, gmv: km.gmv })))];
                  kams.push({ nombre: "", meta: 0, gmv: 0 });
                  updateProy("kams", kams);
                }} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200 transition">
                  + Agregar KAM
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-purple-50 text-purple-800 text-xs">
                      <th className="text-left p-2">KAM</th>
                      <th className="text-right p-2">Meta ($)</th>
                      <th className="text-right p-2">GMV ($)</th>
                      <th className="text-right p-2">Cumplimiento</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const allKams = proy.kams || form.kams.map(km => ({ nombre: km.nombre, meta: km.meta, gmv: km.gmv }));
                      return allKams.map((pk, i) => {
                        const cumplK = pk.meta > 0 ? (pk.gmv / pk.meta * 100) : 0;
                        const updateKamField = (field, val) => {
                          const kams = [...allKams];
                          kams[i] = { ...kams[i], [field]: field === "nombre" ? val : (Number(val) || 0) };
                          updateProy("kams", kams);
                        };
                        const removeKam = () => {
                          const kams = allKams.filter((_, idx) => idx !== i);
                          updateProy("kams", kams);
                        };
                        return (
                          <tr key={i} className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                            <td className="p-1">
                              <input type="text" value={pk.nombre || ""} onChange={(e) => updateKamField("nombre", e.target.value)}
                                placeholder="Nombre del KAM"
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-medium text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-400" />
                            </td>
                            <td className="p-1">
                              <input type="number" value={pk.meta || ""} onChange={(e) => updateKamField("meta", e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-purple-400" />
                            </td>
                            <td className="p-1">
                              <input type="number" value={pk.gmv || ""} onChange={(e) => updateKamField("gmv", e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-purple-400" />
                            </td>
                            <td className="p-2 text-right">
                              <span className={`text-xs font-bold ${cumplK >= 95 ? "text-green-600" : cumplK >= 80 ? "text-yellow-600" : "text-red-500"}`}>
                                {cumplK.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-1">
                              <button onClick={removeKam} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}

function Field({ label, value, onChange, type = "number" }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-300"
      />
    </div>
  );
}

function EditableTable({ rows, columns, onChange, columnLabels = {} }) {
  const handleCell = (rowIdx, col, val) => {
    const next = rows.map((r, i) =>
      i === rowIdx ? { ...r, [col]: isNaN(val) ? val : Number(val) } : r
    );
    onChange(next);
  };

  const addRow = () => {
    const empty = {};
    columns.forEach((c) => (empty[c] = ""));
    onChange([...rows, empty]);
  };

  const delRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-purple-50">
              {columns.map((c) => <th key={c} className="text-left p-2 text-purple-700 capitalize text-xs">{columnLabels[c] || c}</th>)}
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b">
                {columns.map((col) => (
                  <td key={col} className="p-1">
                    <input
                      value={row[col] ?? ""}
                      onChange={(e) => handleCell(ri, col, e.target.value)}
                      className="w-full border-b border-gray-200 px-2 py-1 text-xs focus:outline-none focus:border-purple-400"
                    />
                  </td>
                ))}
                <td className="p-1">
                  <button onClick={() => delRow(ri)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="mt-3 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200 transition"
      >
        + Agregar fila
      </button>
    </div>
  );
}

function UploadEvolucion({ proy, setForm, setMsg, cargandoOps, setCargandoOps }) {
  const fileRef = useRef();

  const procesarArchivo = async (file) => {
    setCargandoOps(true);
    setMsg("⏳ Procesando archivo...");
    try {
      const raw = await parseExcelRaw(file);

      if (raw.length < 2) throw new Error("Archivo vacío");

      // Buscar columnas date y gmv por nombre
      const h = raw[0].map(x => String(x).toLowerCase().trim());
      const iDate = h.findIndex(x => x === "date" || x === "fecha");
      const iGmv  = h.findIndex(x => x === "gmv");
      const iPkg  = h.findIndex(x => x === "packages" || x === "paquetes");

      if (iDate < 0 || iGmv < 0) throw new Error("No se encontraron columnas 'date' y 'gmv' en el archivo.");

      const porDia = {};
      let n = 0;
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        const dv = Number(r[iDate]);
        if (!dv) continue;
        const dt = new Date((dv - 25569) * 86400000);
        if (isNaN(dt.getTime())) continue;
        const k = dt.toISOString().slice(0, 10);
        if (!porDia[k]) porDia[k] = { gmv: 0, servicios: 0, paquetes: 0 };
        porDia[k].gmv += Number(r[iGmv]) || 0;
        porDia[k].servicios++;
        if (iPkg >= 0) porDia[k].paquetes += Number(r[iPkg]) || 0;
        n++;
      }

      const ev = Object.entries(porDia)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([fecha, v]) => ({ fecha, ...v }));
      let ac = 0;
      ev.forEach(d => { ac += d.gmv; d.gmvAcumulado = ac; });

      localStorage.setItem("pibox_cierre_evolucion", JSON.stringify(ev));

      setForm(prev => ({
        ...prev,
        proyeccion: {
          ...(prev.proyeccion || {}),
          archivoOps: file.name,
          diasEvolucion: ev.length,
        },
      }));

      setMsg(`✅ Listo: ${ev.length} días, ${n.toLocaleString()} servicios. Haz clic en Guardar.`);
      setTimeout(() => setMsg(""), 8000);
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
    setCargandoOps(false);
  };

  const eliminar = () => {
    localStorage.removeItem("pibox_cierre_evolucion");
    setForm(prev => {
      const p = { ...(prev.proyeccion || {}) };
      delete p.archivoOps;
      delete p.diasEvolucion;
      return { ...prev, proyeccion: p };
    });
    setMsg("🗑️ Eliminado. Guarda para confirmar.");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
      <p className="text-xs font-bold text-purple-800 mb-2">📈 Evolución Diaria del GMV</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={cargandoOps}
          onClick={() => fileRef.current?.click()}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-bold shadow transition ${cargandoOps ? "opacity-50 cursor-wait" : "hover:shadow-lg cursor-pointer"}`}
          style={{ background: "linear-gradient(135deg,#5B17A8,#C026D3)" }}
        >
          {cargandoOps ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={4}/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Procesando...</>
          ) : "📥 Subir archivo (.xlsx)"}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) procesarArchivo(e.target.files[0]); e.target.value = ""; }} />

        {proy.archivoOps && !cargandoOps && (
          <>
            <span className="text-xs text-gray-600">✅ <b>{proy.archivoOps}</b> · {proy.diasEvolucion || 0} días</span>
            <button onClick={eliminar} className="text-xs text-red-500 hover:text-red-700 hover:underline">🗑️ Eliminar</button>
          </>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-2">Archivo con columnas: <b>date</b>, <b>gmv</b>, <b>packages</b>. Después de subir, haz clic en Guardar.</p>
    </div>
  );
}
