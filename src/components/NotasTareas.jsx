import { useState } from "react";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const PIBOX_PURPLE = "#7C22D4";

const SK_NOTAS = "pibox_tada_notas";
const SK_TAREAS = "pibox_tada_tareas";

function loadNotas() { try { return JSON.parse(localStorage.getItem(SK_NOTAS) || "[]"); } catch { return []; } }
function saveNotas(n) { localStorage.setItem(SK_NOTAS, JSON.stringify(n)); }
function loadTareas() { try { return JSON.parse(localStorage.getItem(SK_TAREAS) || "[]"); } catch { return []; } }
function saveTareas(t) { localStorage.setItem(SK_TAREAS, JSON.stringify(t)); }

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function today() { return new Date().toISOString().slice(0, 10); }

// Extraer texto de PDF usando pdf.js CDN
async function extractPdfText(file) {
  const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ") + "\n";
  }
  return text;
}

// Parsear notas de Gemini: extraer resumen, próximos pasos, detalles
function parseGeminiNotes(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  // Buscar título y fecha
  let titulo = "Tráfico TaDa / Pibox";
  let fecha = today();
  for (const l of lines) {
    if (l.match(/^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s/i) || l.match(/\d{4}$/)) {
      const dm = l.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/i);
      if (dm) { try { const d = new Date(`${dm[1]} ${dm[2]}, ${dm[3]}`); if (!isNaN(d)) fecha = d.toISOString().slice(0, 10); } catch {} }
    }
    if (l.includes("Tráfico") || l.includes("TaDa")) titulo = l.slice(0, 60);
  }
  // Extraer secciones
  const fullText = lines.join("\n");
  let resumen = "";
  const resMatch = fullText.match(/Resumen\s*\n([\s\S]*?)(?=Próximos pasos|Detalles|$)/i);
  if (resMatch) resumen = resMatch[1].trim();
  let detalles = "";
  const detMatch = fullText.match(/Detalles\s*\n([\s\S]*?)$/i);
  if (detMatch) detalles = detMatch[1].trim();
  // Extraer tareas de "Próximos pasos"
  const tareas = [];
  const pasosMatch = fullText.match(/Próximos pasos\s*\n([\s\S]*?)(?=Detalles|$)/i);
  if (pasosMatch) {
    // Patrón: [Responsable] Título: Descripción
    const taskLines = pasosMatch[1].split(/(?=\[)/);
    for (const tl of taskLines) {
      const m = tl.match(/\[([^\]]+)\]\s*([^:]+):\s*([\s\S]*)/);
      if (m) {
        tareas.push({
          responsable: m[1].trim(),
          tarea: `${m[2].trim()}: ${m[3].trim().replace(/\s+/g, " ")}`,
        });
      }
    }
  }
  const contenido = (resumen ? "RESUMEN:\n" + resumen : "") + (detalles ? "\n\nDETALLES:\n" + detalles : "");
  return { titulo, fecha, contenido, tareas };
}

