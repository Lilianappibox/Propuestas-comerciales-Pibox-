import { useState, useRef } from "react";

const TABS = [
  { id: "general",           label: "General",           icon: "🏠" },
  { id: "kams",              label: "KAMs",              icon: "👥" },
  { id: "top10",             label: "Top 10",            icon: "🏆" },
  { id: "clientes nuevos",   label: "Clientes Nuevos",   icon: "🌱" },
  { id: "clientes perdidos", label: "Clientes Perdidos", icon: "⚠️" },
  { id: "lineas",            label: "Líneas",            icon: "📦" },
  { id: "ciudades",          label: "Ciudades",          icon: "🗺️" },
  { id: "tendencias",        label: "Tendencias",        icon: "📈" },
];

const LABELS = {
  kam: "KAM", cliente: "Cliente", gmv: "GMV", servicios: "Servicios",
  gmvMesAnterior: "GMV Mes Anterior", linea: "Línea",
  participacion: "Participación %", ciudad: "Ciudad", mes: "Mes", meta: "Meta",
};

// ─────────────────────────────────────────────────────────────────────────────
export default function Configuracion({ data, onSave }) {
  // form: copia de trabajo local — se inicializa cada vez que data cambia
  // (data solo cambia cuando el padre confirma un guardado)
  const [form, setForm] = useState(() => JSON.parse(JSON.stringify(data)));
  const [tab,  setTab]  = useState("general");
  const [msg,  setMsg]  = useState("");
  const excelRef = useRef();

  // Cuando el padre actualiza data (por import JSON u otro guardado externo),
  // reseteamos el form local para reflejar el dato real.
  // Usamos una key de referencia para detectar cambio real del prop.
  const dataRef = useRef(data);
  if (dataRef.current !== data) {
    dataRef.current = data;
    // Solo reseteamos si data cambió desde afuera (no desde nuestro propio guardado)
    setForm(JSON.parse(JSON.stringify(data)));
  }

  const toast = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  // ── Guardar ──────────────────────────────────────────────────────────────
  const guardar = () => {
    onSave(JSON.parse(JSON.stringify(form)));   // llama actualizar() en el padre → escribe en localStorage
    toast("✅ Guardado correctamente");
  };

  // ── Mutadores simples ─────────────────────────────────────────────────────
  const setField = (path, value) => {
    const keys = path.split(".");
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      const num = Number(value);
      obj[keys[keys.length - 1]] = value === "" || isNaN(num) ? value : num;
      return next;
    });
  };

  const setKAM = (idx, field, value) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const num = Number(value);
      next.kams[idx][field] = isNaN(num) ? value : num;
      if (next.kams[idx].meta > 0)
        next.kams[idx].cumplimiento = parseFloat(((next.kams[idx].gmv / next.kams[idx].meta) * 100).toFixed(2));
      return next;
    });
  };

  const setLista = (key, rows) => setForm(prev => ({ ...prev, [key]: rows }));

  const setTop10Cell = (ri, col, value) => {
    setForm(prev => {
      const list = JSON.parse(JSON.stringify(prev.top10Clientes));
      const num  = Number(value);
      list[ri][col] = isNaN(num) ? value : num;
      if ((col === "gmvActual" || col === "gmvAnterior") && list[ri].gmvAnterior > 0)
        list[ri].crecimiento = parseFloat((((list[ri].gmvActual - list[ri].gmvAnterior) / list[ri].gmvAnterior) * 100).toFixed(2));
      return { ...prev, top10Clientes: list };
    });
  };

  // ── Import / Export JSON ──────────────────────────────────────────────────
  const exportarJSON = () => {
    const blob = new Blob([JSON.stringify(form, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `cierre-${form.mes || "datos"}.json` });
    a.click();
  };

  const importarJSON = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { try { setForm(JSON.parse(ev.target.result)); toast("✅ JSON importado — haz clic en Guardar para confirmar"); } catch { toast("❌ Error al leer JSON"); } };
    reader.readAsText(file);
    e.target.value = "";
  };

  const recalcularTop10 = () => {
    const totalGmv = (form.top10Clientes ?? []).reduce((a, c) => a + (c.gmvActual || 0), 0);
    setForm(prev => ({
      ...prev,
      top10Clientes: (prev.top10Clientes ?? []).map(c => ({
        ...c,
        crecimiento:   c.gmvAnterior > 0 ? parseFloat((((c.gmvActual - c.gmvAnterior) / c.gmvAnterior) * 100).toFixed(2)) : 0,
        participacion: totalGmv > 0      ? parseFloat(((c.gmvActual / totalGmv) * 100).toFixed(2))                        : 0,
      })),
    }));
    toast("🔄 Recalculado — haz clic en Guardar para confirmar");
  };

  const tabCfg = TABS.find(t => t.id === tab) ?? TABS[0];

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">

      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-purple-800">⚙️ Configuración del Cierre</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportarJSON} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">💾 Exportar JSON</button>
          <label className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition cursor-pointer">
            📂 Importar JSON
            <input type="file" accept=".json" className="hidden" onChange={importarJSON} />
          </label>
        </div>
      </div>

      {/* Toast */}
      {msg && <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-700 font-medium">{msg}</div>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-purple-100 pb-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-t text-xs font-semibold transition ${tab === t.id ? "bg-purple-600 text-white" : "text-gray-500 hover:bg-purple-50"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Barra de acciones del tab */}
      <div className="flex flex-wrap gap-2 items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => excelRef.current?.click()}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition">
            📥 Cargar Excel
          </button>
          <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files[0]; if(f) toast(`📂 "${f.name}" recibido`); e.target.value=""; }} />
          {tab === "top10" && (
            <button onClick={recalcularTop10} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition">
              🔄 Recalcular crec. y part.
            </button>
          )}
        </div>
        <button onClick={guardar}
          className="px-5 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-bold hover:bg-pink-700 transition shadow">
          💾 Guardar {tabCfg.label}
        </button>
      </div>

      {/* ══ Contenido por tab ══ */}

      {tab === "general" && (
        <div className="grid md:grid-cols-2 gap-4">
          <F label="Mes"                value={form.mes}                               onChange={v => setField("mes", v)}                               type="text" />
          <F label="Período (ej: Enero)"value={form.periodo}                           onChange={v => setField("periodo", v)}                           type="text" />
          <F label="Año"               value={form.anio}                               onChange={v => setField("anio", v)} />
          <F label="Meta Equipo"       value={form.cumplimientoEquipo?.meta}           onChange={v => setField("cumplimientoEquipo.meta", v)} />
          <F label="GMV Real"          value={form.cumplimientoEquipo?.gmv}            onChange={v => setField("cumplimientoEquipo.gmv", v)} />
          <F label="Utilidad Bruta"    value={form.cumplimientoEquipo?.utilidadBruta}  onChange={v => setField("cumplimientoEquipo.utilidadBruta", v)} />
          <F label="Meta Mes Pasado"   value={form.cumplimientoEquipo?.mesPasadoMeta}  onChange={v => setField("cumplimientoEquipo.mesPasadoMeta", v)} />
          <F label="GMV Mes Pasado"    value={form.cumplimientoEquipo?.mesPasadoGmv}   onChange={v => setField("cumplimientoEquipo.mesPasadoGmv", v)} />
          <F label="Meta Año Pasado"   value={form.cumplimientoEquipo?.anioPasadoMeta} onChange={v => setField("cumplimientoEquipo.anioPasadoMeta", v)} />
          <F label="GMV Año Pasado"    value={form.cumplimientoEquipo?.anioPasadoGmv}  onChange={v => setField("cumplimientoEquipo.anioPasadoGmv", v)} />
        </div>
      )}

      {tab === "kams" && (
        <div className="space-y-4">
          {(form.kams ?? []).map((k, i) => (
            <div key={k.nombre} className="border border-purple-100 rounded-xl p-4">
              <p className="font-bold text-purple-700 mb-3">{k.nombre}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <F label="Meta" value={k.meta} onChange={v => setKAM(i, "meta", v)} />
                <F label="GMV"  value={k.gmv}  onChange={v => setKAM(i, "gmv",  v)} />
                <F label="OKR %"value={k.okr}  onChange={v => setKAM(i, "okr",  v)} />
                <div className="bg-purple-50 rounded-lg p-2 text-center flex flex-col justify-center">
                  <p className="text-xs text-gray-500">Cumplimiento</p>
                  <p className="text-lg font-bold text-purple-700">{(k.cumplimiento ?? 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "top10" && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-purple-50 text-purple-800">
                  <th className="p-2 w-6">#</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">KAM</th>
                  <th className="text-right p-2">GMV Actual</th>
                  <th className="text-right p-2">GMV Anterior</th>
                  <th className="text-right p-2">Crec. %</th>
                  <th className="text-right p-2">Part. %</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {(form.top10Clientes ?? []).map((row, ri) => (
                  <tr key={ri} className="border-b hover:bg-purple-50">
                    <td className="p-1 text-center text-purple-400 font-bold">{ri + 1}</td>
                    {["cliente", "kam"].map(col => (
                      <td key={col} className="p-1">
                        <input value={row[col] ?? ""} onChange={e => setTop10Cell(ri, col, e.target.value)}
                          className="w-full border-b border-gray-200 px-1 py-1 focus:outline-none focus:border-purple-400 min-w-[90px]" />
                      </td>
                    ))}
                    {["gmvActual", "gmvAnterior"].map(col => (
                      <td key={col} className="p-1">
                        <input type="number" value={row[col] ?? ""} onChange={e => setTop10Cell(ri, col, e.target.value)}
                          className="w-full border-b border-gray-200 px-1 py-1 text-right focus:outline-none min-w-[100px]" />
                      </td>
                    ))}
                    <td className="p-1">
                      <input type="number" value={row.crecimiento ?? ""} onChange={e => setTop10Cell(ri, "crecimiento", e.target.value)}
                        className={`w-full border-b px-1 py-1 text-right focus:outline-none min-w-[70px] ${(row.crecimiento ?? 0) >= 0 ? "text-green-600 border-green-200" : "text-red-500 border-red-200"}`} />
                    </td>
                    <td className="p-1">
                      <input type="number" value={row.participacion ?? ""} onChange={e => setTop10Cell(ri, "participacion", e.target.value)}
                        className="w-full border-b border-gray-200 px-1 py-1 text-right focus:outline-none min-w-[60px]" />
                    </td>
                    <td className="p-1">
                      <button onClick={() => setForm(p => ({ ...p, top10Clientes: p.top10Clientes.filter((_, i) => i !== ri) }))}
                        className="text-red-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => setForm(p => ({ ...p, top10Clientes: [...(p.top10Clientes ?? []), { cliente: "", kam: "", gmvActual: 0, gmvAnterior: 0, crecimiento: 0, participacion: 0 }] }))}
            className="mt-3 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200 transition">
            + Agregar cliente
          </button>
        </div>
      )}

      {tab === "clientes nuevos" && (
        <Tabla rows={form.clientesNuevos ?? []} cols={["kam", "cliente", "gmv", "servicios"]}
          onChange={rows => setLista("clientesNuevos", rows)} />
      )}
      {tab === "clientes perdidos" && (
        <Tabla rows={form.clientesPerdidos ?? []} cols={["kam", "cliente", "gmvMesAnterior"]}
          onChange={rows => setLista("clientesPerdidos", rows)} />
      )}
      {tab === "lineas" && (
        <Tabla rows={form.facturacionLinea ?? []} cols={["linea", "gmv", "servicios"]}
          onChange={rows => setLista("facturacionLinea", rows)} />
      )}
      {tab === "ciudades" && (
        <Tabla rows={form.facturacionCiudad ?? []} cols={["ciudad", "gmv", "participacion"]}
          onChange={rows => setLista("facturacionCiudad", rows)} />
      )}
      {tab === "tendencias" && (
        <Tabla rows={form.tendencias ?? []} cols={["mes", "gmv", "meta"]}
          onChange={rows => setLista("tendencias", rows)} />
      )}
    </section>
  );
}

// ── Componentes auxiliares ─────────────────────────────────────────────────
function F({ label, value, onChange, type = "number" }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-300" />
    </div>
  );
}

function Tabla({ rows, cols, onChange }) {
  const cell = (ri, col, val) =>
    onChange(rows.map((r, i) => i === ri ? { ...r, [col]: isNaN(Number(val)) || val === "" ? val : Number(val) } : r));
  const add = () => { const e = {}; cols.forEach(c => e[c] = ""); onChange([...rows, e]); };
  const del = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-purple-50">
              {cols.map(c => <th key={c} className="text-left p-2 text-purple-700 font-semibold">{LABELS[c] ?? c}</th>)}
              <th className="p-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b hover:bg-purple-50">
                {cols.map(col => (
                  <td key={col} className="p-1">
                    <input value={row[col] ?? ""} onChange={e => cell(ri, col, e.target.value)}
                      className="w-full border-b border-gray-200 px-2 py-1.5 focus:outline-none focus:border-purple-400 min-w-[80px]" />
                  </td>
                ))}
                <td className="p-1 text-center">
                  <button onClick={() => del(ri)} className="text-red-400 hover:text-red-600">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={add} className="mt-3 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200 transition">
        + Agregar fila
      </button>
    </div>
  );
}
