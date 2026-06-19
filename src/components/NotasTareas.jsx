import { useState } from "react";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";
const PIBOX_PURPLE = "#7C22D4";

const SK_NOTAS = "pibox_tada_notas";
const SK_TAREAS = "pibox_tada_tareas";

const CLIENT_EMAILS = [
  "jgonzalez@bogotabeercompany.com",
  "echoconta@tiendasya.com.co",
  "jonathan.garibello@ab-inbev.com",
  "alejandro.choconta-ext@ab-inbev.com",
  "camilo.mosquera-ext@ab-inbev.com",
  "jesus.gonzalezr@ab-inbev.com",
  "johanna.alvarez-ext@ab-inbev.com",
  "xiomara.sanchez-ext@ab-inbev.com",
];

function loadNotas() { try { return JSON.parse(localStorage.getItem(SK_NOTAS) || "[]"); } catch { return []; } }
function saveNotas(n) { localStorage.setItem(SK_NOTAS, JSON.stringify(n)); }
function loadTareas() { try { return JSON.parse(localStorage.getItem(SK_TAREAS) || "[]"); } catch { return []; } }
function saveTareas(t) { localStorage.setItem(SK_TAREAS, JSON.stringify(t)); }

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function today() { return new Date().toISOString().slice(0, 10); }

// Extraer texto de PDF reconstruyendo líneas por posición Y
async function extractPdfText(file) {
  const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const allLines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Agrupar items por posición Y (misma línea)
    let lastY = null;
    let currentLine = "";
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (currentLine.trim()) allLines.push(currentLine.trim());
        currentLine = "";
      }
      currentLine += (currentLine && !currentLine.endsWith(" ") ? " " : "") + item.str;
      lastY = y;
    }
    if (currentLine.trim()) allLines.push(currentLine.trim());
  }
  return allLines.join("\n");
}

