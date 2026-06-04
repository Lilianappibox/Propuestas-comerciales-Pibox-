import { useState, useEffect } from "react";
import { TARIFAS_DEFAULT, MODULOS_CONFIG } from "./data/tarifas";
import { loadUsers, saveUsers, getPermisos, ROLES } from "./data/users";
import { loadTemplate, saveTemplate, loadHistory, saveHistory, addHistoryEntry } from "./data/templateTexts";
import PropuestaPreview from "./components/PropuestaPreview";
import TarifasEditor from "./components/TarifasEditor";
import UserManager from "./components/UserManager";
import TemplateEditor from "./components/TemplateEditor";
import Login from "./components/Login";
import PropuestasSaved, { loadSaved, storeSaved } from "./components/PropuestasSaved";
import "./App.css";

const SK_TARIFAS   = "pibox_tarifas";
const SK_PROPUESTA = "pibox_propuesta_draft";
const SK_SESSION   = "pibox_session";
const SK_MODULOS   = "pibox_modulos_draft";

const TAB_BUILDER  = "builder";
const TAB_PREVIEW  = "preview";
const TAB_TARIFARIO= "tarifario";
const TAB_PLANTILLA= "plantilla";
const TAB_SAVED    = "saved";
const TAB_USUARIOS = "usuarios";

const ROLE_COLORS = { [ROLES.ADMIN]: "bg-purple-100 text-purple-700", [ROLES.KAM]: "bg-blue-100 text-blue-700" };
const ROLE_ICONS  = { [ROLES.ADMIN]: "🛡️", [ROLES.KAM]: "💼" };

const INITIAL_MODULOS = {
  onDemand: true, programadoBloqueHoras: false, programadoRutas: false,
  picarga: false, storage: false, adnTecnologico: true,
  terminosCondiciones: true, cobertura: true,
};

function loadTarifas() {
  try {
    const s = localStorage.getItem(SK_TARIFAS);
    if (!s) return JSON.parse(JSON.stringify(TARIFAS_DEFAULT));
    const saved = JSON.parse(s);
    // Ensure storage exists (new field)
    if (!saved.storage) saved.storage = JSON.parse(JSON.stringify(TARIFAS_DEFAULT.storage));
    return saved;
  } catch { return JSON.parse(JSON.stringify(TARIFAS_DEFAULT)); }
}

function loadPropuesta() {
  try {
    const s = localStorage.getItem(SK_PROPUESTA);
    const base = { cliente: "", ciudad: "", fecha: new Date().toISOString().slice(0,10), contacto: "", email: "", notas: "" };
    return s ? { ...base, ...JSON.parse(s) } : base;
  } catch { return { cliente: "", ciudad: "", fecha: new Date().toISOString().slice(0,10), contacto: "", email: "", notas: "" }; }
}

function loadModulos() {
  try {
    const s = localStorage.getItem(SK_MODULOS);
    return s ? { ...INITIAL_MODULOS, ...JSON.parse(s) } : { ...INITIAL_MODULOS };
  } catch { return { ...INITIAL_MODULOS }; }
}

