import { useState, useMemo } from "react";

const BRAND_GRADIENT = "linear-gradient(135deg,#00897B 0%,#00BCD4 100%)";
const BRAND_COLOR     = "#00897B";

const SK_NOTAS           = "pibox_cv_notas";
const SK_TAREAS          = "pibox_cv_tareas";
const SK_MEETINGS        = "pibox_cv_meetings";
const SK_HIDDEN_MEETINGS = "pibox_cv_hidden_meetings";

const CLIENT_EMAILS = [
  "jhon.potier@cruzverde.com.co",
  "blanca.almanza@cruzverde.com.co",
  "ivan.agreda@cruzverde.com.co",
  "juan.romero@cruzverde.com.co",
  "cromero@pibox.app",
  "nolivera@pibox.app",
  "mrincon@pibox.app",
  "gestorcomercial@pibox.app",
];

const BUILTIN_MEETINGS = [
  { fecha: "2026-06-23", label: "23 jun 2026", docId: "1BmuFi2xuCSY93E6rkf1AOdUovDBdnMvOc0iKSJM842A" },
  { fecha: "2026-06-17", label: "17 jun 2026", docId: "1u63nfsirhRXHmsxs-qvdcNNqyc0pmxbTdraZzaTt3xQ" },
  { fecha: "2026-06-10", label: "10 jun 2026", docId: "17XHdgpzMcxv8iXYxZ--VeGqG6bJkziKC3YeP82TXMjE" },
  { fecha: "2026-06-02", label: "2 jun 2026",  docId: "1fWfvaRSx1KP3paF3KZ4am9Z6Ijn5LG1mgfyCdKR5pnQ" },
  { fecha: "2026-05-26", label: "26 may 2026", docId: "1lyo2UdzrjP-mP6KvGF4xwkZG0MueR1m9GkA3GbQNbAE" },
  { fecha: "2026-05-21", label: "21 may 2026", docId: "1iYUxZ7KoK75neoMjBlS-UjVYCpodlLENd2v55f0p-Ts" },
  { fecha: "2026-05-12", label: "12 may 2026", docId: "1rKPw2-GaWYxJmCPSNf6tvk9AuC4Y9vl4vgNeI1WnjKI" },
  { fecha: "2026-05-05", label: "5 may 2026",  docId: "105myGXYNye-jK8wWLrVjAMdDUWTSYK00W-bj4aegEjI" },
  { fecha: "2026-04-28", label: "28 abr 2026", docId: "18uaNrBdQCrsId14mHv8mNPNFK-ZKVMWbC_pp8044IeA" },
  { fecha: "2026-04-21", label: "21 abr 2026", docId: "1tA5TV4ZigUizle-SaXRWd432R9ci6__crlgABIEfYc8" },
  { fecha: "2026-04-14", label: "14 abr 2026", docId: "1VN_jdI4n3SWyAZa7pBkd4rvPJyATN45uqVov0w2Kql0" },
  { fecha: "2026-04-07", label: "7 abr 2026",  docId: "1dZWbH9My_d8QZAMfsvkQpvTOdfuJSQYXb0vk773louM" },
  { fecha: "2026-03-31", label: "31 mar 2026", docId: "1n7iqtn6FO0aO84sxJMF0EFvSSVEBdk2sAoLz59SUJho" },
  { fecha: "2026-03-24", label: "24 mar 2026", docId: "10XxmuI3FRYcz4z0Z9OfLfEP39-9-xWDNWeos5k73RPM" },
  { fecha: "2026-03-17", label: "17 mar 2026", docId: "1puNtZYi4kxcNFM_PawjRB22gAiLcAa-hW-GUffh5hTU" },
  { fecha: "2026-03-10", label: "10 mar 2026", docId: "1FnDWi6-VgGmLjUXv5RoBRSNywtcHKvfNg48pNZwbEm0" },
  { fecha: "2026-02-24", label: "24 feb 2026", docId: "1cB7PBWZRdBb4XeZbYfdxc3zIaiSpsGd-REgUxGPBhaY" },
];

function extractDocId(url) {
  const m = String(url).match(/\/document\/d\/([\w-]+)/);
  return m ? m[1] : null;
}

