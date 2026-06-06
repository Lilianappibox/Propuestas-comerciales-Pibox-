import { useRef, useCallback } from "react";

// ── Configuración de cada tab ─────────────────────────────────────────────
const TABS_CONFIG = [
  { id: "general",           label: "General",           icon: "🏠" },
  { id: "kams",              label: "KAMs",              icon: "👥" },
  { id: "top 10",            label: "Top 10",            icon: "🏆" },
  { id: "clientes nuevos",   label: "Clientes Nuevos",   icon: "🌱" },
  { id: "clientes perdidos", label: "Clientes Perdidos", icon: "⚠️" },
  { id: "líneas",            label: "Líneas",            icon: "📦" },
  { id: "ciudades",          label: "Ciudades",          icon: "🗺️" },
  { id: "tendencias",        label: "Tendencias",        icon: "📈" },
];

// ── Barra de acciones por tab ─────────────────────────────────────────────
function TabActions({ tabLabel, onSave, onExcelLoad, extraButtons }) {
  const fileRef = useRef();
  return (
    <div className="flex flex-wrap gap-2 items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition shadow-sm"
        >
          📥 Cargar Excel
        </button>
        <input
          ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => { onExcelLoad?.(e.target.files[0], tabLabel); e.target.value = ""; }}
        />
        {extraButtons}
      </div>
      <button
        onClick={onSave}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-bold hover:bg-pink-700 transition shadow-sm"
      >
        💾 Guardar {tabLabel}
      </button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
/**
 * Configuracion recibe:
 *   form          → el objeto completo que se está editando (vive en el padre)
 *   onFormChange  → función para actualizar el form en el padre
 *   onSave        → función para guardar/persistir
 */
export default function Configuracion({ form, onFormChange, onSave }) {
  // Tab activo — estado LOCAL porque no necesita persistir entre desmontajes
  const [tab, setTab] = [
    form.__configTab ?? "general",
    (t) => onFormChange({ ...form, __configTab: t }),
  ];

  const toast = useCallback((msg) => {
    // El padre (Tablero) ya muestra toast; aquí podemos emitir uno local si hace falta
    // Por ahora delegamos al padre a través de onSave
  }, []);

  // ── Helpers de mutación ─────────────────────────────────────────────────
  const set = useCallback((path, value) => {
    const keys = path.split(".");
    onFormChange((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value === "" || isNaN(value) ? value : Number(value);
      return next;
    });
  }, [onFormChange]);

  const setKAM = useCallback((idx, field, value) => {
    onFormChange((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.kams[idx][field] = isNaN(value) ? value : Number(value);
      next.kams[idx].cumplimiento = next.kams[idx].meta > 0
        ? parseFloat(((next.kams[idx].gmv / next.kams[idx].meta) * 100).toFixed(2))
        : 0;
      return next;
    });
  }, [onFormChange]);

  // ── Exportar / Importar JSON ────────────────────────────────────────────
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(form, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `cierre-${(form.mes || "datos").replace(" ", "-")}.json`;
    a.click();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { onFormChange(JSON.parse(ev.target.result)); }
      catch { alert("❌ Error al leer el archivo JSON"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExcelLoad = (file, tabLabel) => {
    if (!file) return;
    alert(`📂 Archivo "${file.name}" recibido en "${tabLabel}". Integración Excel disponible próximamente.`);
  };

  const tabCfg = TABS_CONFIG.find((t) => t.id === tab) ?? TABS_CONFIG[0];

  const recalcularTop10 = () => {
    const totalGmv = (form.top10Clientes ?? []).reduce((a, c) => a + (c.gmvActual || 0), 0);
    const next = (form.top10Clientes ?? []).map((c) => ({
      ...c,
      crecimiento:   c.gmvAnterior > 0 ? parseFloat((((c.gmvActual - c.gmvAnterior) / c.gmvAnterior) * 100).toFixed(2)) : 0,
      participacion: totalGmv > 0      ? parseFloat(((c.gmvActual / totalGmv) * 100).toFixed(2))                        : 0,
    }));
    onFormChange((prev) => ({ ...prev, top10Clientes: next }));
  };

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">

      {/* ── Header global ── */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-purple-800">⚙️ Módulo de Configuración</h2>
        <div className="flex gap-2 flex-wrap">
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

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-purple-100 pb-2">
        {TABS_CONFIG.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-t text-xs font-semibold transition ${
              tab === t.id ? "bg-purple-600 text-white shadow" : "text-gray-500 hover:text-purple-700 hover:bg-purple-50"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Barra de acciones por tab ── */}
      <TabActions
        tabLabel={tabCfg.label}
        onSave={() => onSave(form)}
        onExcelLoad={handleExcelLoad}
        extraButtons={
          tab === "top 10" ? (
            <button onClick={recalcularTop10}
              className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition shadow-sm">
              🔄 Recalcular crec. y part.
            </button>
          ) : null
        }
      />

      {/* ══════════════ CONTENIDO POR TAB ══════════════ */}

      {tab === "general" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Mes"               value={form.mes}                               onChange={(v) => set("mes", v)}                               type="text" />
          <Field label="Período (ej: Enero)"value={form.periodo}                          onChange={(v) => set("periodo", v)}                           type="text" />
          <Field label="Año"               value={form.anio}                              onChange={(v) => set("anio", v)} />
          <Field label="Meta Equipo"       value={form.cumplimientoEquipo?.meta}          onChange={(v) => set("cumplimientoEquipo.meta", v)} />
          <Field label="GMV Real"          value={form.cumplimientoEquipo?.gmv}           onChange={(v) => set("cumplimientoEquipo.gmv", v)} />
          <Field label="Utilidad Bruta"    value={form.cumplimientoEquipo?.utilidadBruta} onChange={(v) => set("cumplimientoEquipo.utilidadBruta", v)} />
          <Field label="Meta Mes Pasado"   value={form.cumplimientoEquipo?.mesPasadoMeta} onChange={(v) => set("cumplimientoEquipo.mesPasadoMeta", v)} />
          <Field label="GMV Mes Pasado"    value={form.cumplimientoEquipo?.mesPasadoGmv}  onChange={(v) => set("cumplimientoEquipo.mesPasadoGmv", v)} />
          <Field label="Meta Año Pasado"   value={form.cumplimientoEquipo?.anioPasadoMeta}onChange={(v) => set("cumplimientoEquipo.anioPasadoMeta", v)} />
          <Field label="GMV Año Pasado"    value={form.cumplimientoEquipo?.anioPasadoGmv} onChange={(v) => set("cumplimientoEquipo.anioPasadoGmv", v)} />
        </div>
      )}

      {tab === "kams" && (
        <div className="space-y-4">
          {(form.kams ?? []).map((k, i) => (
            <div key={k.nombre} className="border border-purple-100 rounded-xl p-4">
              <p className="font-bold text-purple-700 mb-3">{k.nombre}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Meta" value={k.meta} onChange={(v) => setKAM(i, "meta", v)} />
                <Field label="GMV"  value={k.gmv}  onChange={(v) => setKAM(i, "gmv",  v)} />
                <Field label="OKR %" value={k.okr} onChange={(v) => setKAM(i, "okr",  v)} />
                <div className="rounded-lg bg-purple-50 p-2 text-center flex flex-col justify-center">
                  <p className="text-xs text-gray-500">Cumplimiento</p>
                  <p className="text-lg font-bold text-purple-700">{(k.cumplimiento ?? 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "top 10" && (
        <div>
          <p className="text-xs text-gray-500 mb-3">
            El % de crecimiento se recalcula automáticamente al cambiar el GMV.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-purple-50 text-purple-800 text-xs">
                  <th className="p-2 w-6">#</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">KAM</th>
                  <th className="text-right p-2">GMV Actual</th>
                  <th className="text-right p-2">GMV Anterior</th>
                  <th className="text-right p-2">Crec. %</th>
                  <th className="text-right p-2">Part. %</th>
                  <th className="p-2 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {(form.top10Clientes ?? []).map((row, ri) => (
                  <tr key={ri} className="border-b hover:bg-purple-50">
                    <td className="p-1 text-center text-purple-400 font-bold text-xs">{ri + 1}</td>
                    {["cliente", "kam"].map((col) => (
                      <td key={col} className="p-1">
                        <input value={row[col] ?? ""} onChange={(e) => {
                          const next = (form.top10Clientes ?? []).map((r, i) => i === ri ? { ...r, [col]: e.target.value } : r);
                          onFormChange((prev) => ({ ...prev, top10Clientes: next }));
                        }} className="w-full border-b border-gray-200 px-2 py-1 text-xs focus:outline-none focus:border-purple-400 min-w-[100px]" />
                      </td>
                    ))}
                    {["gmvActual", "gmvAnterior"].map((col) => (
                      <td key={col} className="p-1">
                        <input type="number" value={row[col] ?? ""} onChange={(e) => {
                          const val = Number(e.target.value);
                          const next = (form.top10Clientes ?? []).map((r, i) => {
                            if (i !== ri) return r;
                            const updated = { ...r, [col]: val };
                            if (updated.gmvAnterior > 0)
                              updated.crecimiento = parseFloat((((updated.gmvActual - updated.gmvAnterior) / updated.gmvAnterior) * 100).toFixed(2));
                            return updated;
                          });
                          onFormChange((prev) => ({ ...prev, top10Clientes: next }));
                        }} className="w-full border-b border-gray-200 px-2 py-1 text-xs text-right focus:outline-none min-w-[110px]" />
                      </td>
                    ))}
                    <td className="p-1">
                      <input type="number" value={row.crecimiento ?? ""} onChange={(e) => {
                        const next = (form.top10Clientes ?? []).map((r, i) => i === ri ? { ...r, crecimiento: Number(e.target.value) } : r);
                        onFormChange((prev) => ({ ...prev, top10Clientes: next }));
                      }} className={`w-full border-b px-2 py-1 text-xs text-right focus:outline-none min-w-[80px] ${(row.crecimiento ?? 0) >= 0 ? "text-green-600 border-green-200" : "text-red-500 border-red-200"}`} />
                    </td>
                    <td className="p-1">
                      <input type="number" value={row.participacion ?? ""} onChange={(e) => {
                        const next = (form.top10Clientes ?? []).map((r, i) => i === ri ? { ...r, participacion: Number(e.target.value) } : r);
                        onFormChange((prev) => ({ ...prev, top10Clientes: next }));
                      }} className="w-full border-b border-gray-200 px-2 py-1 text-xs text-right focus:outline-none min-w-[70px]" />
                    </td>
                    <td className="p-1">
                      <button onClick={() => onFormChange((prev) => ({ ...prev, top10Clientes: prev.top10Clientes.filter((_, i) => i !== ri) }))}
                        className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => onFormChange((prev) => ({ ...prev, top10Clientes: [...(prev.top10Clientes ?? []), { cliente: "", kam: "", gmvActual: 0, gmvAnterior: 0, crecimiento: 0, participacion: 0 }] }))}
            className="mt-3 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200 transition">
            + Agregar cliente
          </button>
        </div>
      )}

      {tab === "clientes nuevos" && (
        <EditableTable rows={form.clientesNuevos ?? []} columns={["kam", "cliente", "gmv", "servicios"]}
          onChange={(rows) => onFormChange((prev) => ({ ...prev, clientesNuevos: rows }))} />
      )}

      {tab === "clientes perdidos" && (
        <EditableTable rows={form.clientesPerdidos ?? []} columns={["kam", "cliente", "gmvMesAnterior"]}
          onChange={(rows) => onFormChange((prev) => ({ ...prev, clientesPerdidos: rows }))} />
      )}

      {tab === "líneas" && (
        <EditableTable rows={form.facturacionLinea ?? []} columns={["linea", "gmv", "servicios"]}
          onChange={(rows) => onFormChange((prev) => ({ ...prev, facturacionLinea: rows }))} />
      )}

      {tab === "ciudades" && (
        <EditableTable rows={form.facturacionCiudad ?? []} columns={["ciudad", "gmv", "participacion"]}
          onChange={(rows) => onFormChange((prev) => ({ ...prev, facturacionCiudad: rows }))} />
      )}

      {tab === "tendencias" && (
        <EditableTable rows={form.tendencias ?? []} columns={["mes", "gmv", "meta"]}
          onChange={(rows) => onFormChange((prev) => ({ ...prev, tendencias: rows }))} />
      )}
    </section>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
const LABELS = {
  kam: "KAM", cliente: "Cliente", gmv: "GMV", servicios: "Servicios",
  gmvMesAnterior: "GMV Mes Anterior", linea: "Línea", participacion: "Participación %",
  ciudad: "Ciudad", mes: "Mes", meta: "Meta",
};

function Field({ label, value, onChange, type = "number" }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-300" />
    </div>
  );
}

function EditableTable({ rows, columns, onChange }) {
  const handleCell = (ri, col, val) =>
    onChange(rows.map((r, i) => i === ri ? { ...r, [col]: isNaN(val) || val === "" ? val : Number(val) } : r));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-purple-50">
              {columns.map((c) => (
                <th key={c} className="text-left p-2 text-purple-700 text-xs font-semibold">{LABELS[c] ?? c}</th>
              ))}
              <th className="p-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b hover:bg-purple-50">
                {columns.map((col) => (
                  <td key={col} className="p-1">
                    <input value={row[col] ?? ""} onChange={(e) => handleCell(ri, col, e.target.value)}
                      className="w-full border-b border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-purple-400 min-w-[90px]" />
                  </td>
                ))}
                <td className="p-1 text-center">
                  <button onClick={() => onChange(rows.filter((_, i) => i !== ri))}
                    className="text-red-400 hover:text-red-600 text-xs w-5 h-5 rounded-full hover:bg-red-50">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => { const e = {}; columns.forEach((c) => (e[c] = "")); onChange([...rows, e]); }}
        className="mt-3 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200 transition">
        + Agregar fila
      </button>
    </div>
  );
}