// Parsear notas de Gemini
function parseGeminiNotes(text) {
  const lines = text.split("\n");
  let titulo = "Tráfico TaDa / Pibox";
  let fecha = today();
  // Buscar fecha y título en las primeras líneas
  for (const l of lines.slice(0, 10)) {
    const dateMatch = l.match(/(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+(\d{1,2}),?\s*(\d{4})/i);
    if (dateMatch) {
      const meses = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
      const m = meses[dateMatch[1].slice(0, 3).toLowerCase()];
      if (m) fecha = `${dateMatch[3]}-${String(m).padStart(2, "0")}-${String(dateMatch[2]).padStart(2, "0")}`;
    }
    if (l.includes("Tráfico") && l.includes("TaDa")) titulo = l.trim();
  }
  // Dividir en secciones
  const sections = { resumen: "", pasos: "", detalles: "" };
  let currentSection = "header";
  const pasosLines = [];
  for (const l of lines) {
    const lower = l.toLowerCase().trim();
    if (lower === "resumen") { currentSection = "resumen"; continue; }
    if (lower.startsWith("próximos pasos") || lower.startsWith("proximos pasos")) { currentSection = "pasos"; continue; }
    if (lower === "detalles") { currentSection = "detalles"; continue; }
    if (currentSection === "resumen") sections.resumen += l + "\n";
    if (currentSection === "pasos") pasosLines.push(l);
    if (currentSection === "detalles") sections.detalles += l + "\n";
  }
  // Extraer tareas: unir líneas que pertenecen a la misma tarea
  const tareas = [];
  let currentTask = null;
  for (const l of pasosLines) {
    const taskMatch = l.match(/^\[([^\]]+)\]\s*(.*)/);
    if (taskMatch) {
      if (currentTask) tareas.push(currentTask);
      currentTask = { responsable: taskMatch[1].trim(), tarea: taskMatch[2].trim() };
    } else if (currentTask && l.trim()) {
      currentTask.tarea += " " + l.trim();
    }
  }
  if (currentTask) tareas.push(currentTask);
  const contenido = (sections.resumen.trim() ? "RESUMEN:\n" + sections.resumen.trim() : "") +
    (sections.detalles.trim() ? "\n\nDETALLES:\n" + sections.detalles.trim() : "");
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
  const [pdfCargado, setPdfCargado] = useState(false);

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
      // Agregar tareas extraídas (mantiene pendientes anteriores)
      if (parsed.tareas.length > 0) {
        const newTareas = parsed.tareas.map(t => ({
          id: uid(), tarea: t.tarea, responsable: t.responsable,
          fechaLimite: "", completada: false, creadoEn: new Date().toISOString(),
        }));
        // Mantener tareas pendientes de documentos anteriores + nuevas
        const pendientesAnteriores = tareas.filter(t => !t.completada);
        const completadas = tareas.filter(t => t.completada);
        const next = [...newTareas, ...pendientesAnteriores, ...completadas];
        setTareas(next);
        saveTareas(next);
        setPdfMsg(`✅ ${parsed.tareas.length} tareas extraídas. Haz clic en "Guardar en historial" para conservar la nota.`);
      } else {
        setPdfMsg("✅ Contenido extraído. Haz clic en \"Guardar en historial\" para conservar la nota.");
      }
      setPdfCargado(true);
    } catch (err) {
      setPdfMsg("❌ Error al leer PDF: " + err.message);
    }
    setPdfLoading(false);
    e.target.value = "";
  }

  function limpiarDocumento() {
    setTitulo("Tráfico TaDa / Pibox");
    setFecha(today());
    setContenido("");
    setPdfMsg("");
    setPdfCargado(false);
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

  function enviarReporte() {
    const pendientes = tareas.filter(t => !t.completada);
    const completadas = tareas.filter(t => t.completada);
    const fechaHoy = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

    let cuerpo = `Reporte de tareas - Tráfico TaDa / Pibox\nFecha: ${fechaHoy}\n`;

    if (pendientes.length > 0) {
      cuerpo += `\nTAREAS PENDIENTES (${pendientes.length}):\n`;
      pendientes.forEach((t, i) => {
        const dias = t.creadoEn ? Math.floor((Date.now() - new Date(t.creadoEn).getTime()) / 86400000) : 0;
        cuerpo += `${i + 1}. ${t.tarea}`;
        if (t.responsable) cuerpo += ` — Responsable: ${t.responsable}`;
        cuerpo += ` (${dias} día${dias !== 1 ? "s" : ""} abierta)\n`;
      });
    } else {
      cuerpo += `\nNo hay tareas pendientes.\n`;
    }

    if (completadas.length > 0) {
      cuerpo += `\nTAREAS COMPLETADAS (${completadas.length}):\n`;
      completadas.forEach((t, i) => {
        cuerpo += `${i + 1}. ✓ ${t.tarea}`;
        if (t.responsable) cuerpo += ` — ${t.responsable}`;
        cuerpo += `\n`;
      });
    }

    const to = CLIENT_EMAILS.join(",");
    const subject = encodeURIComponent(`Reporte de tareas - Tráfico TaDa / Pibox - ${fechaHoy}`);
    const body = encodeURIComponent(cuerpo);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

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
            {!pdfCargado && (
              <label className="px-5 py-2 rounded-lg text-white text-sm font-semibold shadow hover:shadow-md cursor-pointer transition flex items-center gap-2"
                style={{ background: BRAND_GRADIENT }}>
                {pdfLoading ? "Procesando..." : "📄 Subir PDF de Gemini"}
                <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={pdfLoading} />
              </label>
            )}
            {contenido.trim() && (
              <button onClick={() => { guardarNota(); setPdfMsg("✅ Nota guardada en historial."); }}
                className="px-5 py-2 rounded-lg text-white text-sm font-semibold shadow hover:shadow-md transition"
                style={{ background: PIBOX_PURPLE }}>
                💾 Guardar en historial
              </button>
            )}
            {pdfCargado && (
              <button onClick={limpiarDocumento}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition">
                🗑️ Eliminar y subir otro
              </button>
            )}
            {pdfMsg && <span className={`text-xs font-medium ${pdfMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>{pdfMsg}</span>}
          </div>
        </div>
      </div>

      {/* ── Tablero de Tareas ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 text-white font-bold text-sm flex items-center justify-between" style={{ background: BRAND_GRADIENT }}>
          <span>✅ Tablero de Tareas</span>
          <div className="flex gap-2">
            <button onClick={enviarReporte} disabled={tareas.length === 0}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1 rounded-lg transition disabled:opacity-40"
              title="Enviar reporte por email a los clientes de TaDa">
              📧 Enviar reporte
            </button>
            <button onClick={() => setShowNewTask(v => !v)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1 rounded-lg transition">
              + Nueva tarea
            </button>
          </div>
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
                    <th className="py-2 px-2">Días</th>
                    <th className="py-2 px-2 text-center">Estado</th>
                    <th className="py-2 px-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tareasFiltradas.map((t, i) => {
                    const dias = t.creadoEn ? Math.floor((Date.now() - new Date(t.creadoEn).getTime()) / 86400000) : 0;
                    return (
                    <tr key={t.id} className={`border-b border-gray-50 ${t.completada ? "opacity-60" : ""}`}>
                      <td className="py-2 px-2 text-gray-400">{i + 1}</td>
                      <td className={`py-2 px-2 text-xs ${t.completada ? "line-through text-gray-400" : "text-gray-700"}`}>{t.tarea}</td>
                      <td className="py-2 px-2 text-xs text-gray-500">{t.responsable || "—"}</td>
                      <td className="py-2 px-2 text-xs">
                        <span className={`font-bold ${dias > 7 ? "text-red-500" : dias > 3 ? "text-orange-500" : "text-green-600"}`}>
                          {dias}d
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input type="checkbox" checked={t.completada} onChange={() => toggleTarea(t.id)}
                          className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: PIBOX_PURPLE }} />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button onClick={() => eliminarTarea(t.id)} className="text-red-400 hover:text-red-600 text-xs font-semibold transition">
                          ✕
                        </button>
                      </td>
                    </tr>
                    );
                  })}
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
              const diasNota = Math.floor((Date.now() - new Date(n.creadoEn || n.fecha).getTime()) / 86400000);
              return (
                <div key={n.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center">
                    <button onClick={() => setExpandedId(expanded ? null : n.id)}
                      className="flex-1 text-left px-4 py-3 flex items-center justify-between hover:bg-purple-50/50 transition">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{n.titulo}</p>
                        <p className="text-xs text-gray-400">{n.fecha} · hace {diasNota} días</p>
                        {!expanded && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.contenido.slice(0, 150)}{n.contenido.length > 150 ? "..." : ""}</p>}
                      </div>
                      <span className="text-gray-400 text-xs ml-2 shrink-0">{expanded ? "▲" : "▼"}</span>
                    </button>
                    <button onClick={() => { if (confirm("¿Eliminar esta nota?")) eliminarNota(n.id); }}
                      className="px-3 py-2 text-red-400 hover:text-red-600 text-xs font-semibold transition shrink-0">
                      🗑️
                    </button>
                  </div>
                  {expanded && (
                    <div className="px-4 pb-4">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-lg p-3 max-h-96 overflow-y-auto">{n.contenido}</pre>
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