function loadHiddenMeetings() {
  try { return new Set(JSON.parse(localStorage.getItem(SK_HIDDEN_MEETINGS) || "[]")); }
  catch { return new Set(); }
}
function saveHiddenMeetings(set) {
  localStorage.setItem(SK_HIDDEN_MEETINGS, JSON.stringify([...set]));
}

function loadMeetings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SK_MEETINGS) || "[]");
    const hidden = loadHiddenMeetings();
    const byFecha = {};
    for (const m of BUILTIN_MEETINGS) byFecha[m.fecha] = m;
    for (const m of stored) byFecha[m.fecha] = m;
    return Object.values(byFecha)
      .filter(m => !hidden.has(m.fecha))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  } catch { return BUILTIN_MEETINGS; }
}
function saveMeetings(list) {
  const builtinFechas = new Set(BUILTIN_MEETINGS.map(m => m.fecha));
  const extra = list.filter(m => !builtinFechas.has(m.fecha));
  localStorage.setItem(SK_MEETINGS, JSON.stringify(extra));
}

function loadNotas()  { try { return JSON.parse(localStorage.getItem(SK_NOTAS)  || "[]"); } catch { return []; } }
function saveNotas(n) { localStorage.setItem(SK_NOTAS,  JSON.stringify(n)); }
function loadTareas()  { try { return JSON.parse(localStorage.getItem(SK_TAREAS) || "[]"); } catch { return []; } }
function saveTareas(t) { localStorage.setItem(SK_TAREAS, JSON.stringify(t)); }

function uid()   { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function today() { return new Date().toISOString().slice(0, 10); }

async function extractPdfText(file) {
  const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const allLines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
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

function esCabeceraPasos(rawLine) {
  const lower = rawLine.replace(/^[\s•●·\-\*>☐✓✗✔☐☑☒·\d\.\)\(📌🗒️]+/, "").trim().toLowerCase();
  return lower.startsWith("próximos pasos") || lower.startsWith("proximos pasos") ||
    lower.startsWith("elementos de acción") || lower.startsWith("elementos de accion") ||
    lower.startsWith("action items") || lower.startsWith("acciones a tomar") ||
    lower.startsWith("next steps") || lower.startsWith("acciones pendientes") ||
    lower.startsWith("pasos siguientes") || lower.startsWith("compromisos") ||
    lower === "tareas" || lower === "pendientes";
}

function parsearLineaTarea(raw) {
  let l = raw.replace(/^[\s•●·\-\*>☐✓✗✔☐☑☒]+/, "").trim();
  l = l.replace(/^\d+[\.\)]\s+/, "").trim();
  if (!l || l.length < 5) return null;
  const m1 = l.match(/^\[([^\]]{2,50})\]\s+(.+)/);
  if (m1) return { responsable: m1[1].trim(), tarea: m1[2].trim() };
  const m2 = l.match(/^(.+?)\s*[—–]+\s*Responsable:\s*(.+?)(?:\s*\(\d+.*?)?\s*$/i);
  if (m2) return { responsable: m2[2].trim(), tarea: m2[1].trim() };
  const m3 = l.match(/^([A-ZÁÉÍÓÚÑ][^:]{1,39}):\s+(.{5,})/);
  if (m3 && !m3[1].toLowerCase().includes("http") && !m3[1].toLowerCase().includes("www"))
    return { responsable: m3[1].trim(), tarea: m3[2].trim() };
  return null;
}

function parsearLineaTareaEstricto(raw) {
  let l = raw.replace(/^[\s•●·\-\*>☐✓✗✔☐☑☒]+/, "").replace(/^\d+[\.\)]\s+/, "").trim();
  if (!l || l.length < 5) return null;
  const m1 = l.match(/^\[([^\]]{2,50})\]\s+(.+)/);
  if (m1) return { responsable: m1[1].trim(), tarea: m1[2].trim() };
  const m2 = l.match(/^(.+?)\s*[—–]+\s*Responsable:\s*(.+?)(?:\s*\(\d+.*?)?\s*$/i);
  if (m2) return { responsable: m2[2].trim(), tarea: m2[1].trim() };
  return null;
}