export default function App() {
  const [users, setUsers]             = useState(loadUsers);
  const [currentUser, setCurrentUser] = useState(() => {
    try { const s = localStorage.getItem(SK_SESSION); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const [tab, setTab]               = useState(TAB_BUILDER);
  const [propuesta, setPropuesta]   = useState(loadPropuesta);
  const [tarifas, setTarifas]       = useState(loadTarifas);
  const [template, setTemplate]     = useState(loadTemplate);
  const [history, setHistory]       = useState(loadHistory);
  const [modulos, setModulos]       = useState(loadModulos);
  const [saved, setSaved]           = useState(loadSaved);
  const [exportingPdf, setExportingPdf]   = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [savedMsg, setSavedMsg]     = useState("");

  const permisos = currentUser ? getPermisos(currentUser) : {};

  // Auto-save drafts
  useEffect(() => { localStorage.setItem(SK_PROPUESTA, JSON.stringify(propuesta)); }, [propuesta]);
  useEffect(() => { localStorage.setItem(SK_TARIFAS, JSON.stringify(tarifas)); }, [tarifas]);
  useEffect(() => { localStorage.setItem(SK_MODULOS, JSON.stringify(modulos)); }, [modulos]);
  useEffect(() => {
    if (currentUser) localStorage.setItem(SK_SESSION, JSON.stringify(currentUser));
    else localStorage.removeItem(SK_SESSION);
  }, [currentUser]);

  const toast = (msg) => { setSavedMsg(msg); setTimeout(() => setSavedMsg(""), 3000); };

  const handleLogin = (user) => { setCurrentUser(user); setTab(TAB_BUILDER); };
  const handleLogout = () => { setCurrentUser(null); setTab(TAB_BUILDER); };

  const handleSaveUsers = (updated) => {
    setUsers(updated); saveUsers(updated);
    // Refresca la sesión del usuario actual para que los nuevos permisos apliquen al instante
    if (currentUser) {
      const r = updated.find((u) => u.id === currentUser.id);
      if (r && r.activo) { setCurrentUser(r); localStorage.setItem(SK_SESSION, JSON.stringify(r)); }
      else handleLogout();
    }
    toast("✓ Usuarios guardados");
  };

  const handleSaveTemplate = (newTexts, camposDirty, oldTexts) => {
    let h = [...history];
    camposDirty.forEach((c) => { h = addHistoryEntry(h, currentUser.id, currentUser.nombre, c.id, oldTexts[c.id], newTexts[c.id]); });
    setTemplate(newTexts); saveTemplate(newTexts);
    setHistory(h); saveHistory(h);
    toast(`✓ Plantilla actualizada (${camposDirty.length} campo${camposDirty.length > 1 ? "s" : ""})`);
  };

  // ── Saved proposals ──────────────────────────────────────
  const handleSaveProposal = () => {
    const id = Date.now().toString(36);
    const now = new Date().toISOString();
    const modulosLabel = MODULOS_CONFIG.filter((m) => modulos[m.id]).map((m) => m.emoji).join(" ");
    const entry = {
      id, userId: currentUser.id, userName: currentUser.nombre,
      clienteNombre: propuesta.cliente || "Sin nombre",
      ciudadCliente: propuesta.ciudad,
      nombre: propuesta.cliente,
      modulosLabel,
      estado: "borrador",
      fechaCreacion: now, fechaModificacion: now,
      propuesta: { ...propuesta },
      modulos: { ...modulos },
      tarifasSnapshot: JSON.parse(JSON.stringify(tarifas)),
      templateSnapshot: JSON.parse(JSON.stringify(template)),
    };
    const updated = [entry, ...saved];
    setSaved(updated); storeSaved(updated);
    toast("✓ Propuesta guardada");
  };

  const handleLoadProposal = (p) => {
    setPropuesta(p.propuesta);
    setModulos(p.modulos);
    setTarifas(p.tarifasSnapshot);
    setTemplate(p.templateSnapshot);
    setTab(TAB_BUILDER);
    toast(`📂 Cargada: ${p.clienteNombre}`);
  };

  const handleDuplicateProposal = (p) => {
    const now = new Date().toISOString();
    const copy = { ...p, id: Date.now().toString(36), fechaCreacion: now, fechaModificacion: now, estado: "borrador",
      clienteNombre: `${p.clienteNombre} (copia)`, propuesta: { ...p.propuesta, cliente: `${p.propuesta.cliente} (copia)` } };
    const updated = [copy, ...saved];
    setSaved(updated); storeSaved(updated);
    toast("📋 Propuesta duplicada");
  };

  const handleDeleteProposal = (id) => {
    const updated = saved.filter((p) => p.id !== id);
    setSaved(updated); storeSaved(updated);
    toast("🗑️ Propuesta eliminada");
  };

  const handleEstadoProposal = (id, estado) => {
    const updated = saved.map((p) => p.id === id ? { ...p, estado, fechaModificacion: new Date().toISOString() } : p);
    setSaved(updated); storeSaved(updated);
    toast(`✓ Estado actualizado: ${estado}`);
  };

  const handleExportPdf = () => {
    setExportingPdf(true);
    setTimeout(() => { window.print(); setExportingPdf(false); }, 200);
  };

  const handleExportWord = async () => {
    setExportingWord(true);
    try {
      const { exportToWord } = await import("./utils/exportWord");
      await exportToWord(propuesta, tarifas, modulos, template, currentUser);
    } catch (e) { alert("Error al exportar Word: " + e.message); }
    setExportingWord(false);
  };

  if (!currentUser) return <Login users={users} onLogin={handleLogin} />;

  const modulosActivos = MODULOS_CONFIG.filter((m) => modulos[m.id]).length;

  const navTabs = [
    { id: TAB_BUILDER,   label: "✏️ Propuesta",   visible: true },
    { id: TAB_PREVIEW,   label: "👁️ Vista Previa", visible: true },
    { id: TAB_SAVED,     label: "📁 Mis Propuestas",visible: true },
    { id: TAB_TARIFARIO, label: "📊 Tarifario",    visible: permisos.verTarifario },
    { id: TAB_PLANTILLA, label: "📝 Plantilla",    visible: permisos.editarPlantilla },
    { id: TAB_USUARIOS,  label: "👥 Usuarios",     visible: permisos.gestionarUsuarios },
  ].filter((t) => t.visible);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Topbar */}
      <header className="bg-blue-800 text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-2xl font-black tracking-tight">PIBOX</div>
            <div className="text-blue-300 text-sm hidden sm:block">Tablero Comercial</div>
          </div>
          <nav className="flex items-center gap-1 flex-1 justify-center flex-wrap">
            {navTabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  tab === t.id ? "bg-white text-blue-800" : "text-blue-200 hover:bg-blue-700"}`}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold leading-tight">{currentUser.nombre}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[currentUser.rol]}`}>
                {ROLE_ICONS[currentUser.rol]} {currentUser.rol}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-white text-blue-800 font-bold flex items-center justify-center text-sm shrink-0">
              {currentUser.nombre.charAt(0).toUpperCase()}
            </div>
            <button onClick={handleLogout} className="text-blue-200 hover:text-white text-xs px-2 py-1 rounded hover:bg-blue-700">Salir</button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {savedMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium print:hidden">
          {savedMsg}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 print:p-0 print:max-w-none">

        {/* ── BUILDER ── */}
        {tab === TAB_BUILDER && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">

              {/* Datos del cliente */}
              <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
                <h2 className="font-bold text-gray-800 mb-4 text-base flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 rounded-lg p-1">🏢</span> Datos del Cliente
                </h2>
                <div className="space-y-3">
                  {[
                    { label: "Empresa / Cliente *", field: "cliente", placeholder: "Ej: OUR Family SAS" },
                    { label: "Contacto (persona)",  field: "contacto", placeholder: "Ej: María González" },
                    { label: "Correo electrónico",  field: "email",    placeholder: "contacto@empresa.com", type: "email" },
                    { label: "Ciudad",              field: "ciudad",   placeholder: "Ej: Bogotá, Medellín..." },
                  ].map(({ label, field, placeholder, type = "text" }) => (
                    <div key={field}>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</label>
                      <input type={type} placeholder={placeholder} value={propuesta[field]}
                        onChange={(e) => setPropuesta((p) => ({ ...p, [field]: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Fecha</label>
                    <input type="date" value={propuesta.fecha}
                      onChange={(e) => setPropuesta((p) => ({ ...p, fecha: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
              </div>

              {/* Tu perfil como KAM */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                  💼 Tu firma en la propuesta
                </p>
                <p className="text-sm font-bold text-gray-800">{currentUser.nombre}</p>
                {currentUser.cargo && <p className="text-xs text-gray-600">{currentUser.cargo}</p>}
                <p className="text-xs text-gray-600">{currentUser.email}</p>
                {currentUser.celular && <p className="text-xs text-gray-600">📱 {currentUser.celular}</p>}
                <p className="text-xs text-blue-500 mt-2 cursor-pointer hover:underline"
                  onClick={() => { setTab(TAB_USUARIOS); }}>
                  Editar mis datos →
                </p>
              </div>

              {/* Módulos */}
              <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
                <h2 className="font-bold text-gray-800 mb-1 text-base flex items-center gap-2">
                  <span className="bg-green-100 text-green-700 rounded-lg p-1">🧩</span> Módulos
                </h2>
                <p className="text-xs text-gray-500 mb-4">{modulosActivos} módulo(s) seleccionado(s)</p>
                <div className="space-y-2">
                  {MODULOS_CONFIG.map((m) => (
                    <label key={m.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                        modulos[m.id] ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200 hover:border-gray-300"}`}>
                      <input type="checkbox" checked={modulos[m.id] || false}
                        onChange={() => setModulos((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                        className="mt-0.5 accent-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{m.label}</p>
                        <p className="text-xs text-gray-500">{m.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notas */}
              <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
                <h2 className="font-bold text-gray-800 mb-3 text-base flex items-center gap-2">
                  <span className="bg-yellow-100 text-yellow-700 rounded-lg p-1">📝</span> Notas de Negociación
                </h2>
                <textarea rows={5} value={propuesta.notas}
                  onChange={(e) => setPropuesta((p) => ({ ...p, notas: e.target.value }))}
                  placeholder="Condiciones especiales, descuentos, observaciones del cliente..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>

              {/* Acciones */}
              <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
                <h2 className="font-bold text-gray-800 mb-3 text-base flex items-center gap-2">
                  <span className="bg-purple-100 text-purple-700 rounded-lg p-1">⬇️</span> Exportar
                </h2>
                <div className="space-y-2">
                  <button onClick={() => setTab(TAB_PREVIEW)}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium">
                    👁️ Ver propuesta completa
                  </button>
                  <button onClick={handleExportPdf} disabled={exportingPdf}
                    className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                    {exportingPdf ? "Preparando PDF..." : "⬇️ Descargar PDF"}
                  </button>
                  <button onClick={handleExportWord} disabled={exportingWord}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                    {exportingWord ? "Generando Word..." : "⬇️ Descargar Word (.docx)"}
                  </button>
                  <button onClick={handleSaveProposal}
                    className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium">
                    💾 Guardar propuesta
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">Los datos se guardan automáticamente como borrador</p>
              </div>
            </div>

            {/* Preview panel */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Vista Previa</span>
                  <button onClick={() => setTab(TAB_PREVIEW)} className="text-xs text-blue-600 hover:underline">Ver completa →</button>
                </div>
                <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                  <div style={{ transform: "scale(0.75)", transformOrigin: "top left", width: "133.3%" }}>
                    <PropuestaPreview propuesta={propuesta} tarifas={tarifas} modulos={modulos} texts={template} currentUser={currentUser} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {tab === TAB_PREVIEW && (
          <div>
            <div className="flex items-center justify-between mb-4 print:hidden">
              <button onClick={() => setTab(TAB_BUILDER)} className="text-sm text-blue-600 hover:underline">← Volver al editor</button>
              <div className="flex gap-2">
                <button onClick={handleExportPdf} className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium">⬇️ PDF</button>
                <button onClick={handleExportWord} disabled={exportingWord} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                  {exportingWord ? "..." : "⬇️ Word"}
                </button>
                <button onClick={handleSaveProposal} className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium">💾 Guardar</button>
              </div>
            </div>
            <div className="bg-white shadow-xl rounded-xl overflow-hidden">
              <PropuestaPreview propuesta={propuesta} tarifas={tarifas} modulos={modulos} texts={template} currentUser={currentUser} />
            </div>
          </div>
        )}

        {/* ── MIS PROPUESTAS ── */}
        {tab === TAB_SAVED && (
          <PropuestasSaved
            saved={saved}
            currentUser={currentUser}
            onLoad={handleLoadProposal}
            onDuplicate={handleDuplicateProposal}
            onDelete={handleDeleteProposal}
            onEstado={handleEstadoProposal}
          />
        )}

        {/* ── TARIFARIO ── */}
        {tab === TAB_TARIFARIO && permisos.verTarifario && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Tarifario PIBOX 2026</h2>
                <p className="text-sm text-gray-500">Se guardan automáticamente. Agrega o elimina ciudades libremente.</p>
              </div>
              {permisos.editarTarifas && (
                <button onClick={() => { if (confirm("¿Restaurar tarifas por defecto?")) { setTarifas(JSON.parse(JSON.stringify(TARIFAS_DEFAULT))); toast("Tarifas restauradas"); } }}
                  className="text-sm text-red-500 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-50">
                  🔄 Restaurar
                </button>
              )}
            </div>
            {permisos.editarTarifas ? (
              <TarifasEditor tarifas={tarifas} onChange={(t) => { setTarifas(t); toast("✓ Tarifas guardadas"); }} />
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                <p className="text-yellow-700 font-medium">🔒 Solo el Administrativo puede editar las tarifas.</p>
              </div>
            )}
          </div>
        )}

        {/* ── PLANTILLA ── */}
        {tab === TAB_PLANTILLA && permisos.editarPlantilla && (
          <TemplateEditor texts={template} history={history} onSave={handleSaveTemplate} currentUser={currentUser} />
        )}

        {/* ── USUARIOS ── */}
        {tab === TAB_USUARIOS && permisos.gestionarUsuarios && (
          <UserManager users={users} onSave={handleSaveUsers} />
        )}
      </main>
    </div>
  );
}