export default function NotasTareas() {
  /* ── Notas ──────────────────────────────────────────────────────────── */
  const [notas, setNotas] = useState(loadNotas);
  const [titulo, setTitulo] = useState("Tráfico TaDa / Pibox");
  const [fecha, setFecha] = useState(today);
  const [contenido, setContenido] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMsg, setPdfMsg] = useState("");

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfLoading(true); setPdfMsg("");
    try {
      const text = await extractPdfText(file);
      const parsed = parseGeminiNotes(text);
      setTitulo(parsed.titulo);
      setFecha(parsed.fecha);
      setContenido(parsed.contenido);
      // Auto-agregar tareas extraídas
      if (parsed.tareas.length > 0) {
        const newTareas = parsed.tareas.map(t => ({
          id: uid(), tarea: t.tarea, responsable: t.responsable,
          fechaLimite: "", completada: false, creadoEn: new Date().toISOString(),
        }));
        const next = [...newTareas, ...tareas];
        setTareas(next);
        saveTareas(next);
        setPdfMsg(`✅ ${parsed.tareas.length} tareas extraídas y agregadas al tablero.`);
      } else {
        setPdfMsg("✅ Contenido extraído. No se encontraron tareas en formato [Responsable].");
      }
    } catch (err) {
      setPdfMsg("❌ Error al leer PDF: " + err.message);
    }
    setPdfLoading(false);
    e.target.value = "";
  }

  function guardarNota() {
    if (!contenido.trim()) return;
    const nueva = { id: uid(), titulo: titulo.trim() || "Sin título", fecha, contenido: contenido.trim(), creadoEn: new Date().toISOString() };
    const next = [nueva, ...notas];
    setNotas(next);
    saveNotas(next);
    setContenido("");
    setPdfMsg("");
  }

  function eliminarNota(id) {
    const next = notas.filter(n => n.id !== id);
    setNotas(next);
    saveNotas(next);
  }

  /* ── Tareas ─────────────────────────────────────────────────────────── */
  const [tareas, setTareas] = useState(loadTareas);
  const [filtro, setFiltro] = useState("todas"); // todas | pendientes | completadas
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTarea, setNewTarea] = useState("");
  const [newResp, setNewResp] = useState("");
  const [newFechaLim, setNewFechaLim] = useState(today);

  function agregarTarea() {
    if (!newTarea.trim()) return;
    const t = { id: uid(), tarea: newTarea.trim(), responsable: newResp.trim(), fechaLimite: newFechaLim, completada: false, creadoEn: new Date().toISOString() };
    const next = [t, ...tareas];
    setTareas(next);
    saveTareas(next);
    setNewTarea("");
    setNewResp("");
    setNewFechaLim(today());
    setShowNewTask(false);
  }

  function toggleTarea(id) {
    const next = tareas.map(t => t.id === id ? { ...t, completada: !t.completada } : t);
    setTareas(next);
    saveTareas(next);
  }

  function eliminarTarea(id) {
    const next = tareas.filter(t => t.id !== id);
    setTareas(next);
    saveTareas(next);
  }

  const tareasFiltradas = filtro === "todas" ? tareas : tareas.filter(t => filtro === "completadas" ? t.completada : !t.completada);

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Agregar Nota ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 text-white font-bold text-sm" style={{ background: BRAND_GRADIENT }}>
          📝 Agregar Nota
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Título</label>
              <input value={titulo} onChange={e => setTitulo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Contenido de la nota</label>
            <textarea value={contenido} onChange={e => setContenido(e.target.value)} rows={6} placeholder="Pega aquí las notas de Gemini u otra fuente..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none resize-y" />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button onClick={guardarNota} disabled={!contenido.trim()}
              className="px-5 py-2 rounded-lg text-white text-sm font-semibold shadow hover:shadow-md transition disabled:opacity-40"
              style={{ background: BRAND_GRADIENT }}>
              Guardar nota
            </button>
            <label className="px-4 py-2 rounded-lg text-xs font-semibold border-2 border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 cursor-pointer transition flex items-center gap-2">
              {pdfLoading ? "Procesando..." : "📄 Subir PDF de Gemini"}
              <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={pdfLoading} />
            </label>
            {pdfMsg && <span className={`text-xs font-medium ${pdfMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>{pdfMsg}</span>}
          </div>
        </div>
      </div>

      {/* ── Tablero de Tareas ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 text-white font-bold text-sm flex items-center justify-between" style={{ background: BRAND_GRADIENT }}>
          <span>✅ Tablero de Tareas</span>
          <button onClick={() => setShowNewTask(v => !v)}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1 rounded-lg transition">
            + Nueva tarea
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* New task form */}
          {showNewTask && (
            <div className="border border-purple-200 bg-purple-50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
                  <input value={newTarea} onChange={e => setNewTarea(e.target.value)} placeholder="Descripción de la tarea..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Responsable</label>
                  <input value={newResp} onChange={e => setNewResp(e.target.value)} placeholder="Nombre..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 outline-none" />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha límite</label>
                  <input type="date" value={newFechaLim} onChange={e => setNewFechaLim(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 outline-none" />
                </div>
                <button onClick={agregarTarea} disabled={!newTarea.trim()}
                  className="px-4 py-2 rounded-lg text-white text-sm font-semibold shadow transition disabled:opacity-40"
                  style={{ background: PIBOX_PURPLE }}>
                  Agregar
                </button>
                <button onClick={() => setShowNewTask(false)}
                  className="px-4 py-2 rounded-lg text-gray-500 text-sm hover:bg-gray-100 transition">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Filter */}
          <div className="flex gap-2">
            {[["todas", "Todas"], ["pendientes", "Pendientes"], ["completadas", "Completadas"]].map(([k, l]) => (
              <button key={k} onClick={() => setFiltro(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filtro === k ? "text-white shadow" : "text-gray-500 hover:bg-purple-50"}`}
                style={filtro === k ? { background: PIBOX_PURPLE } : {}}>
                {l}
              </button>
            ))}
          </div>

          {/* Task table */}
          {tareasFiltradas.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">No hay tareas {filtro !== "todas" ? filtro : ""}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-2 px-2 w-8">#</th>
                    <th className="py-2 px-2">Tarea</th>
                    <th className="py-2 px-2">Responsable</th>
                    <th className="py-2 px-2">Fecha</th>
                    <th className="py-2 px-2 text-center">Estado</th>
                    <th className="py-2 px-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tareasFiltradas.map((t, i) => (
                    <tr key={t.id} className={`border-b border-gray-50 ${t.completada ? "opacity-60" : ""}`}>
                      <td className="py-2 px-2 text-gray-400">{i + 1}</td>
                      <td className={`py-2 px-2 ${t.completada ? "line-through text-gray-400" : "text-gray-700"}`}>{t.tarea}</td>
                      <td className="py-2 px-2 text-gray-500">{t.responsable || "—"}</td>
                      <td className="py-2 px-2 text-gray-500">{t.fechaLimite}</td>
                      <td className="py-2 px-2 text-center">
                        <input type="checkbox" checked={t.completada} onChange={() => toggleTarea(t.id)}
                          className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: PIBOX_PURPLE }} />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button onClick={() => eliminarTarea(t.id)} className="text-red-400 hover:text-red-600 text-xs font-semibold transition">
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Historial de Notas ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 text-white font-bold text-sm" style={{ background: BRAND_GRADIENT }}>
          📋 Historial de Notas ({notas.length})
        </div>
        <div className="p-5 space-y-3">
          {notas.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">No hay notas guardadas</p>
          ) : (
            notas.map(n => {
              const expanded = expandedId === n.id;
              return (
                <div key={n.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedId(expanded ? null : n.id)}
                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-purple-50/50 transition">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{n.titulo}</p>
                      <p className="text-xs text-gray-400">{n.fecha}</p>
                      {!expanded && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.contenido.slice(0, 150)}{n.contenido.length > 150 ? "..." : ""}</p>}
                    </div>
                    <span className="text-gray-400 text-xs ml-2 shrink-0">{expanded ? "▲" : "▼"}</span>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4 space-y-2">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-lg p-3 max-h-96 overflow-y-auto">{n.contenido}</pre>
                      <button onClick={() => eliminarNota(n.id)}
                        className="text-red-400 hover:text-red-600 text-xs font-semibold transition">
                        Eliminar nota
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