function parseGeminiNotes(text) {
  const lines = text.split("\n");
  let titulo = "WEEKLY CRUZ VERDE/PIBOX";
  let fecha = today();
  for (const l of lines.slice(0, 10)) {
    const dateMatch = l.match(/(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+(\d{1,2}),?\s*(\d{4})/i);
    if (dateMatch) {
      const meses = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
      const m = meses[dateMatch[1].slice(0, 3).toLowerCase()];
      if (m) fecha = `${dateMatch[3]}-${String(m).padStart(2, "0")}-${String(dateMatch[2]).padStart(2, "0")}`;
    }
    const lower = l.toLowerCase();
    if (lower.includes("cruz verde") || lower.includes("weekly")) titulo = l.trim();
  }
  const sections = { resumen: "", pasos: "", detalles: "" };
  let currentSection = "header";
  const pasosLines = [];
  for (const l of lines) {
    const rawTrimmed = l.trim();
    const lower = rawTrimmed.toLowerCase();
    if (lower === "resumen" || lower === "summary") { currentSection = "resumen"; continue; }
    if (esCabeceraPasos(rawTrimmed)) { currentSection = "pasos"; continue; }
    if (lower === "detalles" || lower === "details") { currentSection = "detalles"; continue; }
    if (currentSection === "resumen") sections.resumen += l + "\n";
    if (currentSection === "pasos") pasosLines.push(l);
    if (currentSection === "detalles") sections.detalles += l + "\n";
  }

  let tareas = [];
  let currentTask = null;
  for (const l of pasosLines) {
    const parsed = parsearLineaTarea(l);
    if (parsed) {
      if (currentTask) tareas.push(currentTask);
      currentTask = parsed;
    } else if (currentTask && l.trim()) {
      currentTask.tarea += " " + l.trim();
    }
  }
  if (currentTask) tareas.push(currentTask);

  if (tareas.length === 0) {
    for (const l of lines) {
      const parsed = parsearLineaTareaEstricto(l);
      if (parsed) tareas.push(parsed);
    }
  }

  const contenido = (sections.resumen.trim() ? "RESUMEN:\n" + sections.resumen.trim() : "") +
    (sections.detalles.trim() ? "\n\nDETALLES:\n" + sections.detalles.trim() : "");
  const rawPasosLines = pasosLines.length > 0 ? pasosLines : lines;
  return { titulo, fecha, contenido, tareas, rawPasosLines };
}

export default function NotasTareasCruzVerde({ isAdmin = false }) {
  /* ── Reuniones Cruz Verde ───────────────────────────────────────────── */
  const [meetings, setMeetings] = useState(loadMeetings);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [newMeetingUrl, setNewMeetingUrl] = useState("");
  const [newMeetingFecha, setNewMeetingFecha] = useState(today);
  const [newMeetingLabel, setNewMeetingLabel] = useState("");
  const [addMeetingErr, setAddMeetingErr] = useState("");

  const selectedMeeting = meetings[selectedIdx] || null;

  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [rawPasosText, setRawPasosText] = useState("");
  const [manualTareasText, setManualTareasText] = useState("");

  function deleteMeeting(fecha) {
    const hidden = loadHiddenMeetings();
    hidden.add(fecha);
    saveHiddenMeetings(hidden);
    const next = meetings.filter(m => m.fecha !== fecha);
    saveMeetings(next);
    setMeetings(next);
    setSelectedIdx(prev => {
      const removedIdx = meetings.findIndex(m => m.fecha === fecha);
      if (removedIdx < prev) return prev - 1;
      if (removedIdx === prev) return Math.max(0, prev - 1);
      return prev;
    });
    if (showImport) { setShowImport(false); setImportMsg(""); }
  }

  function importarDesdeTextoManual() {
    const lines = manualTareasText.split("\n").map(l => l.trim()).filter(Boolean);
    const nuevas = [];
    for (const l of lines) {
      const parsed = parsearLineaTarea(l);
      if (parsed) {
        nuevas.push({ id: uid(), tarea: parsed.tarea, responsable: parsed.responsable, fechaLimite: "", completada: false, creadoEn: new Date().toISOString() });
      } else {
        nuevas.push({ id: uid(), tarea: l, responsable: "", fechaLimite: "", completada: false, creadoEn: new Date().toISOString() });
      }
    }
    if (!nuevas.length) return;
    setTareas(prev => {
      const next = [...nuevas, ...prev.filter(t => !t.completada), ...prev.filter(t => t.completada)];
      saveTareas(next);
      return next;
    });
    setImportMsg(`✅ ${nuevas.length} tareas agregadas al tablero.`);
    setManualTareasText("");
    setRawPasosText("");
  }

  async function handleMeetingPdfUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true); setImportMsg(""); setRawPasosText(""); setManualTareasText("");
    try {
      const text = await extractPdfText(file);
      const parsed = parseGeminiNotes(text);
      setTitulo(parsed.titulo || selectedMeeting?.label || "WEEKLY CRUZ VERDE/PIBOX");
      setFecha(parsed.fecha || selectedMeeting?.fecha || today());
      if (parsed.contenido) setContenido(parsed.contenido);
      if (parsed.tareas.length > 0) {
        const newTareas = parsed.tareas.map(t => ({
          id: uid(), tarea: t.tarea, responsable: t.responsable,
          fechaLimite: "", completada: false, creadoEn: new Date().toISOString(),
        }));
        setTareas(prev => {
          const pendientes = prev.filter(t => !t.completada);
          const completadas = prev.filter(t => t.completada);
          const next = [...newTareas, ...pendientes, ...completadas];
          saveTareas(next);
          return next;
        });
        setImportMsg(`✅ ${parsed.tareas.length} tareas importadas al tablero.`);
      } else {
        const rawLines = parsed.rawPasosLines || [];
        const raw = rawLines.join("\n");
        setRawPasosText(raw);
        setManualTareasText(raw);
        const seccionEncontrada = rawLines.length > 0 && rawLines.length < (text.split("\n").length - 5);
        setImportMsg(seccionEncontrada
          ? `⚠️ Sección encontrada (${rawLines.length} líneas) pero no se reconoció el formato de tareas — edita el texto abajo y haz clic en 'Agregar tareas'.`
          : "⚠️ No se detectó la sección de próximos pasos — el texto completo del PDF se muestra abajo. Deja sólo las tareas, una por línea (formato: [Responsable] tarea), y haz clic en 'Agregar tareas'.");
      }
    } catch (err) {
      setImportMsg("❌ Error al leer PDF: " + err.message);
    }
    setImportLoading(false);
    e.target.value = "";
  }

  function addMeeting() {
    setAddMeetingErr("");
    const docId = extractDocId(newMeetingUrl);
    if (!docId) { setAddMeetingErr("URL inválida — pega el link de Google Docs"); return; }
    if (!newMeetingFecha) { setAddMeetingErr("Selecciona la fecha de la reunión"); return; }
    const label = newMeetingLabel.trim() || newMeetingFecha.split("-").reverse().join("/");
    const nuevo = { fecha: newMeetingFecha, label, docId };
    const next = [nuevo, ...meetings].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const newIdx = next.findIndex(m => m.fecha === nuevo.fecha && m.docId === docId);
    setMeetings(next);
    saveMeetings(next);
    setSelectedIdx(newIdx >= 0 ? newIdx : 0);
    setNewMeetingUrl("");
    setNewMeetingLabel("");
    setNewMeetingFecha(today());
    setShowAddMeeting(false);
  }

  /* ── Notas ──────────────────────────────────────────────────────────── */
  const [notas, setNotas] = useState(loadNotas);
  const [titulo, setTitulo] = useState("WEEKLY CRUZ VERDE/PIBOX");
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
      if (parsed.tareas.length > 0) {
        const newTareas = parsed.tareas.map(t => ({
          id: uid(), tarea: t.tarea, responsable: t.responsable,
          fechaLimite: "", completada: false, creadoEn: new Date().toISOString(),
        }));
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
    setTitulo("WEEKLY CRUZ VERDE/PIBOX");
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
  const [filtro, setFiltro] = useState("todas");
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
    let cuerpo = `Reporte de tareas - WEEKLY CRUZ VERDE/PIBOX\nFecha: ${fechaHoy}\n`;
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
    const subject = encodeURIComponent(`Reporte de tareas - WEEKLY CRUZ VERDE/PIBOX - ${fechaHoy}`);
    const body = encodeURIComponent(cuerpo);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Reuniones Cruz Verde / Pibox ─────────────────────────────── */}
      {isAdmin && <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 text-white font-bold text-sm flex items-center justify-between" style={{ background: BRAND_GRADIENT }}>
          <span>📅 WEEKLY CRUZ VERDE/PIBOX — Notas de Gemini</span>
          <button
            onClick={() => { setShowAddMeeting(v => !v); setAddMeetingErr(""); }}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1 rounded-lg transition">
            {showAddMeeting ? "✕ Cancelar" : "+ Agregar reunión"}
          </button>
        </div>
        <div className="p-5 space-y-4">

          {showAddMeeting && (
            <div className="border border-teal-200 bg-teal-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-teal-700">Nueva reunión — pega el link de Google Docs de Gemini</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha</label>
                  <input type="date" value={newMeetingFecha} onChange={e => setNewMeetingFecha(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">URL de Google Docs (Notas de Gemini)</label>
                  <input value={newMeetingUrl} onChange={e => setNewMeetingUrl(e.target.value)}
                    placeholder="https://docs.google.com/document/d/..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none" />
                </div>
              </div>
              {addMeetingErr && <p className="text-xs text-red-500">{addMeetingErr}</p>}
              <button onClick={addMeeting}
                className="px-5 py-2 rounded-lg text-white text-sm font-semibold shadow transition"
                style={{ background: BRAND_COLOR }}>
                Guardar reunión
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {meetings.map((m, i) => (
              <div key={m.fecha + m.docId} className="group relative inline-flex">
                <button
                  onClick={() => setSelectedIdx(i)}
                  className={`pl-3 pr-7 py-1.5 rounded-full text-xs font-semibold transition border ${
                    i === selectedIdx
                      ? "text-white border-transparent shadow"
                      : "text-gray-500 bg-gray-50 border-gray-200 hover:border-teal-300 hover:text-teal-700"
                  }`}
                  style={i === selectedIdx ? { background: BRAND_COLOR } : {}}>
                  {m.label}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteMeeting(m.fecha); }}
                  title="Eliminar reunión"
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold leading-none opacity-0 group-hover:opacity-100 transition-opacity ${
                    i === selectedIdx
                      ? "bg-white/30 hover:bg-white/50 text-white"
                      : "bg-gray-200 hover:bg-red-100 text-gray-500 hover:text-red-600"
                  }`}>
                  ×
                </button>
              </div>
            ))}
          </div>

          {selectedMeeting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">
                  Notas de Gemini — reunión del {selectedMeeting.label}
                </span>
                <a
                  href={`https://docs.google.com/document/d/${selectedMeeting.docId}/edit`}
                  target="_blank" rel="noreferrer"
                  className="text-xs font-semibold hover:opacity-80 transition flex items-center gap-1"
                  style={{ color: BRAND_COLOR }}>
                  Abrir en Google Docs ↗
                </a>
              </div>
              <iframe
                key={selectedMeeting.docId}
                src={`https://docs.google.com/document/d/${selectedMeeting.docId}/preview`}
                className="w-full rounded-xl border border-gray-200"
                style={{ height: "480px" }}
                title={`Notas Gemini ${selectedMeeting.label}`}
              />

              <div className="mt-3 border-t border-gray-100 pt-3">
                {!showImport ? (
                  <button onClick={() => { setShowImport(true); setImportMsg(""); }}
                    className="px-4 py-2 rounded-lg text-white text-sm font-semibold shadow transition"
                    style={{ background: BRAND_GRADIENT }}>
                    📥 Importar notas y tareas al tablero
                  </button>
                ) : (
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-teal-700">
                      Descarga el PDF de esta reunión y súbelo para extraer las tareas automáticamente:
                    </p>
                    <div className="flex flex-wrap gap-3 items-center">
                      <a
                        href={`https://docs.google.com/document/d/${selectedMeeting.docId}/export?format=pdf`}
                        target="_blank" rel="noreferrer"
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-teal-700 bg-white border border-teal-300 hover:bg-teal-100 transition flex items-center gap-1">
                        ⬇️ Descargar PDF de esta reunión
                      </a>
                      <label className="px-4 py-2 rounded-lg text-white text-xs font-semibold shadow cursor-pointer transition flex items-center gap-2"
                        style={{ background: BRAND_COLOR }}>
                        {importLoading ? "Procesando..." : "📄 Subir PDF"}
                        <input type="file" accept=".pdf" className="hidden" onChange={handleMeetingPdfUpload} disabled={importLoading} />
                      </label>
                      <button onClick={() => { setShowImport(false); setImportMsg(""); }}
                        className="text-xs text-gray-400 hover:text-gray-600 transition">
                        Cancelar
                      </button>
                    </div>
                    {importMsg && (
                      <p className={`text-xs font-medium ${importMsg.startsWith("✅") ? "text-green-600" : importMsg.startsWith("⚠️") ? "text-orange-600" : "text-red-500"}`}>
                        {importMsg}
                      </p>
                    )}
                    {(rawPasosText !== "" || (!importMsg.startsWith("✅") && importMsg.startsWith("⚠️"))) && (
                      <div className="space-y-2 mt-2">
                        <p className="text-xs text-gray-500">
                          Una tarea por línea. Formato opcional: <code className="bg-gray-100 px-1 rounded">Responsable: descripción</code>
                        </p>
                        <textarea
                          value={manualTareasText}
                          onChange={e => setManualTareasText(e.target.value)}
                          rows={6}
                          placeholder={"Liliana: Revisar cifras de puntualidad\nCamilo: Enviar reporte actualizado\nIván: Confirmar estrategia piloto"}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-teal-300 outline-none resize-y"
                        />
                        <button
                          onClick={importarDesdeTextoManual}
                          disabled={!manualTareasText.trim()}
                          className="px-4 py-2 rounded-lg text-white text-xs font-semibold shadow transition disabled:opacity-40"
                          style={{ background: BRAND_COLOR }}>
                          ✅ Agregar tareas al tablero
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>}

      {/* ── Agregar Nota ─────────────────────────────────────────────── */}
      {isAdmin && <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 text-white font-bold text-sm" style={{ background: BRAND_GRADIENT }}>
          📝 Agregar Nota
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Título</label>
              <input value={titulo} onChange={e => setTitulo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Contenido de la nota</label>
            <textarea value={contenido} onChange={e => setContenido(e.target.value)} rows={6}
              placeholder="Pega aquí las notas de Gemini u otra fuente..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none resize-y" />
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
                style={{ background: BRAND_COLOR }}>
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
      </div>}

      {/* ── Tablero de Tareas ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 text-white font-bold text-sm flex items-center justify-between" style={{ background: BRAND_GRADIENT }}>
          <span>✅ Tablero de Tareas</span>
          <div className="flex gap-2">
            <button onClick={enviarReporte}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1 rounded-lg transition"
              title="Enviar reporte por email al equipo Cruz Verde">
              📧 Enviar reporte
            </button>
            <button onClick={() => setShowNewTask(v => !v)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1 rounded-lg transition">
              + Nueva tarea
            </button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {showNewTask && (
            <div className="border border-teal-200 bg-teal-50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
                  <input value={newTarea} onChange={e => setNewTarea(e.target.value)} placeholder="Descripción de la tarea..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Responsable</label>
                  <input value={newResp} onChange={e => setNewResp(e.target.value)} placeholder="Nombre..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none" />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha límite</label>
                  <input type="date" value={newFechaLim} onChange={e => setNewFechaLim(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none" />
                </div>
                <button onClick={agregarTarea} disabled={!newTarea.trim()}
                  className="px-4 py-2 rounded-lg text-white text-sm font-semibold shadow transition disabled:opacity-40"
                  style={{ background: BRAND_COLOR }}>
                  Agregar
                </button>
                <button onClick={() => setShowNewTask(false)}
                  className="px-4 py-2 rounded-lg text-gray-500 text-sm hover:bg-gray-100 transition">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {[["todas", "Todas"], ["pendientes", "Pendientes"], ["completadas", "Completadas"]].map(([k, l]) => (
              <button key={k} onClick={() => setFiltro(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filtro === k ? "text-white shadow" : "text-gray-500 hover:bg-teal-50"}`}
                style={filtro === k ? { background: BRAND_COLOR } : {}}>
                {l}
              </button>
            ))}
          </div>

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
                            className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: BRAND_COLOR }} />
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
                      className="flex-1 text-left px-4 py-3 flex items-center justify-between hover:bg-teal-50/50 transition">
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
